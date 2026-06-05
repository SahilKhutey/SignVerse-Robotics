import { test, expect } from '@playwright/test';

test.describe('Command Center E2E Tests', () => {
  test('command_submits_and_shows_parsed_intent', async ({ page }) => {
    await page.route('**/api/command', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          agent_output: {
            q_target: [0.785, 0.523, 0.261],
            speed_scaling: 1.0,
            message: 'Moving arm to home position',
          },
        }),
      });
    });

    await page.goto('/command');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    const input = page.locator('input[placeholder*="Enter natural language command"]');
    await expect(input).toBeVisible();
    await input.fill('move arm to home position');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify VLA INTENT DIAGRAM card appears
    const responseCard = page.locator('text=VLA INTENT DIAGRAM');
    await expect(responseCard).toBeVisible({ timeout: 5000 });

    // Assert primitive intent text is visible and not empty
    const intentText = page.locator('text=PRIMITIVE:');
    await expect(intentText).not.toBeEmpty();
  });

  test('command_input_disabled_during_pending', async ({ page }) => {
    await page.goto('/command');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // Force command store to pending state
    await page.evaluate(() => {
      (window as any).useCommandStore.setState({ pending: true });
    });

    const input = page.locator('input[placeholder*="Enter natural language"]');
    await expect(input).toBeDisabled();
  });

  test('voice_command_fills_input_via_speech_api', async ({ page }) => {
    // Inject Mock SpeechRecognition class before script load
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        lang = 'en-US';
        continuous = false;
        interimResults = true;
        maxAlternatives = 1;
        onstart: (() => void) | null = null;
        onresult: ((e: any) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((e: any) => void) | null = null;
        
        start() {
          if (this.onstart) this.onstart();
          // Simulate voice result after a short delay
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                resultIndex: 0,
                results: {
                  0: {
                    0: { transcript: 'pick up block', confidence: 0.95 },
                    length: 1,
                    isFinal: true
                  },
                  length: 1
                }
              });
            }
            if (this.onend) this.onend();
          }, 100);
        }
        stop() {}
        abort() {}
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent() { return true; }
      }
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });

    await page.goto('/command');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    // Click microphone button
    const micButton = page.locator('#voice-mic-btn');
    await expect(micButton).toBeVisible({ timeout: 5000 });
    await micButton.click();

    // Verify input gets filled with the voice transcript
    const input = page.locator('input[placeholder*="Enter natural language"]');
    await expect(input).toHaveValue('pick up block', { timeout: 3000 });
  });

  test('suggested_chips_fill_input', async ({ page }) => {
    await page.goto('/command');
    await expect(page.locator('text=Loading Diagnostics Deck...')).not.toBeVisible({ timeout: 30000 });

    const chip = page.locator('button:has-text("Pick up the block")');
    await expect(chip).toBeVisible();
    await chip.click();

    const input = page.locator('input[placeholder*="Enter natural language"]');
    await expect(input).toHaveValue('Pick up the block');
  });
});
