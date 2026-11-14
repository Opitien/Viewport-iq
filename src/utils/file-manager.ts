import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger.js';

export class FileManager {
  private baseDir: string;
  private screenshotsDir: string;
  private responsiveDir: string;
  private comparisonsDir: string;
  private reportsDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'output');
    this.screenshotsDir = path.join(this.baseDir, 'screenshots');
    this.responsiveDir = path.join(this.baseDir, 'responsive-tests');
    this.comparisonsDir = path.join(this.baseDir, 'comparisons');
    this.reportsDir = path.join(this.baseDir, 'reports');

    this.ensureDirectories();
  }

  public ensureDirectories(): void {
    const dirs = [this.baseDir, this.screenshotsDir, this.responsiveDir, this.comparisonsDir, this.reportsDir];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`Created directory: ${dir}`);
      }
    }
  }

  public sanitizeForFilename(input: string): string {
    return input
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);
  }

  public getScreenshotPath(identifier: string, dimensions?: { width: number; height: number }, prefix: string = 'shot'): string {
    const cleanId = this.sanitizeForFilename(identifier);
    const timestamp = Date.now();
    const dimSuffix = dimensions ? `_${dimensions.width}x${dimensions.height}` : '';
    const filename = `${prefix}_${cleanId}${dimSuffix}_${timestamp}.png`;
    return path.join(this.screenshotsDir, filename);
  }

  public getResponsiveScreenshotPath(url: string, viewportName: string, width: number, height: number): string {
    const cleanUrl = this.sanitizeForFilename(url);
    const cleanName = this.sanitizeForFilename(viewportName);
    const timestamp = Date.now();
    const filename = `resp_${cleanUrl}_${cleanName}_${width}x${height}_${timestamp}.png`;
    return path.join(this.responsiveDir, filename);
  }

  public getComparisonDiffPath(url: string, widthA: number, widthB: number): string {
    const cleanUrl = this.sanitizeForFilename(url);
    const timestamp = Date.now();
    const filename = `diff_${cleanUrl}_${widthA}vs${widthB}_${timestamp}.png`;
    return path.join(this.comparisonsDir, filename);
  }

  public getReportPath(url: string, reportType: string): string {
    const cleanUrl = this.sanitizeForFilename(url);
    const timestamp = Date.now();
    const filename = `report_${reportType}_${cleanUrl}_${timestamp}.json`;
    return path.join(this.reportsDir, filename);
  }

  public saveJsonReport(filePath: string, data: any): string {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.debug(`Saved JSON report to: ${filePath}`);
    return filePath;
  }

  public fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  public getBaseDir(): string {
    return this.baseDir;
  }
}

export const fileManager = new FileManager();
