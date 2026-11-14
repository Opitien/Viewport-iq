import { pageManager } from '../browser/page-manager.js';
import { ElementNotFoundError } from '../utils/errors.js';

export class CssInspector {
  private static readonly DEFAULT_PROPERTIES = [
    'display',
    'position',
    'box-sizing',
    'width',
    'height',
    'min-width',
    'max-width',
    'min-height',
    'max-height',
    'margin',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'padding',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'flex-direction',
    'flex-wrap',
    'flex-grow',
    'flex-shrink',
    'flex-basis',
    'justify-content',
    'align-items',
    'align-content',
    'grid-template-columns',
    'grid-template-rows',
    'gap',
    'font-size',
    'font-weight',
    'line-height',
    'overflow',
    'overflow-x',
    'overflow-y',
    'z-index',
    'visibility',
    'opacity',
    'background-color',
    'color',
  ];

  public async inspectStyles(
    selector: string,
    properties?: string[]
  ): Promise<{
    selector: string;
    tagName: string;
    styles: Record<string, string>;
    layoutModel: 'flex' | 'grid' | 'block' | 'inline-block' | 'inline' | 'none' | 'table' | 'other';
    positioning: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
    boxModel: {
      width: number;
      height: number;
      padding: { top: number; right: number; bottom: number; left: number };
      margin: { top: number; right: number; bottom: number; left: number };
      border: { top: number; right: number; bottom: number; left: number };
    };
  }> {
    const page = pageManager.getActivePageOrThrow();

    const exists = await page.$(selector);
    if (!exists) {
      throw new ElementNotFoundError(selector);
    }

    const propsToInspect = properties && properties.length > 0 ? properties : CssInspector.DEFAULT_PROPERTIES;

    const data = await page.evaluate(
      ({ selector, propsToInspect }) => {
        const el = document.querySelector(selector);
        if (!el) return null;

        const computed = window.getComputedStyle(el);
        const styles: Record<string, string> = {};

        for (const prop of propsToInspect) {
          // Normalize camelCase or kebab-case
          const kebab = prop.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
          const val = computed.getPropertyValue(kebab);
          styles[prop] = val || computed[prop as any] || '';
        }

        const display = computed.display;
        let layoutModel: any = 'other';
        if (display.includes('flex')) layoutModel = 'flex';
        else if (display.includes('grid')) layoutModel = 'grid';
        else if (display === 'block') layoutModel = 'block';
        else if (display === 'inline-block') layoutModel = 'inline-block';
        else if (display === 'inline') layoutModel = 'inline';
        else if (display === 'none') layoutModel = 'none';
        else if (display.includes('table')) layoutModel = 'table';

        const position = (computed.position || 'static') as any;

        const rect = el.getBoundingClientRect();
        const parsePx = (v: string) => parseFloat(v) || 0;

        const boxModel = {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          padding: {
            top: parsePx(computed.paddingTop),
            right: parsePx(computed.paddingRight),
            bottom: parsePx(computed.paddingBottom),
            left: parsePx(computed.paddingLeft),
          },
          margin: {
            top: parsePx(computed.marginTop),
            right: parsePx(computed.marginRight),
            bottom: parsePx(computed.marginBottom),
            left: parsePx(computed.marginLeft),
          },
          border: {
            top: parsePx(computed.borderTopWidth),
            right: parsePx(computed.borderRightWidth),
            bottom: parsePx(computed.borderBottomWidth),
            left: parsePx(computed.borderLeftWidth),
          },
        };

        return {
          selector,
          tagName: el.tagName.toLowerCase(),
          styles,
          layoutModel,
          positioning: position,
          boxModel,
        };
      },
      { selector, propsToInspect }
    );

    if (!data) {
      throw new ElementNotFoundError(selector);
    }

    return data;
  }
}

export const cssInspector = new CssInspector();
