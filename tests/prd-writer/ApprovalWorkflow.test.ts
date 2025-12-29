import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ApprovalWorkflow,
  getApprovalWorkflow,
  resetApprovalWorkflow,
} from '../../src/prd-writer/ApprovalWorkflow.js';
import {
  DocumentNotFoundError,
  FeedbackRequiredError,
} from '../../src/prd-writer/errors.js';
import { resetStateManager } from '../../src/state-manager/index.js';
import { resetScratchpad } from '../../src/scratchpad/index.js';

describe('ApprovalWorkflow', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'prd-writer', 'test-approval-scratchpad');
  const testDocsPath = path.join(process.cwd(), 'tests', 'prd-writer', 'test-approval-docs');
  const testProjectId = '001';

  const samplePRDContent = `# PRD: Test Product

## Executive Summary
This is a test product.

## Functional Requirements

### FR-001: User Authentication
**Priority**: P0
**Description**: Users must be able to log in.

## Non-Functional Requirements

### NFR-001: Performance
**Category**: Performance
**Description**: Response time under 200ms
`;

  const cleanupTestEnvironment = async () => {
    try {
      await fs.promises.rm(testBasePath, { recursive: true });
    } catch {
      // Ignore
    }
    try {
      await fs.promises.rm(testDocsPath, { recursive: true });
    } catch {
      // Ignore
    }
  };

  const setupTestDocument = async () => {
    // Create project directories
    const docDir = path.join(testBasePath, 'documents', testProjectId);
    const progressDir = path.join(testBasePath, 'progress', testProjectId);

    await fs.promises.mkdir(docDir, { recursive: true });
    await fs.promises.mkdir(progressDir, { recursive: true });

    // Create PRD document
    const prdPath = path.join(docDir, 'prd.md');
    await fs.promises.writeFile(prdPath, samplePRDContent, 'utf8');

    // Create state meta file
    const metaPath = path.join(progressDir, '_state_meta.json');
    const meta = {
      currentState: 'prd_drafting',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(metaPath, JSON.stringify(meta), 'utf8');
  };

  beforeEach(async () => {
    resetApprovalWorkflow();
    resetStateManager();
    resetScratchpad();
    await cleanupTestEnvironment();
    await fs.promises.mkdir(testBasePath, { recursive: true });
    await fs.promises.mkdir(testDocsPath, { recursive: true });
  });

  afterEach(async () => {
    resetApprovalWorkflow();
    resetStateManager();
    resetScratchpad();
    await cleanupTestEnvironment();
  });

  describe('constructor', () => {
    it('should create workflow with default options', () => {
      const workflow = new ApprovalWorkflow();
      expect(workflow).toBeInstanceOf(ApprovalWorkflow);
    });

    it('should accept custom options', () => {
      const workflow = new ApprovalWorkflow({
        scratchpadBasePath: testBasePath,
        approvedDocsPath: testDocsPath,
        requireFeedbackOnReject: false,
      });
      expect(workflow).toBeInstanceOf(ApprovalWorkflow);
    });
  });

  describe('requestApproval', () => {
    it('should return approval request with document content', async () => {
      await setupTestDocument();

      const workflow = new ApprovalWorkflow({
        scratchpadBasePath: testBasePath,
        approvedDocsPath: testDocsPath,
      });

      const request = await workflow.requestApproval(testProjectId, 'prd');

      expect(request.projectId).toBe(testProjectId);
      expect(request.documentType).toBe('prd');
      expect(request.content).toContain('Test Product');
      expect(request.content).toContain('FR-001');
      expect(request.metadata.documentId).toBe(`PRD-${testProjectId}`);
      expect(request.requestedAt).toBeDefined();
    });

    it('should throw DocumentNotFoundError for non-existent document', async () => {
      const workflow = new ApprovalWorkflow({
        scratchpadBasePath: testBasePath,
        approvedDocsPath: testDocsPath,
      });

      await expect(workflow.requestApproval('999', 'prd')).rejects.toThrow(DocumentNotFoundError);
    });
  });

  describe('processApproval', () => {
    describe('approve decision', () => {
      it('should return approved result', async () => {
        await setupTestDocument();

        const workflow = new ApprovalWorkflow({
          scratchpadBasePath: testBasePath,
          approvedDocsPath: testDocsPath,
        });

        const result = await workflow.processApproval(testProjectId, 'prd', 'approve');

        expect(result.approved).toBe(true);
        expect(result.decision).toBe('approve');
        expect(result.timestamp).toBeDefined();
      });

      it('should copy document to public docs on approval', async () => {
        await setupTestDocument();

        const workflow = new ApprovalWorkflow({
          scratchpadBasePath: testBasePath,
          approvedDocsPath: testDocsPath,
        });

        await workflow.processApproval(testProjectId, 'prd', 'approve');

        const approvedPath = path.join(testDocsPath, 'prd', `PRD-${testProjectId}.md`);
        const exists = fs.existsSync(approvedPath);
        expect(exists).toBe(true);

        const content = await fs.promises.readFile(approvedPath, 'utf8');
        expect(content).toContain('Test Product');
      });

      it('should record approval in history', async () => {
        await setupTestDocument();

        const workflow = new ApprovalWorkflow({
          scratchpadBasePath: testBasePath,
          approvedDocsPath: testDocsPath,
        });

        await workflow.processApproval(testProjectId, 'prd', 'approve', undefined, 'test-user');

        const status = await workflow.getApprovalStatus(testProjectId, 'prd');
        expect(status.state).toBe('approved');
        expect(status.attemptCount).toBe(1);
        expect(status.latestEntry?.decision).toBe('approve');
        expect(status.latestEntry?.approver).toBe('test-user');
      });
    });

    describe('request_changes decision', () => {
      it('should require feedback when configured', async () => {
        await setupTestDocument();

        const workflow = new ApprovalWorkflow({
          scratchpadBasePath: testBasePath,
          approvedDocsPath: testDocsPath,
          requireFeedbackOnChanges: true,
        });

        await expect(
          workflow.processApproval(testProjectId, 'prd', 'request_changes')
        ).rejects.toThrow(FeedbackRequiredError);
      });

      it('should allow request_changes with feedback', async () => {
        await setupTestDocument();

        const workflow = new ApprovalWorkflow({
          scratchpadBasePath: testBasePath,
          approvedDocsPath: testDocsPath,
          requireFeedbackOnChanges: true,
        });

        const result = await workflow.processApproval(
          testProjectId,
          'prd',
          'request_changes',
          'Please add more details to FR-001'
        );

        expect(result.approved).toBe(false);
        expect(result.decision).toBe('request_changes');
        expect(result.feedback).toBe('Please add more details to FR-001');
      });

      it('should record revision in history', async () => {
        await setupTestDocument();

        const workflow = new ApprovalWorkflow({
          scratchpadBasePath: testBasePath,
          approvedDocsPath: testDocsPath,
        });

        await workflow.processApproval(
          testProjectId,
          'prd',
          'request_changes',
          'Add acceptance criteria'
        );

        const status = await workflow.getApprovalStatus(testProjectId, 'prd');
        expect(status.state).toBe('changes_requested');
        expect(status.revisions.length).toBeGreaterThan(0);
        expect(status.revisions[0].feedback).toBe('Add acceptance criteria');
      });
    });

    describe('reject decision', () => {
      it('should require feedback when configured', async () => {
        await setupTestDocument();

        const workflow = new ApprovalWorkflow({
          scratchpadBasePath: testBasePath,
          approvedDocsPath: testDocsPath,
          requireFeedbackOnReject: true,
        });

        await expect(
          workflow.processApproval(testProjectId, 'prd', 'reject')
        ).rejects.toThrow(FeedbackRequiredError);
      });

      it('should allow reject with feedback', async () => {
        await setupTestDocument();

        const workflow = new ApprovalWorkflow({
          scratchpadBasePath: testBasePath,
          approvedDocsPath: testDocsPath,
          requireFeedbackOnReject: true,
        });

        const result = await workflow.processApproval(
          testProjectId,
          'prd',
          'reject',
          'Requirements are incomplete'
        );

        expect(result.approved).toBe(false);
        expect(result.decision).toBe('reject');
        expect(result.feedback).toBe('Requirements are incomplete');
      });

      it('should not require feedback when disabled', async () => {
        await setupTestDocument();

        const workflow = new ApprovalWorkflow({
          scratchpadBasePath: testBasePath,
          approvedDocsPath: testDocsPath,
          requireFeedbackOnReject: false,
        });

        const result = await workflow.processApproval(testProjectId, 'prd', 'reject');

        expect(result.approved).toBe(false);
        expect(result.decision).toBe('reject');
      });
    });
  });

  describe('getApprovalStatus', () => {
    it('should return pending status for new documents', async () => {
      await setupTestDocument();

      const workflow = new ApprovalWorkflow({
        scratchpadBasePath: testBasePath,
        approvedDocsPath: testDocsPath,
      });

      const status = await workflow.getApprovalStatus(testProjectId, 'prd');

      expect(status.projectId).toBe(testProjectId);
      expect(status.documentType).toBe('prd');
      expect(status.state).toBe('pending');
      expect(status.attemptCount).toBe(0);
      expect(status.revisions).toEqual([]);
    });

    it('should track multiple approval attempts', async () => {
      await setupTestDocument();

      const workflow = new ApprovalWorkflow({
        scratchpadBasePath: testBasePath,
        approvedDocsPath: testDocsPath,
        requireFeedbackOnChanges: false,
      });

      // First attempt - request changes
      await workflow.processApproval(testProjectId, 'prd', 'request_changes', 'Need updates');

      // Second attempt - approve
      await workflow.processApproval(testProjectId, 'prd', 'approve');

      const status = await workflow.getApprovalStatus(testProjectId, 'prd');
      expect(status.attemptCount).toBe(2);
      expect(status.state).toBe('approved');
    });
  });

  describe('getApprovalHistory', () => {
    it('should return empty history for new documents', async () => {
      await setupTestDocument();

      const workflow = new ApprovalWorkflow({
        scratchpadBasePath: testBasePath,
        approvedDocsPath: testDocsPath,
      });

      const history = await workflow.getApprovalHistory(testProjectId, 'prd');

      expect(history.entries).toEqual([]);
      expect(history.revisions).toEqual([]);
      expect(history.attemptCount).toBe(0);
    });

    it('should maintain chronological order of entries', async () => {
      await setupTestDocument();

      const workflow = new ApprovalWorkflow({
        scratchpadBasePath: testBasePath,
        approvedDocsPath: testDocsPath,
        requireFeedbackOnChanges: false,
      });

      await workflow.processApproval(testProjectId, 'prd', 'request_changes', 'First review');
      await workflow.processApproval(testProjectId, 'prd', 'request_changes', 'Second review');
      await workflow.processApproval(testProjectId, 'prd', 'approve');

      const history = await workflow.getApprovalHistory(testProjectId, 'prd');

      expect(history.entries.length).toBe(3);
      // Entries should be newest first
      expect(history.entries[0].decision).toBe('approve');
      expect(history.entries[1].decision).toBe('request_changes');
      expect(history.entries[2].decision).toBe('request_changes');
    });
  });

  describe('singleton functions', () => {
    it('should return same instance from getApprovalWorkflow', () => {
      const workflow1 = getApprovalWorkflow({ scratchpadBasePath: testBasePath });
      const workflow2 = getApprovalWorkflow();

      expect(workflow1).toBe(workflow2);
    });

    it('should create new instance after reset', () => {
      const workflow1 = getApprovalWorkflow({ scratchpadBasePath: testBasePath });
      resetApprovalWorkflow();
      const workflow2 = getApprovalWorkflow({ scratchpadBasePath: testBasePath });

      expect(workflow1).not.toBe(workflow2);
    });
  });
});
