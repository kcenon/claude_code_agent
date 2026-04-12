import { describe, it, expect } from 'vitest';
import {
  ManifestSchema,
  ManifestEntrySchema,
  BundlesSchema,
  GraphSchema,
  RouterSchema,
  DocIndexResultSchema,
  validateDocIndexResult,
  validateManifest,
  validateBundles,
  validateGraph,
  validateRouter,
  DOC_INDEX_SCHEMA_VERSION,
} from '../../src/doc-index-generator/index.js';

describe('Doc Index Generator Schemas', () => {
  const now = new Date().toISOString();

  describe('ManifestSchema', () => {
    it('should validate a valid manifest', () => {
      const data = {
        version: DOC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        mode: 'flat' as const,
        documents: [
          {
            path: 'docs/prd.md',
            title: 'Product Requirements',
            docType: 'PRD',
            keywords: ['requirements', 'product'],
            sections: [
              { heading: 'Overview', level: 1, lineStart: 1, lineEnd: 20 },
              { heading: 'Features', level: 2, lineStart: 22, lineEnd: 50 },
            ],
          },
        ],
      };
      const result = ManifestSchema.parse(data);
      expect(result.documents).toHaveLength(1);
      expect(result.mode).toBe('flat');
    });

    it('should reject a manifest with missing required fields', () => {
      expect(() => ManifestSchema.parse({ version: '1.0.0' })).toThrow();
    });

    it('should validate a manifest entry with minimal fields', () => {
      const entry = { path: 'README.md', title: 'README' };
      const result = ManifestEntrySchema.parse(entry);
      expect(result.keywords).toEqual([]);
      expect(result.sections).toEqual([]);
    });
  });

  describe('BundlesSchema', () => {
    it('should validate a valid bundles file', () => {
      const data = {
        version: DOC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        bundles: [
          {
            id: 'auth',
            name: 'Authentication',
            description: 'Authentication feature bundle',
            documents: [
              {
                path: 'docs/prd.md',
                sections: ['Authentication Requirements'],
                lineRanges: [{ start: 10, end: 30 }],
              },
            ],
          },
        ],
      };
      const result = BundlesSchema.parse(data);
      expect(result.bundles).toHaveLength(1);
      expect(result.bundles[0]?.documents).toHaveLength(1);
    });

    it('should preserve custom fields in bundles', () => {
      const data = {
        version: DOC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        bundles: [
          {
            id: 'core',
            name: 'Core',
            documents: [],
            custom: { owner: 'team-a', priority: 'high' },
          },
        ],
      };
      const result = BundlesSchema.parse(data);
      expect(result.bundles[0]?.custom).toEqual({ owner: 'team-a', priority: 'high' });
    });
  });

  describe('GraphSchema', () => {
    it('should validate a valid graph', () => {
      const data = {
        version: DOC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        nodes: ['docs/prd.md', 'docs/srs.md', 'docs/sds.md'],
        edges: [
          { source: 'docs/prd.md', target: 'docs/srs.md', type: 'implements' as const },
          { source: 'docs/srs.md', target: 'docs/sds.md', type: 'implements' as const },
        ],
      };
      const result = GraphSchema.parse(data);
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
    });

    it('should default edge type to references', () => {
      const data = {
        version: DOC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        nodes: ['a.md', 'b.md'],
        edges: [{ source: 'a.md', target: 'b.md' }],
      };
      const result = GraphSchema.parse(data);
      expect(result.edges[0]?.type).toBe('references');
    });
  });

  describe('RouterSchema', () => {
    it('should validate a valid router', () => {
      const data = {
        version: DOC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        rules: [
          { keywords: ['login', 'auth', 'session'], bundleId: 'auth', priority: 10 },
          { keywords: ['database', 'schema'], bundleId: 'data', priority: 5 },
        ],
      };
      const result = RouterSchema.parse(data);
      expect(result.rules).toHaveLength(2);
    });

    it('should reject rules with empty keywords', () => {
      const data = {
        version: DOC_INDEX_SCHEMA_VERSION,
        generatedAt: now,
        rules: [{ keywords: [], bundleId: 'auth' }],
      };
      expect(() => RouterSchema.parse(data)).toThrow();
    });
  });

  describe('DocIndexResultSchema', () => {
    it('should validate a successful result', () => {
      const data = {
        success: true,
        artifacts: [
          'docs/.index/manifest.yaml',
          'docs/.index/bundles.yaml',
          'docs/.index/graph.yaml',
          'docs/.index/router.yaml',
        ],
        stats: {
          documentsIndexed: 12,
          bundlesCreated: 4,
          crossReferences: 18,
          processingTimeMs: 350,
        },
      };
      const result = DocIndexResultSchema.parse(data);
      expect(result.success).toBe(true);
      expect(result.stats?.documentsIndexed).toBe(12);
    });

    it('should validate a minimal failed result', () => {
      const result = DocIndexResultSchema.parse({ success: false });
      expect(result.success).toBe(false);
      expect(result.artifacts).toEqual([]);
    });
  });

  describe('Validation utilities', () => {
    it('validateDocIndexResult should parse valid data', () => {
      const result = validateDocIndexResult({ success: true, artifacts: ['test.yaml'] });
      expect(result.success).toBe(true);
    });

    it('validateManifest should parse valid data', () => {
      const result = validateManifest({
        generatedAt: now,
        mode: 'grouped',
        documents: [],
      });
      expect(result.mode).toBe('grouped');
    });

    it('validateBundles should parse valid data', () => {
      const result = validateBundles({
        generatedAt: now,
        bundles: [],
      });
      expect(result.bundles).toEqual([]);
    });

    it('validateGraph should parse valid data', () => {
      const result = validateGraph({
        generatedAt: now,
        nodes: [],
        edges: [],
      });
      expect(result.nodes).toEqual([]);
    });

    it('validateRouter should parse valid data', () => {
      const result = validateRouter({
        generatedAt: now,
        rules: [],
      });
      expect(result.rules).toEqual([]);
    });
  });
});
