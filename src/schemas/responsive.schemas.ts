import { z } from 'zod';

export const CustomViewportSchema = z.object({
  name: z.string().describe('Descriptive name of the viewport preset (e.g. "iPhone 14", "iPad Pro", "Desktop Full")'),
  width: z.number().int().min(240).max(5120).describe('Viewport width in CSS pixels'),
  height: z.number().int().min(240).max(5120).describe('Viewport height in CSS pixels'),
  deviceScaleFactor: z.number().optional().default(1),
  isMobile: z.boolean().optional().default(false),
  hasTouch: z.boolean().optional().default(false),
});

export const TestResponsivenessSchema = z.object({
  url: z.string().optional().describe('URL to test. If omitted, uses the currently opened page.'),
  viewports: z
    .array(CustomViewportSchema)
    .optional()
    .describe('Custom list of viewports to test. If omitted, uses standard presets: Small mobile (320), Mobile (375), Large mobile (430), Tablet (768), Small laptop (1024), Desktop (1440), Large desktop (1920).'),
  capture_screenshots: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to capture and save screenshots for each viewport size (default: true).'),
  settle_time_ms: z
    .number()
    .int()
    .min(0)
    .max(10000)
    .optional()
    .default(500)
    .describe('Wait time in milliseconds after resizing for animations/layout to settle (default: 500ms).'),
});

export const DetectOverflowSchema = z.object({
  selector: z
    .string()
    .optional()
    .describe('Optional CSS selector to scope overflow detection. If omitted, checks the entire document and all sub-elements.'),
});

export const InspectBreakpointsSchema = z.object({
  key_widths: z
    .array(z.number().int().min(280).max(3840))
    .optional()
    .describe('Explicit list of viewport widths to probe (e.g. [320, 480, 640, 768, 1024, 1280, 1440]). If omitted, tests standard key widths.'),
  inspect_css_media_queries: z
    .boolean()
    .optional()
    .default(true)
    .describe('Attempt to inspect document.styleSheets for declared CSS @media rules.'),
});

export const InspectElementResponsivenessSchema = z.object({
  selector: z.string().describe('CSS selector of the specific element to test across screen sizes (e.g. ".hero-title", "#main-nav", ".cta-button")'),
  viewports: z
    .array(CustomViewportSchema)
    .optional()
    .describe('Optional custom viewports to check. Defaults to [320, 375, 768, 1024, 1440].'),
});

export const CompareViewportsSchema = z.object({
  url: z.string().optional().describe('URL to compare. Defaults to currently opened page.'),
  viewports: z
    .array(CustomViewportSchema)
    .optional()
    .describe('Viewports to compare. Defaults to Mobile (375x812), Tablet (768x1024), and Desktop (1440x900).'),
  run_pixel_diff: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to generate visual pixel diff images between viewports.'),
});

export const CaptureScreenshotSchema = z.object({
  type: z
    .enum(['viewport', 'fullPage', 'element'])
    .optional()
    .default('viewport')
    .describe('Screenshot type: "viewport" (current visible area), "fullPage" (entire scrollable page), or "element" (specific element).'),
  selector: z
    .string()
    .optional()
    .describe('Required when type is "element": CSS selector of the element to capture.'),
  width: z.number().int().min(240).max(5120).optional().describe('Optional custom viewport width for this screenshot.'),
  height: z.number().int().min(240).max(5120).optional().describe('Optional custom viewport height for this screenshot.'),
  filename_prefix: z.string().optional().default('screenshot').describe('Prefix for the screenshot filename.'),
});

export const AuditLayoutSchema = z.object({
  selector: z
    .string()
    .optional()
    .describe('Optional CSS selector to scope layout audit to a section (e.g. "header", "main", "#catalog"). Default audits entire page.'),
});

export const InspectConsoleSchema = z.object({
  level: z
    .enum(['all', 'error', 'warn', 'info'])
    .optional()
    .default('all')
    .describe('Filter console logs by level (default: "all")'),
  clear: z
    .boolean()
    .optional()
    .default(false)
    .describe('Clear console history after reading (default: false)'),
});

export const InspectNetworkSchema = z.object({
  failed_only: z
    .boolean()
    .optional()
    .default(true)
    .describe('If true, only returns failed or HTTP 4xx/5xx requests. If false, returns all captured requests.'),
  clear: z
    .boolean()
    .optional()
    .default(false)
    .describe('Clear network history after reading (default: false)'),
});
