import { api, forgetSession } from "../shared/api";
import type { Account } from "../shared/api";

export async function authenticate(mode: "sign-in" | "sign-up", email: string, password: string) {
  const account = await api<Account>(`/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  // Authentication rotates the session ID and invalidates its old CSRF token.
  await forgetSession();
  return account;
}

export async function signOut() {
  await api<void>("/auth/sign-out", { method: "POST" });
  await forgetSession();
}
