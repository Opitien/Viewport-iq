export interface ViewportPreset {
  name: string;
  category: 'Small mobile' | 'Mobile' | 'Large mobile' | 'Tablet' | 'Small laptop' | 'Desktop' | 'Large desktop';
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export const DEFAULT_VIEWPORTS: ViewportPreset[] = [
  { name: 'Small mobile', category: 'Small mobile', width: 320, height: 720, isMobile: true, hasTouch: true },
  { name: 'Mobile', category: 'Mobile', width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: 'Large mobile', category: 'Large mobile', width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: 'Tablet', category: 'Tablet', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'Small laptop', category: 'Small laptop', width: 1024, height: 768, isMobile: false, hasTouch: false },
  { name: 'Desktop', category: 'Desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: 'Large desktop', category: 'Large desktop', width: 1920, height: 1080, isMobile: false, hasTouch: false },
];

export interface PageLoadInfo {
  url: string;
  finalUrl: string;
  title: string;
  status: number | null;
  statusText: string | null;
  loadTimeMs: number;
  viewport: { width: number; height: number };
}

export interface ElementInspectionResult {
  selector: string;
  tagName: string;
  id?: string;
  classList: string[];
  attributes: Record<string, string>;
  textContent: string;
  innerHTMLSnippet: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  } | null;
  computedStyles: Record<string, string>;
  visibility: {
    isVisible: boolean;
    isInViewport: boolean;
    display: string;
    visibility: string;
    opacity: string;
    pointerEvents: string;
    clipped: boolean;
  };
  parent?: {
    tagName: string;
    id?: string;
    classList: string[];
    display: string;
    width: number;
    height: number;
  } | null;
  childrenCount: number;
  relevantChildren: Array<{
    tagName: string;
    id?: string;
    classList: string[];
    textSnippet: string;
  }>;
}

export interface LandmarkInfo {
  role: string;
  tag: string;
  label?: string;
  selector: string;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}

export interface HeadingInfo {
  level: number;
  text: string;
  selector: string;
  isVisible: boolean;
}

export interface ImageInfo {
  src: string;
  alt: string;
  hasAlt: boolean;
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  isOversized: boolean;
  selector: string;
}

export interface LinkInfo {
  text: string;
  href: string;
  isExternal: boolean;
  hasAccessibleName: boolean;
  selector: string;
}

export interface ButtonInfo {
  text: string;
  accessibleName: string;
  hasAccessibleName: boolean;
  type: string;
  disabled: boolean;
  selector: string;
}

export interface FormInfo {
  id?: string;
  name?: string;
  action?: string;
  method?: string;
  inputCount: number;
  inputs: Array<{
    type: string;
    name?: string;
    id?: string;
    hasLabel: boolean;
    labelText?: string;
    required: boolean;
  }>;
  selector: string;
}

export interface PageInspectionSummary {
  title: string;
  url: string;
  viewportDimensions: { width: number; height: number };
  documentDimensions: { scrollWidth: number; scrollHeight: number; clientWidth: number; clientHeight: number };
  totalDomElements: number;
  landmarks: LandmarkInfo[];
  headings: HeadingInfo[];
  headingHierarchyValid: boolean;
  headingIssues: string[];
  images: {
    total: number;
    missingAlt: number;
    items: ImageInfo[];
  };
  links: {
    total: number;
    emptyNames: number;
    items: LinkInfo[];
  };
  buttons: {
    total: number;
    missingAccessibleNames: number;
    items: ButtonInfo[];
  };
  forms: FormInfo[];
  accessibilityNotices: string[];
}

export interface PageStructureNode {
  tag: string;
  id?: string;
  classes?: string[];
  role?: string;
  textSnippet?: string;
  children?: PageStructureNode[];
}

export interface OverflowIssue {
  type: 'page-horizontal' | 'element-overflow' | 'text-clipping' | 'media-overflow' | 'fixed-width-hazard';
  severity: 'critical' | 'high' | 'medium' | 'low';
  selector: string;
  tagName: string;
  elementWidth: number;
  containerWidth: number;
  overflowAmount: number;
  viewportWidth: number;
  explanation: string;
  suggestion: string;
}

export interface BreakpointObservation {
  viewportWidth: number;
  viewportName: string;
  navigationState: 'desktop-horizontal' | 'hamburger-mobile' | 'drawer' | 'hidden' | 'stacked' | 'unknown';
  columnCountEstimate?: number;
  flexDirection?: string;
  hiddenElements: string[];
  visibleElements: string[];
  observedChanges: string[];
}

export interface ResponsiveViewportReport {
  viewport: ViewportPreset;
  screenshotPath: string;
  hasHorizontalOverflow: boolean;
  scrollWidth: number;
  viewportWidth: number;
  overflowDelta: number;
  overflowIssues: OverflowIssue[];
  clippedElements: Array<{
    selector: string;
    tagName: string;
    scrollWidth: number;
    clientWidth: number;
    scrollHeight: number;
    clientHeight: number;
    reason: string;
  }>;
  layoutAssessments: {
    navigationType: string;
    navigationFunctional: boolean;
    overlappingElementPairs: Array<{
      selectorA: string;
      selectorB: string;
      overlapAreaPx: number;
      explanation: string;
    }>;
  };
  summary: string;
  grade: 'PASS' | 'WARNING' | 'FAIL';
}

export interface ResponsiveTestSuiteResult {
  url: string;
  testedAt: string;
  viewportsTested: number;
  overallStatus: 'PASS' | 'WARNING' | 'FAIL';
  viewportReports: ResponsiveViewportReport[];
  criticalIssuesCount: number;
  recommendations: string[];
}

export interface ViewportComparisonResult {
  url: string;
  comparedAt: string;
  viewports: Array<{
    preset: ViewportPreset;
    screenshotPath: string;
    domSnapshot: {
      documentWidth: number;
      documentHeight: number;
      elementsCount: number;
    };
  }>;
  layoutTransitions: Array<{
    from: string;
    to: string;
    changes: string[];
  }>;
  shiftingElements: Array<{
    selector: string;
    shiftType: 'repositioned' | 'resized' | 'hidden' | 'stacked';
    details: string;
  }>;
  visualDiff?: {
    diffScreenshotPath: string;
    mismatchedPixels: number;
    mismatchPercentage: number;
    interpretation: string;
  } | null;
  analysisSummary: string;
}

export interface LayoutAuditFinding {
  id: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
  category: 'Overflow' | 'Clipping' | 'Overlap' | 'Fixed Sizing' | 'Positioning' | 'Responsiveness';
  elementSelector: string;
  tagName: string;
  title: string;
  description: string;
  evidence: Record<string, any>;
  recommendation: string;
}

export interface LayoutAuditReport {
  url: string;
  viewport: { width: number; height: number };
  timestamp: string;
  score: number; // 0 to 100
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  findings: LayoutAuditFinding[];
}

export interface ConsoleEntry {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'trace';
  text: string;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  timestamp: string;
}

export interface NetworkEntry {
  id: string;
  url: string;
  method: string;
  resourceType: string;
  status: number | null;
  statusText: string | null;
  failed: boolean;
  failureReason?: string;
  durationMs?: number;
  timestamp: string;
}
