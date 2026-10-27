import { useRef, useState } from "react";
import { FileCheck2, FileText, Plus, Upload, X } from "lucide-react";
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
