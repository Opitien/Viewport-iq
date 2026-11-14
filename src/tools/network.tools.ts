import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { pageManager } from '../browser/page-manager.js';
import { formatErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function registerNetworkTools(server: McpServer): void {
  server.tool(
    'inspect_network',
    'Capture and inspect network activity: failed requests, HTTP 4xx/5xx responses, resource types, and failure reasons (avoids capturing sensitive auth tokens or cookies).',
    {
      failed_only: z.boolean().optional().describe('Only return failed or 4xx/5xx requests (default: true).'),
      clear: z.boolean().optional().describe('Clear network history after reading (default: false).'),
    },
    async (args) => {
      try {
        const logs = pageManager.getNetworkLogs(args.failed_only !== false, args.clear || false);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  totalRequests: logs.length,
                  failedOnly: args.failed_only !== false,
                  data: logs,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in inspect_network tool:', err);
        return formatErrorResponse(err);
      }
    }
  );
}
