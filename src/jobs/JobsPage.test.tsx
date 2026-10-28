import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Job } from "../comparison/types";
import { countByFilter, filterJobs } from "./filters";
import JobsPage from "./JobsPage";

const job = (id: string, status: Job["status"], extra: Partial<Job> = {}): Job => ({
  id, status, originalName: `${id}.pdf`, revisedName: `${id}-v2.pdf`, originalSize: 1, revisedSize: 1,
  mode: "mixed", createdAt: "2026-10-27T00:00:00Z", progress: 0, pageCount: 0,
  changeCount: 0, error: null, ...extra,
});
const jobs = [
  job("done", "COMPLETED", { progress: 100, pageCount: 2, changeCount: 5 }),
  job("waiting", "QUEUED"),
  job("running", "PROCESSING", { progress: 40 }),
  job("broken", "FAILED", { error: "比較できませんでした。" }),
];
const noop = () => {};
const render = (list: Job[], filter?: Parameters<typeof JobsPage>[0]["initialFilter"]) =>
  renderToStaticMarkup(
    <JobsPage jobs={list} initialFilter={filter} open={noop} retry={async () => {}} cancel={noop} startNew={noop} />,
  );
const occurrences = (html: string, text: string) => html.split(text).length - 1;

describe("job filters", () => {
  it("narrows the list to one status, or keeps every job", () => {
    expect(filterJobs(jobs, "all")).toHaveLength(4);
    expect(filterJobs(jobs, "FAILED").map((j) => j.id)).toEqual(["broken"]);
  });

  it("counts jobs per filter", () => {
    expect(countByFilter([...jobs, job("also-waiting", "QUEUED")])).toEqual({
      all: 5, QUEUED: 2, PROCESSING: 1, COMPLETED: 1, FAILED: 1,
    });
  });
});

describe("jobs page", () => {
  it("offers the action that fits each job's status", () => {
    const html = render(jobs);
    for (const label of ["結果を見る", "進捗を見る", "再実行", "取り消す"])
      expect(occurrences(html, `${label}</button>`)).toBe(1);
  });

  it("shows what happened to each job", () => {
    const html = render(jobs);
    expect(html).toContain("5件の差分");
    expect(html).toContain("40%");
    expect(html).toContain("比較できませんでした。");
    expect(html).toContain("順番待ち");
  });

  it("lists only the jobs of the chosen status", () => {
    const html = render(jobs, "FAILED");
    expect(html).toContain("broken.pdf");
    expect(html).not.toContain("done.pdf");
    expect(html).toContain('aria-pressed="true"');
  });

  it("explains an empty filter instead of showing nothing", () => {
    const html = render([jobs[0]], "FAILED");
    expect(html).toContain("該当する比較はありません");
  });
});
