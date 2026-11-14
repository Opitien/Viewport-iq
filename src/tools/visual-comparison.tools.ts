import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { comparisonService } from '../services/comparison-service.js';
import { screenshotService } from '../services/screenshot-service.js';
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

export function registerVisualComparisonTools(server: McpServer): void {
  server.tool(
    'compare_viewports',
    'Capture screenshots of a webpage across mobile (375px), tablet (768px), and desktop (1440px) viewports, identify structural layout shifts, and compute visual pixel diff analysis.',
    {
      url: z.string().optional().describe('URL to compare. Defaults to currently opened page.'),
      viewports: z.array(ViewportInputSchema).optional().describe('Optional custom viewports to compare.'),
      run_pixel_diff: z.boolean().optional().describe('Generate visual pixel difference images (default: true).'),
    },
    async (args) => {
      try {
        const typedViewports = args.viewports as ViewportPreset[] | undefined;
        const result = await comparisonService.compareViewports(args.url, typedViewports, args.run_pixel_diff !== false);
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
        logger.error('Error in compare_viewports tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'capture_screenshot',
    'Capture a viewport, full-page, or specific element screenshot and save it to the output directory with metadata.',
    {
      type: z.enum(['viewport', 'fullPage', 'element']).optional().describe('Screenshot type: "viewport", "fullPage", or "element" (default: "viewport").'),
      selector: z.string().optional().describe('CSS selector (required when type is "element").'),
      width: z.number().int().min(240).max(5120).optional().describe('Optional custom viewport width in px.'),
      height: z.number().int().min(240).max(5120).optional().describe('Optional custom viewport height in px.'),
      filename_prefix: z.string().optional().describe('Prefix for saved screenshot filename.'),
    },
    async (args) => {
      try {
        const result = await screenshotService.captureScreenshot({
          type: args.type || 'viewport',
          selector: args.selector,
          width: args.width,
          height: args.height,
          filenamePrefix: args.filename_prefix,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  message: `Screenshot saved to ${result.filePath}`,
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in capture_screenshot tool:', err);
        return formatErrorResponse(err);
      }
    }
  );
}
