# ViewportIQ: Browser Inspection & Responsive Testing MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-1.6-purple.svg)](https://modelcontextprotocol.io/)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-green.svg)](https://playwright.dev/)
[![Tests](https://img.shields.io/badge/tests-24%20passed-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**ViewportIQ** is a production-quality Model Context Protocol (MCP) server engineered for frontend developers and AI assistants (Claude Desktop, Cursor, Cline, Windsurf). It equips AI assistants with deep browser inspection, multi-viewport responsive layout testing, evidence-based overflow detection, and automated visual comparison.

---

## Table of Contents

1. [Key Capabilities](#key-capabilities)
2. [Architecture](#architecture)
3. [Prerequisites & Installation](#prerequisites--installation)
4. [Client Configuration](#client-configuration)
   - [Claude Desktop](#claude-desktop)
   - [Cursor / Windsurf / Cline](#cursor--windsurf--cline)
5. [Complete MCP Tool Reference](#complete-mcp-tool-reference)
   - [A. Browser Navigation](#a-browser-navigation)
   - [B. Page & DOM Inspection](#b-page--dom-inspection)
   - [C. Responsive Testing & Breakpoints](#c-responsive-testing--breakpoints)
   - [D. Visual Comparison & Screenshots](#d-visual-comparison--screenshots)
   - [E. Layout Audit](#e-layout-audit)
   - [F. Console & Network Diagnostics](#f-console--network-diagnostics)
6. [Organized Output Structure](#organized-output-structure)
7. [Practical Workflow Examples](#practical-workflow-examples)
8. [Automated Test Suite & Fixtures](#automated-test-suite--fixtures)
9. [Troubleshooting & Best Practices](#troubleshooting--best-practices)
10. [Roadmap](#roadmap)

---

## Key Capabilities

- **Automated Multi-Viewport Testing:** Validates layouts across 7 standard presets (320px Small Mobile to 1920px Ultrawide Desktop) or custom dimensions.
- **Evidence-Based Overflow Detection:** Identifies horizontal page overflow, unconstrained fixed widths, media overflow, and text clipping with exact pixel measurements.
- **Visual Viewport Comparison & Pixel Diffing:** Captures synchronized screenshots across device profiles and highlights responsive shifts using image diff analysis (`pixelmatch`).
- **Semantic DOM & Computed CSS:** Inspects landmarks, heading hierarchies (h1-h6), accessible names, box models, flex/grid properties, and layout transitions.
- **Layout Health Audit:** Grades pages with a 0–100 health score and classifies issues by severity (`Critical`, `High`, `Medium`, `Low`).
- **Real-Time Console & Network Diagnostics:** Intercepts uncaught JavaScript exceptions, console warnings, and failed HTTP requests (4xx/5xx) while protecting sensitive credentials.
- **Robust Session Management:** Single persistent Playwright Chromium instance with lifecycle handling and graceful recovery.
- **Strict Protocol Compliance:** Emits all diagnostic logs exclusively to `stderr`, preserving `stdout` for JSON-RPC MCP communication.

---

## Architecture

ViewportIQ adheres to a clean, decoupled modular architecture separating browser automation, MCP tool registration, inspection logic, and report generation:

```
viewport-iq/
├── src/
│   ├── index.ts                     # CLI executable entry point
│   ├── server.ts                    # MCP Server initialization & tool registration
│   ├── browser/
│   │   ├── browser-manager.ts       # Singleton Playwright browser & context lifecycle
│   │   ├── page-manager.ts          # Active page state, console & network interception
│   │   └── navigation.ts            # URL navigation, history, and reload
│   ├── tools/
│   │   ├── navigation.tools.ts      # open_page, navigate_back, reload_page, etc.
│   │   ├── page-inspection.tools.ts # inspect_page, inspect_element, inspect_styles
│   │   ├── responsive.tools.ts      # test_responsiveness, detect_overflow, etc.
│   │   ├── visual-comparison.tools.ts # compare_viewports, capture_screenshot
│   │   ├── layout-audit.tools.ts    # audit_layout
│   │   ├── console.tools.ts         # inspect_console
│   │   └── network.tools.ts         # inspect_network
│   ├── services/
│   │   ├── dom-inspector.ts         # Semantic landmarks, headings, images, forms
│   │   ├── css-inspector.ts         # Computed styles, box-model, flex/grid layout
│   │   ├── overflow-detector.ts     # Horizontal overflow & clipping analysis
│   │   ├── responsive-analyzer.ts   # Multi-viewport sweep & breakpoint probing
│   │   ├── screenshot-service.ts    # Viewport, full-page, element screenshots
│   │   ├── comparison-service.ts    # Cross-screen comparison & pixel diffing
│   │   └── report-generator.ts      # Layout health audit & structured JSON reports
│   ├── schemas/                     # Zod input schemas for tool validation
│   ├── utils/
│   │   ├── logger.ts                # Stderr-only logger (protects stdout JSON-RPC)
│   │   ├── errors.ts                # Structured error handling
│   │   └── file-manager.ts          # Output directory and file paths
│   └── types/                       # Shared TypeScript interfaces & types
├── fixtures/                        # HTML test fixtures (clean, overflow, clipping, etc.)
├── tests/                           # Vitest automated test suite (24 tests)
├── output/                          # Screenshots, diffs, and structured reports
├── package.json
└── tsconfig.json
```

---

## Prerequisites & Installation

### Prerequisites

- **Node.js**: v18.0.0 or later (tested on Node v20, v22, and v24)
- **npm**: v9 or later
- **Operating System**: macOS, Linux, or Windows

### Installation

1. **Clone or navigate to the repository:**
   ```bash
   cd c:/Users/user/mcp-project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright Chromium:**
   ```bash
   npx playwright install chromium
   ```

4. **Build the TypeScript project:**
   ```bash
   npm run build
   ```

5. **Run the test suite:**
   ```bash
   npm run test
   ```

---

## Client Configuration

### Claude Desktop

Edit your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add `viewport-iq` under `mcpServers`:

```json
{
  "mcpServers": {
    "viewport-iq": {
      "command": "node",
      "args": [
        "C:/Users/user/mcp-project/dist/index.js"
      ],
      "env": {
        "NODE_OPTIONS": "--use-system-ca"
      }
    }
  }
}
```

> **Note on Windows paths:** Use forward slashes (`/`) or escaped backslashes (`\\\\`).

### Cursor / Windsurf / Cline

In your MCP settings (or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "viewport-iq": {
      "command": "node",
      "args": ["C:/Users/user/mcp-project/dist/index.js"]
    }
  }
}
```

---

## Complete MCP Tool Reference

### A. Browser Navigation

#### `open_page`
Opens a web URL or local file path.
- **Inputs:**
  - `url` *(string, required)*: E.g., `"https://example.com"` or `"file:///path/to/page.html"`
  - `wait_until` *(string, optional)*: `"load"`, `"domcontentloaded"`, `"networkidle"`, or `"commit"` (default: `"load"`)
  - `timeout` *(number, optional)*: Milliseconds before navigation timeout (default: `30000`)
- **Output:** Final URL, page title, HTTP response status, load time in ms, and current viewport.

#### `navigate_back`
Navigates to the previous page in history.

#### `navigate_forward`
Navigates forward to the next page in history.

#### `reload_page`
Reloads the currently active page.

---

### B. Page & DOM Inspection

#### `inspect_page`
Provides a structural overview of the page.
- **Inputs:**
  - `max_items` *(number, optional)*: Maximum items to return for lists (default: `25`)
  - `include_hidden` *(boolean, optional)*: Include elements with `display:none` or `visibility:hidden`
- **Output:** Viewport and document dimensions, total DOM elements, landmarks (`header`, `nav`, `main`, `footer`), heading hierarchy (`h1`–`h6`) with hierarchy error detection (e.g., skipping from `h1` to `h3`), image dimensions and missing `alt` attributes, links, buttons, and form inputs.

#### `inspect_element`
Inspects a specific DOM element using a CSS selector.
- **Inputs:**
  - `selector` *(string, required)*: E.g., `"#hero"`, `".navbar-brand"`, `"button.primary"`
- **Output:** Tag, text content, attributes, bounding box (`x`, `y`, `width`, `height`, `top`, `right`, `bottom`, `left`), visibility status, parent details, and direct child element snippets.

#### `inspect_styles`
Inspects computed CSS properties and box model for an element.
- **Inputs:**
  - `selector` *(string, required)*: Target CSS selector
  - `properties` *(array of strings, optional)*: Specific CSS properties to inspect (default: box-model, display, flex/grid, typography, overflow)
- **Output:** Computed styles map, layout model (`flex`, `grid`, `block`, etc.), positioning type, and computed box model dimensions (margins, paddings, borders).

#### `inspect_page_structure`
Generates a clean, readable DOM hierarchy tree focusing on meaningful semantic elements.
- **Inputs:**
  - `root_selector` *(string, optional)*: Root selector (default: `"body"`)
  - `max_depth` *(number, optional)*: Depth of tree (default: `4`)
  - `filter_semantic_only` *(boolean, optional)*: Filters out unstyled wrapper `div`s (default: `true`)

---

### C. Responsive Testing & Breakpoints

#### `test_responsiveness` *(Core Feature)*
Runs an automated multi-viewport test across standard device presets:

| Category | Width | Height | Type |
|---|---:|---:|---|
| **Small mobile** | 320px | 720px | Mobile / Touch |
| **Mobile** | 375px | 812px | Mobile / Touch |
| **Large mobile** | 430px | 932px | Mobile / Touch |
| **Tablet** | 768px | 1024px | Tablet / Touch |
| **Small laptop** | 1024px | 768px | Desktop |
| **Desktop** | 1440px | 900px | Desktop |
| **Large desktop** | 1920px | 1080px | Desktop |

For every viewport:
1. Resizes browser viewport.
2. Waits for CSS transitions and layout stabilization.
3. Checks for horizontal page overflow (`scrollWidth > viewportWidth`).
4. Identifies clipped content and unconstrained elements.
5. Evaluates navigation behavior (desktop horizontal vs mobile hamburger vs stacked links).
6. Detects interactive element collisions.
7. Captures a viewport screenshot saved to `output/responsive-tests/`.
- **Output:** Structured report per viewport, overall status (`PASS`, `WARNING`, `FAIL`), critical issue counts, and actionable remediation recommendations.

#### `detect_overflow`
Pinpoints elements breaking the horizontal or vertical bounding box.
- **Inputs:**
  - `selector` *(string, optional)*: Optional selector to scope detection
- **Output:** List of issues categorizing `page-horizontal`, `element-overflow`, `fixed-width-hazard`, `media-overflow`, and `text-clipping` with exact measurements and CSS fix suggestions.

#### `inspect_breakpoints`
Probes how page layout adapts across widths (320px to 1920px).
- **Inputs:**
  - `key_widths` *(array of numbers, optional)*: Custom widths to test
  - `inspect_css_media_queries` *(boolean, optional)*: Queries accessible stylesheet `@media` rules
- **Output:** Layout transformation log (navigation transforms, column changes, revealed/hidden elements) and discovered CSS `@media` rules.

#### `inspect_element_responsiveness`
Tracks how a single component (e.g., hero banner, navigation bar, card) scales across screen widths.
- **Inputs:**
  - `selector` *(string, required)*: Component selector
  - `viewports` *(array, optional)*: Custom viewports

---

### D. Visual Comparison & Screenshots

#### `compare_viewports`
Captures multi-device screenshots (Mobile 375px, Tablet 768px, Desktop 1440px) and performs layout difference and pixel diff analysis.
- **Inputs:**
  - `url` *(string, optional)*: Target URL
  - `viewports` *(array, optional)*: Viewport presets
  - `run_pixel_diff` *(boolean, optional)*: Generates pixel diff image via `pixelmatch` (default: `true`)
- **Output:** Screenshot paths, element shift and stacking analysis, diff image path, mismatched pixel count, and percentage.

#### `capture_screenshot`
Captures viewport, full-page, or element-scoped screenshots.
- **Inputs:**
  - `type` *(string)*: `"viewport"`, `"fullPage"`, or `"element"` (default: `"viewport"`)
  - `selector` *(string, optional)*: Required if type is `"element"`
  - `width` / `height` *(number, optional)*: Custom dimensions
  - `filename_prefix` *(string, optional)*: Custom prefix
- **Output:** Existing file path, width, height, file size in bytes, and timestamp.

---

### E. Layout Audit

#### `audit_layout`
Audits the page for layout defects and produces a scored health report.
- **Inputs:**
  - `selector` *(string, optional)*: Scope selector
- **Output:**
  - `score`: 0 to 100 overall layout health score.
  - `findingsCount`: Breakdown of `Critical`, `High`, `Medium`, `Low`, and `Informational` issues.
  - `findings`: Evidence-based issues detailing selector, tag, bounding boxes, and concrete fixes.

---

### F. Console & Network Diagnostics

#### `inspect_console`
Retrieves intercepted console logs.
- **Inputs:**
  - `level` *(string)*: `"all"`, `"error"`, `"warn"`, or `"info"`
  - `clear` *(boolean)*: Clears buffer after reading

#### `inspect_network`
Retrieves intercepted network requests.
- **Inputs:**
  - `failed_only` *(boolean)*: Only return failed / 4xx / 5xx requests (default: `true`)
  - `clear` *(boolean)*: Clears network buffer after reading

---

## Organized Output Structure

All artifacts generated by ViewportIQ are organized under the `output/` directory:

```
output/
├── screenshots/          # Single-shot viewport, full-page, or element captures
│   └── shot_example_com_1440x900_1794555833208.png
├── responsive-tests/     # Per-viewport responsive sweep screenshots
│   └── resp_example_com_Mobile_375x812_1794555833706.png
├── comparisons/          # Visual comparison diff images
│   └── diff_example_com_375vs1440_1794555835058.png
└── reports/              # Persistent JSON reports for AI ingestion
    ├── report_responsive_suite_example_com_1794555833481.json
    └── report_layout_audit_example_com_1794555833025.json
```

All paths returned to MCP clients are validated to exist on disk.

---

## Practical Workflow Examples

Here is how frontend developers can interact with ViewportIQ via an AI assistant:

### 1. "Open https://example.com and check whether it works on mobile."
The AI assistant invokes `open_page` followed by `test_responsiveness`:
```json
// Tool Call: test_responsiveness
{
  "viewports": [
    { "name": "Mobile", "width": 375, "height": 812 }
  ]
}
```
*AI Explains:*
> "At 375px mobile, your page fails responsiveness with 425px of horizontal overflow. The `.hero-container` has a rigid `width: 800px` without `max-width: 100%`, forcing horizontal scroll on mobile devices."

---

### 2. "Inspect the hero section and explain why the image is overflowing."
The AI invokes `inspect_element` and `inspect_styles`:
```json
// Tool Call: inspect_element
{ "selector": ".hero img" }
```
*AI Explains:*
> "The image has a `naturalWidth` of 1600px and rendered width of 1600px inside a 375px container. Its computed CSS shows `max-width: none`. Add `max-width: 100%; height: auto; display: block;` to make it fluid."

---

### 3. "Compare this website at 375px, 768px, and 1440px."
The AI invokes `compare_viewports`:
```json
// Tool Call: compare_viewports
{
  "viewports": [
    { "name": "Mobile", "width": 375, "height": 812 },
    { "name": "Tablet", "width": 768, "height": 1024 },
    { "name": "Desktop", "width": 1440, "height": 900 }
  ]
}
```
*AI Explains:*
> "Between mobile (375px) and desktop (1440px), the layout undergoes significant restructuring (68.4% visual variance). The navigation collapses from horizontal links into a hamburger toggle, and the 3-column product grid stacks into a single column below 768px."

---

### 4. "Check the browser console for JavaScript errors."
The AI invokes `inspect_console`:
```json
// Tool Call: inspect_console
{ "level": "error" }
```
*AI Explains:*
> "Found 1 uncaught JavaScript exception: `TypeError: Cannot read properties of undefined (reading 'initSlider')` originating from `app.js:142`."

---

## Automated Test Suite & Fixtures

ViewportIQ includes 6 realistic HTML fixtures and 24 automated unit and integration tests:

### Test Fixtures (`fixtures/`)
1. **`responsive-clean.html`**: Fully responsive layout with fluid grid, auto-fitting cards, and zero overflow.
2. **`horizontal-overflow.html`**: Layout with fixed 1200px container triggering mobile overflow.
3. **`oversized-image.html`**: Layout with an unconstrained 1400px image bleeding out of its container.
4. **`text-clipping.html`**: Fixed-height card with `overflow: hidden` cutting off text.
5. **`broken-mobile-nav.html`**: Desktop navbar set to 850px without wrapping or mobile toggle.
6. **`overlapping-elements.html`**: Badly positioned absolute badge colliding with CTA buttons.

### Running the Tests
```bash
npm run test
```
Outputs:
```
 ✓ tests/browser-navigation.test.ts (2 tests)
 ✓ tests/console-network.test.ts (2 tests)
 ✓ tests/dom-inspection.test.ts (4 tests)
 ✓ tests/layout-audit.test.ts (2 tests)
 ✓ tests/mcp-server.test.ts (5 tests)
 ✓ tests/responsive-overflow.test.ts (6 tests)
 ✓ tests/visual-comparison.test.ts (3 tests)

 Test Files  7 passed (7)
      Tests  24 passed (24)
```

---

## Troubleshooting & Best Practices

1. **STDIO Protocol Integrity:**
   Never log using `console.log` in custom tool implementations. `stdout` is exclusively reserved for JSON-RPC messages in STDIO mode. Always use `logger.info()`, `logger.warn()`, or `logger.error()`, which route to `stderr`.

2. **Windows Certificate / Proxy Configuration:**
   If running behind a corporate network or proxy on Windows, launch Node with `--use-system-ca`:
   ```bash
   NODE_OPTIONS="--use-system-ca" node dist/index.js
   ```

3. **Chromium Sandboxing on Linux/Containers:**
   ViewportIQ launches Chromium with `--no-sandbox` and `--disable-dev-shm-usage` by default, ensuring compatibility in Docker or CI environments.

---

## Roadmap

- [x] STDIO Transport support
- [x] 7-preset automated responsive sweeps
- [x] Visual pixel diffing via Pixelmatch
- [x] DOM semantic hierarchy & heading audits
- [x] Layout health score calculation
- [ ] SSE (Server-Sent Events) and Stream transport for remote server deployments
- [ ] Web Vitals inspection (LCP, CLS, FID) integration
- [ ] Dark/Light mode theme contrast comparison

---

## License

MIT © ViewportIQ Contributors
