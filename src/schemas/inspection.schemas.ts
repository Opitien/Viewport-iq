import { z } from 'zod';

export const InspectPageSchema = z.object({
  max_items: z
    .number()
    .int()
    .positive()
    .optional()
    .default(25)
    .describe('Maximum number of items to return in lists (headings, links, buttons, images) to avoid oversized responses.'),
  include_hidden: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include elements hidden via display:none or visibility:hidden in details.'),
});

export const InspectElementSchema = z.object({
  selector: z.string().describe('CSS selector of the element to inspect (e.g. "header", "#hero", ".navbar-brand", "button.submit")'),
});

export const InspectStylesSchema = z.object({
  selector: z.string().describe('CSS selector of the element whose computed styles should be inspected'),
  properties: z
    .array(z.string())
    .optional()
    .describe('Optional list of specific CSS properties to inspect (e.g. ["display", "flex-direction", "width", "overflow"]). If omitted, returns key layout & box model properties.'),
});

export const InspectPageStructureSchema = z.object({
  root_selector: z
    .string()
    .optional()
    .default('body')
    .describe('CSS selector of the root element to start inspecting from (default: "body")'),
  max_depth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(4)
    .describe('Maximum hierarchy depth to traverse (default: 4)'),
  filter_semantic_only: z
    .boolean()
    .optional()
    .default(true)
    .describe('Focus on meaningful semantic elements (header, nav, main, section, article, aside, footer, form, headings, buttons, lists) rather than unstyled div wrappers'),
});
