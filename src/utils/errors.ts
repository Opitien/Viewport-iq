export class ViewportIQError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'ViewportIQError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ViewportIQError.prototype);
  }
}

export class NavigationError extends ViewportIQError {
  constructor(message: string, details?: any) {
    super(message, 'NAVIGATION_ERROR', details);
    this.name = 'NavigationError';
  }
}

export class ElementNotFoundError extends ViewportIQError {
  constructor(selector: string) {
    super(`Element matching selector "${selector}" was not found in the DOM.`, 'ELEMENT_NOT_FOUND', { selector });
    this.name = 'ElementNotFoundError';
  }
}

export class PageNotOpenError extends ViewportIQError {
  constructor() {
    super('No active page is open. Call "open_page" first before inspecting or testing.', 'PAGE_NOT_OPEN');
    this.name = 'PageNotOpenError';
  }
}

export class BrowserCrashError extends ViewportIQError {
  constructor(message: string, details?: any) {
    super(`Browser instance error: ${message}`, 'BROWSER_CRASH', details);
    this.name = 'BrowserCrashError';
  }
}

export function formatErrorResponse(error: unknown): {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
} {
  if (error instanceof ViewportIQError) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'error',
              code: error.code,
              message: error.message,
              details: error.details,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            status: 'error',
            code: 'UNEXPECTED_ERROR',
            message,
          },
          null,
          2
        ),
      },
    ],
  };
}
