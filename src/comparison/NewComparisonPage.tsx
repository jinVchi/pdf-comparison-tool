import {
  ArrowLeftRight,
  ArrowRight,
  Clock3,
  FileDiff,
  FileText,
  FolderClock,
  Layers,
  LoaderCircle,
  LockKeyhole,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import JobList from "../history/JobList";
import DocumentIllustration from "./DocumentIllustration";
import type { Job, Mode } from "./types";
import { modeLabels } from "./types";
import UploadCard from "./UploadCard";

export type ComparisonFiles = [File | null, File | null];
export type ComparisonOptions = {
  mode: Mode;
  ignoreWhitespace: boolean;
  normalizeWidth: boolean;
};

export default function NewComparisonPage({
  files,
  setFiles,
  choose,
  options,
  setOptions,
  loading,
  start,
  demo,
  openSettings,
  recentJobs,
  openJob,
  removeJob,
  showHistory,
}: {
  files: ComparisonFiles;
  setFiles: (files: ComparisonFiles) => void;
  choose: (index: number, files: File[]) => Promise<void>;
  options: ComparisonOptions;
  setOptions: (options: ComparisonOptions) => void;
  loading: boolean;
  start: () => void;
  demo: () => void;
  openSettings: () => void;
  recentJobs: Job[];
  openJob: (job: Job) => void;
  removeJob: (job: Job) => void;
  showHistory: () => void;
}) {
  const { mode, ignoreWhitespace, normalizeWidth } = options;
  return (
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
            onClick={() => setFiles([files[1], files[0]])}
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
          <span>PDF形式・各25MBまで・最大60ページ</span>
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
            {(["mixed", "text", "visual"] as Mode[]).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                className={
                  "mode-option " + (mode === m ? "chosen" : "")
                }
                onClick={() => setOptions({ ...options, mode: m })}
              >
                {m === "mixed" ? (
                  <Layers size={17} />
                ) : m === "text" ? (
                  <FileText size={17} />
                ) : (
                  <ScanLine size={17} />
                )}
                <span>{modeLabels[m]}</span>
                {m === "mixed" && <small>おすすめ</small>}
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
                  setOptions({
                    ...options,
                    ignoreWhitespace: e.target.checked,
                  })
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
                  setOptions({
                    ...options,
                    normalizeWidth: e.target.checked,
                  })
                }
                disabled={mode === "visual"}
              />
              全角・半角を同一視
            </label>
            <button onClick={openSettings}>
              <Settings2 size={14} />
              比較について
            </button>
          </div>
        </div>
        <div className="start-row">
          <p>
            <ShieldCheck size={16} />
            このアカウントのファイルだけを表示します
          </p>
          <button
            className="primary-button"
            disabled={!files[0] || !files[1] || loading}
            onClick={start}
          >
            {loading ? (
              <LoaderCircle className="spin" size={17} />
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
            onClick={demo}
            disabled={loading}
          >
            <span>{loading ? "準備中…" : "サンプルPDFで試す"}</span>
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
            <small>文字・数字・図形の差分をハイライト</small>
          </span>
        </div>
        <div>
          <span className="benefit-icon">
            <Layers size={19} />
          </span>
          <span>
            <strong>帳票のレイアウトをそのままに</strong>
            <small>元のPDFを並べて、わかりやすく確認</small>
          </span>
        </div>
        <div>
          <span className="benefit-icon">
            <Zap size={19} />
          </span>
          <span>
            <strong>大きな書類も、順番に</strong>
            <small>処理中も別の比較を追加できます</small>
          </span>
        </div>
      </div>
      <section className="recent-section">
        <div className="recent-heading">
          <h2>
            <Clock3 size={17} />
            最近の比較
          </h2>
          <button onClick={showHistory}>
            すべての履歴
            <ArrowRight size={14} />
          </button>
        </div>
        {recentJobs.length ? (
          <JobList jobs={recentJobs} open={openJob} remove={removeJob} />
        ) : (
          <div className="empty-recent">
            <FolderClock size={22} />
            <span>比較したファイルがここに表示されます</span>
            <small>最初のPDFをアップロードして、はじめましょう。</small>
          </div>
        )}
      </section>
      <footer className="page-footer">
        <span>差分 sabun</span>
        <p>書類の確認に、少しの余白を。</p>
        <span>PDF COMPARISON WORKSPACE</span>
      </footer>
    </>
  );
}
