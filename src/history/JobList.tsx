import {
  ArrowRight,
  Check,
  ChevronRight,
  FileDiff,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import type { Job } from "../comparison/types";
import { isActive, statusLabels } from "../comparison/types";
import { dateLabel } from "../shared/format";

export default function JobList({
  jobs,
  open,
  remove,
}: {
  jobs: Job[];
  open: (job: Job) => void;
  remove: (job: Job) => void;
}) {
  return (
    <div className="job-list">
      {jobs.map((j) => (
        <div className="job-row" key={j.id}>
          <button className="job-open" onClick={() => open(j)}>
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
            <span className="job-date">
              {dateLabel(j.createdAt)}
            </span>
            <span
              className={"status-badge " + j.status.toLowerCase()}
            >
              {isActive(j) ? (
                <LoaderCircle size={12} className="spin" />
              ) : j.status === "COMPLETED" ? (
                <Check size={12} />
              ) : null}
              {statusLabels[j.status]}
            </span>
            <span className="job-changes">
              {j.status === "COMPLETED"
                ? `${j.changeCount}件の差分`
                : "—"}
            </span>
            <ChevronRight size={16} />
          </button>
          <button
            className="icon-button delete-job"
            aria-label={`${j.originalName}の比較を削除`}
            disabled={isActive(j)}
            onClick={() => remove(j)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
