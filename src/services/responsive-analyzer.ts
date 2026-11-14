import { pageManager } from '../browser/page-manager.js';
import { overflowDetector } from './overflow-detector.js';
import { fileManager } from '../utils/file-manager.js';
import { ElementNotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  ViewportPreset,
  DEFAULT_VIEWPORTS,
  ResponsiveViewportReport,
  ResponsiveTestSuiteResult,
  BreakpointObservation,
} from '../types/index.js';

export class ResponsiveAnalyzer {
  public async testResponsiveness(
    url?: string,
    customViewports?: ViewportPreset[],
    captureScreenshots: boolean = true,
    settleTimeMs: number = 400
  ): Promise<ResponsiveTestSuiteResult> {
    const page = pageManager.getActivePageOrThrow();
    const currentUrl = url || page.url();
    const viewports = customViewports && customViewports.length > 0 ? customViewports : DEFAULT_VIEWPORTS;

    logger.info(`Starting comprehensive responsive testing for ${currentUrl} across ${viewports.length} viewports...`);

    const originalViewport = page.viewportSize() || { width: 1280, height: 800 };
    const viewportReports: ResponsiveViewportReport[] = [];
    let criticalIssuesTotal = 0;

    try {
      for (const vp of viewports) {
        logger.info(`Testing viewport: ${vp.name} (${vp.width}x${vp.height})...`);
        await page.setViewportSize({ width: vp.width, height: vp.height });

        if (settleTimeMs > 0) {
          await page.waitForTimeout(settleTimeMs);
        }

        // 1. Detect overflow issues
        const overflowAnalysis = await overflowDetector.detectOverflow();
        const docDimensions = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
        }));

        const overflowDelta = Math.max(0, docDimensions.scrollWidth - vp.width);
        const hasHorizontalOverflow = overflowDelta > 2;

        // 2. Detect clipped elements and overlapping pairs
        const detailedAssessments = await page.evaluate((vpWidth) => {
          // Clipped elements
          const clipped: any[] = [];
          const allEls = Array.from(document.querySelectorAll('header, nav, main, section, article, div, p, h1, h2, ul, form'));

          for (const el of allEls) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;

            const isHorizontallyClipped = el.scrollWidth > el.clientWidth + 2 && (style.overflowX === 'hidden' || style.overflow === 'hidden');
            const isVerticallyClipped = el.scrollHeight > el.clientHeight + 4 && (style.overflowY === 'hidden' || style.overflow === 'hidden');

            if ((isHorizontallyClipped || isVerticallyClipped) && el.clientHeight > 0 && el.clientWidth > 0) {
              const tag = el.tagName.toLowerCase();
              const sel = el.id ? `#${el.id}` : el.className ? `${tag}.${Array.from(el.classList)[0]}` : tag;
              clipped.push({
                selector: sel,
                tagName: tag,
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                reason: isHorizontallyClipped ? 'Horizontal content overflow clipped' : 'Vertical text content clipped',
              });
              if (clipped.length >= 10) break;
            }
          }

          // Navigation behavior assessment
          const navEl = document.querySelector('nav') || document.querySelector('[role="navigation"]');
          let navigationType = 'none';
          let navigationFunctional = true;

          if (navEl) {
            const navStyle = window.getComputedStyle(navEl);
            const navRect = navEl.getBoundingClientRect();
            const hamburgerBtn = document.querySelector(
              'button[aria-label*="menu" i], button[aria-label*="navigation" i], .hamburger, .menu-toggle, [aria-expanded]'
            );

            if (navStyle.display === 'none' && hamburgerBtn) {
              navigationType = 'collapsed-hamburger';
            } else if (hamburgerBtn && window.getComputedStyle(hamburgerBtn).display !== 'none') {
              navigationType = 'hamburger-toggle';
            } else if (navRect.height > 120 && vpWidth <= 480) {
              navigationType = 'stacked-links';
            } else if (navStyle.display === 'flex' || navStyle.display === 'block') {
              navigationType = 'horizontal-bar';
            }

            // Check if nav itself overflows viewport
            if (navRect.right > vpWidth + 5) {
              navigationFunctional = false;
            }
          }

          // Overlapping interactive and floating elements
          const overlappingPairs: any[] = [];
          const selectorPattern = 'button, a[href], input, .badge, .floating-badge, .floating-banner, [class*="badge"], [class*="button"], [class*="cta"], [class*="floating"]';
          const interactives = Array.from(document.querySelectorAll(selectorPattern)).slice(0, 40);

          for (let i = 0; i < interactives.length; i++) {
            for (let j = i + 1; j < interactives.length; j++) {
              const a = interactives[i];
              const b = interactives[j];
              // Skip ancestor/descendant relationships
              if (a.contains(b) || b.contains(a)) continue;

              const rectA = a.getBoundingClientRect();
              const rectB = b.getBoundingClientRect();

              if (rectA.width === 0 || rectA.height === 0 || rectB.width === 0 || rectB.height === 0) continue;

              const overlapX = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
              const overlapY = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
              const overlapArea = overlapX * overlapY;

              if (overlapArea > 250) {
                const selA = a.id ? `#${a.id}` : a.className ? `${a.tagName.toLowerCase()}.${Array.from(a.classList)[0]}` : a.tagName.toLowerCase();
                const selB = b.id ? `#${b.id}` : b.className ? `${b.tagName.toLowerCase()}.${Array.from(b.classList)[0]}` : b.tagName.toLowerCase();

                overlappingPairs.push({
                  selectorA: selA,
                  selectorB: selB,
                  overlapAreaPx: Math.round(overlapArea),
                  explanation: `Elements visually overlap by ${Math.round(overlapArea)}px, which may obstruct interaction.`,
                });
                if (overlappingPairs.length >= 5) break;
              }
            }
            if (overlappingPairs.length >= 5) break;
          }

          return {
            clipped,
            navigationType,
            navigationFunctional,
            overlappingPairs,
          };
        }, vp.width);

        // 3. Screenshot — inject font-display:swap before each capture to prevent font-loading hangs
        let screenshotPath = '';
        if (captureScreenshots) {
          try {
            await page.evaluate(() => {
              if (!document.querySelector('#viewportiq-font-swap')) {
                const s = document.createElement('style');
                s.id = 'viewportiq-font-swap';
                s.textContent = '* { font-display: swap !important; }';
                document.head.appendChild(s);
              }
            });
            screenshotPath = fileManager.getResponsiveScreenshotPath(currentUrl, vp.name, vp.width, vp.height);
            await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 8000, animations: 'disabled' });
          } catch (shotErr) {
            logger.warn(`Screenshot for ${vp.name} timed out or failed — continuing without screenshot.`);
            screenshotPath = '';
          }
        }

        // Determine grade
        let grade: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
        const failConditions =
          hasHorizontalOverflow ||
          !detailedAssessments.navigationFunctional ||
          detailedAssessments.overlappingPairs.length > 0 ||
          overflowAnalysis.issues.some((i) => i.severity === 'critical');

        const warnConditions =
          detailedAssessments.clipped.length > 0 ||
          overflowAnalysis.issues.some((i) => i.severity === 'high');

        if (failConditions) {
          grade = 'FAIL';
          criticalIssuesTotal++;
        } else if (warnConditions) {
          grade = 'WARNING';
        }

        let summary = `At ${vp.name} (${vp.width}x${vp.height}): `;
        if (grade === 'PASS') {
          summary += 'Layout is clean and stable. No horizontal overflow detected.';
        } else if (grade === 'FAIL') {
          summary += `Layout broken with ${hasHorizontalOverflow ? `${overflowDelta}px horizontal overflow` : ''} ${
            detailedAssessments.overlappingPairs.length > 0 ? `${detailedAssessments.overlappingPairs.length} overlapping elements` : ''
          }.`;
        } else {
          summary += `Minor layout warnings: ${detailedAssessments.clipped.length} clipped elements detected.`;
        }

        viewportReports.push({
          viewport: vp,
          screenshotPath,
          hasHorizontalOverflow,
          scrollWidth: docDimensions.scrollWidth,
          viewportWidth: vp.width,
          overflowDelta,
          overflowIssues: overflowAnalysis.issues,
          clippedElements: detailedAssessments.clipped,
          layoutAssessments: {
            navigationType: detailedAssessments.navigationType,
            navigationFunctional: detailedAssessments.navigationFunctional,
            overlappingElementPairs: detailedAssessments.overlappingPairs,
          },
          summary,
          grade,
        });
      }

      // Generate global recommendations
      const recommendations: string[] = [];
      const failingReports = viewportReports.filter((r) => r.grade === 'FAIL');

      if (failingReports.length > 0) {
        recommendations.push(
          `Fix horizontal page overflow across ${failingReports.map((r) => r.viewport.name).join(', ')}. Use max-width: 100% and box-sizing: border-box.`
        );
      }

      const anyOverlaps = viewportReports.some((r) => r.layoutAssessments.overlappingElementPairs.length > 0);
      if (anyOverlaps) {
        recommendations.push('Review z-index stacking and position: absolute offsets to prevent element collisions at narrower screen widths.');
      }

      const anyNavFail = viewportReports.some((r) => !r.layoutAssessments.navigationFunctional);
      if (anyNavFail) {
        recommendations.push('Implement a responsive navigation drawer or hamburger menu for mobile viewports (<= 768px).');
      }

      if (recommendations.length === 0) {
        recommendations.push('Website demonstrates solid responsiveness across all tested viewports.');
      }

      const overallStatus = criticalIssuesTotal > 0 ? 'FAIL' : viewportReports.some((r) => r.grade === 'WARNING') ? 'WARNING' : 'PASS';

      const result: ResponsiveTestSuiteResult = {
        url: currentUrl,
        testedAt: new Date().toISOString(),
        viewportsTested: viewports.length,
        overallStatus,
        viewportReports,
        criticalIssuesCount: criticalIssuesTotal,
        recommendations,
      };

      const reportPath = fileManager.getReportPath(currentUrl, 'responsive_suite');
      fileManager.saveJsonReport(reportPath, result);

      return result;
    } finally {
      await page.setViewportSize(originalViewport);
    }
  }

  public async inspectBreakpoints(
    keyWidths: number[] = [320, 480, 640, 768, 1024, 1280, 1440, 1920],
    inspectCssMediaQueries: boolean = true
  ): Promise<{
    url: string;
    testedWidths: number[];
    observedTransitions: BreakpointObservation[];
    declaredCssMediaQueries: string[];
    summary: string;
  }> {
    const page = pageManager.getActivePageOrThrow();
    const url = page.url();
    const originalViewport = page.viewportSize() || { width: 1280, height: 800 };

    logger.info(`Inspecting layout breakpoints across ${keyWidths.length} widths for ${url}...`);

    const observations: BreakpointObservation[] = [];
    let previousState: any = null;

    try {
      for (const width of keyWidths) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(200);

        const currentObservation = await page.evaluate((w) => {
          const navEl = document.querySelector('nav');
          let navigationState: any = 'unknown';
          if (navEl) {
            const cs = window.getComputedStyle(navEl);
            if (cs.display === 'none') {
              navigationState = 'hidden';
            } else if (cs.flexDirection === 'column' || cs.display === 'block') {
              navigationState = 'stacked';
            } else {
              navigationState = 'desktop-horizontal';
            }
          }

          const hamburger = document.querySelector('button[aria-label*="menu" i], .hamburger, .menu-toggle');
          if (hamburger && window.getComputedStyle(hamburger).display !== 'none') {
            navigationState = 'hamburger-mobile';
          }

          // Detect column count in main grid / flex container
          let columnCountEstimate = 1;
          const container = document.querySelector('.grid, .row, main, section');
          if (container) {
            const cs = window.getComputedStyle(container);
            if (cs.gridTemplateColumns && cs.gridTemplateColumns.includes('px')) {
              columnCountEstimate = cs.gridTemplateColumns.split(' ').length;
            }
          }

          // Sample landmark visibility
          const sampleSelectors = ['header', 'nav', 'main', 'aside', 'footer', '.sidebar', '.banner', '.hero'];
          const visibleElements: string[] = [];
          const hiddenElements: string[] = [];

          for (const s of sampleSelectors) {
            const el = document.querySelector(s);
            if (el) {
              const cs = window.getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden') {
                hiddenElements.push(s);
              } else {
                visibleElements.push(s);
              }
            }
          }

          return {
            viewportWidth: w,
            navigationState,
            columnCountEstimate,
            visibleElements,
            hiddenElements,
          };
        }, width);

        const changes: string[] = [];
        if (previousState) {
          if (previousState.navigationState !== currentObservation.navigationState) {
            changes.push(`Navigation transformed from "${previousState.navigationState}" to "${currentObservation.navigationState}".`);
          }
          if (previousState.columnCountEstimate !== currentObservation.columnCountEstimate) {
            changes.push(`Grid column count shifted from ${previousState.columnCountEstimate} to ${currentObservation.columnCountEstimate}.`);
          }
          const newlyHidden = currentObservation.hiddenElements.filter((e: string) => !previousState.hiddenElements.includes(e));
          if (newlyHidden.length > 0) {
            changes.push(`Elements hidden at ${width}px: ${newlyHidden.join(', ')}`);
          }
          const newlyVisible = currentObservation.visibleElements.filter((e: string) => !previousState.visibleElements.includes(e));
          if (newlyVisible.length > 0) {
            changes.push(`Elements revealed at ${width}px: ${newlyVisible.join(', ')}`);
          }
        }

        observations.push({
          viewportWidth: width,
          viewportName: `${width}px`,
          navigationState: currentObservation.navigationState,
          columnCountEstimate: currentObservation.columnCountEstimate,
          hiddenElements: currentObservation.hiddenElements,
          visibleElements: currentObservation.visibleElements,
          observedChanges: changes,
        });

        previousState = currentObservation;
      }

      // Inspect CSS @media rules from document.styleSheets
      let declaredMediaQueries: string[] = [];
      if (inspectCssMediaQueries) {
        declaredMediaQueries = await page.evaluate(() => {
          const queries = new Set<string>();
          try {
            for (let i = 0; i < document.styleSheets.length; i++) {
              const sheet = document.styleSheets[i];
              try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) continue;
                for (let j = 0; j < rules.length; j++) {
                  const rule = rules[j];
                  if (rule instanceof CSSMediaRule && rule.conditionText) {
                    queries.add(rule.conditionText);
                  }
                }
              } catch {
                // Cross-origin stylesheet access restriction
              }
            }
          } catch {
            // General error
          }
          return Array.from(queries);
        });
      }

      const summary = `Probed ${keyWidths.length} viewport widths (${keyWidths[0]}px to ${keyWidths[keyWidths.length - 1]}px). Observed ${
        observations.filter((o) => o.observedChanges.length > 0).length
      } layout change points. Discovered ${declaredMediaQueries.length} declared CSS media queries in accessible stylesheets.`;

      return {
        url,
        testedWidths: keyWidths,
        observedTransitions: observations,
        declaredCssMediaQueries: declaredMediaQueries,
        summary,
      };
    } finally {
      await page.setViewportSize(originalViewport);
    }
  }

  public async inspectElementResponsiveness(
    selector: string,
    customViewports?: ViewportPreset[]
  ): Promise<{
    selector: string;
    url: string;
    viewportsTested: number;
    timeline: Array<{
      viewport: ViewportPreset;
      boundingBox: { width: number; height: number; x: number; y: number } | null;
      computedStyles: {
        display: string;
        position: string;
        fontSize: string;
        width: string;
        height: string;
        margin: string;
        padding: string;
        overflow: string;
      };
      isVisible: boolean;
      isOverflowingParent: boolean;
    }>;
    summary: string;
  }> {
    const page = pageManager.getActivePageOrThrow();

    const exists = await page.$(selector);
    if (!exists) {
      throw new ElementNotFoundError(selector);
    }

    const viewports = customViewports || [
      { name: 'Small mobile', category: 'Small mobile', width: 320, height: 720 },
      { name: 'Mobile', category: 'Mobile', width: 375, height: 812 },
      { name: 'Tablet', category: 'Tablet', width: 768, height: 1024 },
      { name: 'Small laptop', category: 'Small laptop', width: 1024, height: 768 },
      { name: 'Desktop', category: 'Desktop', width: 1440, height: 900 },
    ];

    const originalViewport = page.viewportSize() || { width: 1280, height: 800 };
    const timeline: any[] = [];

    try {
      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(200);

        const data = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;

          const rect = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          const isVisible = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;

          const parent = el.parentElement;
          const parentWidth = parent ? parent.getBoundingClientRect().width : window.innerWidth;
          const isOverflowingParent = rect.width > parentWidth + 2;

          return {
            boundingBox: {
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              x: Math.round(rect.x),
              y: Math.round(rect.y),
            },
            computedStyles: {
              display: cs.display,
              position: cs.position,
              fontSize: cs.fontSize,
              width: cs.width,
              height: cs.height,
              margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
              padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
              overflow: cs.overflow,
            },
            isVisible,
            isOverflowingParent,
          };
        }, selector);

        if (data) {
          timeline.push({
            viewport: vp,
            ...data,
          });
        }
      }

      const firstEntry = timeline[0];
      const lastEntry = timeline[timeline.length - 1];

      let summary = `Element "${selector}" tracked across ${timeline.length} viewports. `;
      if (firstEntry && lastEntry) {
        summary += `Width scales from ${firstEntry.boundingBox?.width}px (${firstEntry.viewport.name}) to ${lastEntry.boundingBox?.width}px (${lastEntry.viewport.name}). `;
        if (timeline.some((t) => t.isOverflowingParent)) {
          summary += 'WARNING: Element overflows its parent container at some screen sizes.';
        } else {
          summary += 'Element remains contained within its parent layout across all tested viewports.';
        }
      }

      return {
        selector,
        url: page.url(),
        viewportsTested: timeline.length,
        timeline,
        summary,
      };
    } finally {
      await page.setViewportSize(originalViewport);
    }
  }
}

export const responsiveAnalyzer = new ResponsiveAnalyzer();
