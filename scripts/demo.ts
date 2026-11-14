import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ViewportIQServer } from '../src/server.js';
import { browserManager } from '../src/browser/browser-manager.js';

async function runDemo() {
  console.log('\n======================================================');
  console.log('       ViewportIQ MCP Server - Live Interactive Demo   ');
  console.log('======================================================\n');

  // 1. Initialize Server & Client
  console.log('1. Starting ViewportIQ MCP Server & connecting MCP Client...');
  const server = new ViewportIQServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'demo-client', version: '1.0.0' });
  await server.getServer().connect(serverTransport);
  await client.connect(clientTransport);
  console.log('Connected successfully via MCP protocol.\n');

  // 2. List registered tools
  console.log('2. Discovering registered MCP tools:');
  const toolsResult = await client.listTools();
  console.log(`Found ${toolsResult.tools.length} active MCP tools:`);
  toolsResult.tools.forEach((t, i) => {
    console.log(`   [${i + 1}] ${t.name}: ${t.description.split('.')[0]}.`);
  });
  console.log('');

  // 3. Test URL: use fixture or user-provided URL
  const targetUrl = process.argv[2] || path.resolve(process.cwd(), 'fixtures/horizontal-overflow.html');
  console.log(`3. Calling "open_page" on target: ${targetUrl}`);
  const openRes: any = await client.callTool({
    name: 'open_page',
    arguments: { url: targetUrl, timeout: 30000 },
  });
  const openData = JSON.parse(openRes.content[0].text);
  if (openData.status === 'error' || !openData.data) {
    console.error('Failed to open page:', openData.message || openData);
    await client.close();
    await browserManager.close();
    process.exit(1);
  }
  console.log('Page loaded:', {
    title: openData.data.title || '(untitled)',
    finalUrl: openData.data.finalUrl || openData.data.url,
    loadTimeMs: `${openData.data.loadTimeMs || 'N/A'}ms`,
    viewport: openData.data.viewport,
  });
  console.log('');

  // 4. Run detect_overflow at Mobile 375px
  console.log('4. Calling "detect_overflow" at Mobile (375px) to locate layout breaks:');
  const overflowRes: any = await client.callTool({
    name: 'detect_overflow',
    arguments: { viewport_width: 375 },
  });
  const overflowData = JSON.parse(overflowRes.content[0].text);
  console.log('Overflow status:', {
    hasHorizontalPageOverflow: overflowData.data.hasHorizontalPageOverflow,
    pageScrollWidth: `${overflowData.data.pageScrollWidth}px`,
    viewportWidth: `${overflowData.data.viewportWidth}px`,
    issuesFound: overflowData.data.totalIssuesCount,
  });
  if (overflowData.data.issues.length > 0) {
    console.log('Sample Issue Found:');
    const first = overflowData.data.issues[0];
    console.log(`   - Severity: ${first.severity.toUpperCase()}`);
    console.log(`   - Type: ${first.type}`);
    console.log(`   - Element: ${first.selector}`);
    console.log(`   - Explanation: ${first.explanation}`);
    console.log(`   - Fix: ${first.suggestion}`);
  }
  console.log('');

  // 5. Test Responsiveness across Mobile & Desktop
  console.log('5. Calling "test_responsiveness" across Mobile (375px) and Desktop (1440px):');
  const respRes: any = await client.callTool({
    name: 'test_responsiveness',
    arguments: {
      viewports: [
        { name: 'Mobile', width: 375, height: 812 },
        { name: 'Desktop', width: 1440, height: 900 },
      ],
      capture_screenshots: true,
    },
  });
  const respData = JSON.parse(respRes.content[0].text);
  if (respData.data) {
    console.log(`Overall Responsiveness Grade: [${respData.data.overallStatus}]`);
    respData.data.viewportReports.forEach((r: any) => {
      console.log(`   - ${r.viewport.name} (${r.viewport.width}x${r.viewport.height}): [${r.grade}] - ${r.summary}`);
      if (r.screenshotPath) console.log(`     Screenshot: ${r.screenshotPath}`);
    });
  } else {
    console.log('   Notice:', respData.message || 'No responsive data returned.');
  }
  console.log('');

  // 6. Layout audit at Mobile 375px
  console.log('6. Calling "audit_layout" at Mobile (375px) to calculate layout health score:');
  const auditRes: any = await client.callTool({
    name: 'audit_layout',
    arguments: { viewport_width: 375 },
  });
  const auditData = JSON.parse(auditRes.content[0].text);
  if (auditData.data) {
    console.log(`Layout Health Score: ${auditData.data.score}/100`);
    console.log('Findings Breakdown:', auditData.data.findingsCount);
  } else {
    console.log('   Notice:', auditData.message || 'No audit findings returned.');
  }
  console.log('');

  // 7. Visual comparison
  console.log('7. Calling "compare_viewports" with pixel difference analysis:');
  const compRes: any = await client.callTool({
    name: 'compare_viewports',
    arguments: {
      viewports: [
        { name: 'Mobile', width: 375, height: 812 },
        { name: 'Desktop', width: 1440, height: 900 },
      ],
      run_pixel_diff: true,
    },
  });
  const compData = JSON.parse(compRes.content[0].text);
  if (compData.data) {
    console.log('Comparison Summary:', compData.data.analysisSummary);
    if (compData.data.visualDiff) {
      console.log(`Visual Difference: ${compData.data.visualDiff.mismatchPercentage}% mismatched pixels`);
      console.log(`Diff Image Saved At: ${compData.data.visualDiff.diffScreenshotPath}`);
    }
  } else {
    console.log('   Notice:', compData.message || 'No comparison data returned.');
  }
  console.log('');

  console.log('======================================================');
  console.log('           Demo Completed Successfully!                ');
  console.log('   All screenshots, reports & diffs saved to output/  ');
  console.log('======================================================\n');

  await client.close();
  await browserManager.close();
  process.exit(0);
}

runDemo().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
