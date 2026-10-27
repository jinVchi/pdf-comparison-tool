import { ArrowRight, FileCheck2, Settings2, Sparkles, Upload } from "lucide-react";

export default function HelpPage({
  start,
  demo,
}: {
  start: () => void;
  demo: () => void;
}) {
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
            テキスト＋外観の比較では、印字された数値をOCRで認識し、数値変更として変更前・変更後の値を表示します。日本語本文のOCRには対応していません。低解像度の画像には誤認識の可能性があり、認識できない領域は画像上の差分として残ります。外観のみの比較ではOCRを使いません。傾きや解像度の違いも差分になる場合があります。
          </dd>
          <dt>ページの順番が変わった場合は？</dt>
          <dd>
            同じページ番号どうしを比較します。途中に追加されたページや順番の変更を自動で対応づけることはできません。
          </dd>
          <dt>ファイルはいつ削除されますか？</dt>
          <dd>
            完了・エラーになった比較データは作成から24時間後に自動削除されます。履歴から手動で削除することもできます。履歴はアカウントに保存され、ログインすれば別のブラウザーからも確認できます。PDFの比較・履歴の閲覧にはログインが必要です。
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
