import type { Job } from "../comparison/types";
import Modal from "../shared/Modal";

export default function CancelJobModal({
  job,
  close,
  confirm,
}: {
  job: Job;
  close: () => void;
  confirm: () => void;
}) {
  return (
    <Modal title="比較を取り消しますか？" close={close}>
      <p>
        「{job.originalName}
        」の比較を取り消し、アップロードした2つのPDFを削除します。この操作は元に戻せません。
      </p>
      <div className="modal-actions">
        <button onClick={close}>
          戻る
        </button>
        <button className="danger" onClick={confirm}>
          取り消す
        </button>
      </div>
    </Modal>
  );
}
