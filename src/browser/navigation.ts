import * as path from 'path';
import * as fs from 'fs';
import { pageManager } from './page-manager.js';
import { logger } from '../utils/logger.js';
import { NavigationError } from '../utils/errors.js';
import { PageLoadInfo } from '../types/index.js';

export class NavigationService {
  private normalizeUrl(urlInput: string): string {
    const trimmed = urlInput.trim();

    // Check if it's already an HTTP or HTTPS or file URL
    if (/^https?:\/\//i.test(trimmed) || /^file:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // Check if it's an existing local file
    const resolvedPath = path.resolve(trimmed);
    if (fs.existsSync(resolvedPath)) {
      const fileUrl = 'file:///' + resolvedPath.replace(/\\/g, '/');
      return fileUrl;
    }

    // If it looks like a domain without scheme (e.g. "example.com" or "localhost:3000")
    if (/^[a-zA-Z0-9.-]+(:\d+)?(\/.*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }

    return trimmed;
  }

  public async openPage(
    url: string,
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'domcontentloaded',
    timeout: number = 30000
  ): Promise<PageLoadInfo> {
    const page = await pageManager.getPage();
    const targetUrl = this.normalizeUrl(url);
    const startTime = Date.now();

    logger.info(`Navigating to: ${targetUrl} (waitUntil: ${waitUntil}, timeout: ${timeout}ms)`);

    try {
      let response = null;
      try {
        response = await page.goto(targetUrl, {
          waitUntil,
          timeout,
        });
      } catch (navError: any) {
        const errorMsg = navError?.message || String(navError);
        // If the wait state timed out (e.g. slow external assets or live websockets),
        // check if the page DOM has successfully committed and is inspectable
        if (errorMsg.includes('Timeout') || errorMsg.includes('timeout')) {
          const currentUrl = page.url();
          if (currentUrl && currentUrl !== 'about:blank') {
            logger.warn(
              `Navigation wait condition '${waitUntil}' timed out after ${timeout}ms, but page DOM is accessible at ${currentUrl}. Proceeding with inspection.`
            );
          } else {
            throw new NavigationError(`Navigation to ${targetUrl} timed out after ${timeout}ms: ${errorMsg}`);
          }
        } else {
          throw new NavigationError(`Failed to navigate to ${targetUrl}: ${errorMsg}`, { originalError: errorMsg });
        }
      }

      const loadTimeMs = Date.now() - startTime;
      const finalUrl = page.url();
      const title = await page.title().catch(() => 'Untitled');
      const viewport = page.viewportSize() || { width: 1280, height: 800 };

      const status = response ? response.status() : null;
      const statusText = response ? response.statusText() : null;

      logger.info(`Page loaded successfully in ${loadTimeMs}ms. Title: "${title}", Final URL: ${finalUrl}`);

      return {
        url: targetUrl,
        finalUrl,
        title,
        status,
        statusText,
        loadTimeMs,
        viewport,
      };
    } catch (err) {
      if (err instanceof NavigationError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new NavigationError(`Navigation error for ${targetUrl}: ${msg}`);
    }
  }

  public async navigateBack(timeout: number = 15000): Promise<{ url: string; title: string }> {
    const page = pageManager.getActivePageOrThrow();
    logger.info('Navigating back in browser history...');
    await page.goBack({ timeout, waitUntil: 'load' }).catch(async () => {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    });
    return {
      url: page.url(),
      title: await page.title().catch(() => ''),
    };
  }

  public async navigateForward(timeout: number = 15000): Promise<{ url: string; title: string }> {
    const page = pageManager.getActivePageOrThrow();
    logger.info('Navigating forward in browser history...');
    await page.goForward({ timeout, waitUntil: 'load' }).catch(async () => {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    });
    return {
      url: page.url(),
      title: await page.title().catch(() => ''),
    };
  }

  public async reloadPage(
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'load',
    timeout: number = 30000
  ): Promise<PageLoadInfo> {
    const page = pageManager.getActivePageOrThrow();
    const startTime = Date.now();
    logger.info(`Reloading page... (waitUntil: ${waitUntil})`);

    const response = await page.reload({ waitUntil, timeout });
    const loadTimeMs = Date.now() - startTime;
    const title = await page.title().catch(() => '');
    const viewport = page.viewportSize() || { width: 1280, height: 800 };

    return {
      url: page.url(),
      finalUrl: page.url(),
      title,
      status: response ? response.status() : null,
      statusText: response ? response.statusText() : null,
      loadTimeMs,
      viewport,
    };
  }
}

export const navigationService = new NavigationService();
