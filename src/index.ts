#!/usr/bin/env node

/**
 * ViewportIQ MCP Server Entry Point
 * Production-grade Browser Inspection & Responsive Testing MCP Server
 */

import { ViewportIQServer } from './server.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    const server = new ViewportIQServer();
    await server.start();
  } catch (error) {
    logger.error('Fatal error starting ViewportIQ MCP Server:', error);
    process.exit(1);
  }
}

main();
