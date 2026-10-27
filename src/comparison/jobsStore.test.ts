import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "./types";

const session = {
  csrfToken: "token", csrfHeader: "X-CSRF-TOKEN", retentionHours: 24,
  user: { id: "account-1", email: "reader@example.com" },
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
const job = (id: string, status: Job["status"] = "COMPLETED"): Job => ({
  id, status, originalName: "a.pdf", revisedName: "b.pdf", originalSize: 1, revisedSize: 1,
  mode: "mixed", createdAt: "2026-10-27T00:00:00Z", progress: 100, pageCount: 1,
  changeCount: 0, error: null,
});

async function storeWith(...responses: Response[]) {
  const fetcher = vi.fn().mockResolvedValueOnce(response(session));
  for (const r of responses) fetcher.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fetcher);
  const { useJobs } = await import("./jobsStore");
  return { jobs: useJobs.getState, fetcher };
}

describe("jobs store", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("connects by loading the job list", async () => {
    const { jobs } = await storeWith(response([job("a"), job("b")]));
    await jobs().connect();
    expect(jobs().connected).toBe(true);
    expect(jobs().jobs.map((j) => j.id)).toEqual(["a", "b"]);
    expect(jobs().error).toBe("");
  });

  it("stays disconnected with the server message when the list fails, and reconnects later", async () => {
    const { jobs } = await storeWith(
      response({ message: "メンテナンス中です。" }, 503),
      response([job("a")]),
    );
    await jobs().connect();
    expect(jobs().connected).toBe(false);
    expect(jobs().error).toBe("メンテナンス中です。");
    await jobs().connect();
    expect(jobs().connected).toBe(true);
    expect(jobs().error).toBe("");
    expect(jobs().jobs).toHaveLength(1);
  });

  it("opens a job with its full detail", async () => {
    const detail = { ...job("a"), result: { pages: [], changes: [], warnings: [] } };
    const { jobs, fetcher } = await storeWith(response(detail));
    await expect(jobs().openJob(job("a"))).resolves.toBe(true);
    expect(fetcher.mock.calls[1][0]).toBe("/api/comparisons/a");
    expect(jobs().job).toEqual(detail);
    expect(jobs().loading).toBe(false);
  });

  it("keeps the current view when a job cannot be opened", async () => {
    const { jobs } = await storeWith(response({ message: "見つかりません。" }, 404));
    await expect(jobs().openJob(job("gone"))).resolves.toBe(false);
    expect(jobs().job).toBeNull();
    expect(jobs().error).toBe("見つかりません。");
  });

  it("deletes a job from the list and closes it when it was open", async () => {
    const { jobs, fetcher } = await storeWith(
      response([job("a"), job("b")]),
      response(job("a")),
      new Response(null, { status: 204 }),
    );
    await jobs().connect();
    await jobs().openJob(job("a"));
    await jobs().remove(job("a"));
    expect(fetcher.mock.calls[3][0]).toBe("/api/comparisons/a");
    expect(fetcher.mock.calls[3][1].method).toBe("DELETE");
    expect(jobs().jobs.map((j) => j.id)).toEqual(["b"]);
    expect(jobs().job).toBeNull();
  });

  it("starts a comparison, lists it first and opens it", async () => {
    const { jobs, fetcher } = await storeWith(response([job("old")]), response(job("new", "QUEUED"), 201));
    await jobs().connect();
    const pdf = (name: string) => new File(["%PDF-1.7\n"], name, { type: "application/pdf" });
    await expect(jobs().start({
      files: [pdf("a.pdf"), pdf("b.pdf")],
      options: { mode: "text", ignoreWhitespace: true, normalizeWidth: false },
    })).resolves.toBe(true);
    expect(fetcher.mock.calls[2][0]).toBe("/api/comparisons");
    expect(fetcher.mock.calls[2][1].body.get("mode")).toBe("text");
    expect(jobs().jobs.map((j) => j.id)).toEqual(["new", "old"]);
    expect(jobs().job?.id).toBe("new");
    expect(jobs().loading).toBe(false);
  });

  it("starts the demo comparison even before connecting", async () => {
    const { jobs, fetcher } = await storeWith(response(job("demo", "QUEUED"), 201));
    await expect(jobs().start("demo")).resolves.toBe(true);
    expect(fetcher.mock.calls[1][0]).toBe("/api/comparisons/demo");
    expect(jobs().connected).toBe(true);
    expect(jobs().job?.id).toBe("demo");
  });

  it("reports a comparison that could not be started", async () => {
    const { jobs } = await storeWith(response({ message: "上限に達しました。" }, 429));
    await expect(jobs().start("demo")).resolves.toBe(false);
    expect(jobs().job).toBeNull();
    expect(jobs().jobs).toEqual([]);
    expect(jobs().error).toBe("上限に達しました。");
  });
});
