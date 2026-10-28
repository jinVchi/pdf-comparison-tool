import { useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  FileDiff,
  ListChecks,
  LoaderCircle,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import type { Job } from "../comparison/types";
import { isActive, statusLabels } from "../comparison/types";
import { dateLabel } from "../shared/format";
import type { JobFilter } from "./filters";
import { countByFilter, filterJobs, jobFilters } from "./filters";
import "./jobs.css";

export default function JobsPage({
  jobs,
  initialFilter = "all",
  open,
  retry,
  cancel,
  startNew,
}: {
  jobs: Job[];
  initialFilter?: JobFilter;
  open: (job: Job) => void;
  retry: (job: Job) => Promise<void>;
  cancel: (job: Job) => void;
  startNew: () => void;
}) {
  const [filter, setFilter] = useState<JobFilter>(initialFilter);
  const [retrying, setRetrying] = useState<string | null>(null);
  const counts = countByFilter(jobs);
  const shown = filterJobs(jobs, filter);

  async function retryJob(j: Job) {
    setRetrying(j.id);
    try {
      await retry(j);
    } finally {
      setRetrying(null);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            JOB RESULTS
          </div>
          <h1>ジョブ一覧</h1>
          <p>
            比較ジョブの状況を確認し、結果の表示・再実行・取り消しができます。
          </p>
        </div>
        <button className="primary-button" onClick={startNew}>
          <Plus size={16} />
          新しい比較
        </button>
      </div>
      <div className="history-card">
        <div className="job-filters" role="group" aria-label="状態で絞り込む">
          {jobFilters.map((f) => (
            <button
              key={f.value}
              className={filter === f.value ? "job-filter selected" : "job-filter"}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className="count-badge">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        {shown.length ? (
          <div className="job-list">
            {shown.map((j) => (
              <div className="job-row job-result-row" key={j.id}>
                <span className="job-icon">
                  <FileDiff size={21} />
                </span>
                <span className="job-names">
                  <strong>{j.originalName}</strong>
                  <span>
                    <ArrowRight size={11} />
                    {j.revisedName}
                  </span>
                </span>
                <span className="job-date">{dateLabel(j.createdAt)}</span>
                <span className={"status-badge " + j.status.toLowerCase()}>
                  {isActive(j) ? (
                    <LoaderCircle size={12} className="spin" />
                  ) : j.status === "COMPLETED" ? (
                    <Check size={12} />
                  ) : null}
                  {statusLabels[j.status]}
                </span>
                <JobDetail job={j} />
                <span className="job-action">
                  {j.status === "COMPLETED" && (
                    <button className="secondary-button" onClick={() => open(j)}>
                      <Eye size={14} />
                      結果を見る
                    </button>
                  )}
                  {j.status === "PROCESSING" && (
                    <button className="secondary-button" onClick={() => open(j)}>
                      <Eye size={14} />
                      進捗を見る
                    </button>
                  )}
                  {j.status === "FAILED" && (
                    <button
                      className="secondary-button"
                      disabled={retrying === j.id}
                      onClick={() => void retryJob(j)}
                    >
                      <RotateCcw size={14} />
                      再実行
                    </button>
                  )}
                  {j.status === "QUEUED" && (
                    <button className="secondary-button cancel-job" onClick={() => cancel(j)}>
                      <X size={14} />
                      取り消す
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <ListChecks size={38} />
            <h3>
              {jobs.length ? "該当する比較はありません" : "まだ比較ジョブがありません"}
            </h3>
            <p>
              {jobs.length
                ? "別の状態を選んでください。"
                : "PDFをアップロードすると、ここに進捗と結果が表示されます。"}
            </p>
            {!jobs.length && (
              <button className="primary-button" onClick={startNew}>
                PDFを比較
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function JobDetail({ job }: { job: Job }) {
  switch (job.status) {
    case "COMPLETED":
      return (
        <span className="job-detail">
          {job.changeCount}件の差分・{job.pageCount}ページ
        </span>
      );
    case "PROCESSING":
      return (
        <span className="job-detail job-progress">
          <span className="progress-track">
            <span style={{ width: `${job.progress}%` }} />
          </span>
          {job.progress}%
        </span>
      );
    case "FAILED":
      return (
        <span className="job-detail job-error" title={job.error ?? undefined}>
          {job.error ?? "比較できませんでした。"}
        </span>
      );
    case "QUEUED":
      return <span className="job-detail">順番待ち</span>;
  }
}
