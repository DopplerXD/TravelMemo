import { test, expect, type APIRequestContext } from '@playwright/test';
import { createRequire } from 'node:module';
const requireServer = createRequire(new URL('../../server/package.json', import.meta.url));
const sharp = requireServer('sharp');

async function seed(request: APIRequestContext, prefix: string) {
  const login = await request.post('/api/login', { data: { username: 'e2e-admin', password: 'e2e-only-password-2026' } });
  expect(login.ok()).toBeTruthy();
  const headers = { 'X-CSRF-Token': (await login.json()).csrfToken };
  const create = async (collection: string, data: unknown) => {
    const response = await request.post(`/api/${collection}`, { data, headers });
    expect(response.status(), await response.text()).toBe(201);
    return response.json();
  };
  const place = await create('places', { name: `${prefix}老门东`, province: '江苏省', provinceCode: '320000', city: '南京市', cityCode: '320100', lng: 118.786, lat: 32.017 });
  const trip = await create('trips', { title: `${prefix}江南慢行`, description: '沿着秦淮河走一走', cityRoute: [{ name: '南京市', lng: 118.79, lat: 32.06 }, { name: '苏州市', lng: 120.58, lat: 31.3 }] });
  const trip2 = await create('trips', { title: `${prefix}再访金陵`, description: '', cityRoute: [] });
  const bytes = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#9bb7ae' } }).png().toBuffer();
  const upload = await request.post('/api/photos', { headers, multipart: { file: { name: 'nanjing.png', mimeType: 'image/png', buffer: bytes } } });
  expect(upload.status()).toBe(201);
  const photo = await upload.json();
  await create('entries', { title: `${prefix}旧城初见`, date: '2025-05-01', placeId: place.id, tripId: trip.id, body: '沿河散步', photos: [photo] });
  await create('entries', { title: `${prefix}金陵秋日`, date: '2026-10-18', placeId: place.id, tripId: trip2.id, body: '再看一眼旧街巷', photos: [] });
  return { place, trip, trip2 };
}

test('四视图导航、旅行地点内容与地图实例保留', async ({ page, request }, info) => {
  test.setTimeout(90000);
  const prefix = `${info.project.name}导航`;
  const { place, trip } = await seed(request, prefix);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  expect(canvas).toBeTruthy();
  const nav = page.getByRole('navigation', { name: '主导航' });
  for (const view of ['Trips', 'Places', 'Timeline', 'Stats']) {
    await nav.getByText(view, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${view.toLowerCase()}$`));
    expect(await canvas!.evaluate(element => element.isConnected)).toBeTruthy();
    if (view === 'Trips') {
      await page.getByRole('button', { name: `打开旅行 ${trip.title}`, exact: true }).click();
      await expect(page.getByRole('region', { name: '旅行详情' })).toContainText(`${prefix}旧城初见`);
      await expect(page.getByRole('region', { name: '城市连线' })).toContainText('苏州市');
      await page.getByRole('button', { name: '返回旅行分组', exact: true }).click();
    }
    if (view === 'Places') {
      await page.getByText(place.name, { exact: true }).first().click();
      await expect(page.getByText(`${prefix}旧城初见`, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(`${prefix}金陵秋日`, { exact: true }).first()).toBeVisible();
    }
    if (view === 'Timeline') {
      await expect(page.getByText(`${prefix}旧城初见`, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(`${prefix}金陵秋日`, { exact: true }).first()).toBeVisible();
    }
    if (view === 'Stats') {
      const catalog = await (await request.get('/api/catalog')).json();
      const values = await page.locator('.stat-tile__value').allTextContents();
      const ids = new Set(catalog.entries.map((entry: { placeId: string }) => entry.placeId));
      const visited = catalog.places.filter((place: { id: string }) => ids.has(place.id));
      expect(values.map(Number)).toEqual([
        new Set(visited.map((place: { provinceCode: string }) => place.provinceCode)).size,
        new Set(visited.map((place: { cityCode: string }) => place.cityCode)).size,
        ids.size,
        new Set(catalog.entries.map((entry: { tripId: string }) => entry.tripId).filter(Boolean)).size,
        catalog.entries.length,
        catalog.entries.reduce((sum: number, entry: { photos: unknown[] }) => sum + entry.photos.length, 0),
      ]);
    }
    await expect(nav.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-current', 'page');
    await page.screenshot({ path: `.artifacts/${info.project.name}-${view.toLowerCase()}.png`, fullPage: true });
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/timeline$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/stats$/);
  await page.reload();
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  for (const view of ['trips', 'places', 'timeline', 'stats']) {
    await page.goto(`/${view}`);
    await expect(page.getByRole('heading', { name: new RegExp(`^${view}$`, 'i') })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('系统暗色、主题记忆和管理页共享主题', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const canvas = await page.locator('.maplibregl-canvas').elementHandle();
  const pixel = async () => {
    const shot = await page.locator('.maplibregl-canvas').screenshot();
    const sample = await sharp(shot).extract({ left: 4, top: 4, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    return (sample[0] + sample[1] + sample[2]) / 3;
  };
  await expect.poll(pixel, { timeout: 15000 }).toBeLessThan(110);
  await page.getByRole('button', { name: /切换.*亮色/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await canvas!.evaluate(element => element.isConnected)).toBeTruthy();
  await expect.poll(pixel).toBeGreaterThan(150);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: /切换.*暗色/ }).click();
  await page.goto('/timeline');
  await expect(page.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible();
  await page.screenshot({ path: `.artifacts/${test.info().project.name}-dark-timeline.png`, fullPage: true });
  await page.goto('/admin');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('账号', { exact: true }).fill('e2e-admin');
  await page.getByLabel('密码', { exact: true }).fill('e2e-only-password-2026');
  await page.getByRole('button', { name: '登录管理后台' }).click();
  await expect(page.getByRole('navigation', { name: '管理内容分类' })).toBeVisible();
  await page.screenshot({ path: `.artifacts/${test.info().project.name}-dark-admin.png`, fullPage: true });
  await page.getByRole('button', { name: /切换.*亮色/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/timeline');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
