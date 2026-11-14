import { describe, it, expect, afterAll } from 'vitest';
import * as path from 'path';
import { navigationService } from '../src/browser/navigation.js';
import { overflowDetector } from '../src/services/overflow-detector.js';
import { responsiveAnalyzer } from '../src/services/responsive-analyzer.js';
import { browserManager } from '../src/browser/browser-manager.js';
import { pageManager } from '../src/browser/page-manager.js';

describe('Responsive Testing & Overflow Detection', () => {
  afterAll(async () => {
    await browserManager.close();
  });

  it('should pass cleanly on a properly responsive site', async () => {
    const fixture = path.resolve(process.cwd(), 'fixtures/responsive-clean.html');
    await navigationService.openPage(fixture);

    const result = await responsiveAnalyzer.testResponsiveness(undefined, [
      { name: 'Mobile', category: 'Mobile', width: 375, height: 812 },
      { name: 'Desktop', category: 'Desktop', width: 1440, height: 900 },
    ]);

    expect(result.overallStatus).toBe('PASS');
    expect(result.criticalIssuesCount).toBe(0);
    expect(result.viewportReports.every((r) => !r.hasHorizontalOverflow)).toBe(true);
  });

  it('should detect horizontal page overflow and fixed-width hazards', async () => {
    const fixture = path.resolve(process.cwd(), 'fixtures/horizontal-overflow.html');
    await navigationService.openPage(fixture);
    await pageManager.setViewport(375, 812);

    const overflowResult = await overflowDetector.detectOverflow();
    expect(overflowResult.hasHorizontalPageOverflow).toBe(true);
    expect(overflowResult.pageScrollWidth).toBeGreaterThan(1000);
    expect(overflowResult.issues.some((i) => i.type === 'page-horizontal' || i.type === 'fixed-width-hazard')).toBe(true);
  });

  it('should detect oversized unconstrained media', async () => {
    const fixture = path.resolve(process.cwd(), 'fixtures/oversized-image.html');
    await navigationService.openPage(fixture);
    await pageManager.setViewport(375, 812);

    const overflowResult = await overflowDetector.detectOverflow();
    expect(overflowResult.hasHorizontalPageOverflow).toBe(true);
    expect(overflowResult.issues.some((i) => i.type === 'element-overflow' || i.type === 'fixed-width-hazard')).toBe(true);
  });

  it('should detect text clipping on fixed height containers', async () => {
    const fixture = path.resolve(process.cwd(), 'fixtures/text-clipping.html');
    await navigationService.openPage(fixture);

    const overflowResult = await overflowDetector.detectOverflow();
    expect(overflowResult.issues.some((i) => i.type === 'text-clipping')).toBe(true);
  });

  it('should detect broken mobile navigation that overflows screen', async () => {
    const fixture = path.resolve(process.cwd(), 'fixtures/broken-mobile-nav.html');
    await navigationService.openPage(fixture);

    const suite = await responsiveAnalyzer.testResponsiveness(undefined, [
      { name: 'Mobile', category: 'Mobile', width: 375, height: 812 },
    ]);

    const mobileReport = suite.viewportReports[0];
    expect(mobileReport.hasHorizontalOverflow).toBe(true);
    expect(mobileReport.grade).toBe('FAIL');
  });

  it('should detect overlapping elements in responsive audit', async () => {
    const fixture = path.resolve(process.cwd(), 'fixtures/overlapping-elements.html');
    await navigationService.openPage(fixture);

    const suite = await responsiveAnalyzer.testResponsiveness(undefined, [
      { name: 'Mobile', category: 'Mobile', width: 375, height: 812 },
    ]);

    const mobileReport = suite.viewportReports[0];
    expect(mobileReport.layoutAssessments.overlappingElementPairs.length).toBeGreaterThan(0);
    expect(mobileReport.layoutAssessments.overlappingElementPairs[0].explanation).toContain('overlap');
  });
});
