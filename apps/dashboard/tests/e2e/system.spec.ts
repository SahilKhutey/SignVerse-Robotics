import { test, expect } from '@playwright/test';

test.describe('System Diagnostics E2E Tests', () => {
  test('system_page_shows_kernel_running', async ({ page }) => {
    // Mock the status endpoint to return running kernel state
    await page.route('**/api/system/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kernel: 'running',
          uptime: 9850,
          loopFrequency: { target: 1000, actual: 1001 }
        }),
      });
    });

    await page.goto('/system');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    const badge = page.locator('#kernel-status-badge');
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toHaveText('Running', { ignoreCase: true });
  });

  test('system_page_latency_meter_updates', async ({ page }) => {
    await page.goto('/system');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // Set wsState to LIVE so the latency meter activates
    await page.evaluate(() => {
      (window as any).useTelemetryStore.getState().setWsState('LIVE');
    });

    // Dispatch synthetic pong messages to build a rolling average
    await page.evaluate(() => {
      const ws = (window as any).wsClient;
      if (ws && typeof ws.notifyMessage === 'function') {
        for (let i = 0; i < 5; i++) {
          ws.notifyMessage({
            type: 'pong',
            ts: performance.now() - 15 // 15ms simulated RTT
          });
        }
      }
    });

    const latencyDisplay = page.locator('#latency-value-display');
    await expect(latencyDisplay).toBeVisible({ timeout: 5000 });

    // Wait until the display is showing a real number (not '--')
    await page.waitForFunction(() => {
      const el = document.querySelector('#latency-value-display');
      return el && el.textContent !== '--' && el.textContent !== '';
    }, { timeout: 8000 });

    const latencyText = await latencyDisplay.innerText();
    const latency = parseInt(latencyText, 10);
    expect(latency).toBeLessThan(200);
    expect(latency).toBeGreaterThanOrEqual(0);
  });
});
