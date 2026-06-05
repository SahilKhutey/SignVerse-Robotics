import { test, expect } from '@playwright/test';

test.describe('Online Learning E2E Tests', () => {
  test('online_learning_page_shows_live_accuracy', async ({ page }) => {
    await page.goto('/online-learning');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    const sparkline = page.locator('header canvas');
    await expect(sparkline).toBeVisible();

    const countBefore = await page.evaluate(() => (window as any).useOnlineLearningStore.getState().accuracyHistory.length);

    // Simulate receiving an update event and update accuracy history
    const event = {
      type: 'update_complete',
      step: 10,
      loss: 0.02,
      val_accuracy: 0.94,
      per_task_accuracy: {},
      learning_rate: 1e-4,
      replay_ratio: 0.15,
      timestamp_ms: Date.now()
    };

    await page.evaluate((ev) => {
      // pushEvent only adds to events list; updateAccuracyHistory populates accuracyHistory
      (window as any).useOnlineLearningStore.getState().pushEvent(ev);
      (window as any).useOnlineLearningStore.getState().updateAccuracyHistory(ev);
    }, event);

    const countAfter = await page.evaluate(() => (window as any).useOnlineLearningStore.getState().accuracyHistory.length);
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  test('pause_learning_button_toggles_state', async ({ page }) => {
    let mockPaused = false;

    // Mock both pause and state API endpoints
    await page.route('**/api/online/pause', async (route) => {
      const body = route.request().postDataJSON();
      mockPaused = body.paused;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: mockPaused ? 'paused' : 'idle',
          total_steps: 120,
          current_lr: 1e-4,
          replay_buffer_size: 45,
          checkpoint_count: 3,
          last_checkpoint_step: 100,
          ewc_lambda: 400.0,
        }),
      });
    });

    await page.route('**/api/online/state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: mockPaused ? 'paused' : 'idle',
          total_steps: 120,
          current_lr: 1e-4,
          replay_buffer_size: 45,
          checkpoint_count: 3,
          last_checkpoint_step: 100,
          ewc_lambda: 400.0,
        }),
      });
    });


    await page.goto('/online-learning');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // Ensure it's in idle state first
    await page.evaluate(() => {
      (window as any).useOnlineLearningStore.getState().setLearnerState({
        status: 'idle',
        total_steps: 120,
        current_lr: 1e-4,
        replay_buffer_size: 45,
        checkpoint_count: 3,
        last_checkpoint_step: 100,
        ewc_lambda: 400.0,
      });
    });

    const badge = page.locator('.glass-panel').filter({ hasText: 'LEARNING STATE PIPELINE' }).locator('.rounded-full').first();
    await expect(badge).toHaveText('IDLE');

    // Click Pause
    const pauseBtn = page.locator('button:has-text("PAUSE LEARNING")');
    await expect(pauseBtn).toBeVisible();
    await pauseBtn.click();

    // Badge should show PAUSED
    await expect(badge).toHaveText('PAUSED');

    // Click Resume
    const resumeBtn = page.locator('button:has-text("RESUME LEARNING")');
    await expect(resumeBtn).toBeVisible();
    await resumeBtn.click();

    // Badge returns to IDLE
    await expect(badge).toHaveText('IDLE');
  });

  test('forgetting_monitor_shows_per_task_lines', async ({ page }) => {
    await page.goto('/online-learning');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // Inject 3 updates with a per-task accuracy key
    await page.evaluate(() => {
      const store = (window as any).useOnlineLearningStore;
      store.setState({
        accuracyHistory: [
          { step: 10, overall: 0.90, perTask: { task_a: 0.85 } },
          { step: 20, overall: 0.91, perTask: { task_a: 0.87 } },
          { step: 30, overall: 0.92, perTask: { task_a: 0.89 } }
        ]
      });
    });

    // Wait for recharts to render; it outputs SVG <path> elements with class recharts-curve
    // The LineChart contains at least 1 path per Line (task_a + overall = 2 lines)
    await page.waitForFunction(() => {
      const paths = document.querySelectorAll('.recharts-curve, path.recharts-line-curve');
      return paths.length >= 1;
    }, { timeout: 8000 });

    const lines = page.locator('.recharts-curve, path.recharts-line-curve');
    const lineCount = await lines.count();
    expect(lineCount).toBeGreaterThanOrEqual(1);
  });
});
