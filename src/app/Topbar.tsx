import { BookOpen, ChevronRight, LogOut } from "lucide-react";
import ArrowUpRightIcon from "../shared/ArrowUpRightIcon";
import type { View } from "./Workspace";

export default function Topbar({
  view,
  viewingJob,
  connected,
  busy,
  logout,
  openHelp,
}: {
  view: View;
  viewingJob: boolean;
  connected: boolean;
  busy: boolean;
  logout: () => void;
  openHelp: () => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        ワークスペース <ChevronRight size={13} />{" "}
        <span>
          {view === "history"
            ? "比較履歴"
            : view === "help"
              ? "使い方ガイド"
              : viewingJob
                ? "比較結果"
                : "PDFを比較"}
        </span>
      </div>
      <div className="header-right">
        <span className={"connection " + (connected ? "online" : "")}>
          <i />
          {connected ? "接続済み" : "未接続"}
        </span>
        <span className="header-divider" />
        <button className="help-button" disabled={busy} onClick={logout}>
          <LogOut size={15} /> ログアウト
        </button>
        <button className="help-button" onClick={openHelp}>
          <BookOpen size={15} />
          <span>使い方ガイド</span>
          <ArrowUpRightIcon />
        </button>
      </div>
    </header>
  );
}
