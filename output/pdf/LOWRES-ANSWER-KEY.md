# Low-resolution Japanese numerical report comparison

Upload `chohyo-lowres-01-original.pdf` as the original and `chohyo-lowres-02-revised.pdf` as the revised document.

Each PDF contains three A4 portrait pages, 40 detail rows per page (120 total), and eight numerical columns per row (including the row number).
Each page is a single 827 x 1169 grayscale JPEG at approximately 100 DPI, JPEG quality 65, with no text layer.
Use visual comparison. OCR is needed for searchable text or numerical extraction from these image-only PDFs.

There are 15 deliberate input-cell changes (five per page). Dependent amounts and page totals are also recalculated; the number of visual regions reported by the app may differ.

| Page | Row No. | Voucher | Field | Original | Revised |
|---|---|---|---|---:|---:|
| 1 | 4 | 260004 | Quantity / 数量 | 83 | 84 |
| 1 | 11 | 260011 | Unit price / 単価 | 2,507 | 1,980 |
| 1 | 19 | 260019 | Payment / 入金額 | 246,715 | 124,000 |
| 1 | 28 | 260028 | Quantity / 数量 | 66 | 61 |
| 1 | 37 | 260037 | Unit price / 単価 | 6,069 | 3,650 |
| 2 | 43 | 260043 | Payment / 入金額 | 375,215 | 0 |
| 2 | 52 | 260052 | Unit price / 単価 | 8,124 | 8,920 |
| 2 | 63 | 260063 | Quantity / 数量 | 66 | 97 |
| 2 | 71 | 260071 | Payment / 入金額 | 71,992 | 50,000 |
| 2 | 79 | 260079 | Unit price / 単価 | 3,823 | 6,200 |
| 3 | 85 | 260085 | Quantity / 数量 | 15 | 46 |
| 3 | 94 | 260094 | Unit price / 単価 | 5,878 | 1,540 |
| 3 | 103 | 260103 | Payment / 入金額 | 387,194 | 90,000 |
| 3 | 112 | 260112 | Quantity / 数量 | 49 | 73 |
| 3 | 119 | 260119 | Unit price / 単価 | 1,303 | 7,240 |

Amounts: net = quantity x unit price; tax = 10% rounded half up per row; gross = net + tax; outstanding = gross - payment.
All companies, vouchers, and transactions are synthetic. Unchanged rows, page geometry, headers, and dates are identical between the pair.
