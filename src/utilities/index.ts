/**
 * Utilities - Shared Utilities and Infrastructure
 *
 * Every utility export of `./core.ts`, plus the `Monitoring` namespace,
 * which loads the monitoring subsystem (optional per ADR-0006; also
 * available as the `ad-sdlc/monitoring` entry point).
 *
 * @packageDocumentation
 */

export * from './core.js';

// Re-export monitoring module (using namespace to avoid conflicts)
export * as Monitoring from '../monitoring/index.js';
