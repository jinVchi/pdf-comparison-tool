import { create } from "zustand";
import { api } from "../shared/api";
import { submit } from "./api";
import type { ComparisonOptions } from "./NewComparisonPage";
import type { Job } from "./types";
import { isActive } from "./types";

export type StartRequest =
  | { files: [File, File]; options: ComparisonOptions }
  | "demo";

type JobsState = {
  jobs: Job[];
  /** The comparison being viewed; null shows the page underneath. */
  job: Job | null;
  connected: boolean;
  loading: boolean;
  error: string;
  connect: () => Promise<void>;
  /** Reloads the list, and the open job while it is still being processed. */
  refresh: () => Promise<void>;
  /** Resolves false when the job could not be created, so the caller keeps its view. */
  start: (request: StartRequest) => Promise<boolean>;
  /** Resolves false when the job could not be loaded, so the caller keeps its view. */
  openJob: (job: Job) => Promise<boolean>;
  closeJob: () => void;
  remove: (job: Job) => Promise<void>;
  setError: (error: string) => void;
  /** Forgets everything loaded for the current account. */
  reset: () => void;
};

const initial = { jobs: [], job: null, connected: false, loading: false, error: "" };

export const useJobs = create<JobsState>()((set, get) => ({
  ...initial,
  async connect() {
    try {
      set({ jobs: await api<Job[]>("/comparisons"), connected: true, error: "" });
    } catch (e) {
      set({ connected: false, error: (e as Error).message });
    }
  },
  async refresh() {
    const open = get().job;
    try {
      const [list, detail] = await Promise.all([
        api<Job[]>("/comparisons"),
        open && isActive(open)
          ? api<Job>(`/comparisons/${open.id}`)
          : Promise.resolve(null),
      ]);
      // A reset (sign-out, account switch) may have happened while the request was in flight.
      if (!get().connected) return;
      // The user may have closed or switched jobs meanwhile too.
      set((s) => ({ jobs: list, job: detail && s.job?.id === detail.id ? detail : s.job }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  async start(request) {
    set({ loading: true, error: "" });
    try {
      const created = request === "demo"
        ? await api<Job>("/comparisons/demo", { method: "POST" })
        : await submit(
            request.files[0],
            request.files[1],
            request.options.mode,
            request.options.ignoreWhitespace,
            request.options.normalizeWidth,
          );
      set((s) => ({ connected: true, job: created, jobs: [created, ...s.jobs] }));
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    } finally {
      set({ loading: false });
    }
  },
  async openJob(target) {
    set({ loading: true, error: "" });
    try {
      set({ job: await api<Job>(`/comparisons/${target.id}`) });
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    } finally {
      set({ loading: false });
    }
  },
  closeJob: () => set({ job: null }),
  async remove(target) {
    try {
      await api(`/comparisons/${target.id}`, { method: "DELETE" });
      set((s) => ({
        jobs: s.jobs.filter((j) => j.id !== target.id),
        job: s.job?.id === target.id ? null : s.job,
      }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  setError: (error) => set({ error }),
  reset: () => set(initial),
}));
