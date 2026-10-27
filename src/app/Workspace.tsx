import { useEffect, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { signOut } from "../auth/api";
import { validatePdf } from "../comparison/api";
import ComparisonSettingsModal from "../comparison/ComparisonSettingsModal";
import { useJobs } from "../comparison/jobsStore";
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
  const { jobs, job, connected, loading, error } = useJobs(
    useShallow(({ jobs, job, connected, loading, error }) => ({
      jobs,
      job,
      connected,
      loading,
      error,
    })),
  );
  const { connect, refresh, start, openJob, closeJob, remove, setError, reset } =
    useJobs.getState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void connect();
    // The store outlives this account's workspace, so drop its jobs on the way out.
    return reset;
  }, [connect, reset]);
  const polling =
    connected && (jobs.some(isActive) || (job !== null && isActive(job)));
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => clearInterval(timer);
  }, [polling, refresh]);

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
  async function startComparison(demo = false) {
    const [original, revised] = files;
    if (!demo && (!original || !revised)) return;
    const started = await start(
      demo ? "demo" : { files: [original!, revised!], options },
    );
    if (started) setView("new");
  }
  async function open(j: Job) {
    if (await openJob(j)) setView("new");
  }
  async function confirmRemove() {
    if (!deleteTarget) return;
    await remove(deleteTarget);
    setDeleteTarget(null);
  }
  function navigate(next: View) {
    setView(next);
    closeJob();
    setError("");
    if (connected) void refresh();
  }

  async function logout() {
    setSigningOut(true);
    reset();
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
              start={() => void startComparison()}
              demo={() => void startComparison(true)}
              openSettings={() => setSettingsOpen(true)}
              recentJobs={jobs.slice(0, 3)}
              openJob={open}
              removeJob={setDeleteTarget}
              showHistory={() => navigate("history")}
            />
          )}
          {view === "new" &&
            job &&
            (job.status === "COMPLETED" && job.result ? (
              <ResultView job={job} back={closeJob} />
            ) : (
              <ProcessingView job={job} back={closeJob} />
            ))}
          {view === "history" && (
            <HistoryPage
              jobs={jobs}
              open={open}
              remove={setDeleteTarget}
              startNew={() => navigate("new")}
            />
          )}
          {view === "help" && (
            <HelpPage
              start={() => navigate("new")}
              demo={() => void startComparison(true)}
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
          confirm={() => void confirmRemove()}
        />
      )}
    </div>
  );
}
