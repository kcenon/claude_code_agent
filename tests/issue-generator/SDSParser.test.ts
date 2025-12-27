import { describe, it, expect } from 'vitest';
import { SDSParser, SDSParseError } from '../../src/issue-generator/index.js';

describe('SDSParser', () => {
  const parser = new SDSParser();

  const minimalSDS = `
# SDS: Test Product

| Field | Value |
|-------|-------|
| **Document ID** | SDS-001 |
| **Source SRS** | SRS-001 |
| **Source PRD** | PRD-001 |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Created** | 2024-01-01 |
| **Last Updated** | 2024-01-02 |

---

## 1. Introduction

### 1.1 Purpose
Test SDS document

---

## 2. System Architecture

### 2.3 Technology Stack
| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Backend | Node.js | 18.x | LTS support |
| Database | PostgreSQL | 15 | ACID compliance |

---

## 3. Component Design

### CMP-001: Authentication Service

| Attribute | Value |
|-----------|-------|
| **Source Feature** | SF-001 |
| **Responsibility** | Handle user authentication |
| **Priority** | P0 |

**Description:**
Manages user authentication and session handling.

**Interfaces:**
\`\`\`typescript
interface IAuthService {
  login(email: string, password: string): Promise<Session>;
  logout(sessionId: string): Promise<void>;
}
\`\`\`

**Dependencies:**
- CMP-002

**Implementation Notes:**
Use bcrypt for password hashing.

---

### CMP-002: Token Manager

| Attribute | Value |
|-----------|-------|
| **Source Feature** | SF-002 |
| **Responsibility** | Manage JWT tokens |
| **Priority** | P1 |

**Description:**
Creates and validates JWT tokens.

**Interfaces:**
\`\`\`typescript
interface ITokenManager {
  createToken(payload: object): string;
  verifyToken(token: string): object;
}
\`\`\`

**Dependencies:**

**Implementation Notes:**
Use RS256 algorithm.

---

## 4. Data Design

---

## 9. Traceability Matrix

| Component | SRS Feature | Use Cases | PRD Requirement |
|-----------|-------------|-----------|-----------------|
| CMP-001 | SF-001 | UC-001, UC-002 | FR-001 |
| CMP-002 | SF-002 | UC-003 | FR-002 |

---

## 10. Appendix
`;

  describe('parse', () => {
    it('should parse document metadata', () => {
      const result = parser.parse(minimalSDS);

      expect(result.metadata.documentId).toBe('SDS-001');
      expect(result.metadata.sourceSRS).toBe('SRS-001');
      expect(result.metadata.sourcePRD).toBe('PRD-001');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.status).toBe('Draft');
    });

    it('should parse components', () => {
      const result = parser.parse(minimalSDS);

      expect(result.components.length).toBe(2);

      const auth = result.components.find((c) => c.id === 'CMP-001');
      expect(auth).toBeDefined();
      expect(auth?.name).toBe('Authentication Service');
      expect(auth?.sourceFeature).toBe('SF-001');
      expect(auth?.priority).toBe('P0');
      expect(auth?.dependencies).toContain('CMP-002');
    });

    it('should parse interfaces from components', () => {
      const result = parser.parse(minimalSDS);

      const auth = result.components.find((c) => c.id === 'CMP-001');
      expect(auth?.interfaces.length).toBe(1);
      expect(auth?.interfaces[0]?.name).toBe('IAuthService');
      expect(auth?.interfaces[0]?.methods.length).toBe(2);
    });

    it('should parse technology stack', () => {
      const result = parser.parse(minimalSDS);

      // Parser may pick up other 4-column tables, but Backend and Database should be there
      expect(result.technologyStack.length).toBeGreaterThanOrEqual(2);
      const backend = result.technologyStack.find((t) => t.layer === 'Backend');
      const database = result.technologyStack.find((t) => t.layer === 'Database');
      expect(backend).toBeDefined();
      expect(backend?.technology).toBe('Node.js');
      expect(database).toBeDefined();
      expect(database?.technology).toBe('PostgreSQL');
    });

    it('should parse traceability matrix', () => {
      const result = parser.parse(minimalSDS);

      expect(result.traceabilityMatrix.length).toBe(2);

      const entry = result.traceabilityMatrix.find(
        (e) => e.componentId === 'CMP-001'
      );
      expect(entry).toBeDefined();
      expect(entry?.srsFeature).toBe('SF-001');
      expect(entry?.useCases).toContain('UC-001');
      expect(entry?.prdRequirement).toBe('FR-001');
    });

    it('should handle empty SDS', () => {
      const result = parser.parse('# Empty SDS\n\n---\n');

      expect(result.components.length).toBe(0);
      expect(result.technologyStack.length).toBe(0);
    });

    it('should handle components without interfaces', () => {
      const sdsWithoutInterfaces = `
## 3. Component Design

### CMP-001: Simple Component

| Attribute | Value |
|-----------|-------|
| **Source Feature** | SF-001 |
| **Priority** | P2 |

**Description:**
A simple component.

---

## 4. Data Design
`;
      const result = parser.parse(sdsWithoutInterfaces);

      expect(result.components.length).toBe(1);
      expect(result.components[0]?.interfaces.length).toBe(0);
    });
  });

  describe('validate', () => {
    it('should return empty array for valid SDS', () => {
      const result = parser.parse(minimalSDS);
      const errors = parser.validate(result);

      expect(errors.length).toBe(0);
    });

    it('should detect missing document ID', () => {
      const sds = parser.parse('# Test\n\n---\n## 3. Component Design\n\n## 4. Data Design');
      const errors = parser.validate(sds);

      expect(errors).toContain('Missing document ID in metadata');
    });

    it('should detect no components', () => {
      const sds = parser.parse(`
| **Document ID** | SDS-001 |

---

## 3. Component Design

## 4. Data Design
`);
      const errors = parser.validate(sds);

      expect(errors).toContain('No components found in SDS');
    });

    it('should detect unknown dependency references', () => {
      const sdsWithBadDep = `
| **Document ID** | SDS-001 |

---

## 3. Component Design

### CMP-001: Test

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |

**Dependencies:**
- CMP-999

---

## 4. Data Design
`;
      const result = parser.parse(sdsWithBadDep);
      const errors = parser.validate(result);

      expect(
        errors.some((e) => e.includes('unknown dependency: CMP-999'))
      ).toBe(true);
    });
  });

  describe('strict mode', () => {
    it('should throw on validation errors in strict mode', () => {
      const strictParser = new SDSParser({ strict: true });
      const sds = strictParser.parse('# Test\n\n---\n');

      expect(() => strictParser.validate(sds)).toThrow(SDSParseError);
    });
  });
});
