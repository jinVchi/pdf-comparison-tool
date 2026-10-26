# Direct comparison of the two low-resolution PDFs

## Result

- 3 corresponding pages; 120 detail rows in each PDF.
- 15 changed detail rows: 5 on each page.
- 63 changed detail cells: page 1 = 22, page 2 = 19, page 3 = 22.
- 18 changed page-total numbers: 6 per page.
- 81 changed numerical values in total. This is a cell/value count, not a highlight-region count.
- No added/deleted pages or rows. Dates, voucher numbers, and departments are unchanged.

## Method and limits

Read the JPEG images embedded in the actual PDFs and compared all 1,320 table cells (120 rows x 11 columns). Values were visually transcribed from the original/revised images. The fixture generator, its answer key, and the application's comparison engine were not used for this comparison. Arithmetic and page-total deltas were checked separately.

Each PDF page contains a single 827 x 1169 grayscale image and zero extractable text. Pixel screening counted pixels differing by more than 60 grayscale levels in each cell interior; 12 such pixels selected a candidate. All selected cells matched the visually confirmed differences. Compression noise is not treated as a numerical change. This is a document-specific comparison baseline, not a general OCR engine.

Observed screening separation: changed cells have at least 14 strong-difference pixels; unchanged cells have at most 0.

A tool can merge adjacent changed cells into a single highlight, split a change into several regions, or report compression artifacts depending on its threshold. Compare locations and values against this baseline, rather than requiring exactly 81 result cards. Text-only comparison cannot recover the numbers without OCR.

## All detail-cell changes

| Page | Row No. | Voucher | Field | Original | Revised | Delta |
|---:|---:|---:|---|---:|---:|---:|
| 1 | 4 | 260004 | 数量 | 83 | 84 | +1 |
| 1 | 4 | 260004 | 税抜金額 | 128,484 | 130,032 | +1,548 |
| 1 | 4 | 260004 | 消費税 | 12,848 | 13,003 | +155 |
| 1 | 4 | 260004 | 税込金額 | 141,332 | 143,035 | +1,703 |
| 1 | 4 | 260004 | 未収残高 | 141,332 | 143,035 | +1,703 |
| 1 | 11 | 260011 | 単価 | 2,507 | 1,980 | -527 |
| 1 | 11 | 260011 | 税抜金額 | 80,224 | 63,360 | -16,864 |
| 1 | 11 | 260011 | 消費税 | 8,022 | 6,336 | -1,686 |
| 1 | 11 | 260011 | 税込金額 | 88,246 | 69,696 | -18,550 |
| 1 | 11 | 260011 | 未収残高 | 22,062 | 3,512 | -18,550 |
| 1 | 19 | 260019 | 入金額 | 246,715 | 124,000 | -122,715 |
| 1 | 19 | 260019 | 未収残高 | 82,239 | 204,954 | +122,715 |
| 1 | 28 | 260028 | 数量 | 66 | 61 | -5 |
| 1 | 28 | 260028 | 税抜金額 | 319,176 | 294,996 | -24,180 |
| 1 | 28 | 260028 | 消費税 | 31,918 | 29,500 | -2,418 |
| 1 | 28 | 260028 | 税込金額 | 351,094 | 324,496 | -26,598 |
| 1 | 28 | 260028 | 未収残高 | 351,094 | 324,496 | -26,598 |
| 1 | 37 | 260037 | 単価 | 6,069 | 3,650 | -2,419 |
| 1 | 37 | 260037 | 税抜金額 | 297,381 | 178,850 | -118,531 |
| 1 | 37 | 260037 | 消費税 | 29,738 | 17,885 | -11,853 |
| 1 | 37 | 260037 | 税込金額 | 327,119 | 196,735 | -130,384 |
| 1 | 37 | 260037 | 未収残高 | 245,340 | 114,956 | -130,384 |
| 2 | 43 | 260043 | 入金額 | 375,215 | 0 | -375,215 |
| 2 | 43 | 260043 | 未収残高 | 125,072 | 500,287 | +375,215 |
| 2 | 52 | 260052 | 単価 | 8,124 | 8,920 | +796 |
| 2 | 52 | 260052 | 税抜金額 | 398,076 | 437,080 | +39,004 |
| 2 | 52 | 260052 | 消費税 | 39,808 | 43,708 | +3,900 |
| 2 | 52 | 260052 | 税込金額 | 437,884 | 480,788 | +42,904 |
| 2 | 52 | 260052 | 未収残高 | 437,884 | 480,788 | +42,904 |
| 2 | 63 | 260063 | 数量 | 66 | 97 | +31 |
| 2 | 63 | 260063 | 税抜金額 | 107,646 | 158,207 | +50,561 |
| 2 | 63 | 260063 | 消費税 | 10,765 | 15,821 | +5,056 |
| 2 | 63 | 260063 | 税込金額 | 118,411 | 174,028 | +55,617 |
| 2 | 63 | 260063 | 未収残高 | 29,603 | 85,220 | +55,617 |
| 2 | 71 | 260071 | 入金額 | 71,992 | 50,000 | -21,992 |
| 2 | 71 | 260071 | 未収残高 | 23,998 | 45,990 | +21,992 |
| 2 | 79 | 260079 | 単価 | 3,823 | 6,200 | +2,377 |
| 2 | 79 | 260079 | 税抜金額 | 317,309 | 514,600 | +197,291 |
| 2 | 79 | 260079 | 消費税 | 31,731 | 51,460 | +19,729 |
| 2 | 79 | 260079 | 税込金額 | 349,040 | 566,060 | +217,020 |
| 2 | 79 | 260079 | 未収残高 | 87,260 | 304,280 | +217,020 |
| 3 | 85 | 260085 | 数量 | 15 | 46 | +31 |
| 3 | 85 | 260085 | 税抜金額 | 69,675 | 213,670 | +143,995 |
| 3 | 85 | 260085 | 消費税 | 6,968 | 21,367 | +14,399 |
| 3 | 85 | 260085 | 税込金額 | 76,643 | 235,037 | +158,394 |
| 3 | 85 | 260085 | 未収残高 | 57,483 | 215,877 | +158,394 |
| 3 | 94 | 260094 | 単価 | 5,878 | 1,540 | -4,338 |
| 3 | 94 | 260094 | 税抜金額 | 487,874 | 127,820 | -360,054 |
| 3 | 94 | 260094 | 消費税 | 48,787 | 12,782 | -36,005 |
| 3 | 94 | 260094 | 税込金額 | 536,661 | 140,602 | -396,059 |
| 3 | 94 | 260094 | 未収残高 | 268,331 | -127,728 | -396,059 |
| 3 | 103 | 260103 | 入金額 | 387,194 | 90,000 | -297,194 |
| 3 | 103 | 260103 | 未収残高 | 129,065 | 426,259 | +297,194 |
| 3 | 112 | 260112 | 数量 | 49 | 73 | +24 |
| 3 | 112 | 260112 | 税抜金額 | 408,856 | 609,112 | +200,256 |
| 3 | 112 | 260112 | 消費税 | 40,886 | 60,911 | +20,025 |
| 3 | 112 | 260112 | 税込金額 | 449,742 | 670,023 | +220,281 |
| 3 | 112 | 260112 | 未収残高 | 449,742 | 670,023 | +220,281 |
| 3 | 119 | 260119 | 単価 | 1,303 | 7,240 | +5,937 |
| 3 | 119 | 260119 | 税抜金額 | 108,149 | 600,920 | +492,771 |
| 3 | 119 | 260119 | 消費税 | 10,815 | 60,092 | +49,277 |
| 3 | 119 | 260119 | 税込金額 | 118,964 | 661,012 | +542,048 |
| 3 | 119 | 260119 | 未収残高 | 29,741 | 571,789 | +542,048 |

## Page totals

| Page | Field | Original | Revised | Delta |
|---:|---|---:|---:|---:|
| 1 | 数量計 | 1,960 | 1,956 | -4 |
| 1 | 税抜計 | 7,464,660 | 7,306,633 | -158,027 |
| 1 | 消費税計 | 746,468 | 730,666 | -15,802 |
| 1 | 税込計 | 8,211,128 | 8,037,299 | -173,829 |
| 1 | 入金合計 | 3,137,559 | 3,014,844 | -122,715 |
| 1 | 未収残高 | 5,073,569 | 5,022,455 | -51,114 |
| 2 | 数量計 | 1,960 | 1,991 | +31 |
| 2 | 税抜計 | 9,581,460 | 9,868,316 | +286,856 |
| 2 | 消費税計 | 958,148 | 986,833 | +28,685 |
| 2 | 税込計 | 10,539,608 | 10,855,149 | +315,541 |
| 2 | 入金合計 | 3,786,339 | 3,389,132 | -397,207 |
| 2 | 未収残高 | 6,753,269 | 7,466,017 | +712,748 |
| 3 | 数量計 | 1,960 | 2,015 | +55 |
| 3 | 税抜計 | 11,562,260 | 12,039,228 | +476,968 |
| 3 | 消費税計 | 1,156,228 | 1,203,924 | +47,696 |
| 3 | 税込計 | 12,718,488 | 13,243,152 | +524,664 |
| 3 | 入金合計 | 4,584,719 | 4,287,525 | -297,194 |
| 3 | 未収残高 | 8,133,769 | 8,955,627 | +821,858 |

## Notable value

Page 3, row 94: 未収残高 changes from 268,331 to -127,728. The minus sign is part of the revised PDF, and follows from 140,602 gross minus 268,330 paid.

## Source file fingerprints (SHA-256)

- `chohyo-lowres-01-original.pdf`: `eb601455cfcacf3e79a83aef16fd71fb01365ce571064e706ba1eb311da0e816`
- `chohyo-lowres-02-revised.pdf`: `6a7cf1bc47a57ca8b2c402a73acaa66c1cb59a4fd321e00c64065fd987d15205`
