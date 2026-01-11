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
 * import { ILogTransport, BaseTransport, TransportLogEntry } from './logging';
 *
 * // Use existing transports or create custom ones
 * class CustomTransport extends BaseTransport {
 *   // Implementation
 * }
 * ```
 */

// Export all transport-related types and classes
export * from './transports/index.js';
