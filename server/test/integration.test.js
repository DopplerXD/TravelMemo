import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createApp } from '../app.js';

test('authentication, CRUD, images, references and restart persistence', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'travelmemo-'));
  let instance, server, base;
  async function start() {
    instance = createApp({ dataDir, username: 'admin', password: 'a-long-test-password' });
    server = instance.app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { await new Promise(resolve => server.close(resolve)); instance.close(); }
  let cookie, csrf;
  const request = (url, method = 'GET', body, authenticated = true, token = csrf) => fetch(base + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated && cookie ? { Cookie: cookie, 'X-CSRF-Token': token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  try {
    await start();
    assert.equal((await request('/api/health')).status, 200);
    assert.deepEqual((await (await request('/api/map-config')).json()).tiles, []);
    assert.equal((await fetch(base + '/api/photos', { method: 'POST' })).status, 401);
    assert.deepEqual(await (await request('/api/catalog')).json(), { trips: [], places: [], entries: [] });
    assert.equal((await request('/api/trips', 'POST', {}, false)).status, 401);
    assert.equal((await request('/api/login', 'POST', { username: 'admin', password: 'wrong' })).status, 401);
    const login = await request('/api/login', 'POST', { username: 'admin', password: 'a-long-test-password' });
    cookie = login.headers.get('set-cookie').split(';')[0]; csrf = (await login.json()).csrfToken;
    assert.match(cookie, /travelmemo_session=/);
    assert.equal((await request('/api/trips', 'POST', {}, true, 'bad')).status, 403);
    assert.equal((await fetch(base + '/api/trips', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    const invalidImage = new FormData(); invalidImage.set('file', new Blob(['<svg/>']), 'image.svg');
    assert.equal((await fetch(base + '/api/photos', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: invalidImage })).status, 400);
    const trip = await (await request('/api/trips', 'POST', { title: '江南旅行', description: '', cityRoute: [] })).json();
    const place = await (await request('/api/places', 'POST', { name: '南京', province: '江苏省', provinceCode: '320000', city: '南京市', cityCode: '320100', lng: 118.79, lat: 32.06 })).json();
    const form = new FormData();
    form.set('file', new Blob([await sharp({ create: { width: 100, height: 80, channels: 3, background: '#fff' } }).png().toBuffer()], { type: 'image/png' }), 'photo.png');
    const upload = await fetch(base + '/api/photos', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: form });
    assert.equal(upload.status, 201); const photo = await upload.json();
    assert.equal(photo.width, 100);
    assert.equal((await fetch(base + photo.thumbnailUrl)).status, 200);
    const entryInput = { title: '旧城', date: '2026-10-18', placeId: place.id, tripId: trip.id, body: '沿河散步', photos: [{ ...photo, url: 'https://other.example/tracking', alt: '河边' }] };
    const saved = await request('/api/entries', 'POST', entryInput); assert.equal(saved.status, 201);
    const entry = await saved.json();
    assert.equal(entry.photos[0].url, photo.url);
    assert.equal((await request('/api/entries', 'POST', { ...entryInput, photos: [{ id: 'missing', alt: '' }] })).status, 404);
    assert.equal((await request('/api/entries', 'POST', { ...entryInput, date: '2026-02-30' })).status, 400);
    assert.equal((await request(`/api/places/${place.id}`, 'DELETE')).status, 409);
    assert.equal((await request(`/api/trips/${trip.id}`, 'DELETE')).status, 409);
    assert.equal((await (await request('/api/catalog')).json()).entries[0].body, undefined);
    await stop(); await start();
    assert.equal((await (await request(`/api/entries/${entry.id}`)).json()).body, '沿河散步');
    assert.equal((await fetch(base + photo.url)).status, 200);
    assert.equal((await (await request('/api/session')).json()).authenticated, true);
    assert.equal((await request(`/api/entries/${entry.id}`, 'PUT', { ...entryInput, body: '更新' })).status, 200);
    assert.equal((await request(`/api/entries/${entry.id}`, 'DELETE')).status, 200);
    assert.equal((await request(`/api/places/${place.id}`, 'DELETE')).status, 200);
    assert.equal((await request(`/api/trips/${trip.id}`, 'DELETE')).status, 200);
    assert.equal((await request('/api/logout', 'POST')).status, 200);
    assert.equal((await request('/api/trips', 'POST', { title: 'x', cityRoute: [] })).status, 401);
  } finally { if (server?.listening) await stop(); await rm(dataDir, { recursive: true, force: true }); }
});
