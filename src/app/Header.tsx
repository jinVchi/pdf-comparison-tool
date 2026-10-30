import type { Account } from "../shared/api";
import type { View } from "./Workspace";

const links: { view: View; label: string }[] = [
  { view: "new", label: "PDFを比較" },
  { view: "jobs", label: "ジョブ一覧" },
  { view: "history", label: "比較履歴" },
  { view: "help", label: "ヘルプ" },
];

export default function Header({
  user,
  view,
  activeCount,
  navigate,
  signingOut,
  busy,
  logout,
}: {
  user: Account;
  view: View;
  activeCount: number;
  navigate: (view: View) => void;
  signingOut: boolean;
  busy: boolean;
  logout: () => void;
}) {
  return (
    <header className="header">
      <strong>差分</strong>
      <nav aria-label="メインナビゲーション">
        {links.map((l) => (
          <button
            key={l.view}
            aria-current={view === l.view ? "page" : undefined}
            onClick={() => navigate(l.view)}
          >
            {l.label}
            {l.view === "jobs" && activeCount > 0 && ` (${activeCount})`}
          </button>
        ))}
      </nav>
      <span className="header-user" title={user.email}>
        {user.email}
      </span>
      <button disabled={busy} onClick={logout}>
        {signingOut ? "ログアウト中…" : "ログアウト"}
      </button>
    </header>
  );
}
