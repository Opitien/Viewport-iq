import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { responsiveAnalyzer } from '../services/responsive-analyzer.js';
import { overflowDetector } from '../services/overflow-detector.js';
import { formatErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { ViewportPreset } from '../types/index.js';

const ViewportInputSchema = z.object({
  name: z.string(),
  category: z.enum(['Small mobile', 'Mobile', 'Large mobile', 'Tablet', 'Small laptop', 'Desktop', 'Large desktop']).optional(),
  width: z.number().int().min(240).max(5120),
  height: z.number().int().min(240).max(5120),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
});

export function registerResponsiveTools(server: McpServer): void {
  server.tool(
    'test_responsiveness',
    'Test a webpage across standard or custom viewport sizes (320px mobile to 1920px desktop). Detects horizontal overflow, clipped content, broken navigation, and overlapping elements at each size, captures screenshots, and returns structured findings.',
    {
      url: z.string().optional().describe('URL to test. If omitted, tests the currently active page.'),
      viewports: z.array(ViewportInputSchema).optional().describe('Optional custom viewports. Defaults to standard mobile, tablet, and desktop viewports.'),
      capture_screenshots: z.boolean().optional().describe('Capture and save screenshots for each viewport (default: true).'),
      settle_time_ms: z.number().int().min(0).max(10000).optional().describe('Wait time in ms for layout reflow (default: 400ms).'),
    },
    async (args) => {
      try {
        const typedViewports = args.viewports as ViewportPreset[] | undefined;
        const result = await responsiveAnalyzer.testResponsiveness(
          args.url,
          typedViewports,
          args.capture_screenshots !== false,
          args.settle_time_ms || 400
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in test_responsiveness tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'detect_overflow',
    'Identify horizontal page overflow, elements wider than their containers, content extending beyond viewport boundaries, fixed-width hazards, media overflow, and clipped text.',
    {
      selector: z.string().optional().describe('Optional CSS selector to scope detection. If omitted, checks the entire page.'),
      viewport_width: z.number().int().min(240).max(5120).optional().describe('Optional viewport width in px to check at (e.g. 375 for mobile).'),
      viewport_height: z.number().int().min(240).max(5120).optional().describe('Optional viewport height in px to check at (e.g. 812).'),
    },
    async (args) => {
      try {
        if (args.viewport_width && args.viewport_height) {
          const { pageManager } = await import('../browser/page-manager.js');
          await pageManager.setViewport(args.viewport_width, args.viewport_height);
        } else if (args.viewport_width) {
          const { pageManager } = await import('../browser/page-manager.js');
          await pageManager.setViewport(args.viewport_width, 800);
        }
        const result = await overflowDetector.detectOverflow(args.selector);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in detect_overflow tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'inspect_breakpoints',
    'Inspect how layout transforms across viewport widths (320px to 1920px). Probes navigation shifts, grid/column count changes, and discovers declared CSS @media queries.',
    {
      key_widths: z.array(z.number().int().min(280).max(3840)).optional().describe('Widths to test (default: [320, 480, 640, 768, 1024, 1280, 1440, 1920])'),
      inspect_css_media_queries: z.boolean().optional().describe('Inspect document stylesheets for CSS @media rules (default: true).'),
    },
    async (args) => {
      try {
        const result = await responsiveAnalyzer.inspectBreakpoints(
          args.key_widths || [320, 480, 640, 768, 1024, 1280, 1440, 1920],
          args.inspect_css_media_queries !== false
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in inspect_breakpoints tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'inspect_element_responsiveness',
    'Track a specific element (e.g. hero section, nav bar, image, card grid, or button) across multiple viewports to analyze how its bounding box, font-size, layout model, and padding scale.',
    {
      selector: z.string().describe('CSS selector of the element to inspect'),
      viewports: z.array(ViewportInputSchema).optional().describe('Optional list of viewports to test against'),
    },
    async (args) => {
      try {
        const typedViewports = args.viewports as ViewportPreset[] | undefined;
        const result = await responsiveAnalyzer.inspectElementResponsiveness(args.selector, typedViewports);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in inspect_element_responsiveness tool:', err);
        return formatErrorResponse(err);
      }
    }
  );
}
