/**
 * ConsoleTransport - Console log transport implementation
 *
 * Implements ILogTransport for console output with support for
 * JSON and pretty-printed formats with optional colors.
 *
 * @module logging/transports
 */

import { BaseTransport } from './BaseTransport.js';
import type { TransportLogEntry, ConsoleTransportConfig, LogLevel } from './types.js';

/**
 * ANSI color codes for console output
 */
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

/**
 * Color mapping for log levels
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: COLORS.gray,
  INFO: COLORS.blue,
  WARN: COLORS.yellow,
  ERROR: COLORS.red,
};

/**
 * Console log transport implementation
 *
 * Supports two output formats:
 * - 'json': Structured JSON output for log aggregation tools
 * - 'pretty': Human-readable format with optional colors
 *
 * @example
 * ```typescript
 * const transport = new ConsoleTransport({
 *   type: 'console',
 *   format: 'pretty',
 *   colors: true,
 *   includeTimestamp: true,
 * });
 *
 * await transport.initialize();
 * await transport.log({
 *   timestamp: new Date(),
 *   level: 'INFO',
 *   message: 'Application started',
 *   context: {},
 * });
 * ```
 */
export class ConsoleTransport extends BaseTransport {
  /**
   * Output format: 'json' or 'pretty'
   */
  private readonly format: 'json' | 'pretty';

  /**
   * Whether to use colors in pretty format
   */
  private readonly colors: boolean;

  /**
   * Whether to include timestamp in pretty format
   */
  private readonly includeTimestamp: boolean;

  /**
   * Create a new ConsoleTransport instance
   *
   * @param config - Console transport configuration
   */
  constructor(config: ConsoleTransportConfig = { type: 'console' }) {
    super('console', {
      ...config,
      // Console transport typically doesn't need batching
      enableBatching: config.enableBatching ?? false,
    });

    this.format = config.format ?? 'pretty';
    this.colors = config.colors ?? this.isTTY();
    this.includeTimestamp = config.includeTimestamp ?? true;
  }

  /**
   * Check if stdout is a TTY (supports colors)
   */
  private isTTY(): boolean {
    return process.stdout.isTTY ?? false;
  }

  /**
   * Initialize the console transport
   *
   * No initialization needed for console output.
   */
  protected async doInitialize(): Promise<void> {
    // Console transport needs no initialization
  }

  /**
   * Log entries to console
   *
   * @param entries - Log entries to output
   */
  protected async doLog(entries: TransportLogEntry[]): Promise<void> {
    for (const entry of entries) {
      const output = this.formatEntry(entry);
      this.writeToConsole(entry.level, output);
    }
  }

  /**
   * Flush console output
   *
   * Console output is synchronous, no flush needed.
   */
  protected async doFlush(): Promise<void> {
    // Console is synchronous, nothing to flush
  }

  /**
   * Close the console transport
   *
   * Nothing to close for console.
   */
  protected async doClose(): Promise<void> {
    // Nothing to close for console
  }

  /**
   * Format a log entry for output
   */
  private formatEntry(entry: TransportLogEntry): string {
    if (this.format === 'json') {
      return this.formatAsJson(entry);
    }
    return this.formatAsPretty(entry);
  }

  /**
   * Format entry as JSON
   */
  private formatAsJson(entry: TransportLogEntry): string {
    const jsonEntry: Record<string, unknown> = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
    };

    // Add optional fields
    if (entry.correlationId !== undefined) {
      jsonEntry['correlationId'] = entry.correlationId;
    }
    if (entry.agentId !== undefined) {
      jsonEntry['agentId'] = entry.agentId;
    }
    if (entry.traceId !== undefined) {
      jsonEntry['traceId'] = entry.traceId;
    }
    if (entry.spanId !== undefined) {
      jsonEntry['spanId'] = entry.spanId;
    }
    if (entry.parentSpanId !== undefined) {
      jsonEntry['parentSpanId'] = entry.parentSpanId;
    }
    if (entry.stage !== undefined) {
      jsonEntry['stage'] = entry.stage;
    }
    if (entry.projectId !== undefined) {
      jsonEntry['projectId'] = entry.projectId;
    }
    if (entry.sessionId !== undefined) {
      jsonEntry['sessionId'] = entry.sessionId;
    }
    if (entry.durationMs !== undefined) {
      jsonEntry['durationMs'] = entry.durationMs;
    }
    if (entry.error !== undefined) {
      jsonEntry['error'] = entry.error;
    }
    if (entry.source !== undefined) {
      jsonEntry['source'] = entry.source;
    }
    if (entry.hostname !== undefined) {
      jsonEntry['hostname'] = entry.hostname;
    }
    if (entry.pid !== undefined) {
      jsonEntry['pid'] = entry.pid;
    }
    if (Object.keys(entry.context).length > 0) {
      jsonEntry['context'] = entry.context;
    }

    return JSON.stringify(jsonEntry);
  }

  /**
   * Format entry as pretty-printed output
   */
  private formatAsPretty(entry: TransportLogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.includeTimestamp) {
      const time = entry.timestamp.toISOString().substring(11, 23);
      if (this.colors) {
        parts.push(`${COLORS.dim}${time}${COLORS.reset}`);
      } else {
        parts.push(time);
      }
    }

    // Level
    const levelStr = entry.level.padEnd(5);
    if (this.colors) {
      const color = LEVEL_COLORS[entry.level];
      parts.push(`${color}${levelStr}${COLORS.reset}`);
    } else {
      parts.push(levelStr);
    }

    // Agent
    if (entry.agentId !== undefined) {
      if (this.colors) {
        parts.push(`${COLORS.cyan}[${entry.agentId}]${COLORS.reset}`);
      } else {
        parts.push(`[${entry.agentId}]`);
      }
    }

    // Stage
    if (entry.stage !== undefined) {
      if (this.colors) {
        parts.push(`${COLORS.dim}(${entry.stage})${COLORS.reset}`);
      } else {
        parts.push(`(${entry.stage})`);
      }
    }

    // Message
    parts.push(entry.message);

    // Duration
    if (entry.durationMs !== undefined) {
      if (this.colors) {
        parts.push(`${COLORS.dim}${entry.durationMs}ms${COLORS.reset}`);
      } else {
        parts.push(`${entry.durationMs}ms`);
      }
    }

    // Context (if not empty)
    if (Object.keys(entry.context).length > 0) {
      const contextStr = JSON.stringify(entry.context);
      if (this.colors) {
        parts.push(`${COLORS.dim}${contextStr}${COLORS.reset}`);
      } else {
        parts.push(contextStr);
      }
    }

    const mainLine = parts.join(' ');

    // Add error stack if present
    if (entry.error?.stack !== undefined) {
      const stackLines = entry.error.stack
        .split('\n')
        .map((line) => (this.colors ? `${COLORS.red}${line}${COLORS.reset}` : line))
        .join('\n');
      return `${mainLine}\n${stackLines}`;
    }

    return mainLine;
  }

  /**
   * Write output to console based on log level
   */
  private writeToConsole(level: LogLevel, output: string): void {
    switch (level) {
      case 'ERROR':
        console.error(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }
}
