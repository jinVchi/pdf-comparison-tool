import { useState } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { authenticate } from "./api";

export type AuthMode = "sign-in" | "sign-up";

export default function AuthForm({ mode, changeMode, busy, setBusy, disabled = false }: {
  mode: AuthMode;
  changeMode: (mode: AuthMode) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const registering = mode === "sign-up";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    if (registering && (Array.from(password).length < 12 || new TextEncoder().encode(password).length > 72)) {
      setError("パスワードは12文字以上、UTF-8で72バイト以内にしてください。");
      return;
    }
    if (registering && password !== confirmation) {
      setError("確認用パスワードが一致しません。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await authenticate(mode, email, password);
      // Discard all workspace state and in-flight requests at the identity boundary.
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy || disabled}>
        <label htmlFor="auth-email">メールアドレス</label>
        <input id="auth-email" type="email" autoComplete="email" required maxLength={254}
          value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="auth-password">パスワード</label>
        <input id="auth-password" type="password" required
          autoComplete={registering ? "new-password" : "current-password"}
          aria-describedby={registering ? "password-hint" : undefined}
          value={password} onChange={(event) => setPassword(event.target.value)} />
        {registering && <>
          <small id="password-hint">12文字以上、UTF-8で72バイト以内（日本語は通常24文字まで）</small>
          <label htmlFor="auth-confirmation">パスワード（確認）</label>
          <input id="auth-confirmation" type="password" autoComplete="new-password" required
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </>}
      </fieldset>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="auth-privacy"><LockKeyhole size={14} /> 比較した書類は、あなたのアカウントだけで確認できます。</div>
      <button className="primary-button full-width" type="submit" disabled={busy || disabled}>
        {busy && <LoaderCircle size={16} className="spin" />}
        {busy ? "処理中…" : registering ? "アカウントを作成" : "ログイン"}
      </button>
      <button className="auth-switch" type="button" disabled={busy} onClick={() => {
        setError("");
        setPassword("");
        setConfirmation("");
        changeMode(registering ? "sign-in" : "sign-up");
      }}>
        {registering ? "登録済みの方はこちら：ログイン" : "アカウントをお持ちでない方：新規登録"}
      </button>
    </form>
  );
}
