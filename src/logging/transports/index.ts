/**
 * Log Transports Module
 *
 * This module provides the transport layer abstraction for the logging system.
 * It includes the core interface, base implementation, and type definitions
 * for building pluggable log transport implementations.
 *
 * @module logging/transports
 *
 * @example
 * ```typescript
 * import {
 *   ILogTransport,
 *   BaseTransport,
 *   TransportLogEntry,
 *   ConsoleTransportConfig,
 * } from './logging/transports';
 *
 * class MyTransport extends BaseTransport {
 *   constructor(config: ConsoleTransportConfig) {
 *     super('my-transport', config);
 *   }
 *
 *   protected async doInitialize(): Promise<void> {}
 *   protected async doLog(entries: TransportLogEntry[]): Promise<void> {}
 *   protected async doFlush(): Promise<void> {}
 *   protected async doClose(): Promise<void> {}
 * }
 * ```
 */

// Core interface and types
export type { ILogTransport, TransportState, TransportHealth } from './ILogTransport.js';

// Base implementation
export { BaseTransport } from './BaseTransport.js';

// Transport implementations
export { ConsoleTransport } from './ConsoleTransport.js';
export { FileTransport } from './FileTransport.js';
export { ElasticsearchTransport } from './ElasticsearchTransport.js';
export { CloudWatchTransport } from './CloudWatchTransport.js';

// Type definitions
export type {
  LogLevel,
  ErrorInfo,
  TransportLogEntry,
  BaseTransportConfig,
  ConsoleTransportConfig,
  FileTransportConfig,
  ElasticsearchTransportConfig,
  CloudWatchTransportConfig,
  TransportConfig,
  BatchOperationType,
  BatchOperation,
  TransportFactoryConfig,
  MaskingPattern,
  TransportMetrics,
} from './types.js';

// Utility functions
export { LOG_LEVEL_PRIORITY, shouldLog } from './types.js';
