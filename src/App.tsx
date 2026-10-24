import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowLeft,
    ArrowLeftRight,
    ArrowRight,
    BookOpen,
    Check,
    CheckCheck,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleHelp,
    Clock3,
    Download,
    FileCheck2,
    FileDiff,
    FileText,
    FolderClock,
    Layers,
    LoaderCircle,
    LockKeyhole,
    Maximize2,
    Minus,
    Plus,
    ScanLine,
    Settings2,
    ShieldCheck,
    Sparkles,
    Trash2,
    Upload,
    X,
    Zap,
} from "lucide-react";
import {
    api,
    dateLabel,
    fileSize,
    initialize,
    submit,
    validatePdf,
} from "./api";
import type { Change, Job, Kind, Mode } from "./types";
import { kindLabels, modeLabels, statusLabels } from "./types";

type View = "new" | "history" | "help";
const active = (j: Job) => j.status === "QUEUED" || j.status === "PROCESSING";

function App() {
    const [view, setView] = useState<View>("new");
    const [files, setFiles] = useState<[File | null, File | null]>([
        null,
        null,
    ]);
    const [mode, setMode] = useState<Mode>("mixed");
    const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);
    const [normalizeWidth, setNormalizeWidth] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [job, setJob] = useState<Job | null>(null);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

    const connect = useCallback(async () => {
        try {
            await initialize();
            setConnected(true);
            setJobs(await api<Job[]>("/comparisons"));
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
        if (!connected || (!jobs.some(active) && (!job || !active(job))))
            return;
        let cancelled = false;
        const timer = window.setInterval(async () => {
            try {
                const [list, detail] = await Promise.all([
                    api<Job[]>("/comparisons"),
                    job && active(job)
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
    }, [connected, job, jobs.some(active)]);

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
            const next: [File | null, File | null] = [...current];
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
                      mode,
                      ignoreWhitespace,
                      normalizeWidth,
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

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <a
                    className="brand"
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate("new");
                    }}
                    aria-label="差分 ホーム"
                >
                    <span className="brand-mark">
                        <FileDiff size={25} strokeWidth={1.7} />
                    </span>
                    <span>
                        差分<span className="brand-roman">sabun</span>
                    </span>
                    <span className="brand-dot">•</span>
                </a>
                <div className="workspace-label">MY WORKSPACE</div>
                <nav aria-label="メインナビゲーション">
                    <button
                        className={
                            view === "new" ? "nav-item selected" : "nav-item"
                        }
                        onClick={() => navigate("new")}
                    >
                        <Layers size={18} />
                        PDFを比較<span className="nav-shortcut">＋</span>
                    </button>
                    <button
                        className={
                            view === "history"
                                ? "nav-item selected"
                                : "nav-item"
                        }
                        onClick={() => navigate("history")}
                    >
                        <FolderClock size={18} />
                        比較履歴
                        {jobs.length > 0 && (
                            <span className="nav-count">{jobs.length}</span>
                        )}
                    </button>
                </nav>
                <div className="sidebar-guide">
                    <span className="guide-orbit">
                        <Sparkles size={21} />
                    </span>
                    <h3>「違い」に、もう迷わない。</h3>
                    <p>
                        帳票の小さな変更も、
                        <br />
                        ひと目で見つかります。
                    </p>
                    <button onClick={() => navigate("help")}>
                        使い方を見る <ArrowUpRightIcon />
                    </button>
                </div>
                <div className="sidebar-bottom">
                    <button
                        className="nav-item"
                        onClick={() => navigate("help")}
                    >
                        <CircleHelp size={18} />
                        ヘルプ・使い方
                    </button>
                    <button
                        className="nav-item"
                        onClick={() => setSettingsOpen(true)}
                    >
                        <Settings2 size={18} />
                        比較の設定
                    </button>
                    <div className="workspace-user">
                        <span className="avatar">W</span>
                        <div>
                            <strong>マイワークスペース</strong>
                            <span>セッション内のファイルを管理</span>
                        </div>
                        <LockKeyhole size={14} />
                    </div>
                </div>
            </aside>
            <div className="main-shell">
                <header className="topbar">
                    <div className="breadcrumb">
                        ワークスペース <ChevronRight size={13} />{" "}
                        <span>
                            {view === "history"
                                ? "比較履歴"
                                : view === "help"
                                  ? "使い方ガイド"
                                  : job
                                    ? "比較結果"
                                    : "PDFを比較"}
                        </span>
                    </div>
                    <div className="header-right">
                        <span
                            className={
                                "connection " + (connected ? "online" : "")
                            }
                        >
                            <i />
                            {connected ? "接続済み" : "未接続"}
                        </span>
                        <span className="header-divider" />
                        <button
                            className="help-button"
                            onClick={() => navigate("help")}
                        >
                            <BookOpen size={15} />
                            <span>使い方ガイド</span>
                            <ArrowUpRightIcon />
                        </button>
                    </div>
                </header>
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
                        <>
                            <div className="page-heading">
                                <div>
                                    <div className="eyebrow">
                                        <span />
                                        DOCUMENT COMPARISON
                                    </div>
                                    <h1>違いが見える。確認がはかどる。</h1>
                                    <p>
                                        2つのPDFを並べて、文字・数字・レイアウトの変更をすばやく確認。
                                    </p>
                                </div>
                                <span className="japanese-badge">
                                    <span>あ</span> 日本語の帳票に対応
                                </span>
                            </div>
                            <section
                                className="upload-section"
                                aria-label="PDFのアップロード"
                            >
                                <div className="section-title">
                                    <span className="step-number">01</span>
                                    <h2>比較するPDFを選択</h2>
                                    <span className="section-note">
                                        2つのファイルをまとめてドロップできます
                                    </span>
                                </div>
                                <div className="upload-pair">
                                    <UploadCard
                                        index={0}
                                        file={files[0]}
                                        choose={choose}
                                        clear={() => setFiles([null, files[1]])}
                                    />
                                    <button
                                        className="swap-button"
                                        title="変更前と変更後を入れ替える"
                                        aria-label="変更前と変更後を入れ替える"
                                        disabled={!files.some(Boolean)}
                                        onClick={() =>
                                            setFiles([files[1], files[0]])
                                        }
                                    >
                                        <ArrowLeftRight size={18} />
                                    </button>
                                    <UploadCard
                                        index={1}
                                        file={files[1]}
                                        choose={choose}
                                        clear={() => setFiles([files[0], null])}
                                    />
                                </div>
                                <div className="upload-footnote">
                                    <LockKeyhole size={13} />
                                    ファイルは24時間後に自動削除されます。
                                    <span>
                                        PDF形式・各25MBまで・最大60ページ
                                    </span>
                                </div>
                                <div className="compare-settings">
                                    <div className="section-title">
                                        <span className="step-number">02</span>
                                        <h2>比較方法を選択</h2>
                                    </div>
                                    <div
                                        className="mode-options"
                                        role="radiogroup"
                                        aria-label="比較方法"
                                    >
                                        {(
                                            [
                                                "mixed",
                                                "text",
                                                "visual",
                                            ] as Mode[]
                                        ).map((m) => (
                                            <button
                                                key={m}
                                                role="radio"
                                                aria-checked={mode === m}
                                                className={
                                                    "mode-option " +
                                                    (mode === m ? "chosen" : "")
                                                }
                                                onClick={() => setMode(m)}
                                            >
                                                {m === "mixed" ? (
                                                    <Layers size={17} />
                                                ) : m === "text" ? (
                                                    <FileText size={17} />
                                                ) : (
                                                    <ScanLine size={17} />
                                                )}
                                                <span>{modeLabels[m]}</span>
                                                {m === "mixed" && (
                                                    <small>おすすめ</small>
                                                )}
                                                <i>{mode === m && <span />}</i>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="option-row">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={ignoreWhitespace}
                                                onChange={(e) =>
                                                    setIgnoreWhitespace(
                                                        e.target.checked,
                                                    )
                                                }
                                                disabled={mode === "visual"}
                                            />
                                            空白・改行の違いを無視
                                        </label>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={normalizeWidth}
                                                onChange={(e) =>
                                                    setNormalizeWidth(
                                                        e.target.checked,
                                                    )
                                                }
                                                disabled={mode === "visual"}
                                            />
                                            全角・半角を同一視
                                        </label>
                                        <button
                                            onClick={() =>
                                                setSettingsOpen(true)
                                            }
                                        >
                                            <Settings2 size={14} />
                                            比較について
                                        </button>
                                    </div>
                                </div>
                                <div className="start-row">
                                    <p>
                                        <ShieldCheck size={16} />
                                        このセッションのファイルだけを表示します
                                    </p>
                                    <button
                                        className="primary-button"
                                        disabled={
                                            !files[0] || !files[1] || loading
                                        }
                                        onClick={() => void start()}
                                    >
                                        {loading ? (
                                            <LoaderCircle
                                                className="spin"
                                                size={17}
                                            />
                                        ) : (
                                            <FileDiff size={18} />
                                        )}
                                        比較を開始
                                        <ArrowRight size={17} />
                                    </button>
                                </div>
                            </section>
                            <section className="sample-banner">
                                <div className="sample-copy">
                                    <div className="sample-label">
                                        <Sparkles size={13} />
                                        まずは、見てみましょう
                                    </div>
                                    <h2>小さな差分を、大きな安心に。</h2>
                                    <p>
                                        金額、日付、細かな文言まで。
                                        <br />
                                        日本語の見積書サンプルで、比較を体験できます。
                                    </p>
                                    <button
                                        className="text-button"
                                        onClick={() => void start(true)}
                                        disabled={loading}
                                    >
                                        <span>
                                            {loading
                                                ? "準備中…"
                                                : "サンプルPDFで試す"}
                                        </span>
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                                <DocumentIllustration />
                                <span className="sample-watermark">Aa</span>
                            </section>
                            <div className="benefit-row">
                                <div>
                                    <span className="benefit-icon">
                                        <ScanLine size={19} />
                                    </span>
                                    <span>
                                        <strong>細かな変更を見逃さない</strong>
                                        <small>
                                            文字・数字・図形の差分をハイライト
                                        </small>
                                    </span>
                                </div>
                                <div>
                                    <span className="benefit-icon">
                                        <Layers size={19} />
                                    </span>
                                    <span>
                                        <strong>
                                            帳票のレイアウトをそのままに
                                        </strong>
                                        <small>
                                            元のPDFを並べて、わかりやすく確認
                                        </small>
                                    </span>
                                </div>
                                <div>
                                    <span className="benefit-icon">
                                        <Zap size={19} />
                                    </span>
                                    <span>
                                        <strong>大きな書類も、順番に</strong>
                                        <small>
                                            処理中も別の比較を追加できます
                                        </small>
                                    </span>
                                </div>
                            </div>
                            <section className="recent-section">
                                <div className="recent-heading">
                                    <h2>
                                        <Clock3 size={17} />
                                        最近の比較
                                    </h2>
                                    <button onClick={() => navigate("history")}>
                                        すべての履歴
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                                {jobs.length ? (
                                    <JobList
                                        jobs={jobs.slice(0, 3)}
                                        open={openJob}
                                        remove={setDeleteTarget}
                                    />
                                ) : (
                                    <div className="empty-recent">
                                        <FolderClock size={22} />
                                        <span>
                                            比較したファイルがここに表示されます
                                        </span>
                                        <small>
                                            最初のPDFをアップロードして、はじめましょう。
                                        </small>
                                    </div>
                                )}
                            </section>
                            <footer className="page-footer">
                                <span>差分 sabun</span>
                                <p>書類の確認に、少しの余白を。</p>
                                <span>PDF COMPARISON WORKSPACE</span>
                            </footer>
                        </>
                    )}
                    {view === "new" && job && (
                        <>
                            {job.status === "COMPLETED" && job.result ? (
                                <ResultView
                                    job={job}
                                    back={() => setJob(null)}
                                />
                            ) : (
                                <div className="processing-section">
                                    <button
                                        className="text-button"
                                        onClick={() => setJob(null)}
                                    >
                                        <ArrowLeft size={16} />
                                        新しい比較へ
                                    </button>
                                    <div className="processing-card">
                                        <div
                                            className={
                                                "processing-icon " +
                                                (job.status === "FAILED"
                                                    ? "failed"
                                                    : "")
                                            }
                                        >
                                            {job.status === "FAILED" ? (
                                                <CircleHelp size={35} />
                                            ) : (
                                                <FileDiff size={35} />
                                            )}
                                        </div>
                                        <span className="eyebrow">
                                            DOCUMENT COMPARISON
                                        </span>
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
                                        {active(job) && (
                                            <>
                                                <div
                                                    className={
                                                        "progress-track " +
                                                        (job.status === "QUEUED"
                                                            ? "indeterminate"
                                                            : "")
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
                                                        <LoaderCircle
                                                            size={14}
                                                            className="spin"
                                                        />
                                                        {
                                                            statusLabels[
                                                                job.status
                                                            ]
                                                        }
                                                    </span>
                                                    <span>
                                                        {job.status ===
                                                        "PROCESSING"
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
                                        <button
                                            className="secondary-button"
                                            onClick={() => setJob(null)}
                                        >
                                            {job.status === "FAILED"
                                                ? "ファイルを選び直す"
                                                : "別のPDFを比較する"}
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {view === "history" && (
                        <>
                            <div className="page-heading">
                                <div>
                                    <div className="eyebrow">
                                        <span />
                                        COMPARISON HISTORY
                                    </div>
                                    <h1>比較履歴</h1>
                                    <p>
                                        このセッションで比較した書類を、もう一度確認できます。
                                    </p>
                                </div>
                                <button
                                    className="primary-button"
                                    onClick={() => navigate("new")}
                                >
                                    <Plus size={16} />
                                    新しい比較
                                </button>
                            </div>
                            <div className="history-card">
                                <div className="recent-heading">
                                    <h2>
                                        すべての比較{" "}
                                        <span className="count-badge">
                                            {jobs.length}
                                        </span>
                                    </h2>
                                    <span className="muted">
                                        24時間で自動削除
                                    </span>
                                </div>
                                {jobs.length ? (
                                    <JobList
                                        jobs={jobs}
                                        open={openJob}
                                        remove={setDeleteTarget}
                                    />
                                ) : (
                                    <div className="empty-state">
                                        <FolderClock size={38} />
                                        <h3>まだ比較履歴がありません</h3>
                                        <p>
                                            PDFをアップロードするか、サンプルで体験してみましょう。
                                        </p>
                                        <button
                                            className="primary-button"
                                            onClick={() => navigate("new")}
                                        >
                                            PDFを比較
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {view === "help" && (
                        <Help
                            start={() => navigate("new")}
                            demo={() => void start(true)}
                        />
                    )}
                </main>
            </div>
            {settingsOpen && (
                <Modal
                    title="比較の設定とヒント"
                    close={() => setSettingsOpen(false)}
                >
                    <p>
                        テキストと外観を組み合わせて、文字の修正から図形の変更まで確認できます。
                    </p>
                    <dl className="settings-description">
                        <dt>テキスト＋外観</dt>
                        <dd>
                            文字の位置をハイライトし、文字以外の領域は画像として比較します。一般的な帳票におすすめです。
                        </dd>
                        <dt>テキストのみ</dt>
                        <dd>
                            抽出可能な文字・数字を比較します。空白や全角・半角の違いを無視できます。
                        </dd>
                        <dt>外観のみ</dt>
                        <dd>
                            ページの画像を比較します。印影、罫線、スキャンした書類の確認に適しています。
                        </dd>
                    </dl>
                    <div className="info-box">
                        同じページ番号どうしを比較します。途中へのページ挿入や並び替え、傾きは自動補正されません。OCR・縦書きの読み順補正は含まれていません。
                    </div>
                    <button
                        className="primary-button full-width"
                        onClick={() => setSettingsOpen(false)}
                    >
                        確認しました
                        <Check size={16} />
                    </button>
                </Modal>
            )}
            {deleteTarget && (
                <Modal
                    title="比較データを削除しますか？"
                    close={() => setDeleteTarget(null)}
                >
                    <p>
                        「{deleteTarget.originalName}
                        」の比較結果と、アップロードした2つのPDFを削除します。この操作は取り消せません。
                    </p>
                    <div className="modal-actions">
                        <button
                            className="secondary-button"
                            onClick={() => setDeleteTarget(null)}
                        >
                            キャンセル
                        </button>
                        <button
                            className="danger-button"
                            onClick={() => void remove()}
                        >
                            <Trash2 size={16} />
                            削除する
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function ArrowUpRightIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M4 12 12 4M4 4h8v8"
                stroke="currentColor"
                strokeWidth="1.5"
            />
        </svg>
    );
}

function UploadCard({
    index,
    file,
    choose,
    clear,
}: {
    index: number;
    file: File | null;
    choose: (index: number, files: File[]) => Promise<void>;
    clear: () => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const depth = useRef(0);
    return (
        <div
            className={
                "upload-card " +
                (index === 1 ? "revised " : "") +
                (dragging ? "dragging " : "") +
                (file ? "has-file" : "")
            }
            onDragEnter={(e) => {
                e.preventDefault();
                depth.current++;
                setDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
                e.preventDefault();
                if (--depth.current <= 0) setDragging(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                depth.current = 0;
                setDragging(false);
                void choose(index, Array.from(e.dataTransfer.files));
            }}
        >
            <div className="upload-card-heading">
                <span className="file-label">{index === 0 ? "A" : "B"}</span>
                <strong>{index === 0 ? "変更前のPDF" : "変更後のPDF"}</strong>
                <span>{index === 0 ? "ORIGINAL" : "REVISED"}</span>
            </div>
            <input
                ref={input}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="file-input"
                aria-label={
                    index === 0 ? "変更前のPDFを選択" : "変更後のPDFを選択"
                }
                onChange={(e) => {
                    void choose(index, Array.from(e.target.files || []));
                    e.target.value = "";
                }}
            />
            {file ? (
                <div className="selected-file">
                    <span className="file-illustration">
                        <FileCheck2 size={33} strokeWidth={1.4} />
                        <span>PDF</span>
                    </span>
                    <strong title={file.name}>{file.name}</strong>
                    <p>
                        {fileSize(file.size)} <span>•</span>{" "}
                        アップロードの準備完了
                    </p>
                    <div>
                        <button
                            className="secondary-button"
                            onClick={() => input.current?.click()}
                        >
                            ファイルを変更
                        </button>
                        <button
                            className="icon-button"
                            onClick={clear}
                            aria-label={`${index === 0 ? "変更前" : "変更後"}のPDFを取り除く`}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="upload-card-body">
                    <span className="file-illustration">
                        <FileText size={33} strokeWidth={1.4} />
                        <span>PDF</span>
                        <i>
                            <Plus size={12} />
                        </i>
                    </span>
                    <strong>
                        {dragging
                            ? "ここにドロップ"
                            : "PDFをここにドラッグ＆ドロップ"}
                    </strong>
                    <span className="or-label">または</span>
                    <button
                        className="choose-file"
                        onClick={() => input.current?.click()}
                    >
                        <Upload size={15} />
                        ファイルを選択
                    </button>
                    <p>
                        {index === 0
                            ? "比較の基準となる書類"
                            : "変更を確認したい書類"}
                    </p>
                </div>
            )}
        </div>
    );
}

function DocumentIllustration() {
    return (
        <div className="document-art" aria-hidden="true">
            <div className="art-sheet art-before">
                <div className="mini-brand">MIDORI SYSTEMS</div>
                <h4>御 見 積 書</h4>
                <span className="mini-line" />
                <div className="mini-recipient">株式会社 青葉デザイン 御中</div>
                <div className="mini-total">
                    お見積金額 <span>￥1,210,000</span>
                </div>
                <div className="mini-table">
                    {[
                        "要件定義・設計",
                        "システム開発",
                        "テスト・品質保証",
                        "導入・運用サポート",
                    ].map((v, i) => (
                        <div key={v}>
                            <span>{v}</span>
                            <span>
                                {["300,000", "600,000", "150,000", "50,000"][i]}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mini-date">納品予定日：2026年12月15日</div>
                <div className="mini-lines">
                    <i />
                    <i />
                </div>
            </div>
            <div className="art-sheet art-after">
                <div className="mini-brand">MIDORI SYSTEMS</div>
                <h4>御 見 積 書</h4>
                <span className="mini-line" />
                <div className="mini-recipient">株式会社 青葉デザイン 御中</div>
                <div className="mini-total">
                    お見積金額{" "}
                    <span className="mini-highlight">￥1,375,000</span>
                </div>
                <div className="mini-table">
                    {[
                        "要件定義・設計",
                        "システム開発",
                        "テスト・品質保証",
                        "導入・運用サポート",
                    ].map((v, i) => (
                        <div key={v}>
                            <span>{v}</span>
                            <span
                                className={
                                    i === 1 || i === 3 ? "mini-highlight" : ""
                                }
                            >
                                {
                                    [
                                        "300,000",
                                        "700,000",
                                        "150,000",
                                        "100,000",
                                    ][i]
                                }
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mini-date">
                    納品予定日：
                    <span className="mini-highlight">2026年12月25日</span>
                </div>
                <div className="mini-lines">
                    <i />
                    <i />
                </div>
            </div>
            <span className="art-check">
                <CheckCheck size={20} />
            </span>
            <span className="art-note">
                <span />
                変更箇所をハイライト
            </span>
        </div>
    );
}

function JobList({
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
                            {active(j) ? (
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
                        disabled={active(j)}
                        onClick={() => remove(j)}
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            ))}
        </div>
    );
}

function ResultView({ job, back }: { job: Job; back: () => void }) {
    const result = job.result!;
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<string | null>(
        result.changes[0]?.id || null,
    );
    const [filter, setFilter] = useState("ALL");
    const [zoom, setZoom] = useState(100);
    const [overlay, setOverlay] = useState(false);
    const [opacity, setOpacity] = useState(50);
    const [highlights, setHighlights] = useState(true);
    const [warningsOpen, setWarningsOpen] = useState(false);
    const viewport = useRef<HTMLDivElement>(null);
    const pageMeta = result.pages[page - 1];
    const changes = result.changes.filter(
        (c) => filter === "ALL" || c.kind === filter,
    );
    const currentIndex = changes.findIndex((c) => c.id === selected);
    function select(c: Change) {
        setPage(c.page);
        setSelected(c.id);
    }
    useEffect(() => {
        const target = viewport.current?.querySelector<HTMLElement>(
            ".highlight.is-selected",
        );
        if (target)
            target.scrollIntoView({
                block: "center",
                inline: "nearest",
                behavior: "smooth",
            });
    }, [selected, page]);
    function step(direction: number) {
        const index =
            currentIndex < 0
                ? 0
                : (currentIndex + direction + changes.length) % changes.length;
        if (changes[index]) select(changes[index]);
    }
    return (
        <>
            <div className="result-heading">
                <div>
                    <button className="back-button" onClick={back}>
                        <ArrowLeft size={15} />
                        新しい比較
                    </button>
                    <h1>
                        比較結果{" "}
                        <span className="status-badge completed">
                            <CheckCheck size={13} />
                            比較完了
                        </span>
                    </h1>
                    <p>
                        {job.originalName}
                        <ArrowRight size={14} />
                        {job.revisedName}
                    </p>
                </div>
                <a
                    className="secondary-button"
                    href={`/api/comparisons/${job.id}/report`}
                    download
                >
                    <Download size={16} />
                    差分リストを出力
                </a>
            </div>
            <div className="result-summary">
                <span>
                    <span className="summary-icon">
                        <FileDiff size={20} />
                    </span>
                    <strong>{result.changes.length}</strong>件の差分
                    <span className="summary-divider" />
                    <small>{result.pages.length}ページを比較</small>
                </span>
                <div className="legend">
                    {(["MODIFIED", "ADDED", "DELETED", "VISUAL"] as Kind[]).map(
                        (k) => (
                            <span key={k}>
                                <i className={k.toLowerCase()} />
                                {kindLabels[k]}
                                <b>
                                    {
                                        result.changes.filter(
                                            (c) => c.kind === k,
                                        ).length
                                    }
                                </b>
                            </span>
                        ),
                    )}
                </div>
            </div>
            {result.warnings.length > 0 && (
                <div className="result-warnings">
                    <button
                        onClick={() => setWarningsOpen(!warningsOpen)}
                        aria-expanded={warningsOpen}
                    >
                        <CircleHelp size={14} />
                        比較結果を確認するときの注意点
                        <ChevronDown
                            size={14}
                            className={warningsOpen ? "rotated" : ""}
                        />
                    </button>
                    {warningsOpen && (
                        <ul>
                            {result.warnings.map((w) => (
                                <li key={w}>{w}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            <div className="results-workspace">
                <div className="document-workspace">
                    <div className="viewer-toolbar">
                        <div className="view-switch">
                            <button
                                className={!overlay ? "active" : ""}
                                onClick={() => setOverlay(false)}
                            >
                                <Layers size={14} />
                                並べて表示
                            </button>
                            <button
                                className={overlay ? "active" : ""}
                                onClick={() => setOverlay(true)}
                            >
                                <ScanLine size={14} />
                                重ねて表示
                            </button>
                        </div>
                        <div className="viewer-tools">
                            <button
                                className="icon-button"
                                aria-label="縮小"
                                disabled={zoom <= 60}
                                onClick={() => setZoom(zoom - 20)}
                            >
                                <Minus size={15} />
                            </button>
                            <span>{zoom}%</span>
                            <button
                                className="icon-button"
                                aria-label="拡大"
                                disabled={zoom >= 200}
                                onClick={() => setZoom(zoom + 20)}
                            >
                                <Plus size={15} />
                            </button>
                            <button
                                className="icon-button"
                                title="幅に合わせる"
                                aria-label="幅に合わせる"
                                onClick={() => setZoom(100)}
                            >
                                <Maximize2 size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="document-labels">
                        <span>
                            <span className="file-label">A</span>変更前
                            <span className="document-filename">
                                {job.originalName}
                            </span>
                        </span>
                        <span>
                            <span className="file-label revised-label">B</span>
                            変更後
                            <span className="document-filename">
                                {job.revisedName}
                            </span>
                        </span>
                    </div>
                    <div
                        ref={viewport}
                        className={
                            "pdf-viewport " + (overlay ? "overlay-mode" : "")
                        }
                    >
                        <div
                            className="pdf-pages"
                            style={{ width: `${zoom}%` }}
                        >
                            {(["original", "revised"] as const).map((side) => (
                                <div
                                    className={"pdf-page-holder " + side}
                                    key={side}
                                    style={
                                        overlay && side === "revised"
                                            ? { opacity: opacity / 100 }
                                            : undefined
                                    }
                                >
                                    {pageMeta[`${side}Exists`] ? (
                                        <div
                                            className="pdf-page"
                                            style={{
                                                aspectRatio: `${pageMeta[`${side}Width`]} / ${pageMeta[`${side}Height`]}`,
                                            }}
                                        >
                                            <PageImage
                                                src={`/api/comparisons/${job.id}/pages/${side}/${page}`}
                                                alt={`${side === "original" ? "変更前" : "変更後"}のPDF ${page}ページ`}
                                            />
                                            {highlights &&
                                                result.changes
                                                    .filter(
                                                        (c) =>
                                                            c.page === page &&
                                                            c[`${side}Box`],
                                                    )
                                                    .map((c) => {
                                                        const box =
                                                            c[`${side}Box`]!;
                                                        return (
                                                            <button
                                                                key={c.id}
                                                                aria-label={`${kindLabels[c.kind]}: ${c.before || c.after}`}
                                                                title={`${c.before} → ${c.after}`}
                                                                className={`highlight ${c.kind.toLowerCase()} ${selected === c.id ? "is-selected" : ""}`}
                                                                style={{
                                                                    left: `${box.x * 100}%`,
                                                                    top: `${box.y * 100}%`,
                                                                    width: `${box.width * 100}%`,
                                                                    height: `${box.height * 100}%`,
                                                                }}
                                                                onClick={() =>
                                                                    select(c)
                                                                }
                                                            />
                                                        );
                                                    })}
                                        </div>
                                    ) : (
                                        <div className="missing-page">
                                            <FileText size={32} />
                                            <p>このページはありません</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="viewer-footer">
                        <label>
                            <input
                                type="checkbox"
                                checked={highlights}
                                onChange={(e) =>
                                    setHighlights(e.target.checked)
                                }
                            />
                            差分をハイライト
                        </label>
                        {overlay && (
                            <label className="opacity-control">
                                重なり
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={opacity}
                                    onChange={(e) =>
                                        setOpacity(Number(e.target.value))
                                    }
                                    aria-label="変更後の不透明度"
                                />
                            </label>
                        )}
                        <div className="page-navigation">
                            <button
                                className="icon-button"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                                aria-label="前のページ"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <label>
                                <span className="sr-only">ページ</span>
                                <select
                                    value={page}
                                    onChange={(e) =>
                                        setPage(Number(e.target.value))
                                    }
                                >
                                    {result.pages.map((p) => (
                                        <option value={p.number} key={p.number}>
                                            {p.number}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <span>/ {result.pages.length}</span>
                            <button
                                className="icon-button"
                                disabled={page >= result.pages.length}
                                onClick={() => setPage(page + 1)}
                                aria-label="次のページ"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
                <aside className="changes-panel">
                    <div className="changes-heading">
                        <h2>
                            差分リスト
                            <span className="count-badge">
                                {result.changes.length}
                            </span>
                        </h2>
                        <div>
                            <button
                                className="icon-button"
                                disabled={!changes.length}
                                onClick={() => step(-1)}
                                title="前の差分"
                                aria-label="前の差分"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                className="icon-button"
                                disabled={!changes.length}
                                onClick={() => step(1)}
                                title="次の差分"
                                aria-label="次の差分"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="change-filter">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            aria-label="差分の種類で絞り込み"
                        >
                            <option value="ALL">すべての変更</option>
                            {Object.entries(kindLabels).map(([key, label]) => (
                                <option value={key} key={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <span>{changes.length}件</span>
                    </div>
                    <div className="changes-scroll">
                        {changes.length ? (
                            changes.map((c, i) => (
                                <button
                                    key={c.id}
                                    className={
                                        "change-card " +
                                        (selected === c.id ? "is-selected" : "")
                                    }
                                    onClick={() => select(c)}
                                >
                                    <div className="change-card-top">
                                        <span
                                            className={
                                                "change-kind " +
                                                c.kind.toLowerCase()
                                            }
                                        >
                                            <i />
                                            {kindLabels[c.kind]}
                                        </span>
                                        <span>
                                            {c.page}ページ{" "}
                                            <span className="change-index">
                                                #{i + 1}
                                            </span>
                                        </span>
                                    </div>
                                    {c.before && (
                                        <div className="before-value">
                                            <Minus size={12} />
                                            <span>{c.before}</span>
                                        </div>
                                    )}
                                    {c.after && (
                                        <div className="after-value">
                                            <Plus size={12} />
                                            <span>{c.after}</span>
                                        </div>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="no-changes">
                                <CheckCheck size={31} />
                                <strong>
                                    {result.changes.length
                                        ? "該当する差分はありません"
                                        : "差分は見つかりませんでした"}
                                </strong>
                                <p>
                                    {result.changes.length
                                        ? "別の種類を選択してください。"
                                        : "選択した比較方法では、2つの書類に違いはありません。"}
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="change-panel-footer">
                        <span className="keyboard-hint">
                            <ScanLine size={13} />
                            差分をクリックして該当箇所へ
                        </span>
                    </div>
                </aside>
            </div>
        </>
    );
}

function PageImage({ src, alt }: { src: string; alt: string }) {
    const [error, setError] = useState(false);
    useEffect(() => setError(false), [src]);
    return error ? (
        <div className="image-error">
            <CircleHelp size={24} />
            <p>
                ページを読み込めませんでした。
                <br />
                履歴から比較を開き直してください。
            </p>
        </div>
    ) : (
        <img
            src={src}
            alt={alt}
            onError={() => setError(true)}
            draggable={false}
        />
    );
}

function Help({ start, demo }: { start: () => void; demo: () => void }) {
    return (
        <>
            <div className="page-heading">
                <div>
                    <div className="eyebrow">
                        <span />
                        GETTING STARTED
                    </div>
                    <h1>書類の確認を、もっと軽やかに。</h1>
                    <p>3つのステップで、変更箇所をすばやく見つけられます。</p>
                </div>
            </div>
            <div className="help-steps">
                {[
                    {
                        icon: <Upload />,
                        title: "2つのPDFを選ぶ",
                        text: "変更前・変更後のPDFをドラッグ＆ドロップ。各25MB、60ページまで比較できます。",
                    },
                    {
                        icon: <Settings2 />,
                        title: "比較方法を選ぶ",
                        text: "通常は「テキスト＋外観」がおすすめ。スキャン書類は「外観のみ」を選んでください。",
                    },
                    {
                        icon: <FileCheck2 />,
                        title: "差分を確認する",
                        text: "変更箇所をハイライト表示。差分リストからジャンプして、CSVに書き出せます。",
                    },
                ].map((s, i) => (
                    <div key={s.title}>
                        <span className="help-step-number">0{i + 1}</span>
                        <span className="help-step-icon">{s.icon}</span>
                        <h2>{s.title}</h2>
                        <p>{s.text}</p>
                    </div>
                ))}
            </div>
            <div className="help-bottom">
                <h2>比較の前に知っておきたいこと</h2>
                <dl className="settings-description">
                    <dt>日本語や表の内容は比較できますか？</dt>
                    <dd>
                        PDFに埋め込まれた日本語テキストを抽出し、元の位置にハイライトします。文字間の大きな空白を手がかりに、帳票の項目を分けて比較します。文字を正しく抽出できないPDFでは、外観比較も併用してください。
                    </dd>
                    <dt>スキャンしたPDFは？</dt>
                    <dd>
                        画像として外観を比較できます。OCRは含まれないため、スキャン画像の文字を差分リストに書き出すことはできません。傾きや解像度の違いも差分になる場合があります。
                    </dd>
                    <dt>ページの順番が変わった場合は？</dt>
                    <dd>
                        同じページ番号どうしを比較します。途中に追加されたページや順番の変更を自動で対応づけることはできません。
                    </dd>
                    <dt>ファイルはいつ削除されますか？</dt>
                    <dd>
                        完了・エラーになった比較データは作成から24時間後に自動削除されます。履歴から手動で削除することもできます。履歴は現在のブラウザーセッションに紐づいています。
                    </dd>
                </dl>
                <div className="help-actions">
                    <button className="primary-button" onClick={start}>
                        PDFを比較する
                        <ArrowRight size={16} />
                    </button>
                    <button className="secondary-button" onClick={demo}>
                        サンプルで試す
                        <Sparkles size={15} />
                    </button>
                </div>
            </div>
        </>
    );
}

function Modal({
    title,
    close,
    children,
}: {
    title: string;
    close: () => void;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const onClose = useRef(close);
    onClose.current = close;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement;
        ref.current?.focus();
        function key(e: KeyboardEvent) {
            if (e.key === "Escape") onClose.current();
            if (e.key === "Tab") {
                const items = ref.current?.querySelectorAll<HTMLElement>(
                    'button, a, input, select, [tabindex="0"]',
                );
                if (!items?.length) return;
                const first = items[0],
                    last = items[items.length - 1];
                if (
                    e.shiftKey &&
                    (document.activeElement === first ||
                        document.activeElement === ref.current)
                ) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
        document.addEventListener("keydown", key);
        const before = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", key);
            document.body.style.overflow = before;
            previous?.focus();
        };
    }, []);
    return (
        <div
            className="modal-backdrop"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) close();
            }}
        >
            <div
                className="modal"
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
            >
                <div className="modal-heading">
                    <h2>{title}</h2>
                    <button
                        className="icon-button"
                        onClick={close}
                        aria-label="閉じる"
                    >
                        <X size={19} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default App;
