/**
 * Safe logger for ViewportIQ MCP Server.
 * CRITICAL: When using STDIO transport, stdout is reserved for JSON-RPC messages.
 * All logs MUST be directed to stderr to prevent protocol corruption.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private level: LogLevel = 'INFO';

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };
    return levels[level] >= levels[this.level];
  }

  private format(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[ViewportIQ][${timestamp}][${level}]`;
    if (data !== undefined) {
      try {
        let serialized = '';
        if (data instanceof Error) {
          serialized = `${data.name}: ${data.message}\n${data.stack || ''}`;
        } else if (typeof data === 'string') {
          serialized = data;
        } else {
          serialized = JSON.stringify(data, null, 2);
        }
        return `${prefix} ${message} ${serialized}`;
      } catch {
        return `${prefix} ${message} [Unserializable Object]`;
      }
    }
    return `${prefix} ${message}`;
  }

  public debug(message: string, data?: any): void {
    if (this.shouldLog('DEBUG')) {
      console.error(this.format('DEBUG', message, data));
    }
  }

  public info(message: string, data?: any): void {
    if (this.shouldLog('INFO')) {
      console.error(this.format('INFO', message, data));
    }
  }

  public warn(message: string, data?: any): void {
    if (this.shouldLog('WARN')) {
      console.error(this.format('WARN', message, data));
    }
  }

  public error(message: string, data?: any): void {
    if (this.shouldLog('ERROR')) {
      console.error(this.format('ERROR', message, data));
    }
  }
}

export const logger = new Logger();
