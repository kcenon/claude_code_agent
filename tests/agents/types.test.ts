import { describe, it, expect } from 'vitest';
import { isAgent } from '../../src/agents/types.js';
import type { IAgent } from '../../src/agents/types.js';

class ValidAgent implements IAgent {
  readonly agentId = 'valid-agent';
  readonly name = 'Valid Agent';

  async initialize(): Promise<void> {
    // noop
  }

  async dispose(): Promise<void> {
    // noop
  }
}

describe('types', () => {
  describe('isAgent', () => {
    it('should return true for valid agent', () => {
      const agent = new ValidAgent();

      expect(isAgent(agent)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isAgent(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isAgent(undefined)).toBe(false);
    });

    it('should return false for primitive', () => {
      expect(isAgent('string')).toBe(false);
      expect(isAgent(123)).toBe(false);
      expect(isAgent(true)).toBe(false);
    });

    it('should return false for object without agentId', () => {
      const obj = {
        name: 'Test',
        initialize: async () => {},
        dispose: async () => {},
      };

      expect(isAgent(obj)).toBe(false);
    });

    it('should return false for object without name', () => {
      const obj = {
        agentId: 'test',
        initialize: async () => {},
        dispose: async () => {},
      };

      expect(isAgent(obj)).toBe(false);
    });

    it('should return false for object without initialize', () => {
      const obj = {
        agentId: 'test',
        name: 'Test',
        dispose: async () => {},
      };

      expect(isAgent(obj)).toBe(false);
    });

    it('should return false for object without dispose', () => {
      const obj = {
        agentId: 'test',
        name: 'Test',
        initialize: async () => {},
      };

      expect(isAgent(obj)).toBe(false);
    });

    it('should return false for object with non-function initialize', () => {
      const obj = {
        agentId: 'test',
        name: 'Test',
        initialize: 'not a function',
        dispose: async () => {},
      };

      expect(isAgent(obj)).toBe(false);
    });

    it('should return false for object with non-string agentId', () => {
      const obj = {
        agentId: 123,
        name: 'Test',
        initialize: async () => {},
        dispose: async () => {},
      };

      expect(isAgent(obj)).toBe(false);
    });

    it('should return true for plain object with all required properties', () => {
      const obj = {
        agentId: 'test',
        name: 'Test',
        initialize: async () => {},
        dispose: async () => {},
      };

      expect(isAgent(obj)).toBe(true);
    });
  });
});
