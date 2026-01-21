/**
 * AD-SDLC - Agent-Driven Software Development Lifecycle
 *
 * This is the main entry point that provides backward compatible exports
 * from the layered architecture. For better module organization, consider
 * importing directly from the specific layer entry points:
 *
 * - `@ad-sdlc/control-plane` - Orchestration and state management
 * - `@ad-sdlc/data-plane` - Data storage and persistence
 * - `@ad-sdlc/agents` - Agent implementations
 * - `@ad-sdlc/utilities` - Shared utilities
 *
 * @packageDocumentation
 */

// =============================================================================
// Control Plane - Orchestration and State Management
// =============================================================================
export * from './control-plane/index.js';

// =============================================================================
// Data Plane - Data Storage and Persistence
// =============================================================================
export * from './data-plane/index.js';

// Priority is exported with a different name to avoid conflict
export { PrioritySchema as ScratchpadPrioritySchema } from './scratchpad/index.js';
export type { Priority as ScratchpadPriority } from './scratchpad/index.js';

// =============================================================================
// Agents - Agent Implementations
// =============================================================================
export * from './agents/index.js';

// =============================================================================
// Utilities - Shared Utilities and Infrastructure
// =============================================================================
export * from './utilities/index.js';
