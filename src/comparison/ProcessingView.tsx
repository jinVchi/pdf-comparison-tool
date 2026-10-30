import type { Job } from "./types";
import { isActive, statusLabels } from "./types";

/** `backLabel` names where `back` leads when that is not the new comparison page. */
export default function ProcessingView({
  job,
  back,
  backLabel,
}: {
  job: Job;
  back: () => void;
  backLabel?: string;
}) {
  return (
    <>
      <button className="link" onClick={back}>
        ← {backLabel ?? "新しい比較へ"}
      </button>
      <section className="panel">
        <h1>
          {job.status === "FAILED"
            ? "比較を完了できませんでした"
            : statusLabels[job.status]}
        </h1>
        <p>
          {job.originalName} → {job.revisedName}
        </p>
        {job.status === "FAILED" && <p className="error-text">{job.error}</p>}
        {isActive(job) && (
          <p>
            <progress
              max={100}
              value={job.status === "PROCESSING" ? job.progress : undefined}
            />{" "}
            {job.status === "PROCESSING"
              ? `${job.progress}%`
              : "処理を待っています"}
          </p>
        )}
      </section>
    </>
  );
}
