import { test, expect } from '@playwright/test';

async function mockApiEndpoints(page: any) {
  await page.route('**/api/sessions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/training/status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'idle', epoch: 0, loss: 0 }),
    });
  });

  await page.route('**/api/training/models**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/share/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', active: true }),
    });
  });

  await page.route('**/api/online/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'idle' }),
    });
  });

  await page.route('**/api/datasets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/system**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ uptime: 0, memory_mb: 0, cpu_percent: 0 }),
    });
  });
}

test.describe('Dashboard Smoke & Connection Tests', () => {
  test('all_screens_render_without_console_errors', async ({ page }) => {
    await mockApiEndpoints(page);

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          text.includes('THREE.WebGLRenderer') ||
          text.includes('WebGL') ||
          text.includes('ResizeObserver loop') ||
          text.includes('ERR_INTERNET_DISCONNECTED') ||
          text.includes('403') ||
          text.includes('EventSource') ||
          text.includes('webcam') ||
          text.includes('Webcam') ||
          text.includes('NotAllowedError') ||
          text.includes('NotSupportedError')
        ) {
          return;
        }
        consoleErrors.push(text);
      }
    });

    const routes = ['/twin', '/telemetry', '/command', '/collector', '/training', '/online-learning'];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });
      const indicator = page.locator('[role="status"]');
      await expect(indicator).toBeVisible();
    }

    const significantErrors = consoleErrors.filter(e =>
      !e.includes('WebSocket') &&
      !e.includes('ws://') &&
      !e.includes('Failed to fetch') &&
      !e.includes('net::ERR')
    );

    expect(significantErrors).toEqual([]);
  });

  test('app_loads_and_reaches_LIVE_state', async ({ page }) => {
    await page.goto('/twin');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });
    const indicator = page.locator('[role="status"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveText('Live', { timeout: 5000, ignoreCase: true });
  });

  test('app_shows_OFFLINE_when_gateway_stops', async ({ page }) => {
    await page.goto('/twin');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });
    const indicator = page.locator('[role="status"]');
    await expect(indicator).toHaveText('Live', { timeout: 5000, ignoreCase: true });

    // Simulate gateway shutdown by stubbing WebSocket and closing existing connection
    await page.evaluate(() => {
      (window as any).__originalWebSocket = window.WebSocket;
      window.WebSocket = function () {
        throw new Error('Gateway Down');
      } as any;
      (window as any).wsClient.socket?.close();
    });

    await expect(indicator).toHaveText('Offline', { timeout: 10000, ignoreCase: true });
  });

  test('app_auto_reconnects_after_gateway_restart', async ({ page }) => {
    await page.goto('/twin');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });
    const indicator = page.locator('[role="status"]');
    await expect(indicator).toHaveText('Live', { timeout: 5000, ignoreCase: true });

    // Simulate gateway shutdown
    await page.evaluate(() => {
      (window as any).__originalWebSocket = window.WebSocket;
      window.WebSocket = function () {
        throw new Error('Gateway Down');
      } as any;
      (window as any).wsClient.socket?.close();
    });

    await expect(indicator).toHaveText('Offline', { timeout: 10000, ignoreCase: true });

    // Wait 5 seconds
    await page.waitForTimeout(5000);

    // Restore WebSocket and connect to simulate gateway restart
    await page.evaluate(() => {
      window.WebSocket = (window as any).__originalWebSocket;
      (window as any).wsClient.connect();
    });

    await expect(indicator).toHaveText('Live', { timeout: 15000, ignoreCase: true });
  });

  test('sidebar_navigation_all_6_routes', async ({ page }) => {
    await page.goto('/twin');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    const routes = ['/telemetry', '/command', '/collector', '/training', '/online-learning', '/twin'];
    for (const route of routes) {
      const link = page.locator(`aside a[href="${route}"]`);
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(route));
    }
  });

  test('keyboard_shortcut_cmd_k_opens_command_page', async ({ page }) => {
    await page.goto('/twin');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // Trigger keydown Control+k to simulate Ctrl+K / Cmd+K
    await page.keyboard.press('Control+k');
    await expect(page).toHaveURL(/\/command/);
  });
});
