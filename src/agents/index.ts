/**
 * Agents - Agent Implementations
 *
 * Every agent export of `./core.ts`, plus the `Controller` namespace, which
 * loads the controller subsystem (optional per ADR-0006; also available as
 * the `ad-sdlc/controller` entry point).
 *
 * @packageDocumentation
 */

export * from './core.js';

// Controller - has conflicts with many modules (Priority, CircularDependencyError, DependencyEdge, etc.)
export * as Controller from '../controller/index.js';
