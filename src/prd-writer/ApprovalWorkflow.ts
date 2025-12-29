/**
 * ApprovalWorkflow - User approval workflow for PRD documents
 *
 * Implements the Human-in-the-Loop pattern for document approval,
 * allowing users to review, approve, request changes, or reject
 * generated PRD documents before proceeding to the next stage.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getScratchpad } from '../scratchpad/index.js';
import { getStateManager, type StateManager } from '../state-manager/index.js';
import type { ProjectState } from '../state-manager/types.js';
import type {
  ApprovalWorkflowConfig,
  ApprovalRequest,
  ApprovalResult,
  ApprovalDecision,
  ApprovalHistoryEntry,
  ApprovalStatus,
  ApprovableDocument,
  PRDRevision,
  PRDMetadata,
} from './types.js';
import {
  DocumentNotFoundError,
  FeedbackRequiredError,
  StateTransitionError,
  FileWriteError,
} from './errors.js';

/**
 * Default configuration for ApprovalWorkflow
 */
const DEFAULT_CONFIG: Required<ApprovalWorkflowConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  approvedDocsPath: 'docs',
  requireFeedbackOnReject: true,
  requireFeedbackOnChanges: true,
};

/**
 * Approval history file name
 */
const APPROVAL_HISTORY_FILE = '_approval_history.json';

/**
 * Internal approval history storage structure
 */
interface ApprovalHistoryStorage {
  projectId: string;
  documentType: ApprovableDocument;
  entries: ApprovalHistoryEntry[];
  revisions: PRDRevision[];
  attemptCount: number;
}

/**
 * Map document types to project states
 */
const DOCUMENT_STATE_MAP: Record<ApprovableDocument, { drafting: ProjectState; approved: ProjectState }> = {
  prd: { drafting: 'prd_drafting', approved: 'prd_approved' },
  srs: { drafting: 'srs_drafting', approved: 'srs_approved' },
  sds: { drafting: 'sds_drafting', approved: 'sds_approved' },
};

/**
 * ApprovalWorkflow class for managing document approval
 */
export class ApprovalWorkflow {
  private readonly config: Required<ApprovalWorkflowConfig>;
  private readonly stateManager: StateManager;

  constructor(config: ApprovalWorkflowConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stateManager = getStateManager({ basePath: this.config.scratchpadBasePath });
  }

  /**
   * Request approval for a document
   *
   * @param projectId - Project identifier
   * @param documentType - Type of document to approve
   * @returns Approval request with document content
   */
  public async requestApproval(
    projectId: string,
    documentType: ApprovableDocument
  ): Promise<ApprovalRequest> {
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    const documentPath = scratchpad.getDocumentPath(projectId, documentType);

    // Check if document exists
    const exists = await scratchpad.exists(documentPath);
    if (!exists) {
      throw new DocumentNotFoundError(projectId, documentType);
    }

    // Read document content
    const content = await scratchpad.readMarkdown(documentPath);
    if (content === null) {
      throw new DocumentNotFoundError(projectId, documentType);
    }

    // Get or create metadata
    const metadata = this.getDocumentMetadata(projectId, documentType);

    const now = new Date().toISOString();

    return {
      projectId,
      documentType,
      documentPath,
      content,
      metadata,
      requestedAt: now,
    };
  }

  /**
   * Process an approval decision
   *
   * @param projectId - Project identifier
   * @param documentType - Type of document being approved
   * @param decision - The approval decision
   * @param feedback - Optional feedback (required for some decisions)
   * @param approver - Optional approver identifier
   * @returns Approval result
   */
  public async processApproval(
    projectId: string,
    documentType: ApprovableDocument,
    decision: ApprovalDecision,
    feedback?: string,
    approver?: string
  ): Promise<ApprovalResult> {
    // Validate feedback requirements
    this.validateFeedback(decision, feedback);

    const now = new Date().toISOString();

    // Create history entry
    const metadata = this.getDocumentMetadata(projectId, documentType);
    const historyEntry: ApprovalHistoryEntry = {
      id: randomUUID(),
      projectId,
      documentType,
      documentVersion: metadata.version,
      decision,
      feedback,
      timestamp: now,
      approver,
    };

    // Update approval history
    await this.addHistoryEntry(projectId, documentType, historyEntry);

    // Handle decision
    switch (decision) {
      case 'approve':
        await this.handleApprove(projectId, documentType);
        break;
      case 'request_changes':
        await this.handleRequestChanges(projectId, documentType, feedback ?? '');
        break;
      case 'reject':
        await this.handleReject(projectId, documentType);
        break;
    }

    return {
      approved: decision === 'approve',
      decision,
      feedback,
      timestamp: now,
      approver,
    };
  }

  /**
   * Get current approval status for a document
   *
   * @param projectId - Project identifier
   * @param documentType - Type of document
   * @returns Approval status
   */
  public async getApprovalStatus(
    projectId: string,
    documentType: ApprovableDocument
  ): Promise<ApprovalStatus> {
    const history = await this.getApprovalHistory(projectId, documentType);

    const latestEntry = history.entries[0];
    let state: ApprovalStatus['state'] = 'pending';

    if (latestEntry !== undefined) {
      switch (latestEntry.decision) {
        case 'approve':
          state = 'approved';
          break;
        case 'request_changes':
          state = 'changes_requested';
          break;
        case 'reject':
          state = 'rejected';
          break;
      }
    }

    return {
      projectId,
      documentType,
      state,
      latestEntry,
      attemptCount: history.attemptCount,
      revisions: history.revisions,
    };
  }

  /**
   * Get approval history for a document
   *
   * @param projectId - Project identifier
   * @param documentType - Type of document
   * @returns Approval history storage
   */
  public async getApprovalHistory(
    projectId: string,
    documentType: ApprovableDocument
  ): Promise<ApprovalHistoryStorage> {
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    const historyPath = this.getHistoryPath(projectId, documentType);

    const history = await scratchpad.readJson<ApprovalHistoryStorage>(historyPath, {
      allowMissing: true,
    });

    if (history === null) {
      return {
        projectId,
        documentType,
        entries: [],
        revisions: [],
        attemptCount: 0,
      };
    }

    return history;
  }

  /**
   * Validate feedback based on decision
   */
  private validateFeedback(decision: ApprovalDecision, feedback?: string): void {
    const hasFeedback = feedback !== undefined && feedback.trim().length > 0;

    if (decision === 'reject' && this.config.requireFeedbackOnReject && !hasFeedback) {
      throw new FeedbackRequiredError('reject');
    }

    if (decision === 'request_changes' && this.config.requireFeedbackOnChanges && !hasFeedback) {
      throw new FeedbackRequiredError('request_changes');
    }
  }

  /**
   * Handle approve decision
   */
  private async handleApprove(
    projectId: string,
    documentType: ApprovableDocument
  ): Promise<void> {
    const stateConfig = DOCUMENT_STATE_MAP[documentType];

    // Transition project state
    try {
      const currentState = await this.stateManager.getCurrentState(projectId);

      // Only transition if in drafting state
      if (currentState === stateConfig.drafting) {
        await this.stateManager.transitionState(projectId, stateConfig.approved);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new StateTransitionError(
          projectId,
          stateConfig.drafting,
          stateConfig.approved,
          error.message
        );
      }
      throw error;
    }

    // Copy approved document to public docs
    await this.copyToPublicDocs(projectId, documentType);
  }

  /**
   * Handle request_changes decision
   */
  private async handleRequestChanges(
    projectId: string,
    documentType: ApprovableDocument,
    feedback: string
  ): Promise<void> {
    // Record revision request
    const history = await this.getApprovalHistory(projectId, documentType);
    const metadata = this.getDocumentMetadata(projectId, documentType);

    const revision: PRDRevision = {
      version: metadata.version,
      timestamp: new Date().toISOString(),
      changes: [],
      feedback,
    };

    const updatedHistory: ApprovalHistoryStorage = {
      ...history,
      revisions: [revision, ...history.revisions],
    };

    await this.saveApprovalHistory(projectId, documentType, updatedHistory);

    // Project state remains in drafting - no transition needed
  }

  /**
   * Handle reject decision
   */
  private async handleReject(
    projectId: string,
    _documentType: ApprovableDocument
  ): Promise<void> {
    // Transition to cancelled state
    try {
      await this.stateManager.transitionState(projectId, 'cancelled');
    } catch (error) {
      // If transition fails, just log - rejection is still recorded in history
      console.warn(`Could not transition project ${projectId} to cancelled state:`, error);
    }
  }

  /**
   * Copy approved document to public docs directory
   */
  private async copyToPublicDocs(
    projectId: string,
    documentType: ApprovableDocument
  ): Promise<void> {
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    const sourcePath = scratchpad.getDocumentPath(projectId, documentType);
    const content = await scratchpad.readMarkdown(sourcePath);

    if (content === null) {
      throw new DocumentNotFoundError(projectId, documentType);
    }

    const destDir = path.join(this.config.approvedDocsPath, documentType);
    const destPath = path.join(destDir, `${documentType.toUpperCase()}-${projectId}.md`);

    try {
      await fs.promises.mkdir(destDir, { recursive: true });
      await fs.promises.writeFile(destPath, content, 'utf8');
    } catch (error) {
      throw new FileWriteError(destPath, String(error));
    }
  }

  /**
   * Get document metadata
   */
  private getDocumentMetadata(
    projectId: string,
    documentType: ApprovableDocument
  ): PRDMetadata {
    const now = new Date().toISOString();

    // Return basic metadata - in real implementation, would read from document
    return {
      documentId: `${documentType.toUpperCase()}-${projectId}`,
      version: '1.0.0',
      status: 'Draft',
      createdAt: now,
      updatedAt: now,
      projectId,
      productName: `Project ${projectId}`,
    };
  }

  /**
   * Get approval history file path
   */
  private getHistoryPath(projectId: string, documentType: ApprovableDocument): string {
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    return path.join(
      scratchpad.getProjectPath('documents', projectId),
      `${documentType}${APPROVAL_HISTORY_FILE}`
    );
  }

  /**
   * Add entry to approval history
   */
  private async addHistoryEntry(
    projectId: string,
    documentType: ApprovableDocument,
    entry: ApprovalHistoryEntry
  ): Promise<void> {
    const history = await this.getApprovalHistory(projectId, documentType);

    const updatedHistory: ApprovalHistoryStorage = {
      ...history,
      entries: [entry, ...history.entries],
      attemptCount: history.attemptCount + 1,
    };

    await this.saveApprovalHistory(projectId, documentType, updatedHistory);
  }

  /**
   * Save approval history
   */
  private async saveApprovalHistory(
    projectId: string,
    documentType: ApprovableDocument,
    history: ApprovalHistoryStorage
  ): Promise<void> {
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    const historyPath = this.getHistoryPath(projectId, documentType);

    await scratchpad.writeJson(historyPath, history);
  }
}

/**
 * Singleton instance for global access
 */
let globalApprovalWorkflow: ApprovalWorkflow | null = null;

/**
 * Get or create the global ApprovalWorkflow instance
 *
 * @param config - Configuration options
 * @returns The global ApprovalWorkflow instance
 */
export function getApprovalWorkflow(config?: ApprovalWorkflowConfig): ApprovalWorkflow {
  if (globalApprovalWorkflow === null) {
    globalApprovalWorkflow = new ApprovalWorkflow(config);
  }
  return globalApprovalWorkflow;
}

/**
 * Reset the global ApprovalWorkflow instance (for testing)
 */
export function resetApprovalWorkflow(): void {
  globalApprovalWorkflow = null;
}
