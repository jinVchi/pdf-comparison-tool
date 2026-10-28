import type { Job } from "../comparison/types";
import { statusLabels } from "../comparison/types";

export type JobFilter = "all" | Job["status"];

export const jobFilters: { value: JobFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "QUEUED", label: statusLabels.QUEUED },
  { value: "PROCESSING", label: statusLabels.PROCESSING },
  { value: "COMPLETED", label: statusLabels.COMPLETED },
  { value: "FAILED", label: statusLabels.FAILED },
];

export const filterJobs = (jobs: Job[], filter: JobFilter) =>
  filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

export function countByFilter(jobs: Job[]): Record<JobFilter, number> {
  const counts = { all: jobs.length, QUEUED: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
  for (const j of jobs) counts[j.status]++;
  return counts;
}
