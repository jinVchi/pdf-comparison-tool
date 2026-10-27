import { ArrowRight, FolderClock, Plus } from "lucide-react";
import type { Job } from "../comparison/types";
import JobList from "./JobList";

export default function HistoryPage({
  jobs,
  open,
  remove,
  startNew,
}: {
  jobs: Job[];
  open: (job: Job) => void;
  remove: (job: Job) => void;
  startNew: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            COMPARISON HISTORY
          </div>
          <h1>比較履歴</h1>
          <p>
            このアカウントで比較した書類を、もう一度確認できます。
          </p>
        </div>
        <button className="primary-button" onClick={startNew}>
          <Plus size={16} />
          新しい比較
        </button>
      </div>
      <div className="history-card">
        <div className="recent-heading">
          <h2>
            すべての比較{" "}
            <span className="count-badge">{jobs.length}</span>
          </h2>
          <span className="muted">24時間で自動削除</span>
        </div>
        {jobs.length ? (
          <JobList jobs={jobs} open={open} remove={remove} />
        ) : (
          <div className="empty-state">
            <FolderClock size={38} />
            <h3>まだ比較履歴がありません</h3>
            <p>
              PDFをアップロードするか、サンプルで体験してみましょう。
            </p>
            <button className="primary-button" onClick={startNew}>
              PDFを比較
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
