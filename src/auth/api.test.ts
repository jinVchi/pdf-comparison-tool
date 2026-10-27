import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = { id: "account-1", email: "reader@example.com" };
const session = (token: string, user: typeof account | null = null) => ({
  csrfToken: token, csrfHeader: "X-CSRF-TOKEN", retentionHours: 24, user,
});
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

describe("account API session transitions", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("registers with CSRF and obtains a fresh token before the next account mutation", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(session("guest-token")))
      .mockResolvedValueOnce(response(account, 201))
      .mockResolvedValueOnce(response(session("account-token", account)))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    const { authenticate } = await import("./api");
    const { api } = await import("../shared/api");
    await expect(authenticate("sign-up", account.email, "secure-password-123")).resolves.toEqual(account);
    expect(fetcher.mock.calls[1][0]).toBe("/api/auth/sign-up");
    const registration = fetcher.mock.calls[1][1];
    expect(registration.headers.get("X-CSRF-TOKEN")).toBe("guest-token");
    expect(registration.credentials).toBe("same-origin");
    expect(JSON.parse(registration.body)).toEqual({ email: account.email, password: "secure-password-123" });
    await api("/comparisons/sample", { method: "DELETE" });
    expect(fetcher.mock.calls[2][0]).toBe("/api/session");
    expect(fetcher.mock.calls[3][1].headers.get("X-CSRF-TOKEN")).toBe("account-token");
  });

  it("signs out with CSRF and refreshes the anonymous session before another request", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(session("account-token", account)))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(response(session("new-guest-token")))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal("fetch", fetcher);
    const { signOut } = await import("./api");
    const { initialize, api } = await import("../shared/api");
    expect((await initialize()).user).toEqual(account);
    await signOut();
    expect(fetcher.mock.calls[1][0]).toBe("/api/auth/sign-out");
    expect(fetcher.mock.calls[1][1].headers.get("X-CSRF-TOKEN")).toBe("account-token");
    await api("/comparisons");
    expect(fetcher.mock.calls[2][0]).toBe("/api/session");
  });

  it("notifies the app when a protected request loses authentication, without retrying it", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(session("account-token", account)))
      .mockResolvedValueOnce(response({ message: "ログインしてからご利用ください。" }, 401));
    vi.stubGlobal("fetch", fetcher);
    const { api, SESSION_EXPIRED_EVENT } = await import("../shared/api");
    await expect(api("/comparisons")).rejects.toThrow("ログインしてからご利用ください。");
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0][0].type).toBe(SESSION_EXPIRED_EVENT);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("shows credential errors and never retries a failed authentication mutation", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(session("guest-token")))
      .mockResolvedValueOnce(response({ message: "メールアドレスまたはパスワードが正しくありません。" }, 401));
    vi.stubGlobal("fetch", fetcher);
    const { authenticate } = await import("./api");
    await expect(authenticate("sign-in", account.email, "wrong-password"))
      .rejects.toThrow("メールアドレスまたはパスワードが正しくありません。");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("refreshes expired CSRF on the next action without replaying the failed POST", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(session("expired-token")))
      .mockResolvedValueOnce(response({}, 403))
      .mockResolvedValueOnce(response(session("fresh-token")))
      .mockResolvedValueOnce(response(account));
    vi.stubGlobal("fetch", fetcher);
    const { authenticate } = await import("./api");
    await expect(authenticate("sign-in", account.email, "secure-password-123"))
      .rejects.toThrow("セッションが切れました");
    expect(fetcher).toHaveBeenCalledTimes(2);
    await authenticate("sign-in", account.email, "secure-password-123");
    expect(fetcher.mock.calls[2][0]).toBe("/api/session");
    expect(fetcher.mock.calls[3][1].headers.get("X-CSRF-TOKEN")).toBe("fresh-token");
  });
});
