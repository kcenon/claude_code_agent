[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StateManager

# Class: StateManager

Defined in: [src/state-manager/StateManager.ts:70](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L70)

StateManager class for managing project state lifecycle

This class serves as a Facade, coordinating multiple focused modules:
- StateMachine: Handles state transition rules and validation
- StatePersistence: Manages file I/O and locking
- StateHistoryManager: Tracks state history and checkpoints
- StateWatcherManager: Handles file watching and notifications
- StateRecovery: Manages recovery operations

## Constructors

### Constructor

> **new StateManager**(`options`): `StateManager`

Defined in: [src/state-manager/StateManager.ts:81](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L81)

#### Parameters

##### options

[`StateManagerOptions`](../interfaces/StateManagerOptions.md) = `{}`

#### Returns

`StateManager`

## Methods

### initializeProject()

> **initializeProject**(`projectId`, `name`, `initialState`): `Promise`\<[`ProjectStateSummary`](../interfaces/ProjectStateSummary.md)\>

Defined in: [src/state-manager/StateManager.ts:125](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L125)

Initialize a new project with all required state structures

#### Parameters

##### projectId

`string`

Unique project identifier

##### name

`string`

Project name

##### initialState

[`ProjectState`](../type-aliases/ProjectState.md) = `'collecting'`

Initial project state (default: 'collecting')

#### Returns

`Promise`\<[`ProjectStateSummary`](../interfaces/ProjectStateSummary.md)\>

Project info

***

### projectExists()

> **projectExists**(`projectId`): `Promise`\<`boolean`\>

Defined in: [src/state-manager/StateManager.ts:155](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L155)

Check if a project exists

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<`boolean`\>

True if project exists

***

### deleteProject()

> **deleteProject**(`projectId`): `Promise`\<`void`\>

Defined in: [src/state-manager/StateManager.ts:164](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L164)

Delete a project and all its state

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<`void`\>

***

### getState()

> **getState**\<`T`\>(`section`, `projectId`, `options`): `Promise`\<[`StateWithMetadata`](../interfaces/StateWithMetadata.md)\<`T`\> \| `null`\>

Defined in: [src/state-manager/StateManager.ts:184](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L184)

Get state for a section

#### Type Parameters

##### T

`T`

#### Parameters

##### section

[`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Scratchpad section

##### projectId

`string`

Project identifier

##### options

[`ReadStateOptions`](../interfaces/ReadStateOptions.md) = `{}`

Read options

#### Returns

`Promise`\<[`StateWithMetadata`](../interfaces/StateWithMetadata.md)\<`T`\> \| `null`\>

State value or null if missing and allowMissing is true

***

### setState()

> **setState**\<`T`\>(`section`, `projectId`, `data`, `options`): `Promise`\<`void`\>

Defined in: [src/state-manager/StateManager.ts:212](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L212)

Set state for a section (full replacement)

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### section

[`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Scratchpad section

##### projectId

`string`

Project identifier

##### data

`T`

State data to write

##### options

[`UpdateOptions`](../interfaces/UpdateOptions.md) = `{}`

Update options

#### Returns

`Promise`\<`void`\>

***

### updateState()

> **updateState**\<`T`\>(`section`, `projectId`, `updates`, `options`): `Promise`\<`void`\>

Defined in: [src/state-manager/StateManager.ts:249](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L249)

Update state for a section (partial update/merge)

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### section

[`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Scratchpad section

##### projectId

`string`

Project identifier

##### updates

`Partial`\<`T`\>

Partial state updates

##### options

[`UpdateOptions`](../interfaces/UpdateOptions.md) = `{}`

Update options

#### Returns

`Promise`\<`void`\>

***

### transitionState()

> **transitionState**(`projectId`, `toState`): `Promise`\<[`TransitionResult`](../interfaces/TransitionResult.md)\>

Defined in: [src/state-manager/StateManager.ts:288](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L288)

Transition project to a new state

#### Parameters

##### projectId

`string`

Project identifier

##### toState

[`ProjectState`](../type-aliases/ProjectState.md)

Target state

#### Returns

`Promise`\<[`TransitionResult`](../interfaces/TransitionResult.md)\>

Transition result

***

### isValidTransition()

> **isValidTransition**(`from`, `to`): `boolean`

Defined in: [src/state-manager/StateManager.ts:334](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L334)

Check if a state transition is valid

#### Parameters

##### from

[`ProjectState`](../type-aliases/ProjectState.md)

Source state

##### to

[`ProjectState`](../type-aliases/ProjectState.md)

Target state

#### Returns

`boolean`

True if transition is valid

***

### getValidTransitions()

> **getValidTransitions**(`from`): readonly [`ProjectState`](../type-aliases/ProjectState.md)[]

Defined in: [src/state-manager/StateManager.ts:344](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L344)

Get allowed transitions from a state

#### Parameters

##### from

[`ProjectState`](../type-aliases/ProjectState.md)

Source state

#### Returns

readonly [`ProjectState`](../type-aliases/ProjectState.md)[]

Array of valid target states

***

### getCurrentState()

> **getCurrentState**(`projectId`): `Promise`\<[`ProjectState`](../type-aliases/ProjectState.md)\>

Defined in: [src/state-manager/StateManager.ts:354](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L354)

Get current project state

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`ProjectState`](../type-aliases/ProjectState.md)\>

Current project state

***

### getProjectSummary()

> **getProjectSummary**(`projectId`): `Promise`\<[`ProjectStateSummary`](../interfaces/ProjectStateSummary.md)\>

Defined in: [src/state-manager/StateManager.ts:365](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L365)

Get project state summary

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`ProjectStateSummary`](../interfaces/ProjectStateSummary.md)\>

Project state summary

***

### getHistory()

> **getHistory**\<`T`\>(`section`, `projectId`): `Promise`\<[`StateHistory`](../interfaces/StateHistory.md)\<`T`\> \| `null`\>

Defined in: [src/state-manager/StateManager.ts:394](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L394)

Get state history for a section

#### Type Parameters

##### T

`T`

#### Parameters

##### section

[`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Scratchpad section

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`StateHistory`](../interfaces/StateHistory.md)\<`T`\> \| `null`\>

State history or null if not found

***

### watchState()

> **watchState**\<`T`\>(`projectId`, `callback`, `section?`): [`StateWatcher`](../interfaces/StateWatcher.md)

Defined in: [src/state-manager/StateManager.ts:413](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L413)

Watch for state changes

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### projectId

`string`

Project identifier

##### callback

[`StateChangeCallback`](../type-aliases/StateChangeCallback.md)\<`T`\>

Callback for state changes

##### section?

[`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Optional section to watch (null for all)

#### Returns

[`StateWatcher`](../interfaces/StateWatcher.md)

State watcher handle

***

### createCheckpoint()

> **createCheckpoint**(`projectId`, `trigger`, `reason?`): `Promise`\<`string`\>

Defined in: [src/state-manager/StateManager.ts:433](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L433)

Create a checkpoint for the current project state

#### Parameters

##### projectId

`string`

Project identifier

##### trigger

`CheckpointTrigger` = `'manual'`

What triggered this checkpoint

##### reason?

`string`

Optional reason for the checkpoint

#### Returns

`Promise`\<`string`\>

Checkpoint ID

***

### getCheckpoints()

> **getCheckpoints**(`projectId`): `Promise`\<`StateCheckpoint`[]\>

Defined in: [src/state-manager/StateManager.ts:501](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L501)

Get all available checkpoints for a project

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<`StateCheckpoint`[]\>

List of checkpoints (newest first)

***

### restoreCheckpoint()

> **restoreCheckpoint**(`projectId`, `checkpointId`): `Promise`\<`RestoreResult`\>

Defined in: [src/state-manager/StateManager.ts:517](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L517)

Restore project state from a checkpoint

#### Parameters

##### projectId

`string`

Project identifier

##### checkpointId

`string`

Checkpoint ID to restore

#### Returns

`Promise`\<`RestoreResult`\>

Restore result

***

### skipTo()

> **skipTo**(`projectId`, `targetState`, `options`): `Promise`\<`SkipResult`\>

Defined in: [src/state-manager/StateManager.ts:533](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L533)

Skip forward to a target state, bypassing intermediate stages

#### Parameters

##### projectId

`string`

Project identifier

##### targetState

[`ProjectState`](../type-aliases/ProjectState.md)

Target state to skip to

##### options

`SkipOptions`

Skip options

#### Returns

`Promise`\<`SkipResult`\>

Skip result

***

### getStagesBetween()

> **getStagesBetween**(`from`, `to`): [`ProjectState`](../type-aliases/ProjectState.md)[]

Defined in: [src/state-manager/StateManager.ts:548](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L548)

Get the stages between two states in the pipeline

#### Parameters

##### from

[`ProjectState`](../type-aliases/ProjectState.md)

Starting state

##### to

[`ProjectState`](../type-aliases/ProjectState.md)

Target state

#### Returns

[`ProjectState`](../type-aliases/ProjectState.md)[]

Array of states between from and to (exclusive)

***

### isStageRequired()

> **isStageRequired**(`state`): `boolean`

Defined in: [src/state-manager/StateManager.ts:558](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L558)

Check if a stage is required

#### Parameters

##### state

[`ProjectState`](../type-aliases/ProjectState.md)

State to check

#### Returns

`boolean`

True if the stage is required

***

### getSkipOptions()

> **getSkipOptions**(`from`): readonly [`ProjectState`](../type-aliases/ProjectState.md)[]

Defined in: [src/state-manager/StateManager.ts:568](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L568)

Get skip-to options for a state

#### Parameters

##### from

[`ProjectState`](../type-aliases/ProjectState.md)

Current state

#### Returns

readonly [`ProjectState`](../type-aliases/ProjectState.md)[]

Array of states that can be skipped to

***

### adminOverride()

> **adminOverride**(`projectId`, `override`): `Promise`\<[`TransitionResult`](../interfaces/TransitionResult.md)\>

Defined in: [src/state-manager/StateManager.ts:583](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L583)

Perform an admin override operation

#### Parameters

##### projectId

`string`

Project identifier

##### override

`AdminOverride`

Override specification

#### Returns

`Promise`\<[`TransitionResult`](../interfaces/TransitionResult.md)\>

Transition result

***

### recoverTo()

> **recoverTo**(`projectId`, `toState`, `reason?`): `Promise`\<[`TransitionResult`](../interfaces/TransitionResult.md)\>

Defined in: [src/state-manager/StateManager.ts:599](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L599)

Perform a recovery transition (go back to a previous state)

#### Parameters

##### projectId

`string`

Project identifier

##### toState

[`ProjectState`](../type-aliases/ProjectState.md)

Target recovery state

##### reason?

`string`

Reason for recovery

#### Returns

`Promise`\<[`TransitionResult`](../interfaces/TransitionResult.md)\>

Transition result

***

### getRecoveryOptions()

> **getRecoveryOptions**(`from`): readonly [`ProjectState`](../type-aliases/ProjectState.md)[]

Defined in: [src/state-manager/StateManager.ts:613](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L613)

Get recovery options for current state

#### Parameters

##### from

[`ProjectState`](../type-aliases/ProjectState.md)

Current state

#### Returns

readonly [`ProjectState`](../type-aliases/ProjectState.md)[]

Array of valid recovery states

***

### getEnhancedTransitionRule()

> **getEnhancedTransitionRule**(`state`): `EnhancedTransitionRule` \| `undefined`

Defined in: [src/state-manager/StateManager.ts:623](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L623)

Get the enhanced transition rule for a state

#### Parameters

##### state

[`ProjectState`](../type-aliases/ProjectState.md)

State to get rule for

#### Returns

`EnhancedTransitionRule` \| `undefined`

Enhanced transition rule or undefined

***

### getRecoveryAuditLog()

> **getRecoveryAuditLog**(`projectId`): `Promise`\<`RecoveryAuditEntry`[]\>

Defined in: [src/state-manager/StateManager.ts:637](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L637)

Get recovery audit log for a project

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<`RecoveryAuditEntry`[]\>

Array of audit entries (newest first)

***

### cleanup()

> **cleanup**(): `Promise`\<`void`\>

Defined in: [src/state-manager/StateManager.ts:653](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L653)

Clean up resources

#### Returns

`Promise`\<`void`\>

***

### getScratchpad()

> **getScratchpad**(): [`Scratchpad`](Scratchpad.md)

Defined in: [src/state-manager/StateManager.ts:664](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/StateManager.ts#L664)

Get the underlying scratchpad instance

#### Returns

[`Scratchpad`](Scratchpad.md)
