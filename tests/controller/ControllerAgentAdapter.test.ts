/**
 * ControllerAgentAdapter tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { isAgent } from '../../src/agents/types.js';
import {
  ControllerAgentAdapter,
  CONTROLLER_AGENT_ID,
} from '../../src/controller/ControllerAgentAdapter.js';
import type { ControllerAgentConfig } from '../../src/controller/ControllerAgentAdapter.js';
import { WorkerPoolManager } from '../../src/controller/WorkerPoolManager.js';
import { PriorityAnalyzer } from '../../src/controller/PriorityAnalyzer.js';
import { ProgressMonitor } from '../../src/controller/ProgressMonitor.js';

describe('ControllerAgentAdapter', () => {
  let adapter: ControllerAgentAdapter;

  beforeEach(() => {
    adapter = new ControllerAgentAdapter();
  });

  describe('IAgent interface compliance', () => {
    it('should have correct agentId', () => {
      expect(adapter.agentId).toBe(CONTROLLER_AGENT_ID);
      expect(adapter.agentId).toBe('controller');
    });

    it('should have correct name', () => {
      expect(adapter.name).toBe('Controller Agent');
    });

    it('should pass isAgent type guard', () => {
      expect(isAgent(adapter)).toBe(true);
    });

    it('should implement initialize() and dispose()', async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined();
      await expect(adapter.dispose()).resolves.toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should accept no arguments', () => {
      const instance = new ControllerAgentAdapter();
      expect(instance).toBeInstanceOf(ControllerAgentAdapter);
    });

    it('should accept custom configuration', () => {
      const config: ControllerAgentConfig = {
        pool: { maxWorkers: 3 },
      };
      const instance = new ControllerAgentAdapter(config);
      expect(instance).toBeInstanceOf(ControllerAgentAdapter);
    });
  });

  describe('initialize()', () => {
    it('should create all sub-component instances', async () => {
      await adapter.initialize();

      expect(adapter.getPoolManager()).toBeInstanceOf(WorkerPoolManager);
      expect(adapter.getPriorityAnalyzer()).toBeInstanceOf(PriorityAnalyzer);
      expect(adapter.getProgressMonitor()).toBeInstanceOf(ProgressMonitor);
    });

    it('should apply pool configuration', async () => {
      const customAdapter = new ControllerAgentAdapter({
        pool: { maxWorkers: 2 },
      });
      await customAdapter.initialize();

      const status = customAdapter.getPoolStatus();
      expect(status.totalWorkers).toBe(2);
      await customAdapter.dispose();
    });
  });

  describe('dispose()', () => {
    it('should release all sub-component instances', async () => {
      await adapter.initialize();

      await adapter.dispose();

      expect(() => adapter.getPoolManager()).toThrow('Agent not initialized');
      expect(() => adapter.getPriorityAnalyzer()).toThrow('Agent not initialized');
      expect(() => adapter.getProgressMonitor()).toThrow('Agent not initialized');
    });

    it('should be safe to call multiple times', async () => {
      await adapter.dispose();
      await adapter.dispose();
    });

    it('should handle dispose when progress monitor is running', async () => {
      await adapter.initialize();
      const poolManager = adapter.getPoolManager();
      const monitor = adapter.getProgressMonitor();

      // ProgressMonitor.start() takes two callback functions
      monitor.start(
        () => poolManager.getStatus(),
        () => poolManager.getQueue()
      );

      // Dispose should stop the monitor without throwing
      await expect(adapter.dispose()).resolves.toBeUndefined();
    });
  });

  describe('getPoolManager()', () => {
    it('should throw when not initialized', () => {
      expect(() => adapter.getPoolManager()).toThrow('Agent not initialized');
    });

    it('should return WorkerPoolManager after initialization', async () => {
      await adapter.initialize();
      expect(adapter.getPoolManager()).toBeInstanceOf(WorkerPoolManager);
    });
  });

  describe('getPriorityAnalyzer()', () => {
    it('should throw when not initialized', () => {
      expect(() => adapter.getPriorityAnalyzer()).toThrow('Agent not initialized');
    });

    it('should return PriorityAnalyzer after initialization', async () => {
      await adapter.initialize();
      expect(adapter.getPriorityAnalyzer()).toBeInstanceOf(PriorityAnalyzer);
    });
  });

  describe('getProgressMonitor()', () => {
    it('should throw when not initialized', () => {
      expect(() => adapter.getProgressMonitor()).toThrow('Agent not initialized');
    });

    it('should return ProgressMonitor after initialization', async () => {
      await adapter.initialize();
      expect(adapter.getProgressMonitor()).toBeInstanceOf(ProgressMonitor);
    });
  });

  describe('getPoolStatus()', () => {
    it('should throw when not initialized', () => {
      expect(() => adapter.getPoolStatus()).toThrow('Agent not initialized');
    });

    it('should return pool status after initialization', async () => {
      await adapter.initialize();

      const status = adapter.getPoolStatus();

      expect(status).toBeDefined();
      expect(typeof status.totalWorkers).toBe('number');
      expect(typeof status.idleWorkers).toBe('number');
      expect(typeof status.workingWorkers).toBe('number');
    });

    it('should reflect configured worker count', async () => {
      const customAdapter = new ControllerAgentAdapter({
        pool: { maxWorkers: 3 },
      });
      await customAdapter.initialize();

      const status = customAdapter.getPoolStatus();
      expect(status.totalWorkers).toBe(3);
      expect(status.idleWorkers).toBe(3);
      expect(status.workingWorkers).toBe(0);

      await customAdapter.dispose();
    });
  });

  describe('lifecycle sequence', () => {
    it('should support full lifecycle: initialize -> use -> dispose', async () => {
      await adapter.initialize();

      const status = adapter.getPoolStatus();
      expect(status.totalWorkers).toBeGreaterThan(0);

      await adapter.dispose();
      expect(() => adapter.getPoolManager()).toThrow('Agent not initialized');
    });
  });

  describe('exported constant', () => {
    it('should export correct agent ID', () => {
      expect(CONTROLLER_AGENT_ID).toBe('controller');
    });
  });
});
