import { describe, it, expect, afterAll } from 'vitest';
import * as path from 'path';
import { navigationService } from '../src/browser/navigation.js';
import { reportGenerator } from '../src/services/report-generator.js';
import { pageManager } from '../src/browser/page-manager.js';
import { browserManager } from '../src/browser/browser-manager.js';

describe('Layout Audit Service', () => {
  afterAll(async () => {
    await browserManager.close();
  });

  it('should score a clean responsive site high with minimal findings', async () => {
    const cleanFixture = path.resolve(process.cwd(), 'fixtures/responsive-clean.html');
    await navigationService.openPage(cleanFixture);

    const audit = await reportGenerator.auditLayout();
    expect(audit.score).toBeGreaterThanOrEqual(90);
    expect(audit.findingsCount.critical).toBe(0);
  });

  it('should flag severe issues and lower score on a broken layout', async () => {
    const brokenFixture = path.resolve(process.cwd(), 'fixtures/horizontal-overflow.html');
    await navigationService.openPage(brokenFixture);
    await pageManager.setViewport(375, 812);

    const audit = await reportGenerator.auditLayout();
    expect(audit.findingsCount.critical).toBeGreaterThan(0);
    expect(audit.findings.some((f) => f.severity === 'Critical' && f.category === 'Overflow')).toBe(true);
    expect(audit.score).toBeLessThan(80);
  });
});
