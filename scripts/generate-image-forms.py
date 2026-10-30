"""Generate a Japanese approval form pair whose only differences are embedded images.

Page 1 swaps images at identical positions. Page 2 keeps identical images but moves them.
All text is identical in both PDFs, so every reported change must come from images.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)
FONT_FILE = "C:/Windows/Fonts/msgothic.ttc"
FONT = "JapaneseForm"
pdfmetrics.registerFont(TTFont(FONT, FONT_FILE, subfontIndex=0))
W, H = A4
LEFT, RIGHT = 38, W - 38
INK = HexColor("#243b34")
MUTED = HexColor("#728177")
GRID = HexColor("#cbd5cc")
PALE = HexColor("#eef3ed")
RED = (196, 32, 40, 255)


def font(size):
    return ImageFont.truetype(FONT_FILE, size, index=0)


def canvas_image(size):
    return Image.new("RGBA", size, (255, 255, 255, 0))


def round_seal(name):
    """Personal hanko: red ring with a two-character name written vertically."""
    img = canvas_image((300, 300))
    d = ImageDraw.Draw(img)
    d.ellipse((10, 10, 290, 290), outline=RED, width=16)
    f = font(110)
    for i, ch in enumerate(name):
        d.text((150, 92 + i * 116), ch, font=f, fill=RED, anchor="mm")
    return img


def square_seal(right, left):
    """Company kakuin: red square read in vertical columns, right column first."""
    img = canvas_image((300, 300))
    d = ImageDraw.Draw(img)
    d.rectangle((10, 10, 290, 290), outline=RED, width=16)
    f = font(112)
    for col, chars in enumerate((right, left)):
        for row, ch in enumerate(chars):
            d.text((210 - col * 120, 90 + row * 120), ch, font=f, fill=RED, anchor="mm")
    return img


def decision_stamp(word):
    img = canvas_image((300, 300))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((14, 60, 286, 240), radius=24, outline=RED, width=14)
    d.text((150, 150), word, font=font(118), fill=RED, anchor="mm")
    return img


def logo(kind):
    img = canvas_image((300, 300))
    d = ImageDraw.Draw(img)
    if kind == "leaf":
        d.ellipse((40, 70, 260, 230), fill=(46, 125, 80, 255))
        d.line((70, 200, 230, 100), fill=(255, 255, 255, 255), width=14)
    else:
        d.ellipse((30, 30, 270, 270), outline=(40, 90, 170, 255), width=36)
        d.rectangle((130, 90, 170, 210), fill=(40, 90, 170, 255))
    return img


def chart(values, color):
    img = Image.new("RGB", (900, 480), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.line((60, 430, 860, 430), fill=(120, 130, 125), width=4)
    d.line((60, 30, 60, 430), fill=(120, 130, 125), width=4)
    for i, value in enumerate(values):
        x = 100 + i * 125
        d.rectangle((x, 430 - value * 38, x + 80, 428), fill=color)
    return img


IMAGES = {
    "logo-leaf": logo("leaf"),
    "logo-ring": logo("ring"),
    "kakuin-wakaba": square_seal("若葉", "之印"),
    "kakuin-aoba": square_seal("青葉", "之印"),
    "seal-tanaka": round_seal("田中"),
    "seal-suzuki": round_seal("鈴木"),
    "seal-takahashi": round_seal("高橋"),
    "stamp-approved": decision_stamp("承認"),
    "stamp-returned": decision_stamp("差戻"),
    "chart-a": chart([4, 6, 5, 8, 7, 9], (70, 140, 100)),
    "chart-b": chart([4, 6, 9, 5, 7, 9], (70, 140, 100)),
}

# Slot positions: (x, y, width, height) in PDF points, origin at the bottom left.
SLOTS = {
    "logo": (LEFT, H - 82, 40, 40),
    "kakuin": (228, 618, 46, 46),
    "seal-staff": (366, 494, 44, 44),
    "seal-check": (434, 494, 44, 44),
    "stamp-decision": (502, 494, 44, 44),
    "chart": (LEFT + 8, 180, 330, 176),
}
ORIGINAL = {"logo": "logo-leaf", "kakuin": "kakuin-wakaba", "seal-staff": "seal-tanaka",
            "seal-check": "seal-suzuki", "stamp-decision": "stamp-approved", "chart": "chart-a"}

# Page 1: (slot, revised image). Unlisted slots keep the original image as a control.
SWAPS = [
    ("logo", "logo-ring", "社章", "緑の葉", "青い円"),
    ("kakuin", "kakuin-aoba", "社印（文字に重なる）", "若葉之印", "青葉之印"),
    ("seal-check", "seal-takahashi", "確認者印", "鈴木", "高橋"),
    ("stamp-decision", "stamp-returned", "決裁印", "承認", "差戻"),
    ("chart", "chart-b", "月次グラフ", "3本目・4本目の棒が低→高", "3本目が高く、4本目が低い"),
]
# Page 2: (slot, dx, dy) in points, positive dx = right, positive dy = down. Same image both sides.
SHIFTS = [
    ("logo", 440, 0, "社章", "ページ右端へ大きく移動"),
    ("kakuin", 4, 0, "社印（文字に重なる）", "右へわずかに移動"),
    ("seal-check", 0, 18, "確認者印", "下へ移動し枠からはみ出す"),
    ("stamp-decision", -8, 8, "決裁印", "左下へ斜めに移動"),
    ("chart", 0, 40, "月次グラフ", "下へ移動"),
]
CONTROL = "seal-staff"


def text(c, x, y, value, size=9, color=INK):
    c.setFillColor(color)
    c.setFont(FONT, size)
    c.drawString(x, y, value)


def right_text(c, x, y, value, size=9, color=INK):
    c.setFillColor(color)
    c.setFont(FONT, size)
    c.drawRightString(x, y, value)


def rule(c, y, x0=LEFT, x1=RIGHT):
    c.setStrokeColor(GRID)
    c.setLineWidth(0.5)
    c.line(x0, y, x1, y)


def form(c, page, title):
    """Identical text and rules on every page of both versions."""
    text(c, LEFT + 50, H - 64, "AOBA OFFICE / APPROVAL", 7, MUTED)
    right_text(c, RIGHT, H - 35, "架空データ・画像比較検証用", 7, MUTED)
    text(c, LEFT + 50, H - 80, title, 18)
    rule(c, H - 108)
    c.setFillColor(PALE)
    c.rect(LEFT, 690, RIGHT - LEFT, 22, fill=1, stroke=0)
    text(c, LEFT + 9, 697, "01  申請者情報", 10)
    rows = [("申請番号", "APR-2026-0412"), ("申請者", "株式会社 若葉文具 （印）"), ("件名", "事務用品の追加購入"), ("申請日", "2026年10月20日")]
    for i, (label, value) in enumerate(rows):
        y = 666 - i * 28
        text(c, LEFT + 8, y, label, 8, MUTED)
        text(c, LEFT + 92, y, value, 9)
        rule(c, y - 12)
    # Approval boxes: label row above three empty squares.
    for i, label in enumerate(("担当", "確認", "決裁")):
        x = 360 + i * 68
        c.setStrokeColor(GRID)
        c.rect(x, 488, 56, 56, fill=0, stroke=1)
        text(c, x + 20, 550, label, 8, MUTED)
    text(c, LEFT + 8, 516, "承認欄（各担当者の押印をもって承認とする）", 8)
    c.setFillColor(PALE)
    c.rect(LEFT, 420, RIGHT - LEFT, 22, fill=1, stroke=0)
    text(c, LEFT + 9, 427, "02  月次使用量の推移", 10)
    text(c, LEFT + 8, 396, "グラフは4月〜9月の使用量（相対値）。数値の比較対象ではありません。", 8, MUTED)
    text(c, 390, 300, "備考：画像の差分検証用資料", 8)
    text(c, 390, 282, "本文はすべて同一です。", 8)
    rule(c, 46)
    text(c, LEFT, 30, "株式会社 青葉事務サービス  |  画像比較テスト", 7, MUTED)
    right_text(c, RIGHT, 30, f"{page} / 2", 8, MUTED)


def placements(page, revised):
    """Return {slot: (image key, x, y, w, h)} for one page of one version."""
    result = {slot: (ORIGINAL[slot], *SLOTS[slot]) for slot in SLOTS}
    if not revised:
        return result
    if page == 1:
        for slot, key, *_ in SWAPS:
            result[slot] = (key, *SLOTS[slot])
    else:
        for slot, dx, dy, *_ in SHIFTS:
            key, x, y, w, h = result[slot]
            result[slot] = (key, x + dx, y - dy, w, h)
    return result


def generate(path, revised):
    c = canvas.Canvas(str(path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("書類承認票 - 画像比較検証用")
    c.setAuthor("Sabun PDF Comparison Fixtures")
    c.setSubject("Embedded image swaps and shifts; fictional comparison test fixture")
    for page, title in ((1, "書類承認票（画像差し替え）"), (2, "書類承認票（画像位置ずれ）")):
        form(c, page, title)
        for key, x, y, w, h in placements(page, revised).values():
            c.drawImage(ImageReader(IMAGES[key]), x, y, w, h, mask="auto")
        c.showPage()
    c.save()


def image_records(path):
    """Per page: list of (rounded bbox, data hash) sorted by position, read back from the PDF."""
    pages = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pages.append(sorted((tuple(round(img[k], 1) for k in ("x0", "top", "x1", "bottom")),
                                 hashlib.sha256(img["stream"].get_data()).hexdigest()) for img in page.images))
    return pages


def validate(paths):
    texts = [[p.extract_text() for p in PdfReader(path).pages] for path in paths]
    assert all(len(t) == 2 for t in texts)
    assert texts[0] == texts[1], "text must be identical"
    a, b = image_records(paths[0]), image_records(paths[1])
    assert all(len(page) == len(SLOTS) for page in a + b)
    # Page 1: identical boxes, 5 different images, 1 identical control.
    assert [box for box, _ in a[0]] == [box for box, _ in b[0]]
    assert sum(ha != hb for (_, ha), (_, hb) in zip(a[0], b[0])) == len(SWAPS)
    # Page 2: identical image set, 5 moved boxes, 1 control in place.
    assert sorted(h for _, h in a[1]) == sorted(h for _, h in b[1])
    assert len(set(box for box, _ in a[1]) - set(box for box, _ in b[1])) == len(SHIFTS)
    print(json.dumps({"files": [str(p) for p in paths], "pagesEach": 2, "imageSwaps": len(SWAPS),
                      "imageShifts": len(SHIFTS), "textIdentical": True}, ensure_ascii=False))


def box(slot, dx=0, dy=0):
    x, y, w, h = SLOTS[slot]
    # Top-left origin, as fractions of the page, to match the app's change boxes.
    return {"x": round((x + dx) / W, 4), "y": round((H - y - h + dy) / H, 4), "width": round(w / W, 4), "height": round(h / H, 4)}


def answer_key():
    changes = [{"page": 1, "kind": "IMAGE_SWAPPED", "slot": slot, "label": label, "before": old, "after": new,
                "originalBox": box(slot), "revisedBox": box(slot)} for slot, _, label, old, new in SWAPS]
    changes += [{"page": 2, "kind": "IMAGE_MOVED", "slot": slot, "label": label, "dxPt": dx, "dyPt": dy, "note": note,
                 "originalBox": box(slot), "revisedBox": box(slot, dx, dy)} for slot, dx, dy, label, note in SHIFTS]
    (OUT / "image-forms-differences.json").write_text(json.dumps(changes, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["# Image comparison test pair", "",
             "Both documents contain 2 A4 pages with identical text, rules, and layout. Only embedded images differ.",
             "All names and companies are fictional test data.", "",
             "Upload `image-form-original.pdf` as A and `image-form-revised.pdf` as B. Use Text + Appearance or Appearance mode.",
             "Text mode should report **no changes**.", "",
             f"## Page 1: different images at the same position ({len(SWAPS)} changes)", "",
             "| Image | Original | Revised |", "| --- | --- | --- |"]
    lines += [f"| {label} | {old} | {new} |" for _, _, label, old, new in SWAPS]
    lines += ["", f"## Page 2: identical images at shifted positions ({len(SHIFTS)} changes)", "",
              "| Image | Shift (pt, +x right, +y down) | Note |", "| --- | --- | --- |"]
    lines += [f"| {label} | ({dx}, {dy}) | {note} |" for _, dx, dy, label, note in SHIFTS]
    lines += ["", "## Controls", "",
              "- 担当者印（田中）is identical and in the same position on both pages. It must not be reported.",
              "- 社印 overlaps the text `（印）` on purpose, as company seals usually do. In Text + Appearance mode,",
              "  pixels under extracted text are masked, so this seal may be partly or fully missed.",
              "- The 4pt 社印 shift on page 2 is below the 0.6% position threshold used for text,",
              "  but image comparison is pixel-based and may still catch it.",
              "", "`image-forms-differences.json` lists each change with page-relative boxes (top-left origin, 0–1).", ""]
    (OUT / "IMAGE-ANSWER-KEY.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    paths = [OUT / "image-form-original.pdf", OUT / "image-form-revised.pdf"]
    generate(paths[0], False)
    generate(paths[1], True)
    validate(paths)
    answer_key()
