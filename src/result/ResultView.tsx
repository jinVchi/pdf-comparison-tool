import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  FileDiff,
  FileText,
  Layers,
  Maximize2,
  Minus,
  Plus,
  ScanLine,
} from "lucide-react";
import type { Change, Job, Kind } from "../comparison/types";
import { kindLabels } from "../comparison/types";
import PageImage from "./PageImage";

/** `backLabel` names where `back` leads when that is not the new comparison page. */
export default function ResultView({
  job,
  back,
  backLabel = "新しい比較",
}: {
  job: Job;
  back: () => void;
  backLabel?: string;
}) {
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
            {backLabel}
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
          {(["MODIFIED", "NUMERIC", "ADDED", "DELETED", "VISUAL"] as Kind[]).map(
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
