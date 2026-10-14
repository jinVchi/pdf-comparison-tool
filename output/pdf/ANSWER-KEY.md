# Japanese PDF comparison test pair

Both documents contain 3 A4 pages, embedded Japanese text, and an identical layout.
All business, bank, contact, and personal details are fictional test data.

Upload `japanese-form-original.pdf` as A and `japanese-form-revised.pdf` as B.
Use Text + Appearance or Text mode. There are exactly **12 deliberate content edits**: 5 on page 1, 4 on page 2, and 3 on page 3.
The app may group these into a different number of highlight regions. No whitespace-only or width-normalization edits are included.

## Answer key

| Page | Field | Original | Revised |
| --- | --- | --- | --- |
| 1 | 申請番号 | REG-2026-0186 | REG-2026-0188 |
| 1 | 担当部署 | 営業企画部 | 営業企画課 |
| 1 | 支店番号 | 318 | 381 |
| 1 | 支払期日 | 翌月末日 | 翌々月末日 |
| 1 | 与信限度額 | 5,000,000 円 | 5,050,000 円 |
| 2 | No.08 標準数量 | 24 | 25 |
| 2 | No.17 品目コード | P-1017 | P-1071 |
| 2 | No.23 規格 | 0.50mm | 0.55mm |
| 2 | No.29 参考単価 | 1,280 | 1,290 |
| 3 | 第2項 検収期間 | 5営業日以内 | 6営業日以内 |
| 3 | 第5項 変更手続 | 事前に書面 | 事後に書面 |
| 3 | 第8項 通知方法 | 電子メールで通知 | 電子メールでも通知 |

Page 2 has 32 densely populated data rows. Prices are reference prices, not a summed purchase order, so changes do not create inconsistent totals.

The PDFs are non-interactive printed forms with selectable text, not scanned images or AcroForm widgets.
