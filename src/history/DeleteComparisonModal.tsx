import { Trash2 } from "lucide-react";
import type { Job } from "../comparison/types";
import Modal from "../shared/Modal";

export default function DeleteComparisonModal({
  job,
  cancel,
  confirm,
}: {
  job: Job;
  cancel: () => void;
  confirm: () => void;
}) {
  return (
    <Modal title="比較データを削除しますか？" close={cancel}>
      <p>
        「{job.originalName}
        」の比較結果と、アップロードした2つのPDFを削除します。この操作は取り消せません。
      </p>
      <div className="modal-actions">
        <button className="secondary-button" onClick={cancel}>
          キャンセル
        </button>
        <button className="danger-button" onClick={confirm}>
          <Trash2 size={16} />
          削除する
        </button>
      </div>
    </Modal>
  );
}
