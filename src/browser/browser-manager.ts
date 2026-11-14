import { chromium, Browser, BrowserContext } from 'playwright';
import { logger } from '../utils/logger.js';
import { BrowserCrashError } from '../utils/errors.js';

export class BrowserManager {
  private static instance: BrowserManager | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private isLaunching = false;

  private constructor() {
    this.registerProcessHandlers();
  }

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  private registerProcessHandlers(): void {
    const cleanup = async () => {
      logger.info('Received process exit signal, cleaning up browser...');
      await this.close();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  public async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.isLaunching) {
      while (this.isLaunching) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.browser && this.browser.isConnected()) {
        return this.browser;
      }
    }

    this.isLaunching = true;
    try {
      logger.info('Launching new Playwright Chromium instance...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
        ],
      });

      this.browser.on('disconnected', () => {
        logger.warn('Browser instance disconnected.');
        this.browser = null;
        this.context = null;
      });

      return this.browser;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to launch browser: ${msg}`);
      throw new BrowserCrashError(msg);
    } finally {
      this.isLaunching = false;
    }
  }

  public async getContext(viewport = { width: 1280, height: 800 }): Promise<BrowserContext> {
    const browser = await this.getBrowser();

    if (!this.context) {
      logger.info('Creating browser context...');
      this.context = await browser.newContext({
        viewport,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 ViewportIQ/1.0',
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
      });

      // Ensure bundler helper symbols (like __name from esbuild/tsx) don't throw in browser evaluations
      await this.context.addInitScript(() => {
        (window as any).__name = (window as any).__name || ((t: any, v: any) => t);
      });

      // Abort font requests that take longer than 3 seconds to prevent Playwright's
      // "waiting for fonts to load" screenshot hang on slow CDNs (Google Fonts, Vercel, etc.)
      await this.context.route('**/*.{woff,woff2,ttf,otf,eot}', async (route) => {
        const abortTimer = setTimeout(() => {
          route.abort('timedout').catch(() => {});
        }, 3000);
        try {
          const response = await route.fetch();
          clearTimeout(abortTimer);
          await route.fulfill({ response });
        } catch {
          clearTimeout(abortTimer);
          route.abort('connectionfailed').catch(() => {});
        }
      });

      // Also intercept CSS-linked font requests (commonly served from CDN paths without file extensions)
      await this.context.route(/fonts\.(googleapis|gstatic|cdnfonts|bunny)\./, async (route) => {
        const abortTimer = setTimeout(() => {
          route.abort('timedout').catch(() => {});
        }, 3000);
        try {
          const response = await route.fetch();
          clearTimeout(abortTimer);
          await route.fulfill({ response });
        } catch {
          clearTimeout(abortTimer);
          route.abort('connectionfailed').catch(() => {});
        }
      });
    }

    return this.context;
  }

  public async close(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
      if (this.browser && this.browser.isConnected()) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      logger.info('Browser resources closed successfully.');
    } catch (err) {
      logger.error('Error closing browser resources:', err);
    }
  }
}

export const browserManager = BrowserManager.getInstance();
