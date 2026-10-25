// Exercises a real API, PostgreSQL and RabbitMQ. Start them before running.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.API_URL || 'http://127.0.0.1:8080/api';
async function session() {
  let res = await fetch(`${base}/session`);assert.equal(res.status,200);
  let token = await res.json();
  let cookie = res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const registration = await fetch(`${base}/auth/sign-up`, { method:'POST', headers:{
    Cookie:cookie, [token.csrfHeader]:token.csrfToken, 'Content-Type':'application/json',
  }, body:JSON.stringify({email:`pdf-smoke-${randomUUID()}@example.com`, password:`smoke-${randomUUID()}`}) });
  assert.equal(registration.status,201,await registration.clone().text());
  cookie = registration.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  res = await fetch(`${base}/session`, {headers:{Cookie:cookie}});assert.equal(res.status,200);
  token = await res.json();assert.ok(token.user);
  return { token, cookie };
}
function headers(s, write=false) {return {Cookie:s.cookie,...(write?{[s.token.csrfHeader]:s.token.csrfToken}:{})};}
function tinyPdf(text) {
  const content=`BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let body='%PDF-1.4\n';const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(body.length);body+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const start=body.length;body+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))body+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  return `${body}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
}
const owner=await session(),other=await session();
assert.equal((await fetch(`${base}/comparisons/demo`,{method:'POST',headers:headers(owner)})).status,403);
const create=await fetch(`${base}/comparisons/demo`,{method:'POST',headers:headers(owner,true)});
assert.equal(create.status,202,await create.clone().text());const created=await create.json();
let job;
for(let n=0;n<60;n++) {
  job=await (await fetch(`${base}/comparisons/${created.id}`,{headers:headers(owner)})).json();
  if(['COMPLETED','FAILED'].includes(job.status))break;
  await new Promise(r=>setTimeout(r,1000));
}
assert.equal(job.status,'COMPLETED',JSON.stringify(job));assert.equal(job.pageCount,2);
assert.ok(job.changeCount>=7);assert.ok(job.result.changes.some(c=>c.before.includes('30日間')&&c.after.includes('90日間')));
assert.ok(job.result.changes.some(c=>c.before.includes('1,210,000')&&c.after.includes('1,375,000')));
for(const suffix of ['', '/report', '/pages/original/1'])assert.equal((await fetch(`${base}/comparisons/${job.id}${suffix}`,{headers:headers(other)})).status,404);
const png=await fetch(`${base}/comparisons/${job.id}/pages/revised/1`,{headers:headers(owner)});assert.equal(png.status,200);assert.ok((await png.arrayBuffer()).byteLength>10000);
const report=await fetch(`${base}/comparisons/${job.id}/report`,{headers:headers(owner)});assert.equal(report.status,200);assert.ok((await report.text()).includes('ページ,種類,変更前,変更後'));
const bad=new FormData();bad.append('original',new Blob(['fake']),'fake.pdf');bad.append('revised',new Blob(['fake']),'fake.pdf');
assert.equal((await fetch(`${base}/comparisons`,{method:'POST',headers:headers(owner,true),body:bad})).status,400);
const upload=new FormData();upload.append('original',new Blob([tinyPdf('Amount 1000')],{type:'application/pdf'}),'変更前.pdf');upload.append('revised',new Blob([tinyPdf('Amount 1200')],{type:'application/pdf'}),'変更後.pdf');upload.append('mode','text');
const uploaded=await fetch(`${base}/comparisons`,{method:'POST',headers:headers(owner,true),body:upload});assert.equal(uploaded.status,202,await uploaded.clone().text());
const uploadId=(await uploaded.json()).id;let uploadJob;
for(let n=0;n<60;n++) {
  uploadJob=await(await fetch(`${base}/comparisons/${uploadId}`,{headers:headers(owner)})).json();
  if(['COMPLETED','FAILED'].includes(uploadJob.status))break;
  await new Promise(r=>setTimeout(r,1000));
}
assert.equal(uploadJob.status,'COMPLETED');assert.equal(uploadJob.originalName,'変更前.pdf');assert.equal(uploadJob.changeCount,1);assert.equal(uploadJob.result.changes[0].after,'Amount 1200');
assert.equal((await fetch(`${base}/comparisons/${uploadId}`,{method:'DELETE',headers:headers(owner,true)})).status,204);
assert.equal((await fetch(`${base}/comparisons/${uploadId}`,{headers:headers(owner)})).status,404);
console.log(JSON.stringify({status:'PASS',jobId:job.id,pages:job.pageCount,changes:job.changeCount,checks:['authenticated comparison flow','real Japanese PDF generation','PostgreSQL persistence','RabbitMQ processing','Japanese amount and phrase changes','PNG preview','CSV export','CSRF','account isolation','invalid upload rejection','multipart upload and comparison','Unicode filenames','deletion']},null,2));
// Keep this sample until automatic expiry so its PDF rendering can be inspected.
