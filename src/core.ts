/**
 * AD-SDLC core entry point (`ad-sdlc/core`).
 *
 * The root entry minus the optional subsystems ADR-0006 accepted for
 * extraction: the `Monitoring` and `Controller` namespaces, the controller
 * re-exports of the control plane, and the ControlPlane and DataPlane
 * facades. Importing this entry loads none of those modules; import them
 * from `ad-sdlc/monitoring`, `ad-sdlc/controller`, `ad-sdlc/control-plane`,
 * or `ad-sdlc/data-plane`, or keep using the `ad-sdlc` compatibility root.
 * See docs/guides/package-entry-points.md.
 *
 * @packageDocumentation
 */

export * from './control-plane/core.js';

export * from './data-plane/core.js';

// Priority is exported with a different name to avoid conflict, as in the root entry
export { PrioritySchema as ScratchpadPrioritySchema } from './scratchpad/index.js';
export type { Priority as ScratchpadPriority } from './scratchpad/index.js';

export * from './agents/core.js';

export * from './utilities/core.js';
