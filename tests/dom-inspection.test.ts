import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import { navigationService } from '../src/browser/navigation.js';
import { domInspector } from '../src/services/dom-inspector.js';
import { cssInspector } from '../src/services/css-inspector.js';
import { browserManager } from '../src/browser/browser-manager.js';

describe('DOM & CSS Inspection Services', () => {
  const cleanFixture = path.resolve(process.cwd(), 'fixtures/responsive-clean.html');

  beforeAll(async () => {
    await navigationService.openPage(cleanFixture);
  });

  afterAll(async () => {
    await browserManager.close();
  });

  it('should inspect page overview, landmarks, headings and links', async () => {
    const summary = await domInspector.inspectPage();

    expect(summary.title).toBe('Clean Responsive Showcase');
    expect(summary.totalDomElements).toBeGreaterThan(5);
    expect(summary.landmarks.length).toBeGreaterThan(0);
    expect(summary.headings.length).toBeGreaterThan(0);
    expect(summary.headings[0].text).toContain('Fluid Responsive Design');
    expect(summary.buttons.total).toBeGreaterThanOrEqual(1);
    expect(summary.headingHierarchyValid).toBe(true);
  });

  it('should inspect element details by selector', async () => {
    const el = await domInspector.inspectElement('header .logo');

    expect(el.tagName).toBe('div');
    expect(el.textContent).toBe('CleanFlow');
    expect(el.boundingBox).not.toBeNull();
    expect(el.visibility.isVisible).toBe(true);
    expect(el.parent?.tagName).toBe('header');
  });

  it('should inspect computed CSS properties and box model', async () => {
    const styles = await cssInspector.inspectStyles('header');

    expect(styles.tagName).toBe('header');
    expect(styles.layoutModel).toBe('flex');
    expect(styles.styles.display).toBe('flex');
    expect(styles.boxModel.width).toBeGreaterThan(0);
    expect(styles.boxModel.padding).toBeDefined();
  });

  it('should inspect page structure hierarchy', async () => {
    const structure = await domInspector.inspectPageStructure('body', 3, true);

    expect(structure.tag).toBe('body');
    expect(structure.children).toBeDefined();
    expect(structure.children?.some((c) => c.tag === 'header')).toBe(true);
    expect(structure.children?.some((c) => c.tag === 'main')).toBe(true);
  });
});
