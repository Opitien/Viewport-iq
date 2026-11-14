import { pageManager } from '../browser/page-manager.js';
import { fileManager } from '../utils/file-manager.js';
import { LayoutAuditReport, LayoutAuditFinding } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ReportGenerator {
  public async auditLayout(scopeSelector?: string): Promise<LayoutAuditReport> {
    const page = pageManager.getActivePageOrThrow();
    const url = page.url();
    const viewport = page.viewportSize() || { width: 1280, height: 800 };

    logger.info(`Running layout audit for ${url} at ${viewport.width}x${viewport.height}...`);

    const findings = await page.evaluate(
      ({ scopeSelector, viewportWidth, viewportHeight }) => {
        const root = scopeSelector ? document.querySelector(scopeSelector) : document.body;
        const results: LayoutAuditFinding[] = [];

        if (!root) return results;

        let findingIdCounter = 1;
        const addFinding = (
          severity: LayoutAuditFinding['severity'],
          category: LayoutAuditFinding['category'],
          elementSelector: string,
          tagName: string,
          title: string,
          description: string,
          evidence: Record<string, any>,
          recommendation: string
        ) => {
          results.push({
            id: `FIND-${String(findingIdCounter++).padStart(3, '0')}`,
            severity,
            category,
            elementSelector,
            tagName,
            title,
            description,
            evidence,
            recommendation,
          });
        };

        const getSel = (el: Element): string => {
          if (el.id) return `#${el.id}`;
          const tag = el.tagName.toLowerCase();
          if (el.classList.length > 0) return `${tag}.${Array.from(el.classList)[0]}`;
          return tag;
        };

        // 1. Page horizontal overflow
        const docScrollWidth = document.documentElement.scrollWidth;
        if (docScrollWidth > viewportWidth + 2) {
          addFinding(
            'Critical',
            'Overflow',
            'html',
            'html',
            'Horizontal Page Overflow Detected',
            `Document width (${docScrollWidth}px) exceeds the current viewport width (${viewportWidth}px) by ${docScrollWidth - viewportWidth}px.`,
            { scrollWidth: docScrollWidth, viewportWidth, delta: docScrollWidth - viewportWidth },
            'Audit child elements for fixed widths exceeding 100% or unconstrained images.'
          );
        }

        // 2. Element-level audits
        const candidates = Array.from(root.querySelectorAll('*')).filter((el) => {
          const tag = el.tagName.toLowerCase();
          return !['script', 'style', 'noscript', 'defs', 'clipPath'].includes(tag);
        });

        for (const el of candidates) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;

          const rect = el.getBoundingClientRect();
          const tag = el.tagName.toLowerCase();
          const sel = getSel(el);

          // Fixed widths hazard
          const inlineW = (el as HTMLElement).style.width || '';
          const computedW = parseFloat(style.width);
          if (
            (inlineW.includes('px') || (!inlineW.includes('%') && !inlineW.includes('vw'))) &&
            computedW > viewportWidth &&
            style.maxWidth === 'none'
          ) {
            addFinding(
              'High',
              'Fixed Sizing',
              sel,
              tag,
              'Rigid Fixed Pixel Width Exceeds Viewport',
              `Element specifies rigid width of ${Math.round(computedW)}px exceeding viewport (${viewportWidth}px).`,
              { computedWidth: computedW, viewportWidth, maxWidth: style.maxWidth },
              'Replace fixed width with max-width: 100% or fluid percentage/grid units.'
            );
          }

          // Text clipping
          if (
            el.scrollHeight > el.clientHeight + 4 &&
            (style.overflowY === 'hidden' || style.overflow === 'hidden') &&
            el.clientHeight > 0
          ) {
            const txt = (el.textContent || '').trim();
            if (txt.length > 25) {
              addFinding(
                'Medium',
                'Clipping',
                sel,
                tag,
                'Text Content Clipped by Fixed Height Container',
                `Element content height (${el.scrollHeight}px) is cut off by container height (${el.clientHeight}px) due to overflow: hidden.`,
                { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflow: style.overflow },
                'Use min-height rather than fixed height, or allow text to wrap naturally without overflow: hidden.'
              );
            }
          }

          // Oversized images
          if (tag === 'img') {
            const imgEl = el as HTMLImageElement;
            const parent = el.parentElement;
            const parentW = parent ? parent.getBoundingClientRect().width : viewportWidth;

            if (rect.width > parentW + 4 || (imgEl.naturalWidth > parentW && style.maxWidth === 'none' && rect.width > parentW)) {
              addFinding(
                'High',
                'Overflow',
                sel,
                tag,
                'Unconstrained Image Bleeding Outside Container',
                `Image rendered width (${Math.round(rect.width)}px) exceeds parent container (${Math.round(parentW)}px).`,
                { renderedWidth: Math.round(rect.width), parentWidth: Math.round(parentW), naturalWidth: imgEl.naturalWidth },
                'Apply max-width: 100%; height: auto; to responsive images.'
              );
            }
          }

          // Fixed position covering content
          if (style.position === 'fixed' && rect.height > 60) {
            const nextEl = document.elementFromPoint(rect.left + 20, rect.bottom + 10);
            if (nextEl) {
              const nextStyle = window.getComputedStyle(nextEl);
              if (nextStyle.marginTop === '0px' && nextStyle.paddingTop === '0px' && rect.top === 0) {
                addFinding(
                  'Low',
                  'Positioning',
                  sel,
                  tag,
                  'Fixed Header Without Sibling Top Padding',
                  'Fixed header element sits at the top of the viewport; verify that the page body or main content has adequate padding-top to prevent obscured text.',
                  { headerHeight: Math.round(rect.height) },
                  'Add padding-top equal to header height on body or main content.'
                );
              }
            }
          }
        }

        // 3. Detect overlapping interactive and floating elements
        const interactiveEls = Array.from(
          document.querySelectorAll('button, a[href], input, .hero-badge, .cta, .floating-badge, [class*="badge"], [class*="cta"]')
        ).slice(0, 40);
        for (let i = 0; i < interactiveEls.length; i++) {
          for (let j = i + 1; j < interactiveEls.length; j++) {
            const a = interactiveEls[i];
            const b = interactiveEls[j];
            if (a.contains(b) || b.contains(a)) continue;

            const rA = a.getBoundingClientRect();
            const rB = b.getBoundingClientRect();

            if (rA.width === 0 || rA.height === 0 || rB.width === 0 || rB.height === 0) continue;

            const overlapW = Math.max(0, Math.min(rA.right, rB.right) - Math.max(rA.left, rB.left));
            const overlapH = Math.max(0, Math.min(rA.bottom, rB.bottom) - Math.max(rA.top, rB.top));
            const overlapArea = overlapW * overlapH;

            if (overlapArea > 200) {
              addFinding(
                'High',
                'Overlap',
                getSel(a),
                a.tagName.toLowerCase(),
                'Interactive Elements Colliding / Overlapping',
                `Element visually collides with ${getSel(b)} (overlapping area: ${Math.round(overlapArea)}px).`,
                { elementA: getSel(a), elementB: getSel(b), overlapAreaPx: Math.round(overlapArea) },
                'Inspect relative and absolute positioning or flex-wrap to prevent collision.'
              );
            }
          }
        }

        return results;
      },
      { scopeSelector, viewportWidth: viewport.width, viewportHeight: viewport.height }
    );

    // Compute score: starts at 100, drops for findings
    let score = 100;
    const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };

    for (const f of findings) {
      if (f.severity === 'Critical') {
        counts.critical++;
        score -= 25;
      } else if (f.severity === 'High') {
        counts.high++;
        score -= 15;
      } else if (f.severity === 'Medium') {
        counts.medium++;
        score -= 8;
      } else if (f.severity === 'Low') {
        counts.low++;
        score -= 3;
      } else {
        counts.informational++;
      }
    }
    score = Math.max(0, Math.min(100, score));

    const report: LayoutAuditReport = {
      url,
      viewport,
      timestamp: new Date().toISOString(),
      score,
      findingsCount: counts,
      findings,
    };

    const reportPath = fileManager.getReportPath(url, 'layout_audit');
    fileManager.saveJsonReport(reportPath, report);

    return report;
  }
}

export const reportGenerator = new ReportGenerator();
