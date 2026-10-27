import { CheckCheck } from "lucide-react";

export default function DocumentIllustration() {
  return (
    <div className="document-art" aria-hidden="true">
      <div className="art-sheet art-before">
        <div className="mini-brand">MIDORI SYSTEMS</div>
        <h4>御 見 積 書</h4>
        <span className="mini-line" />
        <div className="mini-recipient">株式会社 青葉デザイン 御中</div>
        <div className="mini-total">
          お見積金額 <span>￥1,210,000</span>
        </div>
        <div className="mini-table">
          {[
            "要件定義・設計",
            "システム開発",
            "テスト・品質保証",
            "導入・運用サポート",
          ].map((v, i) => (
            <div key={v}>
              <span>{v}</span>
              <span>
                {["300,000", "600,000", "150,000", "50,000"][i]}
              </span>
            </div>
          ))}
        </div>
        <div className="mini-date">納品予定日：2026年12月15日</div>
        <div className="mini-lines">
          <i />
          <i />
        </div>
      </div>
      <div className="art-sheet art-after">
        <div className="mini-brand">MIDORI SYSTEMS</div>
        <h4>御 見 積 書</h4>
        <span className="mini-line" />
        <div className="mini-recipient">株式会社 青葉デザイン 御中</div>
        <div className="mini-total">
          お見積金額{" "}
          <span className="mini-highlight">￥1,375,000</span>
        </div>
        <div className="mini-table">
          {[
            "要件定義・設計",
            "システム開発",
            "テスト・品質保証",
            "導入・運用サポート",
          ].map((v, i) => (
            <div key={v}>
              <span>{v}</span>
              <span
                className={
                  i === 1 || i === 3 ? "mini-highlight" : ""
                }
              >
                {
                  [
                    "300,000",
                    "700,000",
                    "150,000",
                    "100,000",
                  ][i]
                }
              </span>
            </div>
          ))}
        </div>
        <div className="mini-date">
          納品予定日：
          <span className="mini-highlight">2026年12月25日</span>
        </div>
        <div className="mini-lines">
          <i />
          <i />
        </div>
      </div>
      <span className="art-check">
        <CheckCheck size={20} />
      </span>
      <span className="art-note">
        <span />
        変更箇所をハイライト
      </span>
    </div>
  );
}
