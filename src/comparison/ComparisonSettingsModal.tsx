import { Check } from "lucide-react";
import Modal from "../shared/Modal";

export default function ComparisonSettingsModal({ close }: { close: () => void }) {
  return (
    <Modal title="比較の設定とヒント" close={close}>
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
        同じページ番号どうしを比較します。途中へのページ挿入や並び替え、傾きは自動補正されません。画像内の印字された数値はOCRで認識します。日本語本文のOCR・縦書きの読み順補正は含まれていません。
      </div>
      <button className="primary-button full-width" onClick={close}>
        確認しました
        <Check size={16} />
      </button>
    </Modal>
  );
}
