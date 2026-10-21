import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../app.js';

test('public profile, protected validation and restart persistence', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'travelmemo-profile-'));
  let instance, server, base;
  const start = async () => {
    instance = createApp({ dataDir, username: 'admin', password: 'a-long-test-password' });
    server = instance.app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    await new Promise(resolve => server.close(resolve));
    instance.close();
  };
  try {
    await start();
    const initial = await (await fetch(base + '/api/profile')).json();
    assert.deepEqual(initial, { name: 'Xinchuan "Doppler" Yang', school: 'CityU of HongKong', major: 'Computer Science', blog: 'https://www.dopplerxd.site', ryot: 'http://120.48.53.155:9500/' });
    const put = (data, headers = {}) => fetch(base + '/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
    assert.equal((await put(initial)).status, 401);
    const login = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'a-long-test-password' }) });
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    const headers = { Cookie, 'X-CSRF-Token': (await login.json()).csrfToken };
    assert.equal((await put(initial, { Cookie })).status, 403);
    assert.equal((await put(initial, { ...headers, Origin: 'https://other.example' })).status, 403);
    for (const bad of ['https:example.com', 'javascript:alert(1)', 'data:text/html,x', '/relative', 'ftp://example.com', 'https://user:password@example.com'])
      assert.equal((await put({ ...initial, blog: bad }, headers)).status, 400);
    assert.equal((await put({ ...initial, name: 'x'.repeat(201) }, headers)).status, 400);
    assert.equal((await put({ ...initial, school: null }, headers)).status, 400);
    const empty = { name: '', school: '', major: '', blog: '', ryot: '' };
    assert.deepEqual(await (await put(empty, headers)).json(), empty);
    const edited = { ...initial, name: 'Doppler', blog: 'https://example.com/new' };
    assert.equal((await put(edited, headers)).status, 200);
    await stop();
    await start();
    assert.deepEqual(await (await fetch(base + '/api/profile')).json(), edited);
    assert.deepEqual(await (await fetch(base + '/api/catalog')).json(), { trips: [], places: [], entries: [] });
  } finally { await stop(); await rm(dataDir, { recursive: true, force: true }); }
});
