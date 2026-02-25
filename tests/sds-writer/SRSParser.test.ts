import { describe, it, expect } from 'vitest';
import { SRSParser } from '../../src/sds-writer/SRSParser.js';
import { SRSParseError } from '../../src/sds-writer/errors.js';

describe('SRSParser', () => {
  const createSampleSRS = (): string => `
# Software Requirements Specification: Test Product

| **Document ID** | SRS-001 |
| **Source PRD** | PRD-001 |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Project ID** | test-project |

---

## 1. Introduction

### 1.1 Purpose

**Test Product** is a system for testing SRS parsing.

This document describes the software requirements.

## 2. Software Features

### SF-001: User Authentication

| **Priority** | P0 |
| **Source** | FR-001 |
| **Use Cases** | UC-001, UC-002 |

**Description:**

Users can authenticate using email and password.

**Acceptance Criteria:**

- User can log in with valid credentials
- User receives error for invalid credentials
- Session is created upon successful login

### SF-002: Data Export

| **Priority** | P1 |
| **Source** | FR-002 |
| **Use Cases** | UC-003 |

**Description:**

Users can export their data in various formats.

**Acceptance Criteria:**

- Export to CSV format
- Export to JSON format
- Include all user data

## 3. Use Cases

#### UC-001: User Login

| **Primary Actor** | User |
| **Source Feature** | SF-001 |

**Preconditions:**

- User has an account

**Main Success Scenario:**

1. User enters email
2. User enters password
3. System validates credentials
4. System creates session

**Postconditions:**

- User is logged in

**Alternative Scenarios:**

##### Invalid Credentials

- System shows error message
- User can retry

#### UC-002: User Logout

| **Primary Actor** | User |
| **Source Feature** | SF-001 |

**Preconditions:**

- User is logged in

**Main Success Scenario:**

1. User clicks logout
2. System destroys session

**Postconditions:**

- User is logged out

## 4. Non-Functional Requirements

### NFR-001: Performance Requirements

| **Category** | Performance |
| **Priority** | P1 |
| **Metric** | Response time < 200ms |

System should respond within 200ms for all API calls.

### NFR-002: Security Requirements

| **Category** | Security |
| **Priority** | P0 |

All data must be encrypted at rest and in transit.

## 5. Constraints

### CON-001: Technical Constraints

| **Type** | Technical |

Must use TypeScript and Node.js.

## 6. Assumptions

- Users have modern browsers
- Internet connection is stable
`;

  describe('parse', () => {
    it('should parse metadata correctly', () => {
      const parser = new SRSParser();
      const result = parser.parse(createSampleSRS());

      expect(result.metadata.documentId).toBe('SRS-001');
      expect(result.metadata.sourcePRD).toBe('PRD-001');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.status).toBe('Draft');
      expect(result.metadata.projectId).toBe('test-project');
    });

    it('should parse product information', () => {
      const parser = new SRSParser();
      const result = parser.parse(createSampleSRS());

      expect(result.productName).toContain('Test Product');
      expect(result.productDescription).toBeTruthy();
    });

    it('should parse features correctly', () => {
      const parser = new SRSParser();
      const result = parser.parse(createSampleSRS());

      expect(result.features).toHaveLength(2);

      const authFeature = result.features.find((f) => f.id === 'SF-001');
      expect(authFeature).toBeDefined();
      expect(authFeature?.name).toBe('User Authentication');
      expect(authFeature?.priority).toBe('P0');
      expect(authFeature?.sourceRequirements).toContain('FR-001');
      expect(authFeature?.useCaseIds).toContain('UC-001');
      expect(authFeature?.useCaseIds).toContain('UC-002');
      expect(authFeature?.acceptanceCriteria).toHaveLength(3);
    });

    it('should parse use cases correctly', () => {
      const parser = new SRSParser();
      const result = parser.parse(createSampleSRS());

      expect(result.useCases).toHaveLength(2);

      const loginUseCase = result.useCases.find((uc) => uc.id === 'UC-001');
      expect(loginUseCase).toBeDefined();
      expect(loginUseCase?.name).toBe('User Login');
      expect(loginUseCase?.primaryActor).toBe('User');
      expect(loginUseCase?.sourceFeatureId).toBe('SF-001');
      expect(loginUseCase?.preconditions).toHaveLength(1);
      expect(loginUseCase?.mainScenario.length).toBeGreaterThan(0);
      expect(loginUseCase?.postconditions).toHaveLength(1);
      expect(loginUseCase?.alternativeScenarios).toHaveLength(1);
    });

    it('should parse NFRs correctly', () => {
      const parser = new SRSParser();
      const result = parser.parse(createSampleSRS());

      expect(result.nfrs).toHaveLength(2);

      const perfNFR = result.nfrs.find((n) => n.id === 'NFR-001');
      expect(perfNFR).toBeDefined();
      expect(perfNFR?.category).toBe('Performance');
      expect(perfNFR?.priority).toBe('P1');
      expect(perfNFR?.metric).toContain('200ms');
    });

    it('should parse constraints correctly', () => {
      const parser = new SRSParser();
      const result = parser.parse(createSampleSRS());

      expect(result.constraints).toHaveLength(1);
      expect(result.constraints[0]?.id).toBe('CON-001');
      expect(result.constraints[0]?.type).toBe('Technical');
    });

    it('should parse assumptions correctly', () => {
      const parser = new SRSParser();
      const result = parser.parse(createSampleSRS());

      expect(result.assumptions).toHaveLength(2);
      expect(result.assumptions).toContain('Users have modern browsers');
    });
  });

  describe('options', () => {
    it('should skip use cases when parseUseCases is false', () => {
      const parser = new SRSParser({ parseUseCases: false });
      const result = parser.parse(createSampleSRS());

      expect(result.useCases).toHaveLength(0);
    });

    it('should skip NFRs when parseNFRs is false', () => {
      const parser = new SRSParser({ parseNFRs: false });
      const result = parser.parse(createSampleSRS());

      expect(result.nfrs).toHaveLength(0);
    });
  });

  describe('validate', () => {
    it('should return no errors for valid SRS', () => {
      const parser = new SRSParser();
      const srs = parser.parse(createSampleSRS());
      const errors = parser.validate(srs);

      expect(errors).toHaveLength(0);
    });

    it('should detect missing document ID', () => {
      const parser = new SRSParser();
      const srs = parser.parse('# Empty SRS');
      const errors = parser.validate(srs);

      expect(errors.some((e) => e.includes('document ID'))).toBe(true);
    });

    it('should detect no features', () => {
      const parser = new SRSParser();
      const srs = parser.parse(`
| **Document ID** | SRS-001 |
      `);
      const errors = parser.validate(srs);

      expect(errors.some((e) => e.includes('No features'))).toBe(true);
    });

    it('should throw in strict mode for invalid SRS', () => {
      const parser = new SRSParser({ strict: true });
      const srs = parser.parse('# Empty SRS');

      expect(() => parser.validate(srs)).toThrow(SRSParseError);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const parser = new SRSParser();
      const result = parser.parse('');

      expect(result.metadata.documentId).toBe('');
      expect(result.features).toHaveLength(0);
    });

    it('should extract project ID from document ID', () => {
      const parser = new SRSParser();
      const result = parser.parse(`
| **Document ID** | SRS-my-project |
      `);

      expect(result.metadata.projectId).toBe('my-project');
    });

    it('should handle features without use cases', () => {
      const parser = new SRSParser();
      const result = parser.parse(`
## 2. Software Features

### SF-001: Simple Feature

| **Priority** | P0 |

**Description:**

A simple feature.
      `);

      expect(result.features).toHaveLength(1);
      expect(result.features[0]?.useCaseIds).toHaveLength(0);
    });

    it('should parse features section with "System Features" heading', () => {
      const parser = new SRSParser();
      const result = parser.parse(`
## 2. System Features

### SF-001: Feature One

| **Priority** | P0 |
| **Source** | FR-001 |

**Description:**

A feature under System Features heading.

**Acceptance Criteria:**

- Criterion one
- Criterion two

### SF-002: Feature Two

| **Priority** | P1 |
| **Source** | FR-002 |

**Description:**

Another feature.
      `);

      expect(result.features).toHaveLength(2);
      expect(result.features[0]?.id).toBe('SF-001');
      expect(result.features[0]?.name).toBe('Feature One');
      expect(result.features[0]?.priority).toBe('P0');
      expect(result.features[0]?.sourceRequirements).toContain('FR-001');
      expect(result.features[0]?.acceptanceCriteria).toHaveLength(2);
      expect(result.features[1]?.id).toBe('SF-002');
      expect(result.features[1]?.name).toBe('Feature Two');
    });

    it('should handle priority extraction from complex strings', () => {
      const parser = new SRSParser();
      const result = parser.parse(`
## 2. Software Features

### SF-001: Feature

| **Priority** | P0 / P1 / P2 / P3 |
      `);

      expect(result.features[0]?.priority).toBe('P0');
    });
  });
});
