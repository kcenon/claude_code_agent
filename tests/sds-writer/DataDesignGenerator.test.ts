import { describe, it, expect } from 'vitest';
import { DataDesignGenerator } from '../../src/sds-writer/DataDesignGenerator.js';
import type { DataModel, ParsedSRS, ParsedSRSFeature } from '../../src/sds-writer/types.js';

describe('DataDesignGenerator', () => {
  const createModel = (overrides: Partial<DataModel> = {}): DataModel => ({
    id: 'DM-001',
    name: 'User',
    category: 'entity',
    description: 'Represents an application user',
    sourceComponent: 'CMP-001',
    properties: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Unique identifier',
        validation: ['uuid'],
      },
      { name: 'email', type: 'string', required: true, description: 'Email address' },
      { name: 'createdAt', type: 'datetime', required: true, description: 'Creation timestamp' },
      { name: 'updatedAt', type: 'datetime', required: true, description: 'Last update timestamp' },
    ],
    relationships: [],
    indexes: [
      { name: 'idx_users_pk', fields: ['id'], unique: true },
      { name: 'idx_users_email', fields: ['email'], unique: true },
    ],
    ...overrides,
  });

  const createFeature = (id: string, name: string): ParsedSRSFeature => ({
    id,
    name,
    description: `Description for ${name}`,
    priority: 'P1',
    sourceRequirements: ['FR-001'],
    useCaseIds: ['UC-001'],
    acceptanceCriteria: [],
  });

  const createParsedSRS = (features: readonly ParsedSRSFeature[] = []): ParsedSRS => ({
    metadata: {
      documentId: 'SRS-001',
      sourcePRD: 'PRD-001',
      version: '1.0.0',
      status: 'Draft',
      projectId: 'test-project',
    },
    productName: 'Test Product',
    productDescription: 'A test product for DBS generation',
    features,
    nfrs: [],
    constraints: [],
    assumptions: [],
    useCases: [],
  });

  describe('isApplicable', () => {
    it('returns false when no data models are provided', () => {
      const generator = new DataDesignGenerator();
      expect(generator.isApplicable([])).toBe(false);
    });

    it('returns true when at least one data model is provided', () => {
      const generator = new DataDesignGenerator();
      expect(generator.isApplicable([createModel()])).toBe(true);
    });
  });

  describe('generateSummarySection', () => {
    it('returns a "not applicable" notice when no data models are provided', () => {
      const generator = new DataDesignGenerator();
      const result = generator.generateSummarySection({
        projectId: 'test-project',
        models: [],
      });
      expect(result).toContain('not applicable');
      expect(result).not.toContain('DBS-test-project');
    });

    it('returns a table row for each model and a cross-reference link', () => {
      const generator = new DataDesignGenerator();
      const result = generator.generateSummarySection({
        projectId: 'test-project',
        models: [createModel(), createModel({ id: 'DM-002', name: 'Order' })],
      });

      expect(result).toContain('| User | entity |');
      expect(result).toContain('| Order | entity |');
      expect(result).toContain('| Data Model | Category | Properties |');
      expect(result).toContain('Cross-reference');
      expect(result).toContain('DBS-test-project');
      expect(result).toContain('../dbs/DBS-test-project.md');
    });

    it('summary section does NOT contain full table definitions', () => {
      const generator = new DataDesignGenerator();
      const result = generator.generateSummarySection({
        projectId: 'test-project',
        models: [createModel()],
      });
      // Summary should not inline column-level details
      expect(result).not.toContain('CURRENT_TIMESTAMP');
      expect(result).not.toContain('Foreign Keys');
    });

    it('returns Korean cross-reference when language is kr', () => {
      const generator = new DataDesignGenerator({ language: 'kr' });
      const result = generator.generateSummarySection({
        projectId: 'test-project',
        models: [createModel()],
      });
      expect(result).toContain('크로스레퍼런스');
      expect(result).toContain('DBS-test-project');
    });
  });

  describe('generateFullContent', () => {
    it('includes all required DBS sections', () => {
      const generator = new DataDesignGenerator();
      const srs = createParsedSRS([createFeature('SF-001', 'User Management')]);
      const result = generator.generateFullContent({
        projectId: 'test-project',
        models: [createModel()],
        srs,
      });

      expect(result).toContain('## 1. Overview');
      expect(result).toContain('## 2. Entity Relationship Diagram');
      expect(result).toContain('## 3. Table Definitions');
      expect(result).toContain('## 4. Data Access Patterns');
      expect(result).toContain('## 5. Migration Strategy');
      expect(result).toContain('## 6. SRS Traceability');
    });

    it('renders a Mermaid ER diagram', () => {
      const generator = new DataDesignGenerator();
      const srs = createParsedSRS();
      const result = generator.generateFullContent({
        projectId: 'test-project',
        models: [createModel()],
        srs,
      });

      expect(result).toContain('```mermaid');
      expect(result).toContain('erDiagram');
      expect(result).toContain('User {');
    });

    it('renders full column definitions with nullable and default columns', () => {
      const generator = new DataDesignGenerator();
      const srs = createParsedSRS();
      const result = generator.generateFullContent({
        projectId: 'test-project',
        models: [createModel()],
        srs,
      });

      expect(result).toContain('| Column | Type | Nullable | Default | Description |');
      expect(result).toContain('gen_random_uuid()');
      expect(result).toContain('CURRENT_TIMESTAMP');
      // id is required -> Nullable: NO
      expect(result).toMatch(/\| id \| string \| NO \|/);
    });

    it('renders index definitions when present', () => {
      const generator = new DataDesignGenerator();
      const srs = createParsedSRS();
      const result = generator.generateFullContent({
        projectId: 'test-project',
        models: [createModel()],
        srs,
      });

      expect(result).toContain('**Indexes:**');
      expect(result).toContain('idx_users_pk');
      expect(result).toContain('idx_users_email');
    });

    it('renders foreign keys section only when relationships exist', () => {
      const generator = new DataDesignGenerator();
      const srs = createParsedSRS();

      const withoutFk = generator.generateFullContent({
        projectId: 'test-project',
        models: [createModel()],
        srs,
      });
      expect(withoutFk).not.toContain('**Foreign Keys:**');

      const withFk = generator.generateFullContent({
        projectId: 'test-project',
        models: [
          createModel({
            relationships: [
              {
                target: 'Account',
                type: 'many-to-many',
                foreignKey: 'accountId',
                description: 'Reference to Account',
              },
            ],
          }),
        ],
        srs,
      });
      expect(withFk).toContain('**Foreign Keys:**');
      expect(withFk).toContain('accountId');
      expect(withFk).toContain('accounts');
    });

    it('renders traceability rows for each feature', () => {
      const generator = new DataDesignGenerator();
      const srs = createParsedSRS([
        createFeature('SF-001', 'User Management'),
        createFeature('SF-002', 'Order Processing'),
      ]);
      const result = generator.generateFullContent({
        projectId: 'test-project',
        models: [createModel()],
        srs,
      });

      expect(result).toContain('SF-001: User Management');
      expect(result).toContain('SF-002: Order Processing');
    });

    it('renders Korean content when language is kr', () => {
      const generator = new DataDesignGenerator({ language: 'kr' });
      const srs = createParsedSRS([createFeature('SF-001', 'User Management')]);
      const result = generator.generateFullContent({
        projectId: 'test-project',
        models: [createModel()],
        srs,
      });

      expect(result).toContain('데이터베이스 스키마 명세');
      expect(result).toContain('개요');
      expect(result).toContain('엔티티 관계 다이어그램');
      expect(result).toContain('테이블 정의');
      expect(result).toContain('데이터 접근 패턴');
      expect(result).toContain('마이그레이션 전략');
      expect(result).toContain('SRS 추적성');
    });

    it('includes project metadata in header', () => {
      const generator = new DataDesignGenerator();
      const srs = createParsedSRS();
      const result = generator.generateFullContent({
        projectId: 'test-project',
        models: [createModel()],
        srs,
      });

      expect(result).toContain('DBS-test-project');
      expect(result).toContain('SRS-001');
      expect(result).toContain('Test Product');
    });
  });

  describe('access patterns', () => {
    it('surfaces indexed fields as secondary lookup paths', () => {
      const generator = new DataDesignGenerator();
      const srs = createParsedSRS();
      const result = generator.generateFullContent({
        projectId: 'test-project',
        models: [createModel()],
        srs,
      });

      expect(result).toContain('Data Access Patterns');
      // email is in an index -> should appear as secondary lookup
      expect(result).toContain('`email`');
    });
  });
});
