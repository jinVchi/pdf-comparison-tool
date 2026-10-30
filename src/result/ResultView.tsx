import { useEffect, useRef, useState } from "react";
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
    viewport.current
      ?.querySelector<HTMLElement>(".highlight.is-selected")
      ?.scrollIntoView({ block: "center", inline: "nearest" });
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
      <button className="link" onClick={back}>
        ← {backLabel}
      </button>
      <div className="result-heading">
        <h1>比較結果</h1>
        <span>
          {job.originalName} → {job.revisedName}・{result.changes.length}
          件の差分・{result.pages.length}ページ
        </span>
        <a href={`/api/comparisons/${job.id}/report`} download>
          差分リストを出力
        </a>
      </div>
      {result.warnings.length > 0 && (
        <details>
          <summary>注意点（{result.warnings.length}）</summary>
          <ul>
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="results-workspace">
        <div className="document-workspace">
          <div className="toolbar">
            <button aria-pressed={!overlay} onClick={() => setOverlay(false)}>
              並べて表示
            </button>
            <button aria-pressed={overlay} onClick={() => setOverlay(true)}>
              重ねて表示
            </button>
            {overlay && (
              <label>
                重なり
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  aria-label="変更後の不透明度"
                />
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={highlights}
                onChange={(e) => setHighlights(e.target.checked)}
              />
              ハイライト
            </label>
            <span className="toolbar-gap" />
            <button
              aria-label="縮小"
              disabled={zoom <= 60}
              onClick={() => setZoom(zoom - 20)}
            >
              −
            </button>
            <span>{zoom}%</span>
            <button
              aria-label="拡大"
              disabled={zoom >= 200}
              onClick={() => setZoom(zoom + 20)}
            >
              ＋
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              aria-label="前のページ"
            >
              ‹
            </button>
            <label>
              <span className="sr-only">ページ</span>
              <select
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
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
              disabled={page >= result.pages.length}
              onClick={() => setPage(page + 1)}
              aria-label="次のページ"
            >
              ›
            </button>
          </div>
          {!overlay && (
            <div className="document-labels">
              <span title={job.originalName}>変更前：{job.originalName}</span>
              <span title={job.revisedName}>変更後：{job.revisedName}</span>
            </div>
          )}
          <div
            ref={viewport}
            className={"pdf-viewport " + (overlay ? "overlay-mode" : "")}
          >
            <div className="pdf-pages" style={{ width: `${zoom}%` }}>
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
                          .filter((c) => c.page === page && c[`${side}Box`])
                          .map((c) => {
                            const box = c[`${side}Box`]!;
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
                                onClick={() => select(c)}
                              />
                            );
                          })}
                    </div>
                  ) : (
                    <p className="missing-page">このページはありません</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="changes-panel">
          <div className="changes-heading">
            <h2>差分リスト</h2>
            <button
              disabled={!changes.length}
              onClick={() => step(-1)}
              aria-label="前の差分"
            >
              ‹
            </button>
            <button
              disabled={!changes.length}
              onClick={() => step(1)}
              aria-label="次の差分"
            >
              ›
            </button>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="差分の種類で絞り込み"
          >
            <option value="ALL">すべて（{result.changes.length}）</option>
            {(Object.keys(kindLabels) as Kind[]).map((k) => (
              <option value={k} key={k}>
                {kindLabels[k]}（
                {result.changes.filter((c) => c.kind === k).length}）
              </option>
            ))}
          </select>
          <div className="changes-scroll">
            {changes.length ? (
              changes.map((c) => (
                <button
                  key={c.id}
                  className={
                    "change-card " + (selected === c.id ? "is-selected" : "")
                  }
                  onClick={() => select(c)}
                >
                  <span className={"change-kind " + c.kind.toLowerCase()}>
                    {kindLabels[c.kind]}・{c.page}ページ
                  </span>
                  {c.before && <span className="before-value">− {c.before}</span>}
                  {c.after && <span className="after-value">＋ {c.after}</span>}
                </button>
              ))
            ) : (
              <p className="muted">
                {result.changes.length
                  ? "該当する差分はありません"
                  : "差分は見つかりませんでした"}
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
