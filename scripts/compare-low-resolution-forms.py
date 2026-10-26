"""Compare embedded PDF images; numeric values below were read from the images.

Does not import the fixture generator, its data, or the application's comparison code.
"""
from pathlib import Path
import csv
import hashlib
import json

import numpy as np
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
FILES = [OUT / "chohyo-lowres-01-original.pdf", OUT / "chohyo-lowres-02-revised.pdf"]
FIELDS = ["数量", "単価", "税抜金額", "消費税", "税込金額", "入金額", "未収残高"]
# Visually transcribed from the original and revised embedded JPEG images.
ROWS = {
    4: ([83,1548,128484,12848,141332,0,141332], [84,1548,130032,13003,143035,0,143035]),
    11: ([32,2507,80224,8022,88246,66184,22062], [32,1980,63360,6336,69696,66184,3512]),
    19: ([83,3603,299049,29905,328954,246715,82239], [83,3603,299049,29905,328954,124000,204954]),
    28: ([66,4836,319176,31918,351094,0,351094], [61,4836,294996,29500,324496,0,324496]),
    37: ([49,6069,297381,29738,327119,81779,245340], [49,3650,178850,17885,196735,81779,114956]),
    43: ([66,6891,454806,45481,500287,375215,125072], [66,6891,454806,45481,500287,0,500287]),
    52: ([49,8124,398076,39808,437884,0,437884], [49,8920,437080,43708,480788,0,480788]),
    63: ([66,1631,107646,10765,118411,88808,29603], [97,1631,158207,15821,174028,88808,85220]),
    71: ([32,2727,87264,8726,95990,71992,23998], [32,2727,87264,8726,95990,50000,45990]),
    79: ([83,3823,317309,31731,349040,261780,87260], [83,6200,514600,51460,566060,261780,304280]),
    85: ([15,4645,69675,6968,76643,19160,57483], [46,4645,213670,21367,235037,19160,215877]),
    94: ([83,5878,487874,48787,536661,268330,268331], [83,1540,127820,12782,140602,268330,-127728]),
    103: ([66,7111,469326,46933,516259,387194,129065], [66,7111,469326,46933,516259,90000,426259]),
    112: ([49,8344,408856,40886,449742,0,449742], [73,8344,609112,60911,670023,0,670023]),
    119: ([83,1303,108149,10815,118964,89223,29741], [83,7240,600920,60092,661012,89223,571789]),
}
TOTAL_FIELDS = ["数量計", "税抜計", "消費税計", "税込計", "入金合計", "未収残高"]
TOTALS = {
    1: ([1960,7464660,746468,8211128,3137559,5073569], [1956,7306633,730666,8037299,3014844,5022455]),
    2: ([1960,9581460,958148,10539608,3786339,6753269], [1991,9868316,986833,10855149,3389132,7466017]),
    3: ([1960,11562260,1156228,12718488,4584719,8133769], [2015,12039228,1203924,13243152,4287525,8955627]),
}

readers = [PdfReader(path) for path in FILES]
assert [len(r.pages) for r in readers] == [3, 3]
xs = [24]
for width in [30,56,58,53,43,61,78,65,78,80,78]:
    xs.append(xs[-1] + width)

detected = set()
scores = []
for p in range(3):
    pages = [r.pages[p] for r in readers]
    assert all(not page.extract_text().strip() for page in pages)
    images = [page.images[0].image.convert("L") for page in pages]
    assert all(im.size == (827,1169) for im in images)
    delta = np.abs(np.asarray(images[0]).astype(int) - np.asarray(images[1]).astype(int))
    for row in range(40):
        y = 230 + row * 19
        for col in range(11):
            crop = delta[y+1:y+18, xs[col]+1:xs[col+1]-1]
            count = int(np.sum(crop > 60))
            key = (p * 40 + row + 1, col)
            scores.append((key, count))
            if count >= 12:
                detected.add(key)

expected = set()
changes = []
for row, (before, after) in ROWS.items():
    for values in (before, after):
        qty, unit, net, tax, gross, paid, balance = values
        assert net == qty * unit
        assert tax == (net + 5) // 10
        assert gross == net + tax
        assert balance == gross - paid
    for col, (old, new) in enumerate(zip(before, after)):
        if old != new:
            expected.add((row, col + 4))
            changes.append({"page": (row-1)//40+1, "scope": "detail", "row_no": row,
                            "voucher": 260000+row, "field": FIELDS[col], "original": old,
                            "revised": new, "delta": new-old})
assert detected == expected, {"extra": sorted(detected-expected), "missing": sorted(expected-detected)}
for page, (before, after) in TOTALS.items():
    for i, row_col in enumerate([0,2,3,4,5,6]):
        detail_delta = sum(b[row_col]-a[row_col] for n,(a,b) in ROWS.items() if (n-1)//40+1 == page)
        assert after[i]-before[i] == detail_delta
        changes.append({"page": page, "scope": "page_total", "row_no": "", "voucher": "",
                        "field": TOTAL_FIELDS[i], "original": before[i], "revised": after[i],
                        "delta": after[i]-before[i]})
assert len(expected) == 63 and len(changes) == 81
csv_path = OUT / "LOWRES-INDEPENDENT-COMPARISON.csv"
with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(changes[0]))
    writer.writeheader()
    writer.writerows(sorted(changes, key=lambda d: (d["page"], d["scope"], d["row_no"] or 0)))

lines = ["# Direct comparison of the two low-resolution PDFs", "",
         "## Result", "",
         "- 3 corresponding pages; 120 detail rows in each PDF.",
         "- 15 changed detail rows: 5 on each page.",
         "- 63 changed detail cells: page 1 = 22, page 2 = 19, page 3 = 22.",
         "- 18 changed page-total numbers: 6 per page.",
         "- 81 changed numerical values in total. This is a cell/value count, not a highlight-region count.",
         "- No added/deleted pages or rows. Dates, voucher numbers, and departments are unchanged.", "",
         "## Method and limits", "",
         "Read the JPEG images embedded in the actual PDFs and compared all 1,320 table cells (120 rows x 11 columns). Values were visually transcribed from the original/revised images. The fixture generator, its answer key, and the application's comparison engine were not used for this comparison. Arithmetic and page-total deltas were checked separately.", "",
         "Each PDF page contains a single 827 x 1169 grayscale image and zero extractable text. Pixel screening counted pixels differing by more than 60 grayscale levels in each cell interior; 12 such pixels selected a candidate. All selected cells matched the visually confirmed differences. Compression noise is not treated as a numerical change. This is a document-specific comparison baseline, not a general OCR engine.", "",
         f"Observed screening separation: changed cells have at least {min(s for k,s in scores if k in expected)} strong-difference pixels; unchanged cells have at most {max(s for k,s in scores if k not in expected)}.", "",
         "A tool can merge adjacent changed cells into a single highlight, split a change into several regions, or report compression artifacts depending on its threshold. Compare locations and values against this baseline, rather than requiring exactly 81 result cards. Text-only comparison cannot recover the numbers without OCR.", "",
         "## All detail-cell changes", "",
         "| Page | Row No. | Voucher | Field | Original | Revised | Delta |",
         "|---:|---:|---:|---|---:|---:|---:|"]
for d in changes:
    if d["scope"] == "detail":
        lines.append(f"| {d['page']} | {d['row_no']} | {d['voucher']} | {d['field']} | {d['original']:,} | {d['revised']:,} | {d['delta']:+,} |")
lines += ["", "## Page totals", "", "| Page | Field | Original | Revised | Delta |", "|---:|---|---:|---:|---:|"]
for d in changes:
    if d["scope"] == "page_total":
        lines.append(f"| {d['page']} | {d['field']} | {d['original']:,} | {d['revised']:,} | {d['delta']:+,} |")
lines += ["", "## Notable value", "",
          "Page 3, row 94: 未収残高 changes from 268,331 to -127,728. The minus sign is part of the revised PDF, and follows from 140,602 gross minus 268,330 paid.", "",
          "## Source file fingerprints (SHA-256)", ""]
for path in FILES:
    lines.append(f"- `{path.name}`: `{hashlib.sha256(path.read_bytes()).hexdigest()}`")
(OUT / "LOWRES-INDEPENDENT-COMPARISON.md").write_text("\n".join(lines)+"\n", encoding="utf-8")
print(json.dumps({"changed_rows": len(ROWS), "detail_cells": len(expected), "total_values": 18,
                  "all_values": len(changes), "min_changed_cell_pixels": min(s for k,s in scores if k in expected),
                  "max_unchanged_cell_pixels": max(s for k,s in scores if k not in expected)}, indent=2))
print("Saved comparison Markdown and CSV.")
