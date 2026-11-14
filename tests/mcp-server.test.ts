import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ViewportIQServer } from '../src/server.js';
import { browserManager } from '../src/browser/browser-manager.js';

describe('ViewportIQ MCP Server Integration', () => {
  let serverInstance: ViewportIQServer;
  let client: Client;
  const cleanFixture = path.resolve(process.cwd(), 'fixtures/responsive-clean.html');

  beforeAll(async () => {
    serverInstance = new ViewportIQServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({
      name: 'test-client',
      version: '1.0.0',
    });

    await serverInstance.getServer().connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
    await browserManager.close();
  });

  it('should list all registered ViewportIQ tools', async () => {
    const toolsResult = await client.listTools();
    expect(toolsResult.tools).toBeDefined();

    const toolNames = toolsResult.tools.map((t) => t.name);
    expect(toolNames).toContain('open_page');
    expect(toolNames).toContain('navigate_back');
    expect(toolNames).toContain('navigate_forward');
    expect(toolNames).toContain('reload_page');
    expect(toolNames).toContain('inspect_page');
    expect(toolNames).toContain('inspect_element');
    expect(toolNames).toContain('inspect_styles');
    expect(toolNames).toContain('inspect_page_structure');
    expect(toolNames).toContain('test_responsiveness');
    expect(toolNames).toContain('detect_overflow');
    expect(toolNames).toContain('inspect_breakpoints');
    expect(toolNames).toContain('inspect_element_responsiveness');
    expect(toolNames).toContain('compare_viewports');
    expect(toolNames).toContain('capture_screenshot');
    expect(toolNames).toContain('audit_layout');
    expect(toolNames).toContain('inspect_console');
    expect(toolNames).toContain('inspect_network');
  });

  it('should call open_page tool via MCP protocol', async () => {
    const response: any = await client.callTool({
      name: 'open_page',
      arguments: {
        url: cleanFixture,
      },
    });

    expect(response.content).toBeDefined();
    expect(response.content[0].type).toBe('text');
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.status).toBe('success');
    expect(parsed.data.title).toBe('Clean Responsive Showcase');
  });

  it('should call inspect_page tool via MCP protocol', async () => {
    const response: any = await client.callTool({
      name: 'inspect_page',
      arguments: {},
    });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.status).toBe('success');
    expect(parsed.data.totalDomElements).toBeGreaterThan(0);
    expect(parsed.data.headings.length).toBeGreaterThan(0);
  });

  it('should call detect_overflow tool via MCP protocol', async () => {
    const response: any = await client.callTool({
      name: 'detect_overflow',
      arguments: {},
    });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.status).toBe('success');
    expect(parsed.data.hasHorizontalPageOverflow).toBe(false);
  });

  it('should call capture_screenshot tool via MCP protocol', async () => {
    const response: any = await client.callTool({
      name: 'capture_screenshot',
      arguments: {
        type: 'viewport',
      },
    });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.status).toBe('success');
    expect(parsed.data.filePath).toBeDefined();
  });
});
