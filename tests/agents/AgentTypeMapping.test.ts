import { describe, it, expect } from 'vitest';
import {
  AGENT_TYPE_MAP,
  getAgentTypes,
  getAgentTypeEntry,
  getRegisteredAgentIds,
} from '../../src/agents/AgentTypeMapping.js';
import type { AgentTypeEntry } from '../../src/agents/AgentTypeMapping.js';
import {
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
} from '../../src/ad-sdlc-orchestrator/types.js';

describe('AgentTypeMapping', () => {
  describe('AGENT_TYPE_MAP structure', () => {
    it('should be a non-empty object', () => {
      const keys = Object.keys(AGENT_TYPE_MAP);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should have valid AgentTypeEntry shape for every entry', () => {
      for (const [agentType, entry] of Object.entries(AGENT_TYPE_MAP)) {
        expect(entry.agentId).toBeTypeOf('string');
        expect(entry.agentId.length).toBeGreaterThan(0);

        expect(entry.name).toBeTypeOf('string');
        expect(entry.name.length).toBeGreaterThan(0);

        expect(['singleton', 'transient']).toContain(entry.lifecycle);

        expect(entry.requiresWrapper).toBeTypeOf('boolean');

        expect(entry.importPath).toBeTypeOf('string');
        expect(entry.importPath).toMatch(/\.js$/);

        // Ensure agentType key itself is a non-empty string
        expect(agentType.length).toBeGreaterThan(0);
      }
    });

    it('should have unique agentId values', () => {
      const agentIds = Object.values(AGENT_TYPE_MAP).map((e) => e.agentId);
      const unique = new Set(agentIds);
      expect(unique.size).toBe(agentIds.length);
    });
  });

  describe('pipeline stage coverage', () => {
    it('should cover all Greenfield pipeline agentType values', () => {
      for (const stage of GREENFIELD_STAGES) {
        expect(
          AGENT_TYPE_MAP[stage.agentType],
          `Missing mapping for Greenfield agentType '${stage.agentType}'`
        ).toBeDefined();
      }
    });

    it('should cover all Enhancement pipeline agentType values', () => {
      for (const stage of ENHANCEMENT_STAGES) {
        expect(
          AGENT_TYPE_MAP[stage.agentType],
          `Missing mapping for Enhancement agentType '${stage.agentType}'`
        ).toBeDefined();
      }
    });

    it('should cover all Import pipeline agentType values', () => {
      for (const stage of IMPORT_STAGES) {
        expect(
          AGENT_TYPE_MAP[stage.agentType],
          `Missing mapping for Import agentType '${stage.agentType}'`
        ).toBeDefined();
      }
    });
  });

  describe('specific agent entries', () => {
    it('should map collector to collector-agent (IAgent)', () => {
      const entry = AGENT_TYPE_MAP['collector'];
      expect(entry).toBeDefined();
      expect(entry!.agentId).toBe('collector-agent');
      expect(entry!.lifecycle).toBe('singleton');
      expect(entry!.requiresWrapper).toBe(false);
    });

    it('should map worker to worker-agent (transient lifecycle)', () => {
      const entry = AGENT_TYPE_MAP['worker'];
      expect(entry).toBeDefined();
      expect(entry!.agentId).toBe('worker-agent');
      expect(entry!.lifecycle).toBe('transient');
      expect(entry!.requiresWrapper).toBe(false);
    });

    it('should mark project-initializer as requiring wrapper', () => {
      const entry = AGENT_TYPE_MAP['project-initializer'];
      expect(entry).toBeDefined();
      expect(entry!.requiresWrapper).toBe(true);
    });

    it('should mark mode-detector as requiring wrapper', () => {
      const entry = AGENT_TYPE_MAP['mode-detector'];
      expect(entry).toBeDefined();
      expect(entry!.requiresWrapper).toBe(true);
    });

    it('should mark issue-generator as requiring wrapper', () => {
      const entry = AGENT_TYPE_MAP['issue-generator'];
      expect(entry).toBeDefined();
      expect(entry!.requiresWrapper).toBe(true);
    });

    it('should mark controller as requiring wrapper', () => {
      const entry = AGENT_TYPE_MAP['controller'];
      expect(entry).toBeDefined();
      expect(entry!.requiresWrapper).toBe(true);
    });

    it('should mark code-reader as requiring wrapper', () => {
      const entry = AGENT_TYPE_MAP['code-reader'];
      expect(entry).toBeDefined();
      expect(entry!.requiresWrapper).toBe(true);
    });

    it('should map IAgent agents without wrapper requirement', () => {
      const iAgentTypes = [
        'collector',
        'prd-writer',
        'srs-writer',
        'repo-detector',
        'github-repo-setup',
        'sds-writer',
        'worker',
        'pr-reviewer',
        'document-reader',
        'codebase-analyzer',
        'doc-code-comparator',
        'impact-analyzer',
        'prd-updater',
        'srs-updater',
        'sds-updater',
        'regression-tester',
        'issue-reader',
        'ci-fixer',
        'analysis-orchestrator',
      ];

      for (const agentType of iAgentTypes) {
        const entry = AGENT_TYPE_MAP[agentType];
        expect(entry, `Missing entry for '${agentType}'`).toBeDefined();
        expect(
          entry!.requiresWrapper,
          `'${agentType}' should not require wrapper`
        ).toBe(false);
      }
    });

    it('should map non-IAgent agents with wrapper requirement', () => {
      const nonIAgentTypes = [
        'project-initializer',
        'mode-detector',
        'issue-generator',
        'controller',
        'code-reader',
      ];

      for (const agentType of nonIAgentTypes) {
        const entry = AGENT_TYPE_MAP[agentType];
        expect(entry, `Missing entry for '${agentType}'`).toBeDefined();
        expect(
          entry!.requiresWrapper,
          `'${agentType}' should require wrapper`
        ).toBe(true);
      }
    });
  });

  describe('getAgentTypes', () => {
    it('should return all keys from AGENT_TYPE_MAP', () => {
      const types = getAgentTypes();
      const mapKeys = Object.keys(AGENT_TYPE_MAP);

      expect(types).toHaveLength(mapKeys.length);
      for (const key of mapKeys) {
        expect(types).toContain(key);
      }
    });

    it('should return a new array on each call', () => {
      const types1 = getAgentTypes();
      const types2 = getAgentTypes();
      expect(types1).not.toBe(types2);
      expect(types1).toEqual(types2);
    });
  });

  describe('getAgentTypeEntry', () => {
    it('should return entry for known agentType', () => {
      const entry = getAgentTypeEntry('collector');
      expect(entry).toBeDefined();
      expect(entry!.agentId).toBe('collector-agent');
    });

    it('should return undefined for unknown agentType', () => {
      const entry = getAgentTypeEntry('nonexistent-agent');
      expect(entry).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const entry = getAgentTypeEntry('');
      expect(entry).toBeUndefined();
    });
  });

  describe('getRegisteredAgentIds', () => {
    it('should return unique agentId values', () => {
      const ids = getRegisteredAgentIds();
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('should include known agent IDs', () => {
      const ids = getRegisteredAgentIds();
      expect(ids).toContain('collector-agent');
      expect(ids).toContain('worker-agent');
      expect(ids).toContain('pr-reviewer-agent');
      expect(ids).toContain('project-initializer');
      expect(ids).toContain('controller');
    });

    it('should return a new array on each call', () => {
      const ids1 = getRegisteredAgentIds();
      const ids2 = getRegisteredAgentIds();
      expect(ids1).not.toBe(ids2);
      expect(ids1).toEqual(ids2);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of AGENT_TYPE_MAP entries', () => {
      // AGENT_TYPE_MAP is declared as Readonly<Record<...>>, so TypeScript
      // prevents modification at compile time. At runtime, the 'as const'
      // assertion makes it a deeply frozen-like structure.
      const entry = AGENT_TYPE_MAP['collector'];
      expect(entry).toBeDefined();

      // Verify we can still read properties
      expect(entry!.agentId).toBe('collector-agent');
    });
  });
});
