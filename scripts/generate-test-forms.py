"""Generate a reproducible Japanese comparison fixture and verify its 12 edits."""
from pathlib import Path
import difflib
import json
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)
FONT = "JapaneseForm"
pdfmetrics.registerFont(TTFont(FONT, "C:/Windows/Fonts/msgothic.ttc", subfontIndex=0))
W, H = A4
LEFT, RIGHT = 38, W - 38
INK = HexColor("#243b34")
MUTED = HexColor("#728177")
GRID = HexColor("#cbd5cc")
PALE = HexColor("#eef3ed")

EDITS = [
    (1, "申請番号", "REG-2026-0186", "REG-2026-0188"),
    (1, "担当部署", "営業企画部", "営業企画課"),
    (1, "支店番号", "318", "381"),
    (1, "支払期日", "翌月末日", "翌々月末日"),
    (1, "与信限度額", "5,000,000 円", "5,050,000 円"),
    (2, "No.08 標準数量", "24", "25"),
    (2, "No.17 品目コード", "P-1017", "P-1071"),
    (2, "No.23 規格", "0.50mm", "0.55mm"),
    (2, "No.29 参考単価", "1,280", "1,290"),
    (3, "第2項 検収期間", "5営業日以内", "6営業日以内"),
    (3, "第5項 変更手続", "事前に書面", "事後に書面"),
    (3, "第8項 通知方法", "電子メールで通知", "電子メールでも通知"),
]


def text(c, x, y, value, size=9, color=INK):
    c.setFillColor(color)
    c.setFont(FONT, size)
    c.drawString(x, y, value)


def right_text(c, x, y, value, size=9, color=INK):
    c.setFillColor(color)
    c.setFont(FONT, size)
    c.drawRightString(x, y, value)


def rule(c, y):
    c.setStrokeColor(GRID)
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)


def header(c, page, title, subtitle):
    text(c, LEFT, H - 35, "AOBA OFFICE / SUPPLIER REGISTRATION", 7, MUTED)
    right_text(c, RIGHT, H - 35, "架空データ・比較検証用", 7, MUTED)
    text(c, LEFT, H - 70, title, 20)
    text(c, LEFT, H - 92, subtitle, 8, MUTED)
    rule(c, H - 108)
    rule(c, 46)
    text(c, LEFT, 30, "株式会社 青葉事務サービス  |  取引先登録・確認資料", 7, MUTED)
    right_text(c, RIGHT, 30, f"{page} / 3", 8, MUTED)


def section(c, y, number, title):
    c.setFillColor(PALE)
    c.rect(LEFT, y - 6, RIGHT - LEFT, 22, fill=1, stroke=0)
    text(c, LEFT + 9, y + 1, f"{number}  {title}", 10)


def field_row(c, y, left_label, left_value, right_label, right_value):
    # Fixed coordinates keep surrounding fields identical in both versions.
    text(c, LEFT + 8, y, left_label, 8, MUTED)
    text(c, LEFT + 92, y, left_value, 9)
    text(c, LEFT + 275, y, right_label, 8, MUTED)
    text(c, LEFT + 357, y, right_value, 9)
    rule(c, y - 12)


def page_one(c, revised):
    header(c, 1, "取引先登録・支払条件確認票", "登録区分：新規取引先  /  受付日：2026年10月15日  /  管理区分：国内法人")
    section(c, 700, "01", "取引先・申請情報")
    rows = [
        ("申請番号", "REG-2026-0188" if revised else "REG-2026-0186", "申請日", "2026年10月15日"),
        ("法人名", "株式会社 若葉文具", "取引先コード", "V-002417"),
        ("フリガナ", "カブシキガイシャ ワカバブング", "法人区分", "株式会社"),
        ("担当部署", "営業企画課" if revised else "営業企画部", "担当者", "青葉 花子（架空）"),
        ("郵便番号", "100-0000", "電話番号", "03-0000-0000"),
        ("所在地", "東京都架空区青葉1-2-3", "建物名", "若葉ビル 3階"),
        ("連絡先メール", "office@example.com", "請求書形式", "PDF・電子送付"),
    ]
    for i, row in enumerate(rows):
        field_row(c, 668 - i * 31, *row)
    section(c, 426, "02", "振込先・取引条件")
    rows = [
        ("金融機関名", "架空あおば銀行", "金融機関コード", "0000"),
        ("支店名", "若葉支店（架空）", "支店番号", "381" if revised else "318"),
        ("口座種別", "普通", "口座番号", "0000000"),
        ("口座名義", "カ）ワカバブング", "締日", "毎月末日"),
        ("支払期日", "翌々月末日" if revised else "翌月末日", "振込手数料", "当社負担"),
        ("与信限度額", "5,050,000 円" if revised else "5,000,000 円", "取引通貨", "日本円（JPY）"),
    ]
    for i, row in enumerate(rows):
        field_row(c, 394 - i * 31, *row)
    section(c, 181, "03", "確認事項")
    text(c, LEFT + 8, 153, "登録内容および振込先は、申請部門と経理部門の双方で確認すること。", 9)
    text(c, LEFT + 8, 134, "品目別の標準条件は次ページ、発注・検収の取扱いは3ページ目による。", 9)
    text(c, LEFT + 8, 108, "確認担当：山田 一郎（架空）    確認日：2026年10月16日    登録状態：確認待ち", 8)
    text(c, LEFT + 8, 81, "注：本資料に記載した法人・人物・所在地・口座情報は、すべて検証用の架空情報です。", 7, MUTED)
    c.showPage()


ITEMS = [
    ("コピー用紙", "A4・500枚", 10, "冊", 480, "3営業日"),
    ("コピー用紙", "A3・500枚", 6, "冊", 980, "3営業日"),
    ("再生紙ノート", "A5・40枚", 30, "冊", 180, "5営業日"),
    ("リングノート", "B5・80枚", 12, "冊", 320, "5営業日"),
    ("クリアファイル", "A4・透明", 100, "枚", 45, "3営業日"),
    ("個別フォルダー", "A4・青", 40, "枚", 95, "5営業日"),
    ("インデックス", "A4・12山", 15, "組", 240, "5営業日"),
    ("油性ボールペン", "黒・0.7mm", 24, "本", 120, "3営業日"),
    ("油性ボールペン", "赤・0.7mm", 12, "本", 120, "3営業日"),
    ("水性サインペン", "黒・細字", 18, "本", 160, "5営業日"),
    ("蛍光マーカー", "黄・中字", 20, "本", 130, "3営業日"),
    ("シャープペン", "0.5mm", 15, "本", 280, "5営業日"),
    ("替芯", "HB・0.5mm", 20, "個", 200, "5営業日"),
    ("消しゴム", "標準・白", 25, "個", 90, "3営業日"),
    ("修正テープ", "幅5mm", 12, "個", 350, "5営業日"),
    ("付箋", "75×75mm", 20, "個", 280, "3営業日"),
    ("付箋", "50×15mm", 30, "個", 210, "3営業日"),
    ("ダブルクリップ", "中・10個", 15, "箱", 240, "5営業日"),
    ("ゼムクリップ", "大・100個", 10, "箱", 180, "3営業日"),
    ("ステープラー", "10号針対応", 5, "台", 780, "5営業日"),
    ("ステープル針", "10号・1000本", 20, "箱", 90, "3営業日"),
    ("カッターナイフ", "小型・9mm", 8, "本", 420, "5営業日"),
    ("保護シート", "0.50mm", 16, "枚", 650, "7営業日"),
    ("定規", "30cm・透明", 12, "本", 260, "3営業日"),
    ("両面テープ", "幅15mm", 10, "巻", 380, "5営業日"),
    ("製本テープ", "幅35mm・黒", 8, "巻", 580, "5営業日"),
    ("封筒", "長3・100枚", 10, "袋", 420, "3営業日"),
    ("封筒", "角2・100枚", 6, "袋", 980, "5営業日"),
    ("ラベル用紙", "A4・12面", 8, "袋", 1280, "5営業日"),
    ("伝票用紙", "A5・複写", 12, "冊", 460, "7営業日"),
    ("書類保存箱", "A4・段ボール", 15, "個", 340, "5営業日"),
    ("デスクトレー", "A4・グレー", 10, "個", 880, "7営業日"),
]


def page_two(c, revised):
    header(c, 2, "品目別・標準発注条件", "対象部門：総務部・営業企画部  /  適用開始日：2026年11月1日  /  登録品目数：32件")
    text(c, LEFT, 711, "参考単価は税抜。標準数量は発注時の目安とし、発注金額の合計を示すものではありません。", 8, MUTED)
    widths = [25, 60, 119, 85, 40, 30, 72, RIGHT - LEFT - 431]
    xs = [LEFT]
    for width in widths:
        xs.append(xs[-1] + width)
    table_top, row_h = 692, 17
    c.setFillColor(PALE)
    c.rect(LEFT, table_top - 23, RIGHT - LEFT, 23, fill=1, stroke=0)
    labels = ["No.", "品目コード", "品目名", "規格", "標準数量", "単位", "参考単価（円）", "納期目安"]
    for i, label in enumerate(labels):
        text(c, xs[i] + 4, table_top - 15, label, 7)
    for i, item in enumerate(ITEMS, start=1):
        name, spec, qty, unit, price, lead = item
        code = f"P-{1000+i}"
        if revised:
            if i == 8: qty = 25
            if i == 17: code = "P-1071"
            if i == 23: spec = "0.55mm"
            if i == 29: price = 1290
        row = [f"{i:02d}", code, name, spec, str(qty), unit, f"{price:,}", lead]
        y = table_top - 23 - (i - 1) * row_h
        if i % 2 == 0:
            c.setFillColor(HexColor("#f8faf7"))
            c.rect(LEFT, y - row_h, RIGHT - LEFT, row_h, fill=1, stroke=0)
        for col, value in enumerate(row):
            if col in (4, 6): right_text(c, xs[col + 1] - 5, y - 11.8, value, 7.5)
            else: text(c, xs[col] + 4, y - 11.8, value, 7.5)
        rule(c, y - row_h)
    c.setStrokeColor(GRID)
    c.setLineWidth(0.4)
    for x in xs:
        c.line(x, table_top, x, table_top - 23 - 32 * row_h)
    rule(c, table_top)
    rule(c, table_top - 23)
    text(c, LEFT, 104, "保管先：本社事務用品庫    発注単位：品目ごと    価格確認：四半期ごと    発注承認：所属長", 8)
    text(c, LEFT, 83, "数量・単価・納期は比較テスト用の固定データです。税額・発注総額の集計は行っていません。", 7, MUTED)
    c.showPage()


def page_three(c, revised):
    header(c, 3, "発注・検収・取引に関する確認事項", "適用対象：国内事務用品取引  /  文書区分：運用確認票  /  取引先コード：V-002417")
    clauses = [
        ("1. 発注方法", ["発注は、当社所定の発注書に品目コード、数量および希望納期を記載して行う。", "口頭による依頼のみでは正式な発注とせず、発注書の送付をもって受付とする。"]),
        ("2. 納品・検収", [f"納品物の検収は、受領日から{'6' if revised else '5'}営業日以内に実施するものとする。", "数量不足、品違いまたは外観上の破損がある場合は、確認後すみやかに連絡する。"]),
        ("3. 請求書の発行", ["請求書には、発注番号、納品日、品目名、数量、単価および消費税額を記載する。", "月末締めの請求書は、翌月第3営業日までに指定の連絡先へPDF形式で送付する。"]),
        ("4. 個人情報・機密情報", ["取引に関連して知り得た情報は、当該業務の遂行に必要な範囲に限り取り扱う。", "第三者への開示を要する場合は、あらかじめ担当部門に確認し、承認を得ること。"]),
        ("5. 登録内容の変更", [f"振込先、所在地または担当者を変更する場合は、{'事後' if revised else '事前'}に書面で届け出ること。", "変更申請には、変更箇所、変更理由、適用希望日および申請担当者を明記する。"]),
        ("6. 返品・交換", ["仕様不適合または初期不良が確認された品目は、双方協議のうえ交換等を行う。", "返品の際は、対象品目、数量、発注番号および不適合の内容を記録する。"]),
        ("7. 記録の保存", ["発注書、納品書、検収記録および請求書は、社内規程に従って整理・保存する。", "電子データは文書管理番号により関連付け、担当部門が検索できる状態を維持する。"]),
        ("8. 遅延時の連絡", [f"納期の変更が見込まれる場合は、担当者へ電子メール{'でも' if revised else 'で'}通知すること。", "通知には、対象品目、変更後の予定日、遅延の理由および代替案を含めるものとする。"]),
        ("9. その他", ["本確認票に定めのない事項は、双方の担当者間で確認し、必要に応じて記録する。", "本資料は比較検証専用の架空文書であり、実際の取引条件や契約を構成しない。"]),
    ]
    y = 709
    for heading, lines in clauses:
        text(c, LEFT + 3, y, heading, 10)
        for j, value in enumerate(lines):
            text(c, LEFT + 13, y - 20 - j * 15, value, 8.5)
        rule(c, y - 47)
        y -= 65
    text(c, LEFT + 3, 98, "内容確認欄    申請部門：確認済    経理部門：確認済    管理責任者：佐藤 次郎（架空）", 8)
    text(c, LEFT + 3, 77, "発行：株式会社 青葉事務サービス    文書管理番号：AOBA-REG-2026-10", 7, MUTED)
    c.showPage()


def generate(path, revised):
    c = canvas.Canvas(str(path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("取引先登録・支払条件確認票 - 比較検証用")
    c.setAuthor("Sabun PDF Comparison Fixtures")
    c.setSubject("Japanese text and tabular data; fictional comparison test fixture")
    page_one(c, revised)
    page_two(c, revised)
    page_three(c, revised)
    c.save()


def validate(paths):
    extracted = []
    for path in paths:
        reader = PdfReader(path)
        assert len(reader.pages) == 3
        assert not reader.is_encrypted
        pages = [p.extract_text() for p in reader.pages]
        assert all("架空データ・比較検証用" in p for p in pages)
        extracted.append(pages)
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                assert len(page.chars) > 300
                for char in page.chars:
                    assert char["x0"] >= 25 and char["x1"] <= W - 25, (path.name, page.page_number, char)
                    assert char["top"] >= 18 and char["bottom"] <= H - 18
    # Validate exact changed text lines, including dense table cells, rather than trusting generator branches.
    changes = []
    for page, (before, after) in enumerate(zip(*extracted), start=1):
        a, b = before.splitlines(), after.splitlines()
        matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
        for tag, i, j, k, l in matcher.get_opcodes():
            if tag != "equal":
                assert j-i == l-k, (page, tag)
                for old, new in zip(a[i:j], b[k:l]):
                    changes.append({"page":page, "before":old, "after":new})
    assert len(changes) == 12, changes
    assert [sum(c["page"] == p for c in changes) for p in (1,2,3)] == [5,4,3]
    for page, field, old, new in EDITS:
        assert any(c["page"]==page and old in c["before"] and new in c["after"] for c in changes), field
    (OUT / "japanese-forms-differences.json").write_text(json.dumps(changes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"files":[str(p) for p in paths],"pagesEach":3,"verifiedChanges":len(changes),"changesByPage":[5,4,3]}, ensure_ascii=False))


if __name__ == "__main__":
    paths = [OUT / "japanese-form-original.pdf", OUT / "japanese-form-revised.pdf"]
    generate(paths[0], False)
    generate(paths[1], True)
    validate(paths)
    lines = ["# Japanese PDF comparison test pair", "", "Both documents contain 3 A4 pages, embedded Japanese text, and an identical layout.", "All business, bank, contact, and personal details are fictional test data.", "", "Upload `japanese-form-original.pdf` as A and `japanese-form-revised.pdf` as B.", "Use Text + Appearance or Text mode. There are exactly **12 deliberate content edits**: 5 on page 1, 4 on page 2, and 3 on page 3.", "The app may group these into a different number of highlight regions. No whitespace-only or width-normalization edits are included.", "", "## Answer key", "", "| Page | Field | Original | Revised |", "| --- | --- | --- | --- |"]
    lines.extend(f"| {page} | {field} | {old} | {new} |" for page, field, old, new in EDITS)
    lines.extend(["", "Page 2 has 32 densely populated data rows. Prices are reference prices, not a summed purchase order, so changes do not create inconsistent totals.", "", "The PDFs are non-interactive printed forms with selectable text, not scanned images or AcroForm widgets.", ""])
    (OUT / "ANSWER-KEY.md").write_text("\n".join(lines), encoding="utf-8")
