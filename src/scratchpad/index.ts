/**
 * Scratchpad module for file-based state sharing between agents
 *
 * This module implements the Scratchpad pattern that enables
 * inter-agent communication through structured file operations.
 *
 * @example
 * ```typescript
 * import { getScratchpad } from './scratchpad';
 *
 * const scratchpad = getScratchpad();
 * const projectId = await scratchpad.generateProjectId();
 *
 * // Write YAML data
 * await scratchpad.writeYaml(
 *   scratchpad.getCollectedInfoPath(projectId),
 *   { projectId, data: 'example' }
 * );
 * ```
 */

export { Scratchpad, getScratchpad, resetScratchpad } from './Scratchpad.js';

export type {
  ScratchpadSection,
  ProgressSubsection,
  DocumentType,
  FileFormat,
  ScratchpadOptions,
  ProjectInfo,
  CollectedInfo,
  ClarificationEntry,
  WorkOrder,
  WorkOrderContext,
  RelatedFile,
  DependencyStatus,
  ImplementationResult,
  FileChange,
  TestInfo,
  ControllerState,
  IssueQueue,
  WorkerStatus,
  FileLock,
  AtomicWriteOptions,
  ReadOptions,
} from './types.js';
