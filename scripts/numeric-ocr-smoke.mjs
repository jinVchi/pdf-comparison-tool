// Real image-only PDFs through the authenticated API and queue, checked against
// the independently transcribed numerical baseline. No generator data is used.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const base = process.env.API_URL || 'http://127.0.0.1:8080/api';
const cookies = response => response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
let res = await fetch(`${base}/session`);
assert.equal(res.status, 200);
let session = await res.json(), cookie = cookies(res);
res = await fetch(`${base}/auth/sign-up`, { method: 'POST', headers: {
  Cookie: cookie, [session.csrfHeader]: session.csrfToken, 'Content-Type': 'application/json',
}, body: JSON.stringify({ email: process.env.OCR_SMOKE_EMAIL || `numeric-ocr-${randomUUID()}@example.com`,
  password: process.env.OCR_SMOKE_PASSWORD || `test-${randomUUID()}` }) });
assert.equal(res.status, 201, await res.clone().text());
cookie = cookies(res);
session = await (await fetch(`${base}/session`, { headers: { Cookie: cookie } })).json();
const form = new FormData();
for (const [side, file] of [['original', 'chohyo-lowres-01-original.pdf'], ['revised', 'chohyo-lowres-02-revised.pdf']]) {
  form.append(side, new Blob([await readFile(new URL(`../output/pdf/${file}`, import.meta.url))], { type: 'application/pdf' }), file);
}
form.append('mode', 'mixed');
res = await fetch(`${base}/comparisons`, { method: 'POST', headers: { Cookie: cookie, [session.csrfHeader]: session.csrfToken }, body: form });
assert.equal(res.status, 202, await res.clone().text());
const id = (await res.json()).id;
let job;
for (let n = 0; n < 240; n++) {
  job = await (await fetch(`${base}/comparisons/${id}`, { headers: { Cookie: cookie } })).json();
  if (['COMPLETED', 'FAILED'].includes(job.status)) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await writeFile(new URL('../.data/numeric-ocr-smoke-result.json', import.meta.url), JSON.stringify(job, null, 2));
assert.equal(job.status, 'COMPLETED', JSON.stringify({ status: job.status, error: job.error }));
if (process.env.OCR_DEBUG_IMAGES === '1') {
  for (const side of ['original', 'revised']) for (let page = 1; page <= 3; page++) {
    const image = await fetch(`${base}/comparisons/${id}/pages/${side}/${page}`, { headers: { Cookie: cookie } });
    assert.equal(image.status, 200);
    await writeFile(new URL(`../.data/ocr-${side}-${page}.png`, import.meta.url), Buffer.from(await image.arrayBuffer()));
  }
}
const expected = (await readFile(new URL('../output/pdf/LOWRES-INDEPENDENT-COMPARISON.csv', import.meta.url), 'utf8'))
  .trim().split(/\r?\n/).slice(1).map(line => {
    const [page, scope, row, voucher, field, before, after] = line.split(',');
    return { page: Number(page), scope, row, field, before: Number(before), after: Number(after) };
  });
const actual = job.result.changes.filter(c => c.kind === 'NUMERIC');
console.log(JSON.stringify({ id, numeric: actual.length, visual: job.result.changes.filter(c => c.kind === 'VISUAL').length, warnings: job.result.warnings }, null, 2));
assert.equal(actual.length, expected.length, 'All 81 changed values should be recognized as numerical differences');
assert.equal(job.result.changes.filter(c => c.kind === 'VISUAL').length, 0, 'Recognized numerical edits must not have duplicate visual highlights');
const normalized = s => Number(s.replaceAll(',', '').replaceAll(' ', ''));
const unused = [...actual];
for (const e of expected) {
  const index = unused.findIndex(c => c.page === e.page && normalized(c.before) === e.before && normalized(c.after) === e.after);
  assert.notEqual(index, -1, `Missing page ${e.page}, row ${e.row || 'total'}, ${e.field}: ${e.before} -> ${e.after}`);
  const [change] = unused.splice(index, 1);
  assert.ok(change.originalBox && change.revisedBox);
  if (e.row) {
    const rowTop = (230 + ((Number(e.row) - 1) % 40) * 19) / 1169;
    assert.ok(Math.abs(change.originalBox.y - rowTop) < 0.012, `Wrong original row: ${e.row}`);
    assert.ok(Math.abs(change.revisedBox.y - rowTop) < 0.012, `Wrong revised row: ${e.row}`);
    const columns = { '数量': [221, 264], '単価': [264, 325], '税抜金額': [325, 403], '消費税': [403, 468],
      '税込金額': [468, 546], '入金額': [546, 626], '未収残高': [626, 704] };
    const [left, right] = columns[e.field];
    for (const box of [change.originalBox, change.revisedBox]) {
      assert.ok(box.x >= left / 827 - 0.01 && box.x + box.width <= right / 827 + 0.01, `Wrong column: row ${e.row}, ${e.field}`);
    }
  } else {
    assert.ok(change.originalBox.y > 1000 / 1169 && change.revisedBox.y > 1000 / 1169, 'Page totals must point below the table');
  }
}
const csv = await (await fetch(`${base}/comparisons/${id}/report`, { headers: { Cookie: cookie } })).text();
assert.ok(csv.includes('NUMERIC'));
assert.ok(csv.includes('83') && csv.includes('84'));
assert.ok(csv.includes('-127,728') || csv.includes('-127728'));
console.log('PASS: 81 exact numerical value pairs, page/row boxes, CSV, and negative amount.');
