import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { navigationService } from '../src/browser/navigation.js';
import { screenshotService } from '../src/services/screenshot-service.js';
import { comparisonService } from '../src/services/comparison-service.js';
import { browserManager } from '../src/browser/browser-manager.js';

describe('Screenshot & Viewport Comparison Services', () => {
  const cleanFixture = path.resolve(process.cwd(), 'fixtures/responsive-clean.html');

  beforeAll(async () => {
    await navigationService.openPage(cleanFixture);
  });

  afterAll(async () => {
    await browserManager.close();
  });

  it('should capture viewport and full-page screenshots', async () => {
    const viewportShot = await screenshotService.captureScreenshot({ type: 'viewport' });
    expect(fs.existsSync(viewportShot.filePath)).toBe(true);
    expect(viewportShot.fileSizeBytes).toBeGreaterThan(500);

    const fullPageShot = await screenshotService.captureScreenshot({ type: 'fullPage' });
    expect(fs.existsSync(fullPageShot.filePath)).toBe(true);
    expect(fullPageShot.fileSizeBytes).toBeGreaterThan(500);
  });

  it('should capture a specific element screenshot', async () => {
    const elShot = await screenshotService.captureScreenshot({
      type: 'element',
      selector: 'header',
    });

    expect(fs.existsSync(elShot.filePath)).toBe(true);
    expect(elShot.selector).toBe('header');
  });

  it('should compare viewports and generate visual difference metrics', async () => {
    const comparison = await comparisonService.compareViewports(
      undefined,
      [
        { name: 'Mobile', category: 'Mobile', width: 375, height: 812 },
        { name: 'Desktop', category: 'Desktop', width: 1440, height: 900 },
      ],
      true
    );

    expect(comparison.viewports.length).toBe(2);
    expect(fs.existsSync(comparison.viewports[0].screenshotPath)).toBe(true);
    expect(fs.existsSync(comparison.viewports[1].screenshotPath)).toBe(true);
    expect(comparison.layoutTransitions.length).toBeGreaterThan(0);
    expect(comparison.visualDiff).toBeDefined();
    if (comparison.visualDiff) {
      expect(fs.existsSync(comparison.visualDiff.diffScreenshotPath)).toBe(true);
      expect(comparison.visualDiff.mismatchPercentage).toBeGreaterThanOrEqual(0);
    }
  });
});
