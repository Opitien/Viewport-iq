import { Page } from 'playwright';
import { pageManager } from '../browser/page-manager.js';
import { ElementNotFoundError } from '../utils/errors.js';
import {
  PageInspectionSummary,
  ElementInspectionResult,
  PageStructureNode,
  LandmarkInfo,
  HeadingInfo,
  ImageInfo,
  LinkInfo,
  ButtonInfo,
  FormInfo,
} from '../types/index.js';

export class DomInspector {
  public async inspectPage(maxItems: number = 25, includeHidden: boolean = false): Promise<PageInspectionSummary> {
    const page = pageManager.getActivePageOrThrow();

    const data = await page.evaluate(
      ({ maxItems, includeHidden }) => {
        const title = document.title || '';
        const url = window.location.href;

        const viewportDimensions = {
          width: window.innerWidth,
          height: window.innerHeight,
        };

        const documentDimensions = {
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
        };

        const totalDomElements = document.querySelectorAll('*').length;

        // Landmarks & Semantic sections
        const landmarkSelectors = [
          { role: 'banner', tag: 'header' },
          { role: 'navigation', tag: 'nav' },
          { role: 'main', tag: 'main' },
          { role: 'complementary', tag: 'aside' },
          { role: 'contentinfo', tag: 'footer' },
          { role: 'region', tag: 'section' },
          { role: 'article', tag: 'article' },
        ];

        const landmarks: any[] = [];
        for (const item of landmarkSelectors) {
          const els = document.querySelectorAll(item.tag + ', [role="' + item.role + '"]');
          els.forEach((el, idx) => {
            if (landmarks.length >= maxItems) return;
            const rect = el.getBoundingClientRect();
            landmarks.push({
              role: item.role,
              tag: el.tagName.toLowerCase(),
              label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || undefined,
              selector: el.id
                ? `#${el.id}`
                : `${el.tagName.toLowerCase()}${el.className ? '.' + Array.from(el.classList).slice(0, 2).join('.') : ''}:nth-of-type(${idx + 1})`,
              boundingBox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            });
          });
        }

        // Headings & Heading hierarchy check
        const headingEls = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const headings: any[] = [];
        const headingIssues: string[] = [];
        let prevLevel = 0;

        headingEls.forEach((el) => {
          const level = parseInt(el.tagName.substring(1), 10);
          const style = window.getComputedStyle(el);
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden';

          if (!includeHidden && !isVisible) return;

          const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
          headings.push({
            level,
            text: text.slice(0, 80),
            selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}:contains("${text.slice(0, 20)}")`,
            isVisible,
          });

          // Check hierarchy: skipping levels (e.g. h1 -> h3 without h2)
          if (prevLevel > 0 && level > prevLevel + 1) {
            headingIssues.push(`Heading level skipped from h${prevLevel} directly to h${level}: "${text.slice(0, 40)}"`);
          }
          prevLevel = level;
        });

        const h1Count = headings.filter((h) => h.level === 1).length;
        if (h1Count === 0) {
          headingIssues.push('Page is missing a top-level <h1> heading.');
        } else if (h1Count > 1) {
          headingIssues.push(`Page has multiple (${h1Count}) <h1> headings.`);
        }

        // Images
        const imgEls = Array.from(document.querySelectorAll('img, picture > img'));
        let missingAltCount = 0;
        const images: any[] = [];

        imgEls.forEach((img) => {
          const el = img as HTMLImageElement;
          const alt = el.getAttribute('alt');
          const hasAlt = alt !== null && alt.trim().length > 0;
          if (!hasAlt) missingAltCount++;

          if (images.length < maxItems) {
            const rect = el.getBoundingClientRect();
            images.push({
              src: el.src ? el.src.slice(0, 100) : '',
              alt: alt || '',
              hasAlt,
              naturalWidth: el.naturalWidth,
              naturalHeight: el.naturalHeight,
              renderedWidth: Math.round(rect.width),
              renderedHeight: Math.round(rect.height),
              isOversized: el.naturalWidth > window.innerWidth && rect.width > window.innerWidth,
              selector: el.id ? `#${el.id}` : el.className ? `img.${Array.from(el.classList)[0]}` : 'img',
            });
          }
        });

        // Links
        const linkEls = Array.from(document.querySelectorAll('a[href]'));
        let emptyLinkNames = 0;
        const links: any[] = [];

        linkEls.forEach((a) => {
          const el = a as HTMLAnchorElement;
          const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
          const hasAccessibleName = text.length > 0;
          if (!hasAccessibleName) emptyLinkNames++;

          if (links.length < maxItems) {
            links.push({
              text: text.slice(0, 50),
              href: el.href.slice(0, 100),
              isExternal: el.hostname !== window.location.hostname,
              hasAccessibleName,
              selector: el.id ? `#${el.id}` : 'a[href]',
            });
          }
        });

        // Buttons
        const buttonEls = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
        let missingButtonNames = 0;
        const buttons: any[] = [];

        buttonEls.forEach((btn) => {
          const el = btn as HTMLElement;
          const accessibleName = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('value') || '').trim();
          const hasAccessibleName = accessibleName.length > 0;
          if (!hasAccessibleName) missingButtonNames++;

          if (buttons.length < maxItems) {
            buttons.push({
              text: (el.textContent || '').trim().slice(0, 50),
              accessibleName: accessibleName.slice(0, 50),
              hasAccessibleName,
              type: (el as HTMLButtonElement).type || 'button',
              disabled: (el as any).disabled || el.getAttribute('aria-disabled') === 'true',
              selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${el.className ? '.' + Array.from(el.classList)[0] : ''}`,
            });
          }
        });

        // Forms & Inputs
        const formEls = Array.from(document.querySelectorAll('form'));
        const forms: any[] = [];

        formEls.forEach((form) => {
          if (forms.length >= maxItems) return;
          const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
          const inputDetails = inputs.map((inp) => {
            const inputEl = inp as HTMLInputElement;
            const id = inputEl.id;
            let hasLabel = false;
            let labelText = '';

            if (id) {
              const labelEl = document.querySelector(`label[for="${id}"]`);
              if (labelEl) {
                hasLabel = true;
                labelText = (labelEl.textContent || '').trim();
              }
            }
            if (!hasLabel && inputEl.closest('label')) {
              hasLabel = true;
              labelText = (inputEl.closest('label')?.textContent || '').trim();
            }
            if (!hasLabel && (inputEl.getAttribute('aria-label') || inputEl.getAttribute('placeholder'))) {
              hasLabel = true;
              labelText = inputEl.getAttribute('aria-label') || inputEl.getAttribute('placeholder') || '';
            }

            return {
              type: inputEl.type || inputEl.tagName.toLowerCase(),
              name: inputEl.name || undefined,
              id: inputEl.id || undefined,
              hasLabel,
              labelText: labelText.slice(0, 40),
              required: inputEl.required,
            };
          });

          forms.push({
            id: form.id || undefined,
            name: form.getAttribute('name') || undefined,
            action: form.getAttribute('action') || undefined,
            method: (form.getAttribute('method') || 'GET').toUpperCase(),
            inputCount: inputs.length,
            inputs: inputDetails.slice(0, 15),
            selector: form.id ? `#${form.id}` : 'form',
          });
        });

        const accessibilityNotices: string[] = [];
        if (missingAltCount > 0) {
          accessibilityNotices.push(`Found ${missingAltCount} image(s) missing alt text.`);
        }
        if (emptyLinkNames > 0) {
          accessibilityNotices.push(`Found ${emptyLinkNames} link(s) without accessible names.`);
        }
        if (missingButtonNames > 0) {
          accessibilityNotices.push(`Found ${missingButtonNames} button(s) without accessible names.`);
        }
        if (headingIssues.length > 0) {
          accessibilityNotices.push(...headingIssues);
        }

        return {
          title,
          url,
          viewportDimensions,
          documentDimensions,
          totalDomElements,
          landmarks,
          headings,
          headingHierarchyValid: headingIssues.length === 0,
          headingIssues,
          images: {
            total: imgEls.length,
            missingAlt: missingAltCount,
            items: images,
          },
          links: {
            total: linkEls.length,
            emptyNames: emptyLinkNames,
            items: links,
          },
          buttons: {
            total: buttonEls.length,
            missingAccessibleNames: missingButtonNames,
            items: buttons,
          },
          forms,
          accessibilityNotices,
        };
      },
      { maxItems, includeHidden }
    );

    return data;
  }

  public async inspectElement(selector: string): Promise<ElementInspectionResult> {
    const page = pageManager.getActivePageOrThrow();

    const exists = await page.$(selector);
    if (!exists) {
      throw new ElementNotFoundError(selector);
    }

    const result = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      // Attributes
      const attributes: Record<string, string> = {};
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        attributes[attr.name] = attr.value;
      }

      // Computed styles of interest
      const computedStyles: Record<string, string> = {
        display: style.display,
        position: style.position,
        boxSizing: style.boxSizing,
        width: style.width,
        height: style.height,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        margin: `${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}`,
        padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
        flexDirection: style.flexDirection,
        flexWrap: style.flexWrap,
        justifyContent: style.justifyContent,
        alignItems: style.alignItems,
        gridTemplateColumns: style.gridTemplateColumns,
        gridTemplateRows: style.gridTemplateRows,
        gap: style.gap,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        zIndex: style.zIndex,
        visibility: style.visibility,
        opacity: style.opacity,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
      };

      // Visibility & clipping checks
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
      const isInViewport =
        rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
      const isClipped = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;

      // Parent info
      const parent = el.parentElement;
      let parentInfo = null;
      if (parent) {
        const parentStyle = window.getComputedStyle(parent);
        const parentRect = parent.getBoundingClientRect();
        parentInfo = {
          tagName: parent.tagName.toLowerCase(),
          id: parent.id || undefined,
          classList: Array.from(parent.classList),
          display: parentStyle.display,
          width: Math.round(parentRect.width),
          height: Math.round(parentRect.height),
        };
      }

      // Relevant children
      const children = Array.from(el.children).slice(0, 10).map((child) => ({
        tagName: child.tagName.toLowerCase(),
        id: child.id || undefined,
        classList: Array.from(child.classList),
        textSnippet: (child.textContent || '').trim().slice(0, 40),
      }));

      return {
        selector: sel,
        tagName: el.tagName.toLowerCase(),
        id: el.id || undefined,
        classList: Array.from(el.classList),
        attributes,
        textContent: (el.textContent || '').trim().slice(0, 200),
        innerHTMLSnippet: el.innerHTML.slice(0, 300),
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
        },
        computedStyles,
        visibility: {
          isVisible,
          isInViewport,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          clipped: isClipped,
        },
        parent: parentInfo,
        childrenCount: el.children.length,
        relevantChildren: children,
      };
    }, selector);

    if (!result) {
      throw new ElementNotFoundError(selector);
    }

    return result;
  }

  public async inspectPageStructure(
    rootSelector: string = 'body',
    maxDepth: number = 4,
    filterSemanticOnly: boolean = true
  ): Promise<PageStructureNode> {
    const page = pageManager.getActivePageOrThrow();

    const exists = await page.$(rootSelector);
    if (!exists) {
      throw new ElementNotFoundError(rootSelector);
    }

    const structure = await page.evaluate(
      ({ rootSelector, maxDepth, filterSemanticOnly }) => {
        const semanticTags = new Set([
          'header',
          'nav',
          'main',
          'section',
          'article',
          'aside',
          'footer',
          'form',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'button',
          'a',
          'ul',
          'ol',
          'li',
          'table',
          'figure',
          'dialog',
        ]);

        function traverse(element: Element, currentDepth: number): PageStructureNode | null {
          const tag = element.tagName.toLowerCase();

          if (['script', 'style', 'noscript', 'svg', 'path'].includes(tag)) {
            return null;
          }

          const role = element.getAttribute('role') || undefined;
          const id = element.id || undefined;
          const classes = element.className && typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean) : undefined;

          // If filtering semantic only, skip unstyled divs that have no id/classes/role unless they have semantic children
          if (filterSemanticOnly && currentDepth > 1 && !semanticTags.has(tag) && !role && !id && (!classes || classes.length === 0)) {
            // Flatten or skip
          }

          let textSnippet: string | undefined = undefined;
          if (element.children.length === 0) {
            const txt = (element.textContent || '').trim().replace(/\s+/g, ' ');
            if (txt) textSnippet = txt.slice(0, 60);
          }

          const node: PageStructureNode = {
            tag,
            id,
            classes: classes && classes.length > 0 ? classes.slice(0, 3) : undefined,
            role,
            textSnippet,
          };

          if (currentDepth < maxDepth && element.children.length > 0) {
            const childNodes: PageStructureNode[] = [];
            for (let i = 0; i < element.children.length; i++) {
              if (childNodes.length >= 15) break; // Limit fan-out
              const childNode = traverse(element.children[i], currentDepth + 1);
              if (childNode) childNodes.push(childNode);
            }
            if (childNodes.length > 0) {
              node.children = childNodes;
            }
          }

          return node;
        }

        const rootEl = document.querySelector(rootSelector);
        if (!rootEl) return null;
        return traverse(rootEl, 1);
      },
      { rootSelector, maxDepth, filterSemanticOnly }
    );

    if (!structure) {
      throw new ElementNotFoundError(rootSelector);
    }

    return structure;
  }
}

export const domInspector = new DomInspector();
