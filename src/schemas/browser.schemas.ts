import { z } from 'zod';

export const OpenPageSchema = z.object({
  url: z.string().describe('The URL or local file path to open (e.g. "https://example.com" or "file:///C:/path/to/file.html")'),
  wait_until: z
    .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
    .optional()
    .default('domcontentloaded')
    .describe('When to consider navigation succeeded: "domcontentloaded", "load", "networkidle", or "commit". Default is "domcontentloaded".'),
  timeout: z
    .number()
    .positive()
    .optional()
    .default(30000)
    .describe('Maximum operation time in milliseconds. Default is 30,000ms.'),
});

export const NavigateBackSchema = z.object({
  timeout: z.number().positive().optional().default(15000).describe('Navigation timeout in ms.'),
});

export const NavigateForwardSchema = z.object({
  timeout: z.number().positive().optional().default(15000).describe('Navigation timeout in ms.'),
});

export const ReloadPageSchema = z.object({
  wait_until: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).optional().default('load'),
  timeout: z.number().positive().optional().default(30000),
});
