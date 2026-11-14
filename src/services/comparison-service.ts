import * as fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { pageManager } from '../browser/page-manager.js';
import { fileManager } from '../utils/file-manager.js';
import { ViewportPreset, ViewportComparisonResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ComparisonService {
  private static readonly DEFAULT_COMPARISON_VIEWPORTS: ViewportPreset[] = [
    { name: 'Mobile', category: 'Mobile', width: 375, height: 812, isMobile: true, hasTouch: true },
    { name: 'Tablet', category: 'Tablet', width: 768, height: 1024, isMobile: true, hasTouch: true },
    { name: 'Desktop', category: 'Desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
  ];

  public async compareViewports(
    url?: string,
    customViewports?: ViewportPreset[],
    runPixelDiff: boolean = true
  ): Promise<ViewportComparisonResult> {
    const page = pageManager.getActivePageOrThrow();
    const currentUrl = url || page.url();
    const viewports = customViewports && customViewports.length >= 2 ? customViewports : ComparisonService.DEFAULT_COMPARISON_VIEWPORTS;

    logger.info(`Starting viewport comparison for ${currentUrl} across ${viewports.length} viewports...`);

    const originalViewport = page.viewportSize() || { width: 1280, height: 800 };
    const viewportSnapshots: Array<{
      preset: ViewportPreset;
      screenshotPath: string;
      domSnapshot: {
        documentWidth: number;
        documentHeight: number;
        elementsCount: number;
        navDisplay?: string;
        mainGridOrFlex?: string;
      };
    }> = [];

    try {
      for (const vp of viewports) {
        logger.info(`Capturing comparison snapshot for ${vp.name} (${vp.width}x${vp.height})...`);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(400);

        const screenshotPath = fileManager.getResponsiveScreenshotPath(currentUrl, vp.name, vp.width, vp.height);
        try {
          // Inject font-display:swap to prevent Playwright hanging on slow font CDNs
          await page.evaluate(() => {
            if (!document.querySelector('#viewportiq-font-swap')) {
              const s = document.createElement('style');
              s.id = 'viewportiq-font-swap';
              s.textContent = '* { font-display: swap !important; }';
              document.head.appendChild(s);
            }
          });
          await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 8000, animations: 'disabled' });
        } catch (shotErr) {
          logger.warn(`Comparison screenshot for ${vp.name} timed out or failed — continuing without screenshot.`);
        }

        const domSnapshot = await page.evaluate(() => {
          const navEl = document.querySelector('nav, header');
          const navDisplay = navEl ? window.getComputedStyle(navEl).display : undefined;
          const mainEl = document.querySelector('main, #content, .container');
          const mainGridOrFlex = mainEl ? window.getComputedStyle(mainEl).display : undefined;

          return {
            documentWidth: document.documentElement.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
            elementsCount: document.querySelectorAll('*').length,
            navDisplay,
            mainGridOrFlex,
          };
        });

        viewportSnapshots.push({
          preset: vp,
          screenshotPath,
          domSnapshot,
        });
      }

      // Analyze transitions between adjacent viewports
      const layoutTransitions: Array<{ from: string; to: string; changes: string[] }> = [];
      const shiftingElements: Array<{ selector: string; shiftType: 'repositioned' | 'resized' | 'hidden' | 'stacked'; details: string }> = [];

      for (let i = 0; i < viewportSnapshots.length - 1; i++) {
        const a = viewportSnapshots[i];
        const b = viewportSnapshots[i + 1];
        const changes: string[] = [];

        const widthDiff = b.preset.width - a.preset.width;
        changes.push(`Viewport widened by ${widthDiff}px (${a.preset.name} ${a.preset.width}px -> ${b.preset.name} ${b.preset.width}px).`);

        if (a.domSnapshot.documentHeight !== b.domSnapshot.documentHeight) {
          const heightDiff = b.domSnapshot.documentHeight - a.domSnapshot.documentHeight;
          if (heightDiff < 0) {
            changes.push(`Content height decreased by ${Math.abs(heightDiff)}px due to multi-column expanding.`);
          } else {
            changes.push(`Content height increased by ${heightDiff}px.`);
          }
        }

        if (a.domSnapshot.navDisplay !== b.domSnapshot.navDisplay) {
          changes.push(`Navigation display property shifted from "${a.domSnapshot.navDisplay}" to "${b.domSnapshot.navDisplay}".`);
        }

        layoutTransitions.push({
          from: a.preset.name,
          to: b.preset.name,
          changes,
        });
      }

      // Detect shifting and stacking elements by comparing first and last viewport
      const firstVp = viewports[0];
      const lastVp = viewports[viewports.length - 1];

      await page.setViewportSize({ width: firstVp.width, height: firstVp.height });
      await page.waitForTimeout(200);
      const smallRects = await page.evaluate(() => {
        const selectors = ['header', 'nav', 'main', 'footer', 'h1', 'img', 'button'];
        const res: Record<string, { x: number; y: number; width: number; height: number; visible: boolean }> = {};
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el) {
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            res[s] = {
              x: Math.round(r.x),
              y: Math.round(r.y),
              width: Math.round(r.width),
              height: Math.round(r.height),
              visible: cs.display !== 'none' && cs.visibility !== 'hidden',
            };
          }
        }
        return res;
      });

      await page.setViewportSize({ width: lastVp.width, height: lastVp.height });
      await page.waitForTimeout(200);
      const largeRects = await page.evaluate(() => {
        const selectors = ['header', 'nav', 'main', 'footer', 'h1', 'img', 'button'];
        const res: Record<string, { x: number; y: number; width: number; height: number; visible: boolean }> = {};
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el) {
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            res[s] = {
              x: Math.round(r.x),
              y: Math.round(r.y),
              width: Math.round(r.width),
              height: Math.round(r.height),
              visible: cs.display !== 'none' && cs.visibility !== 'hidden',
            };
          }
        }
        return res;
      });

      for (const sel of Object.keys(smallRects)) {
        const s = smallRects[sel];
        const l = largeRects[sel];
        if (!s || !l) continue;

        if (s.visible && !l.visible) {
          shiftingElements.push({
            selector: sel,
            shiftType: 'hidden',
            details: `Element visible on ${firstVp.name} but hidden on ${lastVp.name}.`,
          });
        } else if (!s.visible && l.visible) {
          shiftingElements.push({
            selector: sel,
            shiftType: 'hidden',
            details: `Element hidden on ${firstVp.name} but becomes visible on ${lastVp.name}.`,
          });
        } else if (s.visible && l.visible) {
          if (Math.abs(s.width - l.width) > 50) {
            shiftingElements.push({
              selector: sel,
              shiftType: 'resized',
              details: `Width resized from ${s.width}px on ${firstVp.name} to ${l.width}px on ${lastVp.name}.`,
            });
          }
          if (s.x < 10 && l.x > 100) {
            shiftingElements.push({
              selector: sel,
              shiftType: 'repositioned',
              details: `Repositioned horizontally from X:${s.x}px to X:${l.x}px.`,
            });
          }
        }
      }

      // Visual pixel diff between first (mobile) and last (desktop) normalized
      let visualDiffResult = null;
      if (runPixelDiff && viewportSnapshots.length >= 2) {
        const shotA = viewportSnapshots[0].screenshotPath;
        const shotB = viewportSnapshots[viewportSnapshots.length - 1].screenshotPath;
        // Only attempt pixel diff if both screenshot files actually exist on disk
        if (shotA && shotB && fs.existsSync(shotA) && fs.existsSync(shotB)) {
          try {
            visualDiffResult = await this.computePixelDiff(
              shotA,
              shotB,
              currentUrl,
              viewportSnapshots[0].preset.width,
              viewportSnapshots[viewportSnapshots.length - 1].preset.width
            );
          } catch (diffErr) {
            logger.warn('Pixel difference computation skipped or encountered an error:', diffErr);
          }
        } else {
          logger.warn('Pixel diff skipped — one or both comparison screenshots were not captured.');
        }
      }

      const summary = `Compared ${viewports.length} viewports from ${firstVp.width}px (${firstVp.name}) to ${lastVp.width}px (${lastVp.name}). Identified ${layoutTransitions.length} layout transitions and ${shiftingElements.length} key structural shifts.`;

      const result: ViewportComparisonResult = {
        url: currentUrl,
        comparedAt: new Date().toISOString(),
        viewports: viewportSnapshots,
        layoutTransitions,
        shiftingElements,
        visualDiff: visualDiffResult,
        analysisSummary: summary,
      };

      const reportPath = fileManager.getReportPath(currentUrl, 'viewport_comparison');
      fileManager.saveJsonReport(reportPath, result);

      return result;
    } finally {
      await page.setViewportSize(originalViewport);
    }
  }

  private async computePixelDiff(
    pathA: string,
    pathB: string,
    url: string,
    widthA: number,
    widthB: number
  ): Promise<{
    diffScreenshotPath: string;
    mismatchedPixels: number;
    mismatchPercentage: number;
    interpretation: string;
  }> {
    const imgA = PNG.sync.read(fs.readFileSync(pathA));
    const imgB = PNG.sync.read(fs.readFileSync(pathB));

    // Determine normalized canvas size
    const width = Math.min(imgA.width, imgB.width);
    const height = Math.min(imgA.height, imgB.height);

    const croppedA = new PNG({ width, height });
    const croppedB = new PNG({ width, height });
    const diffImg = new PNG({ width, height });

    PNG.bitblt(imgA, croppedA, 0, 0, width, height, 0, 0);
    PNG.bitblt(imgB, croppedB, 0, 0, width, height, 0, 0);

    const mismatchedPixels = pixelmatch(croppedA.data, croppedB.data, diffImg.data, width, height, {
      threshold: 0.15,
      includeAA: false,
    });

    const totalPixels = width * height;
    const mismatchPercentage = Math.round((mismatchedPixels / totalPixels) * 10000) / 100;

    const diffPath = fileManager.getComparisonDiffPath(url, widthA, widthB);
    fs.writeFileSync(diffPath, PNG.sync.write(diffImg));

    let interpretation = 'Visual comparison indicates ';
    if (mismatchPercentage > 40) {
      interpretation += `substantial responsive layout restructuring (${mismatchPercentage}% visual difference in overlapping viewport bounds). Content flows and stacks differently across screen widths.`;
    } else if (mismatchPercentage > 15) {
      interpretation += `moderate responsive adaptations (${mismatchPercentage}% visual difference), including typography scaling and grid column restructuring.`;
    } else {
      interpretation += `minimal layout changes (${mismatchPercentage}% visual difference). Elements maintain similar positioning across screen widths.`;
    }

    return {
      diffScreenshotPath: diffPath,
      mismatchedPixels,
      mismatchPercentage,
      interpretation,
    };
  }
}

export const comparisonService = new ComparisonService();
