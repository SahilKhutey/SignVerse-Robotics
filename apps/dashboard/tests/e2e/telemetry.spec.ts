import { test, expect } from '@playwright/test';

test.describe('Telemetry Monitor E2E Tests', () => {
  test('telemetry_charts_render_with_live_data', async ({ page }) => {
    await page.goto('/telemetry');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // Inject a telemetry frame to remove skeleton loaders and activate the chart
    await page.evaluate(() => {
      (window as any).useTelemetryStore.getState().setWsState('LIVE');
      (window as any).useTelemetryStore.getState().setFrame({
        jointAngles: [0, 0, 0, 0, 0, 0, 0],
        poseLandmarks: [],
        aiPrediction: [],
        confidence: 1.0,
        timestampMs: Date.now(),
      });
    });

    // The uPlot chart renders a canvas inside the #joint-angle-chart-container
    const container = page.locator('#joint-angle-chart-container');
    await expect(container).toBeVisible({ timeout: 15000 });

    // uPlot injects a canvas element into the container div
    const chart = container.locator('canvas');
    await expect(chart.first()).toBeVisible({ timeout: 15000 });
  });

  test('telemetry_hz_counter_shows_realistic_rate', async ({ page }) => {
    await page.goto('/telemetry');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // Inject live telemetry rate metrics into store
    await page.evaluate(() => {
      (window as any).useTelemetryStore.getState().setFrame({
        jointAngles: [0, 0, 0, 0, 0, 0, 0],
        poseLandmarks: [],
        aiPrediction: [],
        confidence: 1.0,
        timestampMs: Date.now(),
      });
      (window as any).useTelemetryStore.getState().setWsState('LIVE');
      (window as any).useTelemetryStore.getState().setHz(1002);
    });

    const hzValueEl = page.locator('#framerate-hz-value');
    await expect(hzValueEl).toBeVisible({ timeout: 5000 });
    
    // Read and parse rate text to verify it's realistic (between 900 and 1100)
    await page.waitForTimeout(500); // Allow text interpolation
    const hzText = await hzValueEl.innerText();
    const rate = parseInt(hzText, 10);
    expect(rate).toBeGreaterThan(900);
    expect(rate).toBeLessThan(1100);
  });

  test('telemetry_csv_export_downloads_file', async ({ page }) => {
    await page.goto('/telemetry');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // Populate data inside telemetryRingBuffer via evaluate
    await page.evaluate(() => {
      (window as any).useTelemetryStore.getState().setFrame({
        jointAngles: [0, 0, 0, 0, 0, 0, 0],
        poseLandmarks: [],
        aiPrediction: [],
        confidence: 1.0,
        timestampMs: Date.now(),
      });
      (window as any).telemetryRingBuffer.push({
        jointAngles: [1.2, 0.5, -0.3, 0, 0, 0, 0],
        poseLandmarks: [],
        aiPrediction: [],
        confidence: 0.98,
        timestampMs: Date.now(),
      });
    });

    const exportBtn = page.locator('#export-csv-btn');
    await expect(exportBtn).toBeVisible();

    // Trigger download verification
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/telemetry_export_.*\.csv/);
  });
});
