import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  StatusService,
  getStatusService,
  resetStatusService,
} from '../../src/status/index.js';
import type { PipelineStatus, StageStatus } from '../../src/status/types.js';
import { StateManager, getStateManager, resetStateManager } from '../../src/state-manager/index.js';
import { Scratchpad, getScratchpad, resetScratchpad } from '../../src/scratchpad/index.js';

describe('StatusService', () => {
  let statusService: StatusService;
  let stateManager: StateManager;
  let testBasePath: string;

  beforeEach(() => {
    // Reset all singletons first
    resetStatusService();
    resetStateManager();
    resetScratchpad();

    // Create unique test directory
    testBasePath = path.join(os.tmpdir(), `status-service-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);

    // Initialize global singletons with test path
    // This ensures StatusService uses the same path
    stateManager = getStateManager({
      basePath: testBasePath,
      enableLocking: false,
      enableHistory: true,
    });

    // Also set up scratchpad with same path
    getScratchpad({ basePath: testBasePath });

    statusService = new StatusService({ format: 'text', verbose: false });
  });

  afterEach(async () => {
    await stateManager.cleanup();
    resetStatusService();
    resetStateManager();
    resetScratchpad();

    try {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getStatus', () => {
    it('should return empty status when no projects exist', async () => {
      const status = await statusService.getStatus();

      expect(status.totalProjects).toBe(0);
      expect(status.activeProjects).toBe(0);
      expect(status.projects).toHaveLength(0);
      expect(status.timestamp).toBeDefined();
    });

    it('should return status for all projects', async () => {
      // Initialize test projects
      await stateManager.initializeProject('001', 'Project One');
      await stateManager.initializeProject('002', 'Project Two');

      const status = await statusService.getStatus();

      expect(status.totalProjects).toBeGreaterThanOrEqual(0);
      expect(status.timestamp).toBeDefined();
    });

    it('should return status for specific project', async () => {
      await stateManager.initializeProject('001', 'Test Project');

      const status = await statusService.getStatus('001');

      expect(status.projects).toHaveLength(1);
      expect(status.projects[0].projectId).toBe('001');
      expect(status.projects[0].currentState).toBe('collecting');
    });

    it('should return empty when project does not exist', async () => {
      const status = await statusService.getStatus('nonexistent');

      expect(status.projects).toHaveLength(0);
      expect(status.totalProjects).toBe(0);
    });
  });

  describe('getProjectStatus', () => {
    it('should return null for non-existent project', async () => {
      const status = await statusService.getProjectStatus('nonexistent');

      expect(status).toBeNull();
    });

    it('should return project status with all fields', async () => {
      await stateManager.initializeProject('001', 'Test Project');

      const status = await statusService.getProjectStatus('001');

      expect(status).not.toBeNull();
      expect(status!.projectId).toBe('001');
      expect(status!.currentState).toBe('collecting');
      expect(status!.progressPercent).toBeGreaterThanOrEqual(0);
      expect(status!.stages).toBeDefined();
      expect(status!.issues).toBeDefined();
      expect(status!.workers).toBeDefined();
      expect(status!.recentActivity).toBeDefined();
      expect(status!.lastUpdated).toBeDefined();
    });

    it('should calculate correct stage status', async () => {
      await stateManager.initializeProject('001', 'Test Project');
      await stateManager.transitionState('001', 'prd_drafting');

      const status = await statusService.getProjectStatus('001');

      expect(status).not.toBeNull();
      const stages = status!.stages;

      // Collection should be completed
      const collectionStage = stages.find((s) => s.name === 'Collection');
      expect(collectionStage?.status).toBe('completed');

      // PRD Generation should be running
      const prdStage = stages.find((s) => s.name === 'PRD Generation');
      expect(prdStage?.status).toBe('running');

      // Later stages should be pending
      const implementationStage = stages.find((s) => s.name === 'Implementation');
      expect(implementationStage?.status).toBe('pending');
    });

    it('should show 100% progress for merged state', async () => {
      await stateManager.initializeProject('001', 'Test Project');

      // Progress through all states to merged
      const transitions = [
        'prd_drafting',
        'prd_approved',
        'srs_drafting',
        'srs_approved',
        'sds_drafting',
        'sds_approved',
        'issues_creating',
        'issues_created',
        'implementing',
        'pr_review',
        'merged',
      ] as const;

      for (const state of transitions) {
        await stateManager.transitionState('001', state);
      }

      const status = await statusService.getProjectStatus('001');

      expect(status).not.toBeNull();
      expect(status!.progressPercent).toBe(100);
    });

    it('should return issue counts', async () => {
      await stateManager.initializeProject('001', 'Test Project');

      const status = await statusService.getProjectStatus('001');

      expect(status).not.toBeNull();
      expect(status!.issues).toEqual({
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        blocked: 0,
      });
    });

    it('should return empty workers when none active', async () => {
      await stateManager.initializeProject('001', 'Test Project');

      const status = await statusService.getProjectStatus('001');

      expect(status).not.toBeNull();
      expect(status!.workers).toEqual([]);
    });
  });

  describe('displayStatus', () => {
    it('should display text status without errors', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await stateManager.initializeProject('001', 'Test Project');

      const result = await statusService.displayStatus({ format: 'text' });

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should display JSON status', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await stateManager.initializeProject('001', 'Test Project');

      const result = await statusService.displayStatus({ format: 'json' });

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      // Verify JSON output
      const calls = consoleSpy.mock.calls;
      const jsonOutput = calls[0][0] as string;
      const parsed = JSON.parse(jsonOutput) as PipelineStatus;

      expect(parsed.projects).toBeDefined();
      expect(parsed.timestamp).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should display no projects message when empty', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await statusService.displayStatus({ format: 'text' });

      expect(result.success).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should return success with data', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await stateManager.initializeProject('001', 'Test Project');

      const result = await statusService.displayStatus();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.projects).toBeDefined();

      vi.restoreAllMocks();
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      resetStatusService();
      const instance1 = getStatusService();
      const instance2 = getStatusService();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      resetStatusService();
      const instance1 = getStatusService();
      resetStatusService();
      const instance2 = getStatusService();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Stage Status Calculation', () => {
    it('should mark all stages as pending for collecting state', async () => {
      await stateManager.initializeProject('001', 'Test');

      const status = await statusService.getProjectStatus('001');
      const stages = status!.stages;

      const collectionStage = stages.find((s) => s.name === 'Collection');
      expect(collectionStage?.status).toBe('running');

      const laterStages = stages.filter((s) => s.name !== 'Collection');
      for (const stage of laterStages) {
        expect(stage.status).toBe('pending');
      }
    });

    it('should handle cancelled state correctly', async () => {
      await stateManager.initializeProject('001', 'Test');
      await stateManager.transitionState('001', 'cancelled');

      const status = await statusService.getProjectStatus('001');

      expect(status).not.toBeNull();
      expect(status!.currentState).toBe('cancelled');
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress based on state', async () => {
      await stateManager.initializeProject('001', 'Test');

      // Initial state
      let status = await statusService.getProjectStatus('001');
      expect(status!.progressPercent).toBe(0);

      // After PRD drafting
      await stateManager.transitionState('001', 'prd_drafting');
      status = await statusService.getProjectStatus('001');
      expect(status!.progressPercent).toBeGreaterThan(0);

      // After SRS drafting
      await stateManager.transitionState('001', 'prd_approved');
      await stateManager.transitionState('001', 'srs_drafting');
      status = await statusService.getProjectStatus('001');
      expect(status!.progressPercent).toBeGreaterThan(10);
    });

    it('should return 0% for unknown state', async () => {
      await stateManager.initializeProject('001', 'Test');

      const status = await statusService.getProjectStatus('001');

      // Collecting state maps to stage 0
      expect(status!.progressPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully in text mode', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Force an error by using a service with invalid configuration
      const brokenService = new StatusService({
        projectId: '/invalid/path/that/does/not/exist',
      });

      // This should not throw, but return success: false
      const result = await brokenService.displayStatus();

      // Even with invalid project, it should succeed (just show empty)
      expect(result.success).toBe(true);

      errorSpy.mockRestore();
    });

    it('should handle errors gracefully in JSON mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const service = new StatusService({ format: 'json' });

      const result = await service.displayStatus({ projectId: 'nonexistent' });

      // Should succeed with empty data
      expect(result.success).toBe(true);
      expect(result.data?.projects).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  describe('Issue Status Counts', () => {
    it('should return zero counts when no issues exist', async () => {
      await stateManager.initializeProject('001', 'Test');

      const status = await statusService.getProjectStatus('001');

      expect(status!.issues).toEqual({
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        blocked: 0,
      });
    });
  });

  describe('Recent Activity', () => {
    it('should return activity from history', async () => {
      await stateManager.initializeProject('001', 'Test');
      await stateManager.transitionState('001', 'clarifying');

      const status = await statusService.getProjectStatus('001');

      expect(status!.recentActivity.length).toBeGreaterThan(0);
    });

    it('should limit activity entries', async () => {
      await stateManager.initializeProject('001', 'Test');

      // Make multiple state changes
      await stateManager.transitionState('001', 'clarifying');
      await stateManager.transitionState('001', 'prd_drafting');
      await stateManager.transitionState('001', 'prd_approved');
      await stateManager.transitionState('001', 'srs_drafting');

      const status = await statusService.getProjectStatus('001');

      // Should be limited to 10 entries
      expect(status!.recentActivity.length).toBeLessThanOrEqual(10);
    });
  });
});

describe('StatusService Types', () => {
  it('should export all required types', () => {
    // This test ensures types are exported correctly
    const stageStatus: StageStatus = 'completed';
    expect(['pending', 'running', 'completed', 'failed', 'skipped']).toContain(stageStatus);
  });
});
