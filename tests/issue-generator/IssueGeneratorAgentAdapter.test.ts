/**
 * IssueGeneratorAgentAdapter tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { isAgent } from '../../src/agents/types.js';
import {
  IssueGeneratorAgentAdapter,
  ISSUE_GENERATOR_AGENT_ID,
} from '../../src/issue-generator/IssueGeneratorAgentAdapter.js';
import { IssueGenerator } from '../../src/issue-generator/IssueGenerator.js';

/**
 * Minimal valid SDS content for testing issue generation
 */
const MINIMAL_SDS_CONTENT = `# Software Design Specification (SDS)

## Document Information
- **Project**: Test Project
- **Version**: 1.0.0
- **Status**: Draft

## 1. Introduction

### 1.1 Purpose
Test SDS for adapter testing.

## 2. System Architecture

### 2.1 Architecture Overview
Simple architecture.

## 3. Component Design

### 3.1 Component: CMP-001 - Test Component
#### 3.1.1 Purpose
A test component for unit testing.

#### 3.1.2 Interfaces
- TestInterface

#### 3.1.3 Dependencies
None

#### 3.1.4 Implementation Notes
Simple implementation.

#### 3.1.5 Traceability
- SRS: SF-001

#### 3.1.6 Technology
- TypeScript
`;

describe('IssueGeneratorAgentAdapter', () => {
  let adapter: IssueGeneratorAgentAdapter;

  beforeEach(() => {
    adapter = new IssueGeneratorAgentAdapter({ validateSDS: false });
  });

  describe('IAgent interface compliance', () => {
    it('should have correct agentId', () => {
      expect(adapter.agentId).toBe(ISSUE_GENERATOR_AGENT_ID);
      expect(adapter.agentId).toBe('issue-generator');
    });

    it('should have correct name', () => {
      expect(adapter.name).toBe('Issue Generator Agent');
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
      const instance = new IssueGeneratorAgentAdapter();
      expect(instance).toBeInstanceOf(IssueGeneratorAgentAdapter);
    });

    it('should accept custom configuration', () => {
      const instance = new IssueGeneratorAgentAdapter({
        validateSDS: false,
        outputPath: '/tmp/custom-output',
      });
      expect(instance).toBeInstanceOf(IssueGeneratorAgentAdapter);
    });
  });

  describe('initialize()', () => {
    it('should create inner IssueGenerator instance', async () => {
      await adapter.initialize();
      expect(adapter.getInner()).toBeInstanceOf(IssueGenerator);
    });
  });

  describe('dispose()', () => {
    it('should release inner instance', async () => {
      await adapter.initialize();
      expect(adapter.getInner()).toBeInstanceOf(IssueGenerator);

      await adapter.dispose();
      expect(() => adapter.getInner()).toThrow('Agent not initialized');
    });

    it('should be safe to call multiple times', async () => {
      await adapter.dispose();
      await adapter.dispose();
    });
  });

  describe('getInner()', () => {
    it('should throw when not initialized', () => {
      expect(() => adapter.getInner()).toThrow('Agent not initialized');
    });

    it('should return IssueGenerator after initialization', async () => {
      await adapter.initialize();
      expect(adapter.getInner()).toBeInstanceOf(IssueGenerator);
    });
  });

  describe('generate()', () => {
    it('should throw when not initialized', () => {
      expect(() => adapter.generate(MINIMAL_SDS_CONTENT)).toThrow('Agent not initialized');
    });

    it('should generate issues from SDS content', async () => {
      await adapter.initialize();

      const result = adapter.generate(MINIMAL_SDS_CONTENT);

      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
      expect(result.dependencyGraph).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });

  describe('generateFromFile()', () => {
    it('should throw when not initialized', async () => {
      await expect(
        adapter.generateFromFile('/nonexistent/path.md', 'test-project')
      ).rejects.toThrow('Agent not initialized');
    });

    it('should throw for nonexistent file when initialized', async () => {
      await adapter.initialize();

      await expect(
        adapter.generateFromFile('/nonexistent/path.md', 'test-project')
      ).rejects.toThrow();
    });
  });

  describe('lifecycle sequence', () => {
    it('should support full lifecycle: initialize -> generate -> dispose', async () => {
      await adapter.initialize();

      const result = adapter.generate(MINIMAL_SDS_CONTENT);
      expect(result.issues).toBeDefined();

      await adapter.dispose();
      expect(() => adapter.getInner()).toThrow('Agent not initialized');
    });
  });

  describe('exported constant', () => {
    it('should export correct agent ID', () => {
      expect(ISSUE_GENERATOR_AGENT_ID).toBe('issue-generator');
    });
  });
});
