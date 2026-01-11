[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / Scratchpad

# Class: Scratchpad

Defined in: [src/scratchpad/Scratchpad.ts:150](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L150)

Scratchpad implementation for file-based state sharing

## Constructors

### Constructor

> **new Scratchpad**(`options`): `Scratchpad`

Defined in: [src/scratchpad/Scratchpad.ts:163](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L163)

#### Parameters

##### options

[`ScratchpadOptions`](../interfaces/ScratchpadOptions.md) = `{}`

#### Returns

`Scratchpad`

## Methods

### getBasePath()

> **getBasePath**(): `string`

Defined in: [src/scratchpad/Scratchpad.ts:211](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L211)

Get the base scratchpad directory path

#### Returns

`string`

Absolute path to scratchpad directory

***

### getSectionPath()

> **getSectionPath**(`section`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:221](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L221)

Get path to a section directory

#### Parameters

##### section

[`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Scratchpad section

#### Returns

`string`

Absolute path to section directory

***

### getProjectPath()

> **getProjectPath**(`section`, `projectId`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:232](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L232)

Get path to a project directory within a section

#### Parameters

##### section

[`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Scratchpad section

##### projectId

`string`

Project identifier

#### Returns

`string`

Absolute path to project directory

***

### getCollectedInfoPath()

> **getCollectedInfoPath**(`projectId`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:242](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L242)

Get path to collected info file

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`string`

Path to collected_info.yaml

***

### getDocumentPath()

> **getDocumentPath**(`projectId`, `docType`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:253](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L253)

Get path to a document file

#### Parameters

##### projectId

`string`

Project identifier

##### docType

[`DocumentType`](../type-aliases/DocumentType.md)

Document type (prd, srs, sds)

#### Returns

`string`

Path to document file

***

### getIssueListPath()

> **getIssueListPath**(`projectId`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:263](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L263)

Get path to issue list file

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`string`

Path to issue_list.json

***

### getDependencyGraphPath()

> **getDependencyGraphPath**(`projectId`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:273](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L273)

Get path to dependency graph file

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`string`

Path to dependency_graph.json

***

### getControllerStatePath()

> **getControllerStatePath**(`projectId`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:283](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L283)

Get path to controller state file

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`string`

Path to controller_state.yaml

***

### getProgressSubsectionPath()

> **getProgressSubsectionPath**(`projectId`, `subsection`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:294](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L294)

Get path to progress subsection directory

#### Parameters

##### projectId

`string`

Project identifier

##### subsection

[`ProgressSubsection`](../type-aliases/ProgressSubsection.md)

Progress subsection

#### Returns

`string`

Path to subsection directory

***

### getWorkOrderPath()

> **getWorkOrderPath**(`projectId`, `orderId`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:305](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L305)

Get path to a work order file

#### Parameters

##### projectId

`string`

Project identifier

##### orderId

`string`

Work order identifier

#### Returns

`string`

Path to work order file

***

### getResultPath()

> **getResultPath**(`projectId`, `orderId`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:316](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L316)

Get path to an implementation result file

#### Parameters

##### projectId

`string`

Project identifier

##### orderId

`string`

Work order identifier

#### Returns

`string`

Path to result file

***

### getReviewPath()

> **getReviewPath**(`projectId`, `reviewId`): `string`

Defined in: [src/scratchpad/Scratchpad.ts:327](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L327)

Get path to a review file

#### Parameters

##### projectId

`string`

Project identifier

##### reviewId

`string`

Review identifier

#### Returns

`string`

Path to review file

***

### generateProjectId()

> **generateProjectId**(): `Promise`\<`string`\>

Defined in: [src/scratchpad/Scratchpad.ts:340](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L340)

Generate a new unique project ID

#### Returns

`Promise`\<`string`\>

New project ID (format: XXX where X is 0-9)

***

### generateProjectIdSync()

> **generateProjectIdSync**(): `string`

Defined in: [src/scratchpad/Scratchpad.ts:354](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L354)

Generate a new unique project ID (synchronous)

#### Returns

`string`

New project ID

***

### listProjectIds()

> **listProjectIds**(): `Promise`\<`string`[]\>

Defined in: [src/scratchpad/Scratchpad.ts:368](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L368)

List all existing project IDs

#### Returns

`Promise`\<`string`[]\>

Array of project IDs

***

### listProjectIdsSync()

> **listProjectIdsSync**(): `string`[]

Defined in: [src/scratchpad/Scratchpad.ts:383](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L383)

List all existing project IDs (synchronous)

#### Returns

`string`[]

Array of project IDs

***

### initializeProject()

> **initializeProject**(`projectId`, `name`): `Promise`\<[`ProjectInfo`](../interfaces/ProjectInfo.md)\>

Defined in: [src/scratchpad/Scratchpad.ts:400](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L400)

Initialize a new project with all required directories

#### Parameters

##### projectId

`string`

Project identifier

##### name

`string`

Project name

#### Returns

`Promise`\<[`ProjectInfo`](../interfaces/ProjectInfo.md)\>

Project info

***

### atomicWrite()

> **atomicWrite**(`filePath`, `content`, `options`): `Promise`\<`void`\>

Defined in: [src/scratchpad/Scratchpad.ts:441](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L441)

Write content atomically (write to temp file, then rename)

#### Parameters

##### filePath

`string`

Target file path

##### content

`string`

Content to write

##### options

[`AtomicWriteOptions`](../interfaces/AtomicWriteOptions.md) = `{}`

Write options

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if path escapes project root

***

### atomicWriteSync()

> **atomicWriteSync**(`filePath`, `content`, `options`): `void`

Defined in: [src/scratchpad/Scratchpad.ts:483](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L483)

Write content atomically (synchronous)

#### Parameters

##### filePath

`string`

Target file path

##### content

`string`

Content to write

##### options

[`AtomicWriteOptions`](../interfaces/AtomicWriteOptions.md) = `{}`

Write options

#### Returns

`void`

#### Throws

PathTraversalError if path escapes project root

***

### ensureDir()

> **ensureDir**(`dirPath`): `Promise`\<`void`\>

Defined in: [src/scratchpad/Scratchpad.ts:518](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L518)

Ensure a directory exists, creating it if necessary

#### Parameters

##### dirPath

`string`

Directory path

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if path escapes project root

***

### ensureDirSync()

> **ensureDirSync**(`dirPath`): `void`

Defined in: [src/scratchpad/Scratchpad.ts:529](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L529)

Ensure a directory exists (synchronous)

#### Parameters

##### dirPath

`string`

Directory path

#### Returns

`void`

#### Throws

PathTraversalError if path escapes project root

***

### acquireLock()

> **acquireLock**(`filePath`, `holderId?`, `options?`): `Promise`\<`boolean`\>

Defined in: [src/scratchpad/Scratchpad.ts:642](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L642)

Acquire a lock on a file using atomic operations

This implementation uses the atomic rename pattern to prevent
TOCTOU (Time-of-Check-Time-of-Use) race conditions:

1. Write lock info to a temporary file
2. Attempt atomic rename to the lock file
3. If rename fails (lock exists), check if expired and try to steal
4. Retry with exponential backoff on contention

#### Parameters

##### filePath

`string`

File to lock

##### holderId?

`string`

Lock holder identifier

##### options?

`LockOptions`

Lock acquisition options

#### Returns

`Promise`\<`boolean`\>

True if lock acquired, throws LockContentionError on max retries

#### Throws

PathTraversalError if path escapes project root

#### Throws

LockContentionError if lock cannot be acquired after retries

***

### releaseLock()

> **releaseLock**(`filePath`, `holderId?`): `Promise`\<`void`\>

Defined in: [src/scratchpad/Scratchpad.ts:774](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L774)

Release a lock on a file

#### Parameters

##### filePath

`string`

File to unlock

##### holderId?

`string`

Lock holder identifier (optional, releases if matches)

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if path escapes project root

***

### isReleaseRequested()

> **isReleaseRequested**(`filePath`, `holderId`): `Promise`\<`boolean`\>

Defined in: [src/scratchpad/Scratchpad.ts:917](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L917)

Check if a release request exists for a lock

Lock holders can call this periodically to check if another
process is waiting for the lock and release it gracefully.

#### Parameters

##### filePath

`string`

File path (not lock path)

##### holderId

`string`

Current lock holder ID

#### Returns

`Promise`\<`boolean`\>

True if a release is being requested for this holder

#### Throws

PathTraversalError if path escapes project root

***

### withLock()

> **withLock**\<`T`\>(`filePath`, `fn`, `options?`): `Promise`\<`T`\>

Defined in: [src/scratchpad/Scratchpad.ts:1003](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1003)

Execute a function with file lock

Automatically acquires the lock before executing the function
and releases it afterward, even if the function throws.

#### Type Parameters

##### T

`T`

#### Parameters

##### filePath

`string`

File to lock

##### fn

() => `Promise`\<`T`\>

Function to execute while holding the lock

##### options?

Lock options (holderId, retryAttempts, retryDelayMs)

`string` | `LockOptions`

#### Returns

`Promise`\<`T`\>

Result of function

#### Throws

LockContentionError if lock cannot be acquired

***

### readYaml()

> **readYaml**\<`T`\>(`filePath`, `options`): `Promise`\<`T` \| `null`\>

Defined in: [src/scratchpad/Scratchpad.ts:1037](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1037)

Read and parse a YAML file

#### Type Parameters

##### T

`T`

#### Parameters

##### filePath

`string`

Path to YAML file

##### options

[`ReadOptions`](../interfaces/ReadOptions.md) = `{}`

Read options

#### Returns

`Promise`\<`T` \| `null`\>

Parsed YAML content

#### Throws

PathTraversalError if path escapes project root

***

### readYamlSync()

> **readYamlSync**\<`T`\>(`filePath`, `options`): `T` \| `null`

Defined in: [src/scratchpad/Scratchpad.ts:1060](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1060)

Read and parse a YAML file (synchronous)

#### Type Parameters

##### T

`T`

#### Parameters

##### filePath

`string`

Path to YAML file

##### options

[`ReadOptions`](../interfaces/ReadOptions.md) = `{}`

Read options

#### Returns

`T` \| `null`

Parsed YAML content

#### Throws

PathTraversalError if path escapes project root

***

### writeYaml()

> **writeYaml**\<`T`\>(`filePath`, `data`, `options`): `Promise`\<`void`\>

Defined in: [src/scratchpad/Scratchpad.ts:1082](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1082)

Write data as YAML file

#### Type Parameters

##### T

`T`

#### Parameters

##### filePath

`string`

Path to YAML file

##### data

`T`

Data to write

##### options

[`AtomicWriteOptions`](../interfaces/AtomicWriteOptions.md) = `{}`

Write options

#### Returns

`Promise`\<`void`\>

***

### writeYamlSync()

> **writeYamlSync**\<`T`\>(`filePath`, `data`, `options`): `void`

Defined in: [src/scratchpad/Scratchpad.ts:1102](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1102)

Write data as YAML file (synchronous)

#### Type Parameters

##### T

`T`

#### Parameters

##### filePath

`string`

Path to YAML file

##### data

`T`

Data to write

##### options

[`AtomicWriteOptions`](../interfaces/AtomicWriteOptions.md) = `{}`

Write options

#### Returns

`void`

***

### readJson()

> **readJson**\<`T`\>(`filePath`, `options`): `Promise`\<`T` \| `null`\>

Defined in: [src/scratchpad/Scratchpad.ts:1123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1123)

Read and parse a JSON file

#### Type Parameters

##### T

`T`

#### Parameters

##### filePath

`string`

Path to JSON file

##### options

[`ReadOptions`](../interfaces/ReadOptions.md) = `{}`

Read options

#### Returns

`Promise`\<`T` \| `null`\>

Parsed JSON content

#### Throws

PathTraversalError if path escapes project root

***

### readJsonSync()

> **readJsonSync**\<`T`\>(`filePath`, `options`): `T` \| `null`

Defined in: [src/scratchpad/Scratchpad.ts:1146](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1146)

Read and parse a JSON file (synchronous)

#### Type Parameters

##### T

`T`

#### Parameters

##### filePath

`string`

Path to JSON file

##### options

[`ReadOptions`](../interfaces/ReadOptions.md) = `{}`

Read options

#### Returns

`T` \| `null`

Parsed JSON content

#### Throws

PathTraversalError if path escapes project root

***

### writeJson()

> **writeJson**\<`T`\>(`filePath`, `data`, `options`): `Promise`\<`void`\>

Defined in: [src/scratchpad/Scratchpad.ts:1168](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1168)

Write data as JSON file

#### Type Parameters

##### T

`T`

#### Parameters

##### filePath

`string`

Path to JSON file

##### data

`T`

Data to write

##### options

[`AtomicWriteOptions`](../interfaces/AtomicWriteOptions.md) = `{}`

Write options

#### Returns

`Promise`\<`void`\>

***

### writeJsonSync()

> **writeJsonSync**\<`T`\>(`filePath`, `data`, `options`): `void`

Defined in: [src/scratchpad/Scratchpad.ts:1184](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1184)

Write data as JSON file (synchronous)

#### Type Parameters

##### T

`T`

#### Parameters

##### filePath

`string`

Path to JSON file

##### data

`T`

Data to write

##### options

[`AtomicWriteOptions`](../interfaces/AtomicWriteOptions.md) = `{}`

Write options

#### Returns

`void`

***

### readMarkdown()

> **readMarkdown**(`filePath`, `options`): `Promise`\<`string` \| `null`\>

Defined in: [src/scratchpad/Scratchpad.ts:1203](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1203)

Read a Markdown file

#### Parameters

##### filePath

`string`

Path to Markdown file

##### options

[`ReadOptions`](../interfaces/ReadOptions.md) = `{}`

Read options

#### Returns

`Promise`\<`string` \| `null`\>

Markdown content

#### Throws

PathTraversalError if path escapes project root

***

### readMarkdownSync()

> **readMarkdownSync**(`filePath`, `options`): `string` \| `null`

Defined in: [src/scratchpad/Scratchpad.ts:1225](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1225)

Read a Markdown file (synchronous)

#### Parameters

##### filePath

`string`

Path to Markdown file

##### options

[`ReadOptions`](../interfaces/ReadOptions.md) = `{}`

Read options

#### Returns

`string` \| `null`

Markdown content

#### Throws

PathTraversalError if path escapes project root

***

### writeMarkdown()

> **writeMarkdown**(`filePath`, `content`, `options`): `Promise`\<`void`\>

Defined in: [src/scratchpad/Scratchpad.ts:1246](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1246)

Write a Markdown file

#### Parameters

##### filePath

`string`

Path to Markdown file

##### content

`string`

Markdown content

##### options

[`AtomicWriteOptions`](../interfaces/AtomicWriteOptions.md) = `{}`

Write options

#### Returns

`Promise`\<`void`\>

***

### writeMarkdownSync()

> **writeMarkdownSync**(`filePath`, `content`, `options`): `void`

Defined in: [src/scratchpad/Scratchpad.ts:1261](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1261)

Write a Markdown file (synchronous)

#### Parameters

##### filePath

`string`

Path to Markdown file

##### content

`string`

Markdown content

##### options

[`AtomicWriteOptions`](../interfaces/AtomicWriteOptions.md) = `{}`

Write options

#### Returns

`void`

***

### exists()

> **exists**(`filePath`): `Promise`\<`boolean`\>

Defined in: [src/scratchpad/Scratchpad.ts:1280](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1280)

Check if a file exists

#### Parameters

##### filePath

`string`

Path to check

#### Returns

`Promise`\<`boolean`\>

True if file exists

#### Throws

PathTraversalError if path escapes project root

***

### existsSync()

> **existsSync**(`filePath`): `boolean`

Defined in: [src/scratchpad/Scratchpad.ts:1297](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1297)

Check if a file exists (synchronous)

#### Parameters

##### filePath

`string`

Path to check

#### Returns

`boolean`

True if file exists

#### Throws

PathTraversalError if path escapes project root

***

### deleteFile()

> **deleteFile**(`filePath`): `Promise`\<`void`\>

Defined in: [src/scratchpad/Scratchpad.ts:1313](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1313)

Delete a file

#### Parameters

##### filePath

`string`

Path to delete

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if path escapes project root

***

### deleteFileSync()

> **deleteFileSync**(`filePath`): `void`

Defined in: [src/scratchpad/Scratchpad.ts:1324](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1324)

Delete a file (synchronous)

#### Parameters

##### filePath

`string`

Path to delete

#### Returns

`void`

#### Throws

PathTraversalError if path escapes project root

***

### cleanup()

> **cleanup**(): `Promise`\<`void`\>

Defined in: [src/scratchpad/Scratchpad.ts:1332](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1332)

Clean up all active locks and pending release requests

#### Returns

`Promise`\<`void`\>

***

### cleanupSync()

> **cleanupSync**(): `void`

Defined in: [src/scratchpad/Scratchpad.ts:1358](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/Scratchpad.ts#L1358)

Clean up all active locks (synchronous)

#### Returns

`void`
