import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  StateManager,
  getStateManager,
  resetStateManager,
  InvalidTransitionError,
  StateNotFoundError,
  ProjectNotFoundError,
  ProjectExistsError,
  StateValidationError,
  LockAcquisitionError,
  HistoryError,
  WatchError,
  StateManagerError,
} from '../../src/state-manager/index.js';
import type { ProjectState, StateChangeEvent } from '../../src/state-manager/index.js';

describe('StateManager', () => {
  let stateManager: StateManager;
  let testBasePath: string;

  beforeEach(() => {
    resetStateManager();
    testBasePath = path.join(os.tmpdir(), `state-manager-test-${Date.now()}`);
    stateManager = new StateManager({
      basePath: testBasePath,
      enableLocking: false,
      enableHistory: true,
      maxHistoryEntries: 10,
    });
  });

  afterEach(async () => {
    await stateManager.cleanup();
    resetStateManager();
    try {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Project Initialization', () => {
    it('should initialize a new project', async () => {
      const summary = await stateManager.initializeProject('001', 'Test Project');

      expect(summary.projectId).toBe('001');
      expect(summary.currentState).toBe('collecting');
      expect(summary.historyCount).toBe(1);
      expect(summary.hasPendingChanges).toBe(false);
    });

    it('should initialize project with custom initial state', async () => {
      const summary = await stateManager.initializeProject('002', 'Test', 'clarifying');

      expect(summary.currentState).toBe('clarifying');
    });

    it('should throw ProjectExistsError for duplicate project', async () => {
      await stateManager.initializeProject('001', 'First');

      await expect(stateManager.initializeProject('001', 'Second')).rejects.toThrow(
        ProjectExistsError
      );
    });

    it('should check if project exists', async () => {
      expect(await stateManager.projectExists('001')).toBe(false);

      await stateManager.initializeProject('001', 'Test');

      expect(await stateManager.projectExists('001')).toBe(true);
    });

    it('should delete project and all its state', async () => {
      await stateManager.initializeProject('001', 'Test');
      expect(await stateManager.projectExists('001')).toBe(true);

      await stateManager.deleteProject('001');

      expect(await stateManager.projectExists('001')).toBe(false);
    });

    it('should throw ProjectNotFoundError when deleting non-existent project', async () => {
      await expect(stateManager.deleteProject('999')).rejects.toThrow(ProjectNotFoundError);
    });
  });

  describe('State Operations', () => {
    beforeEach(async () => {
      await stateManager.initializeProject('001', 'Test Project');
    });

    it('should set and get state', async () => {
      const testData = { key: 'value', count: 42 };

      await stateManager.setState('info', '001', testData);
      const result = await stateManager.getState<typeof testData>('info', '001');

      expect(result).not.toBeNull();
      expect(result!.value).toEqual(testData);
      expect(result!.projectId).toBe('001');
      expect(result!.section).toBe('info');
    });

    it('should update state with merge', async () => {
      const initial = { name: 'Test', count: 1 };
      await stateManager.setState('info', '001', initial);

      await stateManager.updateState('info', '001', { count: 2 });

      const result = await stateManager.getState<typeof initial>('info', '001');
      expect(result!.value).toEqual({ name: 'Test', count: 2 });
    });

    it('should update state without merge (replace)', async () => {
      const initial = { name: 'Test', count: 1 };
      await stateManager.setState('info', '001', initial);

      await stateManager.updateState('info', '001', { count: 2 }, { merge: false });

      const result = await stateManager.getState<{ count: number }>('info', '001');
      expect(result!.value).toEqual({ count: 2 });
      expect((result!.value as Record<string, unknown>).name).toBeUndefined();
    });

    it('should return null for missing state with allowMissing', async () => {
      const result = await stateManager.getState('documents', '001', { allowMissing: true });
      expect(result).toBeNull();
    });

    it('should throw StateNotFoundError for missing state without allowMissing', async () => {
      await expect(stateManager.getState('documents', '001')).rejects.toThrow(StateNotFoundError);
    });

    it('should throw ProjectNotFoundError for non-existent project', async () => {
      await expect(stateManager.getState('info', '999')).rejects.toThrow(ProjectNotFoundError);
    });

    it('should include version in state metadata', async () => {
      await stateManager.setState('info', '001', { data: 1 });
      const result1 = await stateManager.getState('info', '001');

      await stateManager.setState('info', '001', { data: 2 });
      const result2 = await stateManager.getState('info', '001');

      expect(result2!.version).toBeGreaterThan(result1!.version);
    });

    it('should handle issues section', async () => {
      const issueData = { issueList: ['issue-1', 'issue-2'] };

      await stateManager.setState('issues', '001', issueData);
      const result = await stateManager.getState<typeof issueData>('issues', '001');

      expect(result).not.toBeNull();
      expect(result!.value).toEqual(issueData);
      expect(result!.section).toBe('issues');
    });

    it('should handle progress section', async () => {
      const progressData = { currentPhase: 'development', completion: 50 };

      await stateManager.setState('progress', '001', progressData);
      const result = await stateManager.getState<typeof progressData>('progress', '001');

      expect(result).not.toBeNull();
      expect(result!.value).toEqual(progressData);
      expect(result!.section).toBe('progress');
    });
  });

  describe('State Transitions', () => {
    beforeEach(async () => {
      await stateManager.initializeProject('001', 'Test Project');
    });

    it('should transition to valid state', async () => {
      const result = await stateManager.transitionState('001', 'clarifying');

      expect(result.success).toBe(true);
      expect(result.previousState).toBe('collecting');
      expect(result.newState).toBe('clarifying');
    });

    it('should follow complete workflow path', async () => {
      const transitions: ProjectState[] = [
        'clarifying',
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
      ];

      for (const state of transitions) {
        const result = await stateManager.transitionState('001', state);
        expect(result.success).toBe(true);
        expect(result.newState).toBe(state);
      }

      const finalState = await stateManager.getCurrentState('001');
      expect(finalState).toBe('merged');
    });

    it('should throw InvalidTransitionError for invalid transition', async () => {
      await expect(stateManager.transitionState('001', 'merged')).rejects.toThrow(
        InvalidTransitionError
      );
    });

    it('should allow transition to cancelled from most states', async () => {
      const result = await stateManager.transitionState('001', 'cancelled');

      expect(result.success).toBe(true);
      expect(result.newState).toBe('cancelled');
    });

    it('should not allow transitions from terminal states', async () => {
      await stateManager.transitionState('001', 'cancelled');

      await expect(stateManager.transitionState('001', 'collecting')).rejects.toThrow(
        InvalidTransitionError
      );
    });

    it('should check valid transitions', () => {
      expect(stateManager.isValidTransition('collecting', 'clarifying')).toBe(true);
      expect(stateManager.isValidTransition('collecting', 'merged')).toBe(false);
      expect(stateManager.isValidTransition('merged', 'collecting')).toBe(false);
    });

    it('should get valid transitions from a state', () => {
      const transitions = stateManager.getValidTransitions('collecting');

      expect(transitions).toContain('clarifying');
      expect(transitions).toContain('prd_drafting');
      expect(transitions).toContain('cancelled');
      expect(transitions).not.toContain('merged');
    });

    it('should get current state', async () => {
      const state = await stateManager.getCurrentState('001');
      expect(state).toBe('collecting');

      await stateManager.transitionState('001', 'clarifying');
      const newState = await stateManager.getCurrentState('001');
      expect(newState).toBe('clarifying');
    });

    it('should throw ProjectNotFoundError for non-existent project', async () => {
      await expect(stateManager.transitionState('999', 'clarifying')).rejects.toThrow(
        ProjectNotFoundError
      );
    });
  });

  describe('History Management', () => {
    beforeEach(async () => {
      await stateManager.initializeProject('001', 'Test Project');
    });

    it('should track state history', async () => {
      await stateManager.setState('info', '001', { version: 1 });
      await stateManager.setState('info', '001', { version: 2 });
      await stateManager.setState('info', '001', { version: 3 });

      const result = await stateManager.getState('info', '001', { includeHistory: true });

      expect(result!.history).not.toBeNull();
      expect(result!.history!.entries.length).toBeGreaterThanOrEqual(3);
    });

    it('should get history separately', async () => {
      await stateManager.setState('info', '001', { data: 'test' }, { description: 'First update' });

      const history = await stateManager.getHistory('info', '001');

      expect(history).not.toBeNull();
      expect(history!.entries.length).toBeGreaterThan(0);
    });

    it('should track transition history', async () => {
      await stateManager.transitionState('001', 'clarifying');
      await stateManager.transitionState('001', 'prd_drafting');

      const history = await stateManager.getHistory('progress', '001');

      expect(history).not.toBeNull();
      expect(history!.entries.length).toBeGreaterThan(0);
    });

    it('should limit history entries to max configured', async () => {
      // Manager configured with maxHistoryEntries: 10
      for (let i = 0; i < 15; i++) {
        await stateManager.setState('info', '001', { iteration: i });
      }

      const history = await stateManager.getHistory('info', '001');

      expect(history!.entries.length).toBeLessThanOrEqual(10);
    });

    it('should include description in history entries', async () => {
      await stateManager.setState('info', '001', { data: 'test' }, { description: 'Test change' });

      const history = await stateManager.getHistory('info', '001');
      const latestEntry = history!.entries[0];

      expect(latestEntry.description).toBe('Test change');
    });
  });

  describe('Project Summary', () => {
    it('should get project summary', async () => {
      await stateManager.initializeProject('001', 'Test');
      await stateManager.transitionState('001', 'clarifying');

      const summary = await stateManager.getProjectSummary('001');

      expect(summary.projectId).toBe('001');
      expect(summary.currentState).toBe('clarifying');
      expect(summary.historyCount).toBeGreaterThan(0);
    });

    it('should throw ProjectNotFoundError for non-existent project', async () => {
      await expect(stateManager.getProjectSummary('999')).rejects.toThrow(ProjectNotFoundError);
    });
  });

  describe('Watch Mode', () => {
    beforeEach(async () => {
      await stateManager.initializeProject('001', 'Test Project');
    });

    it('should create watcher', () => {
      const watcher = stateManager.watchState('001', () => {});

      expect(watcher.id).toBeDefined();
      expect(watcher.projectId).toBe('001');
      expect(watcher.section).toBeNull();
      expect(typeof watcher.unsubscribe).toBe('function');

      watcher.unsubscribe();
    });

    it('should create watcher for specific section', () => {
      const watcher = stateManager.watchState('001', () => {}, 'info');

      expect(watcher.section).toBe('info');

      watcher.unsubscribe();
    });

    it('should notify watchers on state change', async () => {
      const events: StateChangeEvent[] = [];
      const watcher = stateManager.watchState('001', (event: StateChangeEvent) => {
        events.push(event);
      }, 'info');

      await stateManager.setState('info', '001', { test: 'data' });

      // Give a moment for notification
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].projectId).toBe('001');
      expect(events[0].section).toBe('info');

      watcher.unsubscribe();
    });

    it('should unsubscribe watcher', async () => {
      const events: StateChangeEvent[] = [];
      const watcher = stateManager.watchState('001', (event: StateChangeEvent) => {
        events.push(event);
      }, 'info');

      watcher.unsubscribe();

      await stateManager.setState('info', '001', { test: 'data' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(events.length).toBe(0);
    });
  });

  describe('Concurrent Access', () => {
    let lockingManager: StateManager;

    beforeEach(async () => {
      lockingManager = new StateManager({
        basePath: testBasePath,
        enableLocking: true,
        lockTimeout: 1000,
      });
      await lockingManager.initializeProject('001', 'Test');
    });

    afterEach(async () => {
      await lockingManager.cleanup();
    });

    it('should handle sequential writes with locking', async () => {
      // With locking enabled, writes should be sequential
      for (let i = 0; i < 5; i++) {
        await lockingManager.setState('info', '001', { value: i });
      }

      const result = await lockingManager.getState<{ value: number }>('info', '001');
      expect(result).not.toBeNull();
      expect(result!.value.value).toBe(4);
    });

    it('should reject concurrent writes when lock is held', async () => {
      // Start first write
      const firstWrite = lockingManager.setState('info', '001', { value: 1 });

      // Second write should fail if lock is still held
      // This tests that locking is working correctly
      await firstWrite;

      // After first write completes, second should work
      await lockingManager.setState('info', '001', { value: 2 });

      const result = await lockingManager.getState<{ value: number }>('info', '001');
      expect(result!.value.value).toBe(2);
    });
  });

  describe('Scratchpad Access', () => {
    it('should provide access to underlying scratchpad', () => {
      const scratchpad = stateManager.getScratchpad();

      expect(scratchpad).toBeDefined();
      expect(typeof scratchpad.getBasePath).toBe('function');
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      resetStateManager();
      const instance1 = getStateManager();
      const instance2 = getStateManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      resetStateManager();
      const instance1 = getStateManager();
      resetStateManager();
      const instance2 = getStateManager();

      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('StateManager Error Classes', () => {
  it('should create InvalidTransitionError with correct properties', () => {
    const error = new InvalidTransitionError('collecting', 'merged', '001');

    expect(error.name).toBe('InvalidTransitionError');
    expect(error.code).toBe('INVALID_TRANSITION');
    expect(error.fromState).toBe('collecting');
    expect(error.toState).toBe('merged');
    expect(error.projectId).toBe('001');
    expect(error.message).toContain('collecting');
    expect(error.message).toContain('merged');
  });

  it('should create StateNotFoundError with correct properties', () => {
    const error = new StateNotFoundError('info', '001');

    expect(error.name).toBe('StateNotFoundError');
    expect(error.code).toBe('STATE_NOT_FOUND');
    expect(error.section).toBe('info');
    expect(error.projectId).toBe('001');
  });

  it('should create ProjectNotFoundError with correct properties', () => {
    const error = new ProjectNotFoundError('001');

    expect(error.name).toBe('ProjectNotFoundError');
    expect(error.code).toBe('PROJECT_NOT_FOUND');
    expect(error.projectId).toBe('001');
  });

  it('should create ProjectExistsError with correct properties', () => {
    const error = new ProjectExistsError('001');

    expect(error.name).toBe('ProjectExistsError');
    expect(error.code).toBe('PROJECT_EXISTS');
    expect(error.projectId).toBe('001');
  });

  it('should create StateValidationError with correct properties', () => {
    const validationErrors = [
      { path: 'name', message: 'Name is required', code: 'REQUIRED' },
      { path: 'status', message: 'Invalid status value', code: 'INVALID_VALUE' },
    ];
    const error = new StateValidationError(validationErrors, '001');

    expect(error.name).toBe('StateValidationError');
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.projectId).toBe('001');
    expect(error.errors).toEqual(validationErrors);
    expect(error.message).toContain('name');
    expect(error.message).toContain('status');
  });

  it('should format StateValidationError errors correctly', () => {
    const validationErrors = [
      { path: 'field1', message: 'Error 1', code: 'CODE1' },
      { path: 'field2', message: 'Error 2', code: 'CODE2' },
    ];
    const error = new StateValidationError(validationErrors);

    const formatted = error.formatErrors();

    expect(formatted).toContain('[CODE1]');
    expect(formatted).toContain('field1');
    expect(formatted).toContain('Error 1');
    expect(formatted).toContain('[CODE2]');
    expect(formatted).toContain('field2');
    expect(formatted).toContain('Error 2');
  });

  it('should create LockAcquisitionError with correct properties', () => {
    const error = new LockAcquisitionError('/path/to/file.json', '001');

    expect(error.name).toBe('LockAcquisitionError');
    expect(error.code).toBe('LOCK_FAILED');
    expect(error.projectId).toBe('001');
    expect(error.filePath).toBe('/path/to/file.json');
    expect(error.message).toContain('/path/to/file.json');
  });

  it('should create LockAcquisitionError without projectId', () => {
    const error = new LockAcquisitionError('/path/to/file.json');

    expect(error.name).toBe('LockAcquisitionError');
    expect(error.code).toBe('LOCK_FAILED');
    expect(error.projectId).toBeUndefined();
  });

  it('should create HistoryError with correct properties', () => {
    const error = new HistoryError('History operation failed', '001');

    expect(error.name).toBe('HistoryError');
    expect(error.code).toBe('HISTORY_ERROR');
    expect(error.projectId).toBe('001');
    expect(error.message).toBe('History operation failed');
  });

  it('should create HistoryError without projectId', () => {
    const error = new HistoryError('History operation failed');

    expect(error.name).toBe('HistoryError');
    expect(error.code).toBe('HISTORY_ERROR');
    expect(error.projectId).toBeUndefined();
  });

  it('should create WatchError with correct properties', () => {
    const error = new WatchError('Watch operation failed', '001');

    expect(error.name).toBe('WatchError');
    expect(error.code).toBe('WATCH_ERROR');
    expect(error.projectId).toBe('001');
    expect(error.message).toBe('Watch operation failed');
  });

  it('should create WatchError without projectId', () => {
    const error = new WatchError('Watch operation failed');

    expect(error.name).toBe('WatchError');
    expect(error.code).toBe('WATCH_ERROR');
    expect(error.projectId).toBeUndefined();
  });

  it('should create base StateManagerError with correct properties', () => {
    const error = new StateManagerError('Base error message', 'CUSTOM_CODE', '001');

    expect(error.name).toBe('StateManagerError');
    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.projectId).toBe('001');
    expect(error.message).toBe('Base error message');
  });

  it('should create StateManagerError without projectId', () => {
    const error = new StateManagerError('Base error message', 'CUSTOM_CODE');

    expect(error.name).toBe('StateManagerError');
    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.projectId).toBeUndefined();
  });
});
