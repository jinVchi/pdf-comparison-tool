import { useCallback, useEffect, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { signOut } from "../auth/api";
import { submit, validatePdf } from "../comparison/api";
import ComparisonSettingsModal from "../comparison/ComparisonSettingsModal";
import NewComparisonPage from "../comparison/NewComparisonPage";
import type {
  ComparisonFiles,
  ComparisonOptions,
} from "../comparison/NewComparisonPage";
import ProcessingView from "../comparison/ProcessingView";
import type { Job } from "../comparison/types";
import { isActive } from "../comparison/types";
import HelpPage from "../help/HelpPage";
import DeleteComparisonModal from "../history/DeleteComparisonModal";
import HistoryPage from "../history/HistoryPage";
import ResultView from "../result/ResultView";
import { api } from "../shared/api";
import type { Account } from "../shared/api";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export type View = "new" | "history" | "help";

export default function Workspace({ user }: { user: Account }) {
  const [view, setView] = useState<View>("new");
  const [files, setFiles] = useState<ComparisonFiles>([null, null]);
  const [options, setOptions] = useState<ComparisonOptions>({
    mode: "mixed",
    ignoreWhitespace: true,
    normalizeWidth: false,
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const connect = useCallback(async () => {
    try {
      setJobs(await api<Job[]>("/comparisons"));
      setConnected(true);
      setError("");
    } catch (e) {
      setConnected(false);
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void connect();
  }, [connect]);
  useEffect(() => {
    if (!connected || (!jobs.some(isActive) && (!job || !isActive(job))))
      return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const [list, detail] = await Promise.all([
          api<Job[]>("/comparisons"),
          job && isActive(job)
            ? api<Job>(`/comparisons/${job.id}`)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setJobs(list);
        if (detail) setJob(detail);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [connected, job, jobs.some(isActive)]);

  async function choose(index: number, incoming: File[]) {
    if (!incoming.length) return;
    if (incoming.length > 2) {
      setError("一度に選択できるPDFは2つまでです。");
      return;
    }
    const selected = incoming.slice(0, 2);
    for (const f of selected) {
      const problem = await validatePdf(f);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setFiles((current) => {
      const next: ComparisonFiles = [...current];
      if (selected.length === 2) {
        next[0] = selected[0];
        next[1] = selected[1];
      } else next[index] = selected[0];
      return next;
    });
    setError("");
  }
  async function start(demo = false) {
    if (!demo && (!files[0] || !files[1])) return;
    setLoading(true);
    setError("");
    try {
      const created = demo
        ? await api<Job>("/comparisons/demo", { method: "POST" })
        : await submit(
            files[0]!,
            files[1]!,
            options.mode,
            options.ignoreWhitespace,
            options.normalizeWidth,
          );
      setConnected(true);
      setJob(created);
      setView("new");
      setJobs((current) => [created, ...current]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function openJob(j: Job) {
    setLoading(true);
    setError("");
    try {
      setJob(await api<Job>(`/comparisons/${j.id}`));
      setView("new");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    try {
      await api(`/comparisons/${deleteTarget.id}`, { method: "DELETE" });
      setJobs((current) =>
        current.filter((j) => j.id !== deleteTarget.id),
      );
      if (job?.id === deleteTarget.id) setJob(null);
      setDeleteTarget(null);
    } catch (e) {
      setError((e as Error).message);
      setDeleteTarget(null);
    }
  }
  function navigate(next: View) {
    setView(next);
    setJob(null);
    setError("");
    if (connected)
      void api<Job[]>("/comparisons")
        .then(setJobs)
        .catch((e) => setError(e.message));
  }

  async function logout() {
    setSigningOut(true);
    setJob(null);
    setJobs([]);
    setDeleteTarget(null);
    setFiles([null, null]);
    try {
      await signOut();
      window.location.reload();
    } catch (e) {
      await connect();
      setError((e as Error).message);
      setSigningOut(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        view={view}
        jobCount={jobs.length}
        navigate={navigate}
        openSettings={() => setSettingsOpen(true)}
      />
      <div className="main-shell">
        <Topbar
          view={view}
          viewingJob={job !== null}
          connected={connected}
          busy={signingOut || loading}
          logout={() => void logout()}
          openHelp={() => navigate("help")}
        />
        <main
          className={
            job?.status === "COMPLETED"
              ? "main-content result-main"
              : "main-content"
          }
        >
          {error && (
            <div className="error-banner" role="alert">
              <CircleHelp size={18} />
              <span>{error}</span>
              {!connected && (
                <button onClick={() => void connect()}>
                  再接続
                </button>
              )}
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="通知を閉じる"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {view === "new" && !job && (
            <NewComparisonPage
              files={files}
              setFiles={setFiles}
              choose={choose}
              options={options}
              setOptions={setOptions}
              loading={loading}
              start={() => void start()}
              demo={() => void start(true)}
              openSettings={() => setSettingsOpen(true)}
              recentJobs={jobs.slice(0, 3)}
              openJob={openJob}
              removeJob={setDeleteTarget}
              showHistory={() => navigate("history")}
            />
          )}
          {view === "new" &&
            job &&
            (job.status === "COMPLETED" && job.result ? (
              <ResultView job={job} back={() => setJob(null)} />
            ) : (
              <ProcessingView job={job} back={() => setJob(null)} />
            ))}
          {view === "history" && (
            <HistoryPage
              jobs={jobs}
              open={openJob}
              remove={setDeleteTarget}
              startNew={() => navigate("new")}
            />
          )}
          {view === "help" && (
            <HelpPage
              start={() => navigate("new")}
              demo={() => void start(true)}
            />
          )}
        </main>
      </div>
      {signingOut && <div className="modal-backdrop" role="status"><div className="modal">ログアウト中…</div></div>}
      {settingsOpen && (
        <ComparisonSettingsModal close={() => setSettingsOpen(false)} />
      )}
      {deleteTarget && (
        <DeleteComparisonModal
          job={deleteTarget}
          cancel={() => setDeleteTarget(null)}
          confirm={() => void remove()}
        />
      )}
    </div>
  );
}
