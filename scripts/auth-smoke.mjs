// Run against the local stack after `docker compose up -d --build`.
// Creates two synthetic accounts; removes its sample comparison after validation.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.API_URL || 'http://127.0.0.1:8080/api';
const password = `smoke-${randomUUID()}`;
const email = `auth-smoke-${randomUUID()}@example.com`;

class Client {
  cookies = new Map();
  token;
  get cookie() { return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '); }
  async request(path, method = 'GET', body) {
    const headers = { Cookie: this.cookie };
    if (method !== 'GET' && this.token) headers[this.token.csrfHeader] = this.token.csrfToken;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${path}`, { method, headers, body: body && JSON.stringify(body) });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0];
      const index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  async refresh() {
    const response = await this.request('/session');
    assert.equal(response.status, 200);
    this.token = await response.json();
    return this.token;
  }
  async auth(action, address = email, secret = password) {
    return this.request(`/auth/${action}`, 'POST', { email: address, password: secret });
  }
}

const owner = new Client();
assert.equal((await owner.refresh()).user, null);
const guestCookie = owner.cookie;
const guestToken = owner.token.csrfToken;
const unknownId = randomUUID();
for (const path of ['/comparisons', `/comparisons/${unknownId}`, `/comparisons/${unknownId}/report`, `/comparisons/${unknownId}/pages/original/1`]) {
  const blocked = await owner.request(path);
  assert.equal(blocked.status, 401, path);
  assert.ok(blocked.headers.get('content-type').includes('application/json'));
  assert.equal(blocked.headers.get('location'), null);
}
assert.equal((await owner.request('/comparisons/demo', 'POST')).status, 401);
assert.equal((await owner.request(`/comparisons/${unknownId}`, 'DELETE')).status, 401);
const anonymousUpload = new FormData();
anonymousUpload.append('original', new Blob(['%PDF-']), 'sample.pdf');
assert.equal((await fetch(`${base}/comparisons`, {
  method: 'POST', headers: { Cookie: owner.cookie, [owner.token.csrfHeader]: owner.token.csrfToken }, body: anonymousUpload,
})).status, 401);
const registration = await owner.auth('sign-up');
assert.equal(registration.status, 201, await registration.clone().text());
const account = await registration.json();
assert.equal(account.email, email);
assert.equal(account.passwordHash, undefined);
assert.notEqual(owner.cookie, guestCookie, 'session ID must rotate at sign-up');
assert.equal((await owner.refresh()).user.id, account.id);
const demo = await owner.request('/comparisons/demo', 'POST');
assert.equal(demo.status, 202, await demo.clone().text());
const job = await demo.json();

const staleWrite = await fetch(`${base}/auth/sign-out`, {
  method: 'POST', headers: { Cookie: owner.cookie, 'X-CSRF-TOKEN': guestToken },
});
assert.equal(staleWrite.status, 403, 'pre-authentication CSRF must be rejected');
assert.equal((await fetch(`${base}/comparisons/${job.id}`, { headers: { Cookie: guestCookie } })).status, 401);

const secondBrowser = new Client();
await secondBrowser.refresh();
const failed = await secondBrowser.auth('sign-in', email, 'incorrect-password');
assert.equal(failed.status, 401);
assert.equal((await secondBrowser.refresh()).user, null);
const loginCookie = secondBrowser.cookie;
const login = await secondBrowser.auth('sign-in', email.toUpperCase());
assert.equal(login.status, 200, await login.clone().text());
assert.notEqual(secondBrowser.cookie, loginCookie, 'session ID must rotate at sign-in');
assert.equal((await secondBrowser.refresh()).user.id, account.id);
assert.equal((await secondBrowser.request(`/comparisons/${job.id}`)).status, 200);

const other = new Client();
await other.refresh();
assert.equal((await other.auth('sign-up', `other-${randomUUID()}@example.com`)).status, 201);
await other.refresh();
for (const suffix of ['', '/report', '/pages/original/1']) {
  assert.equal((await other.request(`/comparisons/${job.id}${suffix}`)).status, 404);
}
assert.equal((await other.request(`/comparisons/${job.id}`, 'DELETE')).status, 404);
assert.deepEqual(await (await other.request('/comparisons')).json(), []);

let completed;
for (let attempt = 0; attempt < 60; attempt++) {
  const response = await owner.request(`/comparisons/${job.id}`);
  assert.equal(response.status, 200, 'worker saves must preserve account ownership');
  completed = await response.json();
  if (['COMPLETED', 'FAILED'].includes(completed.status)) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.equal(completed.status, 'COMPLETED', JSON.stringify(completed));
assert.equal((await secondBrowser.request(`/comparisons/${job.id}/report`)).status, 200);
assert.equal((await secondBrowser.request(`/comparisons/${job.id}/pages/original/1`)).status, 200);

const signedOutCookie = owner.cookie;
assert.equal((await owner.request('/auth/sign-out', 'POST')).status, 204);
assert.equal((await owner.refresh()).user, null);
assert.equal((await owner.request('/comparisons')).status, 401);
assert.equal((await fetch(`${base}/comparisons/${job.id}`, { headers: { Cookie: signedOutCookie } })).status, 401);
assert.equal((await owner.auth('sign-in')).status, 200);
await owner.refresh();
assert.equal((await owner.request(`/comparisons/${job.id}`)).status, 200);
assert.equal((await owner.request(`/comparisons/${job.id}`, 'DELETE')).status, 204);
console.log(JSON.stringify({ status: 'PASS', checks: [
  'mandatory login for all comparison endpoints', 'registration in PostgreSQL', 'session ID rotation', 'CSRF rotation',
  'credential rejection', 'sign-in from a second browser', 'account isolation on detail/PNG/CSV/delete',
  'worker ownership preservation', 'logout invalidation', 'history restored after sign-in',
] }, null, 2));
