import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerNavigationTools } from './tools/navigation.tools.js';
import { registerPageInspectionTools } from './tools/page-inspection.tools.js';
import { registerResponsiveTools } from './tools/responsive.tools.js';
import { registerVisualComparisonTools } from './tools/visual-comparison.tools.js';
import { registerLayoutAuditTools } from './tools/layout-audit.tools.js';
import { registerConsoleTools } from './tools/console.tools.js';
import { registerNetworkTools } from './tools/network.tools.js';
import { browserManager } from './browser/browser-manager.js';
import { logger } from './utils/logger.js';

export class ViewportIQServer {
  private server: McpServer;

  constructor() {
    this.server = new McpServer({
      name: 'viewport-iq',
      version: '1.0.0',
    });

    this.registerAllTools();
  }

  private registerAllTools(): void {
    logger.info('Registering ViewportIQ MCP tools...');
    registerNavigationTools(this.server);
    registerPageInspectionTools(this.server);
    registerResponsiveTools(this.server);
    registerVisualComparisonTools(this.server);
    registerLayoutAuditTools(this.server);
    registerConsoleTools(this.server);
    registerNetworkTools(this.server);
    logger.info('All ViewportIQ tools registered successfully.');
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    logger.info('Starting ViewportIQ MCP Server using STDIO transport...');
    await this.server.connect(transport);
    logger.info('ViewportIQ MCP Server connected and listening on STDIO.');

    const cleanup = async () => {
      logger.info('Shutting down ViewportIQ server...');
      await browserManager.close();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  public getServer(): McpServer {
    return this.server;
  }
}
