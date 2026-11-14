import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { navigationService } from '../browser/navigation.js';
import { formatErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function registerNavigationTools(server: McpServer): void {
  server.tool(
    'open_page',
    'Open a URL or local file path in the browser and return page metadata, final URL, HTTP status, and viewport dimensions.',
    {
      url: z.string().describe('URL or file path to open (e.g. "https://example.com" or "C:/sites/index.html")'),
      wait_until: z
        .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
        .optional()
        .describe('Wait until condition ("domcontentloaded", "load", "networkidle", "commit"). Default is "domcontentloaded".'),
      timeout: z.number().positive().optional().describe('Maximum timeout in ms (default: 30000ms).'),
    },
    async (args) => {
      try {
        const result = await navigationService.openPage(args.url, args.wait_until || 'domcontentloaded', args.timeout || 30000);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  message: `Opened ${result.finalUrl}`,
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in open_page tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'navigate_back',
    'Navigate back to the previous page in the browser session history.',
    {
      timeout: z.number().positive().optional().describe('Timeout in ms (default: 15000ms).'),
    },
    async (args) => {
      try {
        const result = await navigationService.navigateBack(args.timeout || 15000);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  message: `Navigated back to ${result.url}`,
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in navigate_back tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'navigate_forward',
    'Navigate forward to the next page in the browser session history.',
    {
      timeout: z.number().positive().optional().describe('Timeout in ms (default: 15000ms).'),
    },
    async (args) => {
      try {
        const result = await navigationService.navigateForward(args.timeout || 15000);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  message: `Navigated forward to ${result.url}`,
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in navigate_forward tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'reload_page',
    'Reload the currently active page in the browser.',
    {
      wait_until: z
        .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
        .optional()
        .describe('Wait condition on reload (default: "load").'),
      timeout: z.number().positive().optional().describe('Timeout in ms (default: 30000ms).'),
    },
    async (args) => {
      try {
        const result = await navigationService.reloadPage(args.wait_until || 'load', args.timeout || 30000);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  message: `Reloaded ${result.finalUrl}`,
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        logger.error('Error in reload_page tool:', err);
        return formatErrorResponse(err);
      }
    }
  );
}
