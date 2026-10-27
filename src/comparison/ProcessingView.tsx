import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  FileDiff,
  FileText,
  LoaderCircle,
} from "lucide-react";
import type { Job } from "./types";
import { isActive, statusLabels } from "./types";

export default function ProcessingView({ job, back }: { job: Job; back: () => void }) {
  return (
    <div className="processing-section">
      <button className="text-button" onClick={back}>
        <ArrowLeft size={16} />
        新しい比較へ
      </button>
      <div className="processing-card">
        <div
          className={
            "processing-icon " +
            (job.status === "FAILED" ? "failed" : "")
          }
        >
          {job.status === "FAILED" ? (
            <CircleHelp size={35} />
          ) : (
            <FileDiff size={35} />
          )}
        </div>
        <span className="eyebrow">DOCUMENT COMPARISON</span>
        <h1>
          {job.status === "FAILED"
            ? "比較を完了できませんでした"
            : job.status === "QUEUED"
              ? "順番にお調べしています。"
              : "違いを、一つずつ確認しています。"}
        </h1>
        <p>
          {job.status === "FAILED"
            ? job.error
            : job.status === "QUEUED"
              ? "比較の準備ができました。処理が始まるまでお待ちください。"
              : "ページの文字・数字・レイアウトを比較中です。"}
        </p>
        <div className="processing-files">
          <span>
            <FileText size={17} />
            {job.originalName}
          </span>
          <ArrowRight size={17} />
          <span>
            <FileText size={17} />
            {job.revisedName}
          </span>
        </div>
        {isActive(job) && (
          <>
            <div
              className={
                "progress-track " +
                (job.status === "QUEUED" ? "indeterminate" : "")
              }
            >
              <span
                style={{
                  width: `${job.status === "QUEUED" ? 30 : job.progress}%`,
                }}
              />
            </div>
            <div className="progress-label">
              <span>
                <LoaderCircle size={14} className="spin" />
                {statusLabels[job.status]}
              </span>
              <span>
                {job.status === "PROCESSING"
                  ? `${job.progress}%`
                  : "処理を待っています"}
              </span>
            </div>
            <p className="processing-hint">
              この間に、別のPDFを比較することもできます。
              <br />
              比較結果は「比較履歴」から確認できます。
            </p>
          </>
        )}
        <button className="secondary-button" onClick={back}>
          {job.status === "FAILED"
            ? "ファイルを選び直す"
            : "別のPDFを比較する"}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
