import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { pageManager } from '../browser/page-manager.js';
import { formatErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function registerConsoleTools(server: McpServer): void {
  server.tool(
    'inspect_console',
    'Capture and inspect browser console output: JavaScript errors, warnings, uncaught exceptions, and console messages.',
    {
      level: z.enum(['all', 'error', 'warn', 'info']).optional().describe('Filter logs by level: "all", "error", "warn", or "info" (default: "all")'),
      clear: z.boolean().optional().describe('Clear console history after reading (default: false)'),
    },
    async (args) => {
      try {
        const logs = pageManager.getConsoleLogs(args.level || 'all', args.clear || false);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  totalLogs: logs.length,
                  filter: args.level || 'all',
                  data: logs,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in inspect_console tool:', err);
        return formatErrorResponse(err);
      }
    }
  );
}
