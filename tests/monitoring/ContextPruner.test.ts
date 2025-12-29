import { describe, it, expect } from 'vitest';
import { ContextPruner, createContextPruner } from '../../src/monitoring/index.js';
import type { ContentSection } from '../../src/monitoring/index.js';

describe('ContextPruner', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const pruner = createContextPruner(1000);
      const text = 'Hello world'; // 11 chars

      const tokens = pruner.estimateTokens(text);

      expect(tokens).toBe(3); // ~11/4 = 2.75, ceil = 3
    });

    it('should handle empty string', () => {
      const pruner = createContextPruner(1000);

      const tokens = pruner.estimateTokens('');

      expect(tokens).toBe(0);
    });
  });

  describe('createSection', () => {
    it('should create a content section with estimated tokens', () => {
      const pruner = createContextPruner(1000);

      const section = pruner.createSection('test-1', 'Hello world', {
        priority: 5,
        type: 'user',
      });

      expect(section.id).toBe('test-1');
      expect(section.content).toBe('Hello world');
      expect(section.estimatedTokens).toBe(3);
      expect(section.priority).toBe(5);
      expect(section.type).toBe('user');
    });
  });

  describe('prune', () => {
    it('should return all sections if within limit', () => {
      const pruner = createContextPruner(10000);

      const sections: ContentSection[] = [
        { id: '1', content: 'Section 1', estimatedTokens: 100 },
        { id: '2', content: 'Section 2', estimatedTokens: 100 },
      ];

      const result = pruner.prune(sections);

      expect(result.retainedSections.length).toBe(2);
      expect(result.prunedSections.length).toBe(0);
      expect(result.tokensSaved).toBe(0);
    });

    it('should prune low priority sections when over limit', () => {
      const pruner = createContextPruner(5000, {
        systemReserve: 500,
        outputReserve: 500,
      }); // 4000 available

      const sections: ContentSection[] = [
        { id: '1', content: 'High priority', estimatedTokens: 2000, priority: 10 },
        { id: '2', content: 'Low priority', estimatedTokens: 2000, priority: 1 },
        { id: '3', content: 'Medium priority', estimatedTokens: 2000, priority: 5 },
      ];

      const result = pruner.prune(sections);

      expect(result.retainedSections.length).toBe(2);
      expect(result.prunedSections.length).toBe(1);
      expect(result.retainedSections.some((s) => s.id === '1')).toBe(true);
    });

    it('should keep required sections', () => {
      const pruner = createContextPruner(3000, {
        systemReserve: 500,
        outputReserve: 500,
      }); // 2000 available

      const sections: ContentSection[] = [
        { id: '1', content: 'Required', estimatedTokens: 1500, required: true },
        { id: '2', content: 'Optional high priority', estimatedTokens: 1000, priority: 10 },
      ];

      const result = pruner.prune(sections);

      expect(result.retainedSections.some((s) => s.id === '1')).toBe(true);
      expect(result.prunedSections.length).toBe(1);
    });

    it('should calculate correct statistics', () => {
      const pruner = createContextPruner(4000, {
        systemReserve: 0,
        outputReserve: 0,
      });

      const sections: ContentSection[] = [
        { id: '1', content: 'Keep', estimatedTokens: 2000, priority: 10 },
        { id: '2', content: 'Prune', estimatedTokens: 3000, priority: 1 },
      ];

      const result = pruner.prune(sections);

      expect(result.originalTokens).toBe(5000);
      expect(result.tokensSaved).toBe(3000);
      expect(result.stats.sectionsAnalyzed).toBe(2);
      expect(result.stats.sectionsRetained).toBe(1);
      expect(result.stats.sectionsPruned).toBe(1);
      expect(result.stats.reductionPercent).toBe(60);
    });
  });

  describe('pruning strategies', () => {
    it('should use recency strategy', () => {
      const pruner = createContextPruner(3000, {
        strategy: 'recency',
        systemReserve: 0,
        outputReserve: 0,
      });

      const now = new Date();
      const old = new Date(now.getTime() - 3600000); // 1 hour ago

      const sections: ContentSection[] = [
        { id: 'old', content: 'Old', estimatedTokens: 2000, timestamp: old },
        { id: 'new', content: 'New', estimatedTokens: 2000, timestamp: now },
      ];

      const result = pruner.prune(sections);

      expect(result.retainedSections[0]?.id).toBe('new');
    });

    it('should use relevance strategy with keywords', () => {
      const pruner = createContextPruner(3000, {
        strategy: 'relevance',
        relevanceKeywords: ['important', 'critical'],
        systemReserve: 0,
        outputReserve: 0,
      });

      const sections: ContentSection[] = [
        { id: 'relevant', content: 'This is important and critical', estimatedTokens: 2000 },
        { id: 'irrelevant', content: 'This is just text', estimatedTokens: 2000 },
      ];

      const result = pruner.prune(sections);

      expect(result.retainedSections[0]?.id).toBe('relevant');
    });
  });

  describe('suggestTokenLimit', () => {
    it('should suggest limit based on model', () => {
      expect(ContextPruner.suggestTokenLimit('haiku')).toBe(80000);
      expect(ContextPruner.suggestTokenLimit('sonnet')).toBe(160000);
      expect(ContextPruner.suggestTokenLimit('opus')).toBe(160000);
    });

    it('should return default for unknown model', () => {
      expect(ContextPruner.suggestTokenLimit('unknown')).toBe(80000);
    });
  });
});
