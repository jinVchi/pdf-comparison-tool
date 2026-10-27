import {
  CircleHelp,
  FileDiff,
  FolderClock,
  Layers,
  LockKeyhole,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { Account } from "../shared/api";
import ArrowUpRightIcon from "../shared/ArrowUpRightIcon";
import type { View } from "./Workspace";

export default function Sidebar({
  user,
  view,
  jobCount,
  navigate,
  openSettings,
}: {
  user: Account;
  view: View;
  jobCount: number;
  navigate: (view: View) => void;
  openSettings: () => void;
}) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          navigate("new");
        }}
        aria-label="差分 ホーム"
      >
        <span className="brand-mark">
          <FileDiff size={25} strokeWidth={1.7} />
        </span>
        <span>
          差分<span className="brand-roman">sabun</span>
        </span>
        <span className="brand-dot">•</span>
      </a>
      <div className="workspace-label">MY WORKSPACE</div>
      <nav aria-label="メインナビゲーション">
        <button
          className={view === "new" ? "nav-item selected" : "nav-item"}
          onClick={() => navigate("new")}
        >
          <Layers size={18} />
          PDFを比較<span className="nav-shortcut">＋</span>
        </button>
        <button
          className={
            view === "history" ? "nav-item selected" : "nav-item"
          }
          onClick={() => navigate("history")}
        >
          <FolderClock size={18} />
          比較履歴
          {jobCount > 0 && <span className="nav-count">{jobCount}</span>}
        </button>
      </nav>
      <div className="sidebar-guide">
        <span className="guide-orbit">
          <Sparkles size={21} />
        </span>
        <h3>「違い」に、もう迷わない。</h3>
        <p>
          帳票の小さな変更も、
          <br />
          ひと目で見つかります。
        </p>
        <button onClick={() => navigate("help")}>
          使い方を見る <ArrowUpRightIcon />
        </button>
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => navigate("help")}>
          <CircleHelp size={18} />
          ヘルプ・使い方
        </button>
        <button className="nav-item" onClick={openSettings}>
          <Settings2 size={18} />
          比較の設定
        </button>
        <div className="workspace-user">
          <span className="avatar">{user.email[0].toUpperCase()}</span>
          <div>
            <strong title={user.email}>{user.email}</strong>
            <span>アカウントの比較履歴</span>
          </div>
          <LockKeyhole size={14} />
        </div>
      </div>
    </aside>
  );
}
