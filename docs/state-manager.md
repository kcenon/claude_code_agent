# State Manager

High-level state management for AD-SDLC projects with state transition validation, history tracking, watch mode, and concurrent access handling.

## Overview

The State Manager provides a structured way to manage project state throughout the AD-SDLC lifecycle. It builds on top of the Scratchpad module to provide:

- **State Transitions**: Validated state machine for project lifecycle
- **History Tracking**: Versioned state changes with rollback capability
- **Watch Mode**: Real-time notifications for state changes
- **File Locking**: Safe concurrent access to state files

## Installation

The State Manager is included in the main package:

```typescript
import { StateManager, getStateManager } from 'ad-sdlc';
```

## Quick Start

```typescript
import { StateManager } from 'ad-sdlc';

// Create a state manager instance
const stateManager = new StateManager({
  basePath: '.ad-sdlc/scratchpad',
  enableLocking: true,
  enableHistory: true,
});

// Initialize a new project
const summary = await stateManager.initializeProject('001', 'My Project');
console.log(summary.currentState); // 'collecting'

// Transition to next state
await stateManager.transitionState('001', 'clarifying');

// Set state data
await stateManager.setState('info', '001', {
  requirements: ['FR-001', 'FR-002'],
  constraints: ['CON-001'],
});

// Get state data
const state = await stateManager.getState('info', '001');
console.log(state.value);
```

## State Lifecycle

Projects follow a defined state machine:

```
COLLECTING → CLARIFYING → PRD_DRAFTING → PRD_APPROVED →
SRS_DRAFTING → SRS_APPROVED → SDS_DRAFTING → SDS_APPROVED →
ISSUES_CREATING → ISSUES_CREATED → IMPLEMENTING → PR_REVIEW → MERGED
                                                               ↓
                         (any state) ─────────────────→ CANCELLED
```

### Valid Transitions

| From State | Valid Transitions |
|------------|------------------|
| collecting | clarifying, prd_drafting, cancelled |
| clarifying | collecting, prd_drafting, cancelled |
| prd_drafting | prd_approved, collecting, cancelled |
| prd_approved | srs_drafting, prd_drafting, cancelled |
| srs_drafting | srs_approved, prd_approved, cancelled |
| srs_approved | sds_drafting, srs_drafting, cancelled |
| sds_drafting | sds_approved, srs_approved, cancelled |
| sds_approved | issues_creating, sds_drafting, cancelled |
| issues_creating | issues_created, sds_approved, cancelled |
| issues_created | implementing, issues_creating, cancelled |
| implementing | pr_review, issues_created, cancelled |
| pr_review | merged, implementing, cancelled |
| merged | (none - terminal state) |
| cancelled | (none - terminal state) |

## API Reference

### StateManager

#### Constructor Options

```typescript
interface StateManagerOptions {
  basePath?: string;        // Default: '.ad-sdlc/scratchpad'
  enableLocking?: boolean;  // Default: true
  lockTimeout?: number;     // Default: 5000 (ms)
  enableHistory?: boolean;  // Default: true
  maxHistoryEntries?: number; // Default: 50
}
```

#### Project Management

```typescript
// Initialize a new project
await stateManager.initializeProject(
  projectId: string,
  name: string,
  initialState?: ProjectState  // Default: 'collecting'
): Promise<ProjectStateSummary>

// Check if project exists
await stateManager.projectExists(projectId: string): Promise<boolean>

// Delete project and all state
await stateManager.deleteProject(projectId: string): Promise<void>

// Get project summary
await stateManager.getProjectSummary(projectId: string): Promise<ProjectStateSummary>
```

#### State Operations

```typescript
// Get state for a section
await stateManager.getState<T>(
  section: ScratchpadSection,
  projectId: string,
  options?: ReadStateOptions
): Promise<StateWithMetadata<T> | null>

// Set state (full replacement)
await stateManager.setState<T>(
  section: ScratchpadSection,
  projectId: string,
  data: T,
  options?: UpdateOptions
): Promise<void>

// Update state (partial merge)
await stateManager.updateState<T>(
  section: ScratchpadSection,
  projectId: string,
  updates: Partial<T>,
  options?: UpdateOptions
): Promise<void>
```

#### State Transitions

```typescript
// Transition to a new state
await stateManager.transitionState(
  projectId: string,
  toState: ProjectState
): Promise<TransitionResult>

// Get current state
await stateManager.getCurrentState(projectId: string): Promise<ProjectState>

// Check if transition is valid
stateManager.isValidTransition(from: ProjectState, to: ProjectState): boolean

// Get valid transitions from a state
stateManager.getValidTransitions(from: ProjectState): readonly ProjectState[]
```

#### History

```typescript
// Get state history
await stateManager.getHistory<T>(
  section: ScratchpadSection,
  projectId: string
): Promise<StateHistory<T> | null>
```

#### Watch Mode

```typescript
// Watch for state changes
stateManager.watchState<T>(
  projectId: string,
  callback: StateChangeCallback<T>,
  section?: ScratchpadSection
): StateWatcher

// StateWatcher provides unsubscribe method
const watcher = stateManager.watchState('001', (event) => {
  console.log('State changed:', event);
});

// Stop watching
watcher.unsubscribe();
```

## Error Handling

The State Manager provides specific error types:

```typescript
import {
  StateManagerError,      // Base error class
  InvalidTransitionError, // Invalid state transition
  StateNotFoundError,     // State not found
  ProjectNotFoundError,   // Project not found
  ProjectExistsError,     // Project already exists
  StateValidationError,   // Validation failed
  LockAcquisitionError,   // Could not acquire lock
  HistoryError,           // History operation failed
  WatchError,             // Watch operation failed
} from 'ad-sdlc';

try {
  await stateManager.transitionState('001', 'merged');
} catch (error) {
  if (error instanceof InvalidTransitionError) {
    console.log(`Cannot transition from ${error.fromState} to ${error.toState}`);
  }
}
```

## Examples

### Complete Workflow

```typescript
const stateManager = new StateManager();

// 1. Initialize project
await stateManager.initializeProject('001', 'E-commerce Platform');

// 2. Collect requirements
await stateManager.setState('info', '001', {
  requirements: [
    { id: 'FR-001', title: 'User Authentication' },
    { id: 'FR-002', title: 'Product Catalog' },
  ],
});

// 3. Progress through states
await stateManager.transitionState('001', 'prd_drafting');
await stateManager.transitionState('001', 'prd_approved');
await stateManager.transitionState('001', 'srs_drafting');

// 4. Track history
const history = await stateManager.getHistory('progress', '001');
console.log(`${history.entries.length} state changes recorded`);
```

### Watch Mode

```typescript
// Set up watcher
const watcher = stateManager.watchState('001', (event) => {
  console.log(`Section ${event.section} changed at ${event.timestamp}`);
  console.log('New value:', event.newValue);
}, 'info');

// Make changes (will trigger callback)
await stateManager.setState('info', '001', { updated: true });

// Clean up
watcher.unsubscribe();
```

### Concurrent Access

```typescript
const manager = new StateManager({
  enableLocking: true,
  lockTimeout: 5000,
});

// Safe concurrent writes
await Promise.all([
  manager.setState('info', '001', { worker: 1 }),
  manager.setState('info', '001', { worker: 2 }),
  manager.setState('info', '001', { worker: 3 }),
]);
```

## Singleton Usage

For simple use cases, use the singleton pattern:

```typescript
import { getStateManager, resetStateManager } from 'ad-sdlc';

// Get or create singleton instance
const manager = getStateManager();

// Reset singleton (useful for testing)
resetStateManager();
```

## Integration with Scratchpad

The State Manager uses Scratchpad internally for file operations:

```typescript
const stateManager = new StateManager();

// Access underlying Scratchpad
const scratchpad = stateManager.getScratchpad();

// Use Scratchpad directly for advanced operations
const path = scratchpad.getCollectedInfoPath('001');
```

## Best Practices

1. **Always check project exists** before operations
2. **Use proper error handling** for all async operations
3. **Enable history** for debugging and audit trails
4. **Use watch mode sparingly** - file watchers consume resources
5. **Call cleanup()** when done to release resources

## Related

- [Scratchpad](./scratchpad.md) - Low-level file operations
- [Schema Validation](./validation.md) - Data validation with Zod
