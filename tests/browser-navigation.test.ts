import { describe, it, expect, afterAll } from 'vitest';
import * as path from 'path';
import { navigationService } from '../src/browser/navigation.js';
import { browserManager } from '../src/browser/browser-manager.js';

describe('Browser Navigation Service', () => {
  const cleanFixture = path.resolve(process.cwd(), 'fixtures/responsive-clean.html');

  afterAll(async () => {
    await browserManager.close();
  });

  it('should open a local page and retrieve metadata', async () => {
    const result = await navigationService.openPage(cleanFixture);

    expect(result).toBeDefined();
    expect(result.title).toBe('Clean Responsive Showcase');
    expect(result.finalUrl).toContain('responsive-clean.html');
    expect(result.loadTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.viewport).toBeDefined();
  });

  it('should reload the active page', async () => {
    const result = await navigationService.reloadPage();
    expect(result.finalUrl).toContain('responsive-clean.html');
    expect(result.title).toBe('Clean Responsive Showcase');
  });
});
