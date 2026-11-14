import { pageManager } from '../browser/page-manager.js';
import { OverflowIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class OverflowDetector {
  public async detectOverflow(scopeSelector?: string): Promise<{
    hasHorizontalPageOverflow: boolean;
    pageScrollWidth: number;
    viewportWidth: number;
    overflowAmount: number;
    totalIssuesCount: number;
    issues: OverflowIssue[];
  }> {
    const page = pageManager.getActivePageOrThrow();

    const result = await page.evaluate((scopeSel) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const docScrollWidth = document.documentElement.scrollWidth;
      const docClientWidth = document.documentElement.clientWidth;
      const rootEl = scopeSel ? document.querySelector(scopeSel) : document.body;

      const issues: OverflowIssue[] = [];

      if (!rootEl) {
        return {
          hasHorizontalPageOverflow: false,
          pageScrollWidth: docScrollWidth,
          viewportWidth,
          overflowAmount: 0,
          totalIssuesCount: 0,
          issues: [],
        };
      }

      // Check page-level horizontal overflow
      const pageOverflowAmount = Math.max(0, docScrollWidth - viewportWidth);
      const hasPageHorizontalOverflow = pageOverflowAmount > 2;

      if (hasPageHorizontalOverflow && !scopeSel) {
        issues.push({
          type: 'page-horizontal',
          severity: 'critical',
          selector: 'html',
          tagName: 'html',
          elementWidth: docScrollWidth,
          containerWidth: viewportWidth,
          overflowAmount: pageOverflowAmount,
          viewportWidth,
          explanation: `Document scrollWidth (${docScrollWidth}px) exceeds the viewport width (${viewportWidth}px) by ${pageOverflowAmount}px, causing unwanted horizontal scrolling.`,
          suggestion:
            'Inspect child containers for fixed pixel widths (e.g. width: 1200px), unconstrained images, or missing box-sizing: border-box.',
        });
      }

      // Helper to generate a unique selector
      function getElementSelector(el: Element): string {
        if (el.id) return `#${el.id}`;
        const tag = el.tagName.toLowerCase();
        if (el.classList.length > 0) {
          const firstClass = Array.from(el.classList)[0];
          return `${tag}.${firstClass}`;
        }
        return tag;
      }

      // Traverse all descendant elements
      const elements = Array.from(rootEl.querySelectorAll('*'));

      for (const el of elements) {
        // Skip script, style, meta, svg internals
        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'path', 'defs', 'g'].includes(tag)) {
          continue;
        }

        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Skip non-rendered / hidden elements
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          continue;
        }

        // 1. Elements overflowing viewport boundaries to the right
        if (rect.right > viewportWidth + 2 && rect.width > 0 && rect.height > 0) {
          const overflowRight = Math.round(rect.right - viewportWidth);
          const sel = getElementSelector(el);
          const isSeverityHigh = overflowRight > 20;

          // Don't duplicate if already added
          if (!issues.some((i) => i.selector === sel && i.type === 'element-overflow')) {
            issues.push({
              type: 'element-overflow',
              severity: isSeverityHigh ? 'high' : 'medium',
              selector: sel,
              tagName: tag,
              elementWidth: Math.round(rect.width),
              containerWidth: viewportWidth,
              overflowAmount: overflowRight,
              viewportWidth,
              explanation: `Element extends ${overflowRight}px past the right edge of the viewport (rect.right = ${Math.round(rect.right)}px vs viewport = ${viewportWidth}px).`,
              suggestion: 'Set max-width: 100% or overflow: hidden on parent container, or adjust margins/paddings.',
            });
          }
        }

        // 2. Fixed width hazards
        const inlineWidth = (el as HTMLElement).style.width || '';
        const parsedWidth = parseFloat(style.width);
        if (
          (inlineWidth.includes('px') || (!inlineWidth.includes('%') && !inlineWidth.includes('vw'))) &&
          parsedWidth > viewportWidth + 2 &&
          style.maxWidth === 'none'
        ) {
          const sel = getElementSelector(el);
          if (!issues.some((i) => i.selector === sel && i.type === 'fixed-width-hazard')) {
            issues.push({
              type: 'fixed-width-hazard',
              severity: 'high',
              selector: sel,
              tagName: tag,
              elementWidth: Math.round(parsedWidth),
              containerWidth: viewportWidth,
              overflowAmount: Math.round(parsedWidth - viewportWidth),
              viewportWidth,
              explanation: `Element has fixed width ${Math.round(parsedWidth)}px without a responsive max-width, forcing horizontal overflow on ${viewportWidth}px screens.`,
              suggestion: 'Replace fixed pixel width with max-width: 100% or use responsive media queries / clamp().',
            });
          }
        }

        // 3. Media overflow (images, videos, iframes)
        if (['img', 'video', 'iframe', 'canvas', 'svg'].includes(tag)) {
          const mediaEl = el as HTMLImageElement;
          const naturalW = mediaEl.naturalWidth || rect.width;
          const parent = el.parentElement;
          const parentWidth = parent ? parent.getBoundingClientRect().width : viewportWidth;

          if (rect.width > parentWidth + 2 || (naturalW > parentWidth && style.maxWidth === 'none' && rect.width > parentWidth)) {
            const sel = getElementSelector(el);
            const overflowAmt = Math.round(rect.width - parentWidth);
            if (!issues.some((i) => i.selector === sel && i.type === 'media-overflow')) {
              issues.push({
                type: 'media-overflow',
                severity: overflowAmt > 30 ? 'high' : 'medium',
                selector: sel,
                tagName: tag,
                elementWidth: Math.round(rect.width),
                containerWidth: Math.round(parentWidth),
                overflowAmount: Math.max(0, overflowAmt),
                viewportWidth,
                explanation: `Media element (${tag}) width (${Math.round(rect.width)}px) exceeds parent container width (${Math.round(parentWidth)}px).`,
                suggestion: 'Add max-width: 100%; height: auto; display: block; to ensure fluid responsive media sizing.',
              });
            }
          }
        }

        // 4. Text clipping (fixed or max height with overflow hidden clipping text content)
        if (
          el.scrollHeight > el.clientHeight + 4 &&
          (style.overflowY === 'hidden' || style.overflow === 'hidden') &&
          el.clientHeight > 0 &&
          ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'article', 'li', 'div', 'section'].includes(tag)
        ) {
          // Verify it has text content
          const text = (el.textContent || '').trim();
          const hasConstrainedHeight = style.maxHeight !== 'none' || (style.height !== 'auto' && parseFloat(style.height) > 0);
          if (text.length > 20 && hasConstrainedHeight) {
            const sel = getElementSelector(el);
            const clippedPx = el.scrollHeight - el.clientHeight;
            if (!issues.some((i) => i.selector === sel && i.type === 'text-clipping')) {
              issues.push({
                type: 'text-clipping',
                severity: clippedPx > 20 ? 'high' : 'medium',
                selector: sel,
                tagName: tag,
                elementWidth: Math.round(rect.width),
                containerWidth: Math.round(rect.width),
                overflowAmount: clippedPx,
                viewportWidth,
                explanation: `Text content inside element is vertically clipped by ${clippedPx}px due to a constrained height (${Math.round(el.clientHeight)}px vs scrollHeight ${Math.round(el.scrollHeight)}px) with overflow: hidden.`,
                suggestion:
                  'Use min-height instead of fixed height or avoid combining fixed heights with overflow:hidden on text containers.',
              });
            }
          }
        }
      }

      return {
        hasHorizontalPageOverflow: hasPageHorizontalOverflow,
        pageScrollWidth: docScrollWidth,
        viewportWidth,
        overflowAmount: pageOverflowAmount,
        totalIssuesCount: issues.length,
        issues: issues.slice(0, 30),
      };
    }, scopeSelector);

    logger.debug(`Overflow detection complete: found ${result.totalIssuesCount} issues.`);
    return result;
  }
}

export const overflowDetector = new OverflowDetector();
