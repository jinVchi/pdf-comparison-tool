import { useState } from "react";
import type { Job } from "../comparison/types";
import { statusLabels } from "../comparison/types";
import { dateLabel } from "../shared/format";
import type { JobFilter } from "./filters";
import { countByFilter, filterJobs, jobFilters } from "./filters";

export default function JobsPage({
  jobs,
  initialFilter = "all",
  open,
  retry,
  cancel,
}: {
  jobs: Job[];
  initialFilter?: JobFilter;
  open: (job: Job) => void;
  retry: (job: Job) => Promise<void>;
  cancel: (job: Job) => void;
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
      <h1>ジョブ一覧</h1>
      <div className="filters" role="group" aria-label="状態で絞り込む">
        {jobFilters.map((f) => (
          <button
            key={f.value}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}（{counts[f.value]}）
          </button>
        ))}
      </div>
      {shown.length ? (
        <table>
          <thead>
            <tr>
              <th>ファイル</th>
              <th>日時</th>
              <th>状態</th>
              <th>詳細</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((j) => (
              <tr key={j.id}>
                <td>
                  {j.originalName} → {j.revisedName}
                </td>
                <td>{dateLabel(j.createdAt)}</td>
                <td>{statusLabels[j.status]}</td>
                <td>
                  <JobDetail job={j} />
                </td>
                <td>
                  {j.status === "COMPLETED" && (
                    <button onClick={() => open(j)}>結果を見る</button>
                  )}
                  {j.status === "PROCESSING" && (
                    <button onClick={() => open(j)}>進捗を見る</button>
                  )}
                  {j.status === "FAILED" && (
                    <button
                      disabled={retrying === j.id}
                      onClick={() => void retryJob(j)}
                    >
                      再実行
                    </button>
                  )}
                  {j.status === "QUEUED" && (
                    <button onClick={() => cancel(j)}>取り消す</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">
          {jobs.length
            ? "該当する比較はありません"
            : "まだ比較ジョブがありません"}
        </p>
      )}
    </>
  );
}

function JobDetail({ job }: { job: Job }) {
  switch (job.status) {
    case "COMPLETED":
      return (
        <>
          {job.changeCount}件の差分・{job.pageCount}ページ
        </>
      );
    case "PROCESSING":
      return <>{job.progress}%</>;
    case "FAILED":
      return (
        <span className="error-text">
          {job.error ?? "比較できませんでした。"}
        </span>
      );
    case "QUEUED":
      return <>順番待ち</>;
  }
}
