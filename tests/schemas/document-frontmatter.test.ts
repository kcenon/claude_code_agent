/**
 * Tests for document frontmatter Zod schema definitions
 *
 * Validates runtime parsing behavior for YAML frontmatter
 * used in AD-SDLC pipeline documents (PRD, SRS, SDS).
 */

import { describe, it, expect } from 'vitest';

import {
  DocumentTypeSchema,
  DocumentStatusSchema,
  ApprovalEntrySchema,
  ChangeHistoryEntrySchema,
  DocumentFrontmatterSchema,
} from '../../src/schemas/document-frontmatter.js';

describe('DocumentTypeSchema', () => {
  it('should accept valid document types', () => {
    expect(DocumentTypeSchema.parse('PRD')).toBe('PRD');
    expect(DocumentTypeSchema.parse('SRS')).toBe('SRS');
    expect(DocumentTypeSchema.parse('SDS')).toBe('SDS');
  });

  it('should reject invalid document types', () => {
    const result = DocumentTypeSchema.safeParse('INVALID');
    expect(result.success).toBe(false);
  });
});

describe('DocumentStatusSchema', () => {
  it('should accept valid statuses', () => {
    expect(DocumentStatusSchema.parse('Draft')).toBe('Draft');
    expect(DocumentStatusSchema.parse('Review')).toBe('Review');
    expect(DocumentStatusSchema.parse('Approved')).toBe('Approved');
  });

  it('should reject invalid statuses', () => {
    const result = DocumentStatusSchema.safeParse('Pending');
    expect(result.success).toBe(false);
  });
});

describe('ApprovalEntrySchema', () => {
  it('should accept a full approval entry', () => {
    const data = {
      role: 'Technical Lead',
      name: 'John Doe',
      date: '2026-04-12',
      status: 'approved',
    };
    const result = ApprovalEntrySchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('Technical Lead');
      expect(result.data.status).toBe('approved');
    }
  });

  it('should accept a minimal approval entry', () => {
    const data = {
      role: 'Reviewer',
      status: 'pending',
    };
    const result = ApprovalEntrySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject invalid approval status', () => {
    const data = {
      role: 'Reviewer',
      status: 'maybe',
    };
    const result = ApprovalEntrySchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('ChangeHistoryEntrySchema', () => {
  it('should accept a valid change history entry', () => {
    const data = {
      version: '1.0.0',
      date: '2026-04-12',
      author: 'AD-SDLC PRD Writer Agent',
      description: 'Initial document generation',
    };
    const result = ChangeHistoryEntrySchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1.0.0');
    }
  });

  it('should reject entry missing required fields', () => {
    const data = {
      version: '1.0.0',
      date: '2026-04-12',
      // missing author and description
    };
    const result = ChangeHistoryEntrySchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('DocumentFrontmatterSchema', () => {
  it('should accept a complete frontmatter object', () => {
    const data = {
      doc_id: 'PRD-my-project',
      title: 'PRD: My Project',
      version: '1.0.0',
      status: 'Draft',
      generated_by: 'AD-SDLC PRD Writer Agent',
      generated_at: '2026-04-12T10:00:00.000Z',
      pipeline_session: 'session-123',
      source_documents: ['input.md'],
      approval: [{ role: 'Tech Lead', status: 'pending' }],
      change_history: [
        {
          version: '1.0.0',
          date: '2026-04-12',
          author: 'AD-SDLC PRD Writer Agent',
          description: 'Initial generation',
        },
      ],
    };
    const result = DocumentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.doc_id).toBe('PRD-my-project');
      expect(result.data.change_history).toHaveLength(1);
    }
  });

  it('should accept a minimal frontmatter object', () => {
    const data = {
      doc_id: 'SRS-001',
      title: 'SRS: Test',
      version: '1.0.0',
      status: 'Draft',
      generated_by: 'AD-SDLC SRS Writer Agent',
      generated_at: '2026-04-12T10:00:00.000Z',
    };
    const result = DocumentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject frontmatter missing required fields', () => {
    const data = {
      doc_id: 'PRD-001',
      // missing title, version, etc.
    };
    const result = DocumentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject frontmatter with invalid status', () => {
    const data = {
      doc_id: 'PRD-001',
      title: 'PRD: Test',
      version: '1.0.0',
      status: 'Invalid',
      generated_by: 'Test',
      generated_at: '2026-04-12T10:00:00.000Z',
    };
    const result = DocumentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
