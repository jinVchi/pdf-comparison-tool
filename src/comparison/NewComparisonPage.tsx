import type { Mode } from "./types";
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
}: {
  files: ComparisonFiles;
  setFiles: (files: ComparisonFiles) => void;
  choose: (index: number, files: File[]) => Promise<void>;
  options: ComparisonOptions;
  setOptions: (options: ComparisonOptions) => void;
  loading: boolean;
  start: () => void;
}) {
  const { mode, ignoreWhitespace, normalizeWidth } = options;
  return (
    <>
      <h1>PDFを比較</h1>
      <section className="panel">
        <div className="upload-pair">
          <UploadCard
            index={0}
            file={files[0]}
            choose={choose}
            clear={() => setFiles([null, files[1]])}
          />
          <button
            title="変更前と変更後を入れ替える"
            className="swap"
            aria-label="変更前と変更後を入れ替える"
            disabled={!files.some(Boolean)}
            onClick={() => setFiles([files[1], files[0]])}
          >
            ⇄
          </button>
          <UploadCard
            index={1}
            file={files[1]}
            choose={choose}
            clear={() => setFiles([files[0], null])}
          />
        </div>
        <p className="muted">
          PDF形式・各25MBまで・最大60ページ。ファイルは24時間後に自動削除されます。
        </p>
        <div className="settings">
          <fieldset>
            <legend>比較方法</legend>
            {(["mixed", "text", "visual"] as Mode[]).map((m) => (
              <label key={m}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === m}
                  onChange={() => setOptions({ ...options, mode: m })}
                />
                {modeLabels[m]}
              </label>
            ))}
          </fieldset>
          <fieldset disabled={mode === "visual"}>
            <legend>オプション</legend>
            <label>
              <input
                type="checkbox"
                checked={ignoreWhitespace}
                onChange={(e) =>
                  setOptions({ ...options, ignoreWhitespace: e.target.checked })
                }
              />
              空白・改行の違いを無視
            </label>
            <label>
              <input
                type="checkbox"
                checked={normalizeWidth}
                onChange={(e) =>
                  setOptions({ ...options, normalizeWidth: e.target.checked })
                }
              />
              全角・半角を同一視
            </label>
          </fieldset>
        </div>
        <div className="panel-footer">
          <button
            className="primary"
            disabled={!files[0] || !files[1] || loading}
            onClick={start}
          >
            {loading ? "処理中…" : "比較を開始"}
          </button>
        </div>
      </section>
    </>
  );
}
