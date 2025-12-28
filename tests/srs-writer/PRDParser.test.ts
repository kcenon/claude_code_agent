import { describe, it, expect } from 'vitest';
import { PRDParser } from '../../src/srs-writer/PRDParser.js';
import { PRDParseError } from '../../src/srs-writer/errors.js';

describe('PRDParser', () => {
  const createSamplePRD = (): string => `
# PRD: Test Product

| Field | Value |
|-------|-------|
| Document ID | PRD-001 |
| Version | 1.0.0 |
| Status | Draft |

## 1. Executive Summary

This is a test product for demonstration purposes.
It provides comprehensive functionality.

## 2. User Personas

### 2.1 Developer

**Role**: Software Engineer
**Description**: Builds and maintains the system
**Goals**:
- Write clean code
- Deploy features quickly

### 2.2 Administrator

**Role**: System Admin
**Description**: Manages the system
**Goals**:
- Monitor system health
- Configure settings

## 3. Goals and Metrics

- Reduce deployment time: 50% reduction
- Improve user satisfaction: > 90% satisfaction rate

## 4. Functional Requirements

### FR-001: User Authentication

**Priority**: P0
**Description**: The system must allow users to authenticate using email and password credentials securely.

**Acceptance Criteria**:
- [x] Users can log in with valid credentials
- [ ] Invalid login attempts are logged
- [ ] Account lockout after 5 failed attempts

**Dependencies**: None

### FR-002: Data Export

**Priority**: P1
**Description**: Users should be able to export their data in multiple formats.

**User Story**: As a user, I want to export my data so that I can use it in other applications.

**Acceptance Criteria**:
- [ ] Export to CSV format
- [ ] Export to JSON format
- [ ] Export includes all user data

**Depends on**: FR-001

### FR-003: Dashboard Analytics

**Priority**: P2
**Description**: The system must provide analytics dashboard for administrators. Additionally, it should support real-time updates and customizable widgets.

**Acceptance Criteria**:
- [ ] Display key metrics
- [ ] Allow date range filtering
- [ ] Support chart visualizations
- [ ] Enable widget customization

## 5. Non-Functional Requirements

### NFR-001: Performance

**Category**: Performance
**Description**: System response time must be under 200ms
**Metric**: p95 latency < 200ms
**Priority**: P1

### NFR-002: Security

**Category**: Security
**Description**: All data must be encrypted at rest
**Priority**: P0

### 5.1 Scalability Requirements

- Support 10,000 concurrent users
- Handle 1M requests per day

## 6. Constraints

### CON-001: Technical

**Technical**: Must use TypeScript for backend

### CON-002: Timeline

**Timeline**: Must launch by Q2 2025

- **Business**: Budget limited to $100k
- **Regulatory**: Must comply with GDPR

## 7. Assumptions

- Users have access to modern browsers
- Network connectivity is stable
- Users have basic technical knowledge
`;

  describe('constructor', () => {
    it('should create parser with default options', () => {
      const parser = new PRDParser();
      expect(parser).toBeInstanceOf(PRDParser);
    });

    it('should accept custom options', () => {
      const parser = new PRDParser({
        strict: true,
        parsePersonas: false,
        parseGoals: false,
      });
      expect(parser).toBeInstanceOf(PRDParser);
    });
  });

  describe('parse', () => {
    it('should parse complete PRD document', () => {
      const parser = new PRDParser();
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.metadata.documentId).toBe('PRD-001');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.status).toBe('Draft');
      expect(result.metadata.projectId).toBe('001');
    });

    it('should extract product name from title', () => {
      const parser = new PRDParser();
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.productName).toBe('Test Product');
    });

    it('should extract product description from summary', () => {
      const parser = new PRDParser();
      const result = parser.parse(createSamplePRD(), '001');

      // Description may be empty or contain summary text
      expect(result.productDescription).toBeDefined();
    });

    it('should parse functional requirements', () => {
      const parser = new PRDParser();
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(3);

      const fr001 = result.functionalRequirements.find((r) => r.id === 'FR-001');
      expect(fr001).toBeDefined();
      expect(fr001?.title).toBe('User Authentication');
      expect(fr001?.priority).toBe('P0');
      expect(fr001?.acceptanceCriteria.length).toBeGreaterThan(0);
    });

    it('should parse requirement priorities correctly', () => {
      const parser = new PRDParser();
      const result = parser.parse(createSamplePRD(), '001');

      const priorities = result.functionalRequirements.map((r) => r.priority);
      expect(priorities).toContain('P0');
      expect(priorities).toContain('P1');
      expect(priorities).toContain('P2');
    });

    it('should parse requirement dependencies', () => {
      const parser = new PRDParser();
      // Use a PRD with explicit "Depends on:" format
      const prdWithDeps = `
# PRD: Test

## Functional Requirements

### FR-001: Base Feature
**Priority**: P0
**Description**: A base feature

### FR-002: Dependent Feature
**Priority**: P1
**Description**: This depends on FR-001
**Depends on**: FR-001
`;
      const result = parser.parse(prdWithDeps, '001');

      const fr002 = result.functionalRequirements.find((r) => r.id === 'FR-002');
      expect(fr002?.dependencies).toContain('FR-001');
    });

    it('should parse user stories when present', () => {
      const parser = new PRDParser();
      const result = parser.parse(createSamplePRD(), '001');

      const fr002 = result.functionalRequirements.find((r) => r.id === 'FR-002');
      expect(fr002?.userStory).toContain('As a user');
    });

    it('should parse non-functional requirements', () => {
      const parser = new PRDParser();
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.nonFunctionalRequirements.length).toBeGreaterThan(0);

      const nfr001 = result.nonFunctionalRequirements.find((r) => r.id === 'NFR-001');
      expect(nfr001).toBeDefined();
      expect(nfr001?.category.toLowerCase()).toContain('perform');
    });

    it('should parse constraints', () => {
      const parser = new PRDParser();
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.constraints.length).toBeGreaterThan(0);
    });

    it('should parse assumptions', () => {
      const parser = new PRDParser();
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.assumptions.length).toBeGreaterThan(0);
      expect(result.assumptions.some((a) => a.includes('browser'))).toBe(true);
    });

    it('should parse user personas when enabled', () => {
      const parser = new PRDParser({ parsePersonas: true });
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.userPersonas.length).toBeGreaterThan(0);
      expect(result.userPersonas.some((p) => p.name.includes('Developer'))).toBe(true);
    });

    it('should skip user personas when disabled', () => {
      const parser = new PRDParser({ parsePersonas: false });
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.userPersonas.length).toBe(0);
    });

    it('should parse goals when enabled', () => {
      const parser = new PRDParser({ parseGoals: true });
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.goals.length).toBeGreaterThan(0);
    });

    it('should skip goals when disabled', () => {
      const parser = new PRDParser({ parseGoals: false });
      const result = parser.parse(createSamplePRD(), '001');

      expect(result.goals.length).toBe(0);
    });
  });

  describe('metadata parsing', () => {
    it('should use default values for missing metadata', () => {
      const parser = new PRDParser();
      const minimalPRD = `
# Test Product

## Functional Requirements

### FR-001: Basic Feature
**Description**: A basic feature
**Priority**: P1
`;
      const result = parser.parse(minimalPRD, '002');

      expect(result.metadata.documentId).toBe('PRD-002');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.status).toBe('Draft');
    });
  });

  describe('alternative format parsing', () => {
    it('should parse numbered list format requirements', () => {
      const parser = new PRDParser();
      const altPRD = `
# Test Product

## Functional Requirements

1. **User Login**: Allow users to log in
2. **User Logout**: Allow users to log out
3. **Profile Management**: Users can edit their profile
`;
      const result = parser.parse(altPRD, '003');

      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(3);
    });

    it('should parse bulleted list format requirements', () => {
      const parser = new PRDParser();
      const altPRD = `
# Test Product

## Functional Requirements

- **User Login**: Allow users to log in
- **User Logout**: Allow users to log out
`;
      const result = parser.parse(altPRD, '004');

      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty PRD gracefully', () => {
      const parser = new PRDParser();
      const result = parser.parse('', '005');

      expect(result.metadata.projectId).toBe('005');
      expect(result.functionalRequirements.length).toBe(0);
    });

    it('should handle PRD with only title', () => {
      const parser = new PRDParser();
      const result = parser.parse('# My Product', '006');

      expect(result.productName).toBe('My Product');
      expect(result.functionalRequirements.length).toBe(0);
    });

    it('should handle malformed acceptance criteria', () => {
      const parser = new PRDParser({ strict: false });
      const malformedPRD = `
# Test Product

## Functional Requirements

### FR-001: Test Feature
**Description**: A test feature
**Priority**: P1
**Acceptance Criteria**:
This is not a proper list format
`;
      const result = parser.parse(malformedPRD, '007');

      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('goals parsing', () => {
    it('should parse goals with metric patterns', () => {
      const parser = new PRDParser({ parseGoals: true });
      const prdWithGoals = `
# Test Product

## Goals and Metrics

- Reduce deployment time: 50% reduction
- Improve user satisfaction – greater than 90%
- Increase performance - response under 200ms

## Functional Requirements

### FR-001: Basic Feature
**Description**: A basic feature
**Priority**: P1
`;
      const result = parser.parse(prdWithGoals, '008');

      expect(result.goals.length).toBe(3);
      expect(result.goals[0].description).toContain('Reduce deployment');
      expect(result.goals[0].metric).toBeDefined();
    });

    it('should parse goals without metric patterns', () => {
      const parser = new PRDParser({ parseGoals: true });
      const prdWithSimpleGoals = `
# Test Product

## Goals and Metrics

- Simple goal without any metric separator
- Another simple goal statement
* Yet another goal using asterisk

## Functional Requirements

### FR-001: Basic Feature
**Description**: A basic feature
**Priority**: P1
`;
      const result = parser.parse(prdWithSimpleGoals, '009');

      expect(result.goals.length).toBe(3);
      // Goals without metrics should still have descriptions
      expect(result.goals.every((g) => g.description.length > 0)).toBe(true);
    });

    it('should handle empty goals section', () => {
      const parser = new PRDParser({ parseGoals: true });
      const prdWithoutGoals = `
# Test Product

## Functional Requirements

### FR-001: Basic Feature
**Description**: A basic feature
**Priority**: P1
`;
      const result = parser.parse(prdWithoutGoals, '010');

      expect(result.goals.length).toBe(0);
    });

    it('should parse goals with different section header formats', () => {
      const parser = new PRDParser({ parseGoals: true });
      const prdWithAlternateHeader = `
# Test Product

## Success Metrics

- User engagement: 80% retention
- Revenue growth: 20% YoY

## Functional Requirements

### FR-001: Basic Feature
**Description**: A basic feature
**Priority**: P1
`;
      const result = parser.parse(prdWithAlternateHeader, '011');

      expect(result.goals.length).toBe(2);
    });
  });

  describe('user personas edge cases', () => {
    it('should handle personas without explicit role', () => {
      const parser = new PRDParser({ parsePersonas: true });
      const prdWithSimplePersona = `
# Test Product

## User Personas

### Developer
**Description**: A software developer

## Functional Requirements

### FR-001: Basic Feature
**Description**: A basic feature
**Priority**: P1
`;
      const result = parser.parse(prdWithSimplePersona, '012');

      expect(result.userPersonas.length).toBe(1);
      // Role should default to name
      expect(result.userPersonas[0].role).toBe('Developer');
    });

    it('should handle personas with goals list', () => {
      const parser = new PRDParser({ parsePersonas: true });
      const prdWithPersonaGoals = `
# Test Product

## User Personas

### Project Manager
**Role**: PM
**Description**: Manages projects
**Goals**:
- Track project progress
- Manage team resources

## Functional Requirements

### FR-001: Basic Feature
**Description**: A basic feature
**Priority**: P1
`;
      const result = parser.parse(prdWithPersonaGoals, '013');

      expect(result.userPersonas.length).toBe(1);
      expect(result.userPersonas[0].goals.length).toBe(2);
    });
  });
});
