import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { domInspector } from '../services/dom-inspector.js';
import { cssInspector } from '../services/css-inspector.js';
import { formatErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function registerPageInspectionTools(server: McpServer): void {
  server.tool(
    'inspect_page',
    'Inspect the currently opened page, returning document/viewport dimensions, landmarks, heading hierarchy, images, links, buttons, and forms with accessibility notices.',
    {
      max_items: z.number().int().positive().optional().describe('Maximum items to return in lists (default: 25)'),
      include_hidden: z.boolean().optional().describe('Whether to include hidden elements (default: false)'),
    },
    async (args) => {
      try {
        const result = await domInspector.inspectPage(args.max_items || 25, args.include_hidden || false);
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
        logger.error('Error in inspect_page tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'inspect_element',
    'Inspect a specific DOM element using a CSS selector. Returns tag, text, attributes, computed styles, bounding box, visibility, parent, and relevant children.',
    {
      selector: z.string().describe('CSS selector of the target element (e.g. "header", "#hero", ".navbar-brand", "button.submit")'),
    },
    async (args) => {
      try {
        const result = await domInspector.inspectElement(args.selector);
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
        logger.error('Error in inspect_element tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'inspect_styles',
    'Inspect computed CSS styles and box model (display, position, width/height, margin, padding, flex/grid, overflow, z-index, font-size) for a selector.',
    {
      selector: z.string().describe('CSS selector of the element'),
      properties: z
        .array(z.string())
        .optional()
        .describe('Specific CSS properties to inspect (e.g. ["display", "flex-direction", "width", "overflow"]). If omitted, returns key layout & box model properties.'),
    },
    async (args) => {
      try {
        const result = await cssInspector.inspectStyles(args.selector, args.properties);
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
        logger.error('Error in inspect_styles tool:', err);
        return formatErrorResponse(err);
      }
    }
  );

  server.tool(
    'inspect_page_structure',
    'Return a clean, readable structural hierarchy of the page DOM focusing on semantic elements (header, nav, main, section, footer, headings) up to max_depth.',
    {
      root_selector: z.string().optional().describe('Root selector to start traversal from (default: "body")'),
      max_depth: z.number().int().min(1).max(10).optional().describe('Max hierarchy depth (default: 4)'),
      filter_semantic_only: z.boolean().optional().describe('Focus on meaningful semantic nodes (default: true)'),
    },
    async (args) => {
      try {
        const result = await domInspector.inspectPageStructure(
          args.root_selector || 'body',
          args.max_depth || 4,
          args.filter_semantic_only !== false
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
        logger.error('Error in inspect_page_structure tool:', err);
        return formatErrorResponse(err);
      }
    }
  );
}
