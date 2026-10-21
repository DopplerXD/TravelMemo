import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const requireServer = createRequire(new URL('../../server/package.json', import.meta.url));
const sharp = requireServer('sharp');

test('公开地图、多次到访、在线保存与照片浏览', async ({ page, request }, info) => {
  const prefix = info.project.name;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /Worker failed|WebGL|Error:/.test(message.text())) errors.push(message.text()); });
  const login = await request.post('/api/login', { data: { username: 'e2e-admin', password: 'e2e-only-password-2026' } });
  expect(login.ok()).toBeTruthy();
  const headers = { 'X-CSRF-Token': (await login.json()).csrfToken };
  const create = async (collection: string, data: unknown) => {
    const response = await request.post(`/api/${collection}`, { data, headers });
    expect(response.status(), await response.text()).toBe(201);
    return response.json();
  };
  const place = await create('places', { name: `${prefix}老门东`, province: '江苏省', provinceCode: '320000', city: '南京市', cityCode: '320100', lng: 118.786, lat: 32.017 });
  const trip1 = await create('trips', { title: `${prefix}南京周末`, description: '', cityRoute: [] });
  const trip2 = await create('trips', { title: `${prefix}江南旅行`, description: '', cityRoute: [{ name: '南京市', lng: 118.79, lat: 32.06 }, { name: '苏州市', lng: 120.58, lat: 31.3 }] });
  const older = await create('entries', { title: `${prefix}去年的南京`, date: '2025-05-01', placeId: place.id, tripId: trip1.id, body: '沿着秦淮河散步', photos: [] });
  const newer = await create('entries', { title: `${prefix}又到南京`, date: '2026-10-18', placeId: place.id, tripId: trip2.id, body: '在旧街巷里慢慢走', photos: [] });
  const cities = page.waitForResponse(response => response.url().endsWith('/geo/cities/320000.json'));
  await page.goto('/timeline');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`${prefix}又到南京`) }).click();
  await expect(page.getByRole('region', { name: '简记详情' })).toContainText('在旧街巷里慢慢走');
  expect((await cities).ok()).toBeTruthy();
  const visitedCity = page.locator('.map-label--city.map-label--visited').filter({ hasText: '南京市' });
  await expect(visitedCity).toHaveCount(1);
  await page.getByRole('button', { name: '关闭简记详情' }).click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: 'Timeline', exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '缩小地图', exact: true }).click();
    await page.waitForTimeout(350);
  }
  await expect(visitedCity).toBeVisible();
  await page.screenshot({ path: `.artifacts/${prefix}-city.png`, fullPage: true });
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.getByLabel('按年份筛选').selectOption('2025');
  await expect(page.getByRole('button', { name: new RegExp(`${prefix}去年的南京`) })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`${prefix}又到南京`) })).toHaveCount(0);
  await page.getByLabel('按年份筛选').selectOption('all');
  await page.getByLabel('按旅行筛选').selectOption(trip2.id);
  await expect(page.getByRole('button', { name: new RegExp(`${prefix}又到南京`) })).toBeVisible();
  await page.getByRole('button', { name: '返回地图', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `.artifacts/${prefix}-map.png`, fullPage: true });

  await page.goto('/admin');
  await page.getByLabel('账号', { exact: true }).fill('e2e-admin');
  await page.getByLabel('密码', { exact: true }).fill('e2e-only-password-2026');
  await page.getByRole('button', { name: '登录管理后台' }).click();
  await page.getByRole('button', { name: '新建简记', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('标题', { exact: false }).fill(`${prefix}手机新记录`);
  await dialog.getByLabel('开始日期', { exact: false }).fill('2026-10-19');
  await dialog.getByLabel('地点', { exact: false }).selectOption(place.id);
  await dialog.getByLabel('旅行分组', { exact: false }).selectOption(trip2.id);
  await dialog.getByLabel('正文', { exact: true }).fill('保存后即可公开浏览');
  const png = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#9bb7ae' } }).png().toBuffer();
  await dialog.locator('input[type=file]').setInputFiles({ name: 'nanjing.png', mimeType: 'image/png', buffer: png });
  await expect(dialog.getByLabel('照片描述')).toBeVisible();
  await dialog.getByLabel('照片描述').fill('南京旅途');
  const save = page.waitForResponse(response => response.url().endsWith('/api/entries') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: '创建简记', exact: true }).click();
  expect((await save).status()).toBe(201);
  await expect(dialog).toHaveCount(0);
  await page.screenshot({ path: `.artifacts/${prefix}-admin.png`, fullPage: true });
  await page.goto('/timeline');
  await page.getByRole('button', { name: new RegExp(`${prefix}手机新记录`) }).click();
  await expect(page.getByRole('region', { name: '简记详情' })).toContainText('保存后即可公开浏览');
  await page.getByRole('button', { name: '查看照片：南京旅途' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  expect(errors).toEqual([]);
  await request.delete(`/api/entries/${older.id}`, { headers });
  await request.delete(`/api/entries/${newer.id}`, { headers });
});

test('管理地点、城市连线排序和删除确认', async ({ page, request }, info) => {
  const prefix = info.project.name;
  await page.goto('/admin');
  await page.getByLabel('账号', { exact: true }).fill('e2e-admin');
  await page.getByLabel('密码', { exact: true }).fill('e2e-only-password-2026');
  await page.getByRole('button', { name: '登录管理后台' }).click();
  const nav = page.getByRole('navigation', { name: '管理内容分类' });
  await nav.getByRole('button', { name: /^地点/ }).click();
  await page.locator('.admin-content__head').getByRole('button', { name: '新建地点', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('地点名称', { exact: false }).fill(`${prefix}苏州平江路`);
  await dialog.locator('#place-province').selectOption('320000');
  await dialog.locator('#place-city').selectOption('320500');
  await expect(dialog.locator('#place-lng')).toHaveCount(0);
  await dialog.getByRole('button', { name: '创建地点', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(`${prefix}苏州平江路`, { exact: true })).toBeVisible();
  await nav.getByRole('button', { name: /^旅行分组/ }).click();
  await page.locator('.admin-content__head').getByRole('button', { name: '新建旅行', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('旅行名称', { exact: false }).fill(`${prefix}城市连线`);
  const adder = dialog.locator('.route-adder').filter({ has: page.locator('#route-province') });
  await adder.locator('#route-province').selectOption('320000');
  await adder.locator('select').nth(1).selectOption('320100');
  await adder.getByRole('button', { name: '添加', exact: true }).click();
  await adder.locator('select').nth(1).selectOption('320500');
  await adder.getByRole('button', { name: '添加', exact: true }).click();
  await dialog.getByRole('button', { name: '城市上移' }).last().click();
  const save = page.waitForResponse(response => response.url().endsWith('/api/trips') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: '创建旅行', exact: true }).click();
  const response = await save;
  expect(response.status()).toBe(201);
  expect((await response.json()).cityRoute.map((city: { name: string }) => city.name)).toEqual(['苏州市', '南京市']);
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: `删除旅行 ${prefix}城市连线`, exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('确定删除');
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByText(`${prefix}城市连线`, { exact: true })).toBeVisible();
  expect((await request.get('/api/catalog')).ok()).toBeTruthy();
});

test('运行时底图配置可加载且无地图表达式错误', async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  let tileRequests = 0;
  const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#e8e6e1' } }).png().toBuffer();
  await page.route('**/test-tiles/**', route => { tileRequests++; return route.fulfill({ contentType: 'image/png', body: tile }); });
  await page.route('**/api/map-config', route => route.fulfill({ json: {
    tiles: ['http://127.0.0.1:3011/test-tiles/base/{z}/{x}/{y}.png'],
    overlayTiles: ['http://127.0.0.1:3011/test-tiles/labels/{z}/{x}/{y}.png'],
    attribution: '验收瓦片', maxZoom: 18,
  } }));
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect.poll(() => tileRequests).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(errors.filter(error => !error.includes('favicon'))).toEqual([]);
});

test('全国默认视野保留边缘省份', async ({ page }, info) => {
  await page.goto('/');
  const names = ['新疆维吾尔自治区', '西藏自治区', '黑龙江省', '海南省', '台湾省'];
  await expect(page.locator('.map-label--province')).toHaveCount(34, { timeout: 15000 });
  await expect.poll(async () => {
    const covered: string[] = [];
    const viewport = page.viewportSize()!;
    const panel = await page.locator('.timeline-panel').count() ? await page.locator('.timeline-panel').boundingBox() : null;
    for (const name of names) {
      const box = await page.locator('.map-label--province').filter({ hasText: name }).boundingBox();
      const left = info.project.name === 'desktop' && panel ? panel.x + panel.width + 4 : 0;
      if (!box || box.x < left || box.x + box.width > viewport.width || box.y < 65 || box.y + box.height > viewport.height - 100) covered.push(name);
    }
    return covered;
  }, { timeout: 5000 }).toEqual([]);
});
