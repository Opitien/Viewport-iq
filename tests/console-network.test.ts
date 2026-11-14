import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import { navigationService } from '../src/browser/navigation.js';
import { pageManager } from '../src/browser/page-manager.js';
import { browserManager } from '../src/browser/browser-manager.js';

describe('Console & Network Inspection', () => {
  const cleanFixture = path.resolve(process.cwd(), 'fixtures/responsive-clean.html');

  beforeAll(async () => {
    await navigationService.openPage(cleanFixture);
  });

  afterAll(async () => {
    await browserManager.close();
  });

  it('should capture console messages and errors', async () => {
    const page = pageManager.getActivePageOrThrow();

    // Trigger console events
    await page.evaluate(() => {
      console.log('Testing info log message');
      console.warn('Testing warning log message');
      console.error('Testing critical error message');
    });

    const allLogs = pageManager.getConsoleLogs('all');
    expect(allLogs.some((l) => l.text.includes('Testing info log message'))).toBe(true);
    expect(allLogs.some((l) => l.text.includes('Testing warning log message'))).toBe(true);
    expect(allLogs.some((l) => l.text.includes('Testing critical error message'))).toBe(true);

    const errorLogsOnly = pageManager.getConsoleLogs('error');
    expect(errorLogsOnly.every((l) => l.type === 'error')).toBe(true);
  });

  it('should capture network failures when requesting invalid assets', async () => {
    const page = pageManager.getActivePageOrThrow();

    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = 'http://127.0.0.1:54321/nonexistent-image.png';
      document.body.appendChild(img);
    });

    // Wait for the browser network failure event to be captured
    await page.waitForTimeout(600);

    const failedLogs = pageManager.getNetworkLogs(true);
    expect(failedLogs.length).toBeGreaterThanOrEqual(1);
    expect(failedLogs[0].failed).toBe(true);
  });
});
