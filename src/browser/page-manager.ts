import { Page, Response, Request } from 'playwright';
import { browserManager } from './browser-manager.js';
import { logger } from '../utils/logger.js';
import { PageNotOpenError } from '../utils/errors.js';
import { ConsoleEntry, NetworkEntry } from '../types/index.js';

export class PageManager {
  private static instance: PageManager | null = null;
  private currentPage: Page | null = null;
  private consoleLogs: ConsoleEntry[] = [];
  private networkLogs: NetworkEntry[] = [];
  private maxLogHistory = 200;

  private constructor() {}

  public static getInstance(): PageManager {
    if (!PageManager.instance) {
      PageManager.instance = new PageManager();
    }
    return PageManager.instance;
  }

  public async getPage(): Promise<Page> {
    if (this.currentPage && !this.currentPage.isClosed()) {
      return this.currentPage;
    }

    const context = await browserManager.getContext();
    this.currentPage = await context.newPage();
    await this.currentPage.addInitScript(() => {
      (window as any).__name = (window as any).__name || ((t: any, v: any) => t);
    });
    this.attachEventListeners(this.currentPage);
    return this.currentPage;
  }

  public getActivePageOrThrow(): Page {
    if (!this.currentPage || this.currentPage.isClosed()) {
      throw new PageNotOpenError();
    }
    return this.currentPage;
  }

  public hasActivePage(): boolean {
    return !!(this.currentPage && !this.currentPage.isClosed());
  }

  private attachEventListeners(page: Page): void {
    page.on('console', (msg) => {
      const type = (msg.type() as ConsoleEntry['type']) || 'log';
      const text = msg.text();
      const location = msg.location();

      const entry: ConsoleEntry = {
        type,
        text,
        location: {
          url: location.url,
          lineNumber: location.lineNumber,
          columnNumber: location.columnNumber,
        },
        timestamp: new Date().toISOString(),
      };

      this.consoleLogs.push(entry);
      if (this.consoleLogs.length > this.maxLogHistory) {
        this.consoleLogs.shift();
      }

      if (type === 'error') {
        logger.warn(`Browser Console [${type}]: ${text}`);
      }
    });

    page.on('pageerror', (err) => {
      const entry: ConsoleEntry = {
        type: 'error',
        text: `Uncaught Exception: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
      this.consoleLogs.push(entry);
      logger.error(`Uncaught Page Exception: ${err.message}`);
    });

    page.on('requestfailed', (req: Request) => {
      const entry: NetworkEntry = {
        id: Math.random().toString(36).substring(2, 9),
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        status: null,
        statusText: null,
        failed: true,
        failureReason: req.failure()?.errorText || 'Unknown request failure',
        timestamp: new Date().toISOString(),
      };

      this.networkLogs.push(entry);
      if (this.networkLogs.length > this.maxLogHistory) {
        this.networkLogs.shift();
      }
      logger.warn(`Request failed: ${req.method()} ${req.url()} - ${entry.failureReason}`);
    });

    page.on('response', (res: Response) => {
      const status = res.status();
      const failed = status >= 400;

      const entry: NetworkEntry = {
        id: Math.random().toString(36).substring(2, 9),
        url: res.url(),
        method: res.request().method(),
        resourceType: res.request().resourceType(),
        status,
        statusText: res.statusText(),
        failed,
        timestamp: new Date().toISOString(),
      };

      this.networkLogs.push(entry);
      if (this.networkLogs.length > this.maxLogHistory) {
        this.networkLogs.shift();
      }

      if (failed) {
        logger.warn(`HTTP error response: ${res.status()} for ${res.url()}`);
      }
    });
  }

  public async setViewport(width: number, height: number, settleMs: number = 200): Promise<void> {
    const page = this.getActivePageOrThrow();
    logger.debug(`Setting viewport to ${width}x${height}...`);
    await page.setViewportSize({ width, height });

    if (settleMs > 0) {
      await page.waitForTimeout(settleMs);
    }
  }

  public getConsoleLogs(level: 'all' | 'error' | 'warn' | 'info' = 'all', clear: boolean = false): ConsoleEntry[] {
    let result = this.consoleLogs;
    if (level === 'error') {
      result = result.filter((e) => e.type === 'error');
    } else if (level === 'warn') {
      result = result.filter((e) => e.type === 'warn' || e.type === 'error');
    } else if (level === 'info') {
      result = result.filter((e) => e.type !== 'debug' && e.type !== 'trace');
    }

    if (clear) {
      this.consoleLogs = [];
    }
    return [...result];
  }

  public getNetworkLogs(failedOnly: boolean = true, clear: boolean = false): NetworkEntry[] {
    let result = this.networkLogs;
    if (failedOnly) {
      result = result.filter((e) => e.failed);
    }

    if (clear) {
      this.networkLogs = [];
    }
    return [...result];
  }

  public clearLogs(): void {
    this.consoleLogs = [];
    this.networkLogs = [];
  }
}

export const pageManager = PageManager.getInstance();
