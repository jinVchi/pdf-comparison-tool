import type { Job, Mode } from "./types";
export type Account = { id: string; email: string };
export type Session = {
    csrfToken: string;
    csrfHeader: string;
    retentionHours: number;
    user: Account | null;
};
let csrf: Session | undefined;
let initializing: Promise<Session> | null = null;
export const SESSION_EXPIRED_EVENT = "sabun:session-expired";

function sessionExpired() {
    if (typeof window !== "undefined")
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function initialize(): Promise<Session> {
    if (initializing) return initializing;
    initializing = (async () => {
        let res: Response;
        try {
            res = await fetch("/api/session", {
                credentials: "same-origin",
                cache: "no-store",
            });
        } catch {
            throw new Error(
                "サーバーに接続できません。接続状況を確認して、再接続してください。",
            );
        }
        if (
            !res.ok ||
            !res.headers.get("content-type")?.includes("application/json")
        )
            throw new Error(
                "サーバーに接続できません。接続状況を確認して、再接続してください。",
            );
        const session: Session = await res.json();
        csrf = session;
        return session;
    })().finally(() => {
        initializing = null;
    });
    return initializing;
}

export async function authenticate(mode: "sign-in" | "sign-up", email: string, password: string) {
    const account = await api<Account>(`/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    // Authentication rotates the session ID and invalidates its old CSRF token.
    if (initializing) await initializing.catch(() => {});
    csrf = undefined;
    return account;
}

export async function signOut() {
    await api<void>("/auth/sign-out", { method: "POST" });
    if (initializing) await initializing.catch(() => {});
    csrf = undefined;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!csrf) await initialize();
    const headers = new Headers(init.headers);
    if (init.method && !["GET", "HEAD"].includes(init.method))
        headers.set(csrf!.csrfHeader, csrf!.csrfToken);
    let res: Response;
    try {
        res = await fetch(`/api${path}`, {
            ...init,
            headers,
            credentials: "same-origin",
            cache: "no-store",
        });
    } catch {
        throw new Error("通信が途切れました。接続状況を確認してください。");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
            csrf = undefined;
            // Incorrect credentials belong to the form; workspace failures must discard private UI state.
            if (!path.startsWith("/auth/")) sessionExpired();
        }
        if (res.status === 403) {
            throw new Error("セッションが切れました。もう一度お試しください。");
        }
        throw new Error(
            body.message ||
                "処理できませんでした。しばらくしてからお試しください。",
        );
    }
    return res.status === 204 ? (undefined as T) : await res.json();
}
export async function validatePdf(file: File): Promise<string | null> {
    if (file.size === 0 || file.size > 25 * 1024 * 1024)
        return "PDFは1ファイル25MB以内にしてください。";
    if (!file.name.toLowerCase().endsWith(".pdf"))
        return "PDFファイルを選択してください。";
    const header = await file.slice(0, 5).text();
    return header === "%PDF-"
        ? null
        : "このファイルは有効なPDFではありません。";
}
export function submit(
    original: File,
    revised: File,
    mode: Mode,
    ignoreWhitespace: boolean,
    normalizeWidth: boolean,
) {
    const form = new FormData();
    form.append("original", original);
    form.append("revised", revised);
    form.append("mode", mode);
    form.append("ignoreWhitespace", String(ignoreWhitespace));
    form.append("normalizeWidth", String(normalizeWidth));
    return api<Job>("/comparisons", { method: "POST", body: form });
}
export function fileSize(n: number) {
    return n < 1024 * 1024
        ? `${Math.max(1, Math.round(n / 1024))} KB`
        : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
export function dateLabel(value: string) {
    return new Intl.DateTimeFormat("ja-JP", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}
