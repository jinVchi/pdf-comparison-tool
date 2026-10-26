"""Create deterministic 100-DPI image-only Japanese comparison fixtures."""
from pathlib import Path
from io import BytesIO
from decimal import Decimal, ROUND_HALF_UP

from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
TMP = ROOT / "tmp" / "pdfs" / "low-resolution"
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
FONT = "C:/Windows/Fonts/msgothic.ttc"
W, H = 827, 1169
WIDTHS = [30, 56, 58, 53, 43, 61, 78, 65, 78, 80, 78]
HEADERS = ["No.", "取引日", "伝票番号", "部門", "数量", "単価", "税抜金額", "消費税", "税込金額", "入金額", "未収残高"]
DEPTS = ["営業一課", "営業二課", "東京支店", "大阪支店", "物流部門", "管理部門"]
EDITS = {
    4: ("qty", 84), 11: ("unit", 1980), 19: ("paid", 124000),
    28: ("qty", 61), 37: ("unit", 3650),
    43: ("paid", 0), 52: ("unit", 8920), 63: ("qty", 97),
    71: ("paid", 50000), 79: ("unit", 6200),
    85: ("qty", 46), 94: ("unit", 1540), 103: ("paid", 90000),
    112: ("qty", 73), 119: ("unit", 7240),
}


def row_data(n, revised):
    qty = 15 + (n * 17) % 85
    unit = 1000 + (n * 137) % 8000
    original_gross = qty * unit + (qty * unit + 5) // 10
    data = {"qty": qty, "unit": unit, "paid": original_gross * (n % 4) // 4}
    if revised and n in EDITS:
        key, value = EDITS[n]
        data[key] = value
    net = data["qty"] * data["unit"]
    tax = int((Decimal(net) / 10).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    gross = net + tax
    return {**data, "net": net, "tax": tax, "gross": gross, "balance": gross - data["paid"]}


def generate(revised):
    filename = "chohyo-lowres-02-revised.pdf" if revised else "chohyo-lowres-01-original.pdf"
    pdf = canvas.Canvas(str(OUT / filename), pagesize=A4, pageCompression=1)
    pdf.setTitle("Japanese numerical report - 100 DPI - " + ("revised" if revised else "original"))
    pdf.setAuthor("Synthetic comparison test data")
    for page in range(3):
        im = Image.new("L", (W, H), 255)
        draw = ImageDraw.Draw(im)

        def txt(x, y, text, size=12, fill=20, right=False):
            font = ImageFont.truetype(FONT, size)
            if right:
                x -= draw.textlength(str(text), font=font)
            draw.text((x, y), str(text), font=font, fill=fill)

        txt(24, 27, "売上・入金管理明細表", 26)
        txt(24, 69, "株式会社 さくら商事  |  経理部  |  2026年09月度", 14)
        txt(803, 34, "帳票番号：AR-202609", 12, right=True)
        txt(803, 59, f"ページ：{page + 1} / 3", 12, right=True)
        draw.line((24, 99, 803, 99), fill=65, width=2)
        txt(24, 116, "集計期間：2026/09/01 - 2026/09/30", 13)
        txt(24, 141, "通貨：日本円（JPY）    消費税率：10%    税額：伝票単位で四捨五入", 12)
        txt(24, 165, "比較テスト用の架空データです。実在の取引・顧客情報は含みません。", 11, 70)
        x_positions = [24]
        for width in WIDTHS:
            x_positions.append(x_positions[-1] + width)
        top, header_h, row_h = 200, 30, 19
        bottom = top + header_h + 40 * row_h
        draw.rectangle((24, top, 804, top + header_h), fill=218)
        for col, label in enumerate(HEADERS):
            font = ImageFont.truetype(FONT, 11)
            width = draw.textlength(label, font=font)
            txt((x_positions[col] + x_positions[col + 1] - width) / 2, top + 9, label, 11)
        totals = {key: 0 for key in ("qty", "net", "tax", "gross", "paid", "balance")}
        for row in range(40):
            n = page * 40 + row + 1
            y = top + header_h + row * row_h
            if row % 2:
                draw.rectangle((24, y, 804, y + row_h), fill=245)
            data = row_data(n, revised)
            values = [str(n), f"09/{1 + (n - 1) % 30:02d}", f"{260000 + n}", DEPTS[(n - 1) % 6]]
            values += [f"{data[k]:,}" for k in ("qty", "unit", "net", "tax", "gross", "paid", "balance")]
            for col, value in enumerate(values):
                txt(x_positions[col + 1] - 4, y + 4, value, 11, right=True)
            for key in totals:
                totals[key] += data[key]
            draw.line((24, y + row_h, 804, y + row_h), fill=180)
        for x in x_positions:
            draw.line((x, top, x, bottom), fill=130)
        draw.rectangle((24, top, 804, bottom), outline=90)
        draw.line((24, top + header_h, 804, top + header_h), fill=90)
        txt(24, 1011, f"当頁件数：40件    数量計：{totals['qty']:,}    税抜計：{totals['net']:,} 円", 13)
        txt(24, 1039, f"消費税計：{totals['tax']:,} 円    税込計：{totals['gross']:,} 円", 13)
        txt(24, 1067, f"入金合計：{totals['paid']:,} 円    未収残高：{totals['balance']:,} 円", 13)
        draw.line((24, 1103, 804, 1103), fill=100)
        txt(24, 1121, "画像帳票 / 100 DPI / A4 / OCRテキストなし", 11, 65)
        txt(803, 1121, f"対象伝票：{260001 + page * 40} - {260040 + page * 40}", 11, 65, right=True)
        jpeg = BytesIO()
        im.save(jpeg, format="JPEG", quality=65, optimize=True, dpi=(100, 100))
        jpeg.seek(0)
        # One low-resolution raster per page; intentionally no searchable text layer.
        pdf.drawImage(ImageReader(jpeg), 0, 0, width=A4[0], height=A4[1])
        im.save(TMP / f"{'revised' if revised else 'original'}-{page + 1}.png")
        pdf.showPage()
    pdf.save()
    reader = PdfReader(OUT / filename)
    assert len(reader.pages) == 3
    for page in reader.pages:
        assert not page.extract_text().strip()
        images = list(page.images)
        assert len(images) == 1 and images[0].image.size == (W, H)
    print(f"Verified: {filename}; 3 pages; image-only; 827 x 1169 pixels; {(OUT / filename).stat().st_size:,} bytes")


generate(False)
generate(True)
lines = [
    "# Low-resolution Japanese numerical report comparison", "",
    "Upload `chohyo-lowres-01-original.pdf` as the original and `chohyo-lowres-02-revised.pdf` as the revised document.", "",
    "Each PDF contains three A4 portrait pages, 40 detail rows per page (120 total), and eight numerical columns per row (including the row number).",
    "Each page is a single 827 x 1169 grayscale JPEG at approximately 100 DPI, JPEG quality 65, with no text layer.",
    "Use visual comparison. OCR is needed for searchable text or numerical extraction from these image-only PDFs.", "",
    "There are 15 deliberate input-cell changes (five per page). Dependent amounts and page totals are also recalculated; the number of visual regions reported by the app may differ.", "",
    "| Page | Row No. | Voucher | Field | Original | Revised |", "|---|---|---|---|---:|---:|",
]
labels = {"qty": "Quantity / 数量", "unit": "Unit price / 単価", "paid": "Payment / 入金額"}
for n, (key, value) in EDITS.items():
    before = row_data(n, False)[key]
    assert before != value
    lines.append(f"| {(n - 1) // 40 + 1} | {n} | {260000 + n} | {labels[key]} | {before:,} | {value:,} |")
lines += ["", "Amounts: net = quantity x unit price; tax = 10% rounded half up per row; gross = net + tax; outstanding = gross - payment.",
          "All companies, vouchers, and transactions are synthetic. Unchanged rows, page geometry, headers, and dates are identical between the pair.", ""]
(OUT / "LOWRES-ANSWER-KEY.md").write_text("\n".join(lines), encoding="utf-8")
