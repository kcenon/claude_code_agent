/**
 * Logging Module
 *
 * This module provides centralized logging infrastructure with support
 * for multiple transport destinations including console, file,
 * Elasticsearch, and CloudWatch.
 *
 * @module logging
 *
 * @example
 * ```typescript
 * import { Logger, getLogger, ConsoleTransport, FileTransport } from './logging';
 *
 * // Create a logger with multiple transports
 * const logger = new Logger({
 *   minLevel: 'INFO',
 *   transports: [
 *     { type: 'console', format: 'pretty', colors: true },
 *     { type: 'file', path: './logs' },
 *   ],
 * });
 *
 * await logger.initialize();
 * logger.info('Application started');
 * await logger.close();
 * ```
 */

// Export Logger class and utilities
export { Logger, getLogger, getLoggerFromEnv, resetLogger } from './Logger.js';

export type { LoggerConfig, EnvironmentConfig, LoggerState, LoggerHealth } from './Logger.js';

// Export all transport-related types and classes
export * from './transports/index.js';
