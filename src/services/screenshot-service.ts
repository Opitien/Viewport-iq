import * as fs from 'fs';
import { Page } from 'playwright';
import { pageManager } from '../browser/page-manager.js';
import { fileManager } from '../utils/file-manager.js';
import { ElementNotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface ScreenshotOptions {
  type?: 'viewport' | 'fullPage' | 'element';
  selector?: string;
  width?: number;
  height?: number;
  filenamePrefix?: string;
}

export interface ScreenshotResult {
  filePath: string;
  type: 'viewport' | 'fullPage' | 'element';
  dimensions: { width: number; height: number };
  fileSizeBytes: number;
  selector?: string;
  url: string;
  timestamp: string;
}

/**
 * Abort any in-flight font / stylesheet requests that haven't settled within
 * a short window.  This prevents Playwright's built-in "wait for web fonts"
 * logic from hanging indefinitely on slow CDNs (e.g. Google Fonts, Vercel).
 */
async function abortPendingFontRequests(page: Page): Promise<void> {
  try {
    // Inject CSS that forces font-display: swap on every @font-face so the
    // browser never blocks on remote font downloads for rendering.
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '* { font-display: swap !important; }';
      document.head.appendChild(style);
    });
  } catch {
    // Non-fatal – best effort
  }
}

export class ScreenshotService {
  public async captureScreenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const page = pageManager.getActivePageOrThrow();
    const currentViewport = page.viewportSize() || { width: 1280, height: 800 };
    const url = page.url();
    const type = options.type || 'viewport';

    let originalViewport = currentViewport;
    const needResize = options.width && options.height && (options.width !== currentViewport.width || options.height !== currentViewport.height);

    if (needResize) {
      originalViewport = currentViewport;
      await page.setViewportSize({ width: options.width!, height: options.height! });
      await page.waitForTimeout(300);
    }

    // Pre-screenshot: force font-display:swap to prevent hangs on slow font CDNs
    await abortPendingFontRequests(page);

    try {
      const activeViewport = page.viewportSize() || { width: 1280, height: 800 };
      const filePath = fileManager.getScreenshotPath(
        url,
        { width: activeViewport.width, height: activeViewport.height },
        options.filenamePrefix || 'shot'
      );

      let shotWidth = activeViewport.width;
      let shotHeight = activeViewport.height;

      if (type === 'element') {
        if (!options.selector) {
          throw new Error('A CSS selector must be provided when screenshot type is "element".');
        }

        const el = await page.$(options.selector);
        if (!el) {
          throw new ElementNotFoundError(options.selector);
        }

        const box = await el.boundingBox();
        if (box) {
          shotWidth = Math.round(box.width);
          shotHeight = Math.round(box.height);
        }

        await el.screenshot({ path: filePath, timeout: 10000, animations: 'disabled' });
      } else if (type === 'fullPage') {
        const fullDims = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        }));
        shotWidth = fullDims.width;
        shotHeight = fullDims.height;

        await page.screenshot({ path: filePath, fullPage: true, timeout: 15000, animations: 'disabled' });
      } else {
        await page.screenshot({ path: filePath, fullPage: false, timeout: 10000, animations: 'disabled' });
      }

      const stats = fs.statSync(filePath);
      logger.info(`Captured ${type} screenshot (${stats.size} bytes) saved to: ${filePath}`);

      return {
        filePath,
        type,
        dimensions: { width: shotWidth, height: shotHeight },
        fileSizeBytes: stats.size,
        selector: options.selector,
        url,
        timestamp: new Date().toISOString(),
      };
    } finally {
      if (needResize) {
        await page.setViewportSize(originalViewport);
      }
    }
  }
}

export const screenshotService = new ScreenshotService();
