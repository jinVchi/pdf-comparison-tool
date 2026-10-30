import { useRef, useState } from "react";
import { fileSize } from "../shared/format";

export default function UploadCard({
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
  const label = index === 0 ? "変更前" : "変更後";
  return (
    <div
      className={dragging ? "upload-card dragging" : "upload-card"}
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
      <strong>{label}のPDF</strong>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        aria-label={`${label}のPDFを選択`}
        onChange={(e) => {
          void choose(index, Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      {file ? (
        <>
          <span className="file-name" title={file.name}>
            {file.name}（{fileSize(file.size)}）
          </span>
          <span>
            <button onClick={() => input.current?.click()}>変更</button>{" "}
            <button onClick={clear} aria-label={`${label}のPDFを取り除く`}>
              取り除く
            </button>
          </span>
        </>
      ) : (
        <>
          <button onClick={() => input.current?.click()}>
            ファイルを選択
          </button>
          <span className="muted">
            {dragging ? "ここにドロップ" : "またはドラッグ＆ドロップ"}
          </span>
        </>
      )}
    </div>
  );
}
