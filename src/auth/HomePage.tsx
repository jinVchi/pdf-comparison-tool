import { useState } from "react";
import AuthForm from "./AuthForm";
import type { AuthMode } from "./AuthForm";

export default function HomePage({ ready, checking, error, retry }: {
  ready: boolean;
  checking: boolean;
  error: string;
  retry: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [busy, setBusy] = useState(false);

  return (
    <main className="login">
      <p className="login-brand"><strong>差分</strong> PDF比較</p>
      <section className="panel">
        <h1>{mode === "sign-up" ? "アカウントを作成" : "ログイン"}</h1>
        {checking && <p className="muted" role="status">接続を確認しています…</p>}
        {error && <div className="error" role="alert"><span>{error}</span><button type="button" onClick={retry}>再接続</button></div>}
        <AuthForm mode={mode} changeMode={setMode} busy={busy} setBusy={setBusy} disabled={!ready} />
      </section>
    </main>
  );
}
