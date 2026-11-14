import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { reportGenerator } from '../services/report-generator.js';
import { formatErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function registerLayoutAuditTools(server: McpServer): void {
  server.tool(
    'audit_layout',
    'Perform a comprehensive layout audit on the current page to detect horizontal overflow, text clipping, unconstrained media, rigid fixed widths, and overlapping elements with severity ratings (Critical, High, Medium, Low).',
    {
      selector: z.string().optional().describe('Optional CSS selector to scope layout audit to a section. Default audits entire page.'),
      viewport_width: z.number().int().min(240).max(5120).optional().describe('Optional viewport width in px to audit layout at (e.g. 375 for mobile).'),
      viewport_height: z.number().int().min(240).max(5120).optional().describe('Optional viewport height in px to audit layout at (e.g. 812).'),
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
        const result = await reportGenerator.auditLayout(args.selector);
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
        logger.error('Error in audit_layout tool:', err);
        return formatErrorResponse(err);
      }
    }
  );
}
