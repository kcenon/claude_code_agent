import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  IssueGenerator,
  getIssueGenerator,
  resetIssueGenerator,
  SDSNotFoundError,
  SDSValidationError,
} from '../../src/issue-generator/index.js';

describe('IssueGenerator', () => {
  let testDir: string;
  let generator: IssueGenerator;

  const sampleSDS = `
# SDS: Sample Product

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

## 3. Component Design

### CMP-001: User Service

| Attribute | Value |
|-----------|-------|
| **Source Feature** | SF-001 |
| **Responsibility** | User management |
| **Priority** | P0 |

**Description:**
Handles user CRUD operations.

**Interfaces:**
\`\`\`typescript
interface IUserService {
  createUser(data: UserData): Promise<User>;
  getUser(id: string): Promise<User>;
}
\`\`\`

**Dependencies:**

**Implementation Notes:**
Use repository pattern.

---

### CMP-002: Auth Service

| Attribute | Value |
|-----------|-------|
| **Source Feature** | SF-002 |
| **Responsibility** | Authentication |
| **Priority** | P1 |

**Description:**
Handles authentication.

**Interfaces:**
\`\`\`typescript
interface IAuthService {
  login(email: string, password: string): Promise<Session>;
}
\`\`\`

**Dependencies:**
- CMP-001

**Implementation Notes:**
Use JWT tokens.

---

## 4. Data Design

---

## 9. Traceability Matrix

| Component | SRS Feature | Use Cases | PRD Requirement |
|-----------|-------------|-----------|-----------------|
| CMP-001 | SF-001 | UC-001 | FR-001 |
| CMP-002 | SF-002 | UC-002 | FR-002 |

---

## 10. Appendix
`;

  beforeEach(() => {
    resetIssueGenerator();
    testDir = path.join(os.tmpdir(), `issue-gen-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    generator = new IssueGenerator({
      outputPath: path.join(testDir, 'output'),
    });
  });

  afterEach(() => {
    resetIssueGenerator();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('generate', () => {
    it('should generate issues from SDS content', () => {
      const result = generator.generate(sampleSDS);

      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      expect(result.dependencyGraph.nodes.length).toBeGreaterThanOrEqual(2);
      expect(result.summary.totalIssues).toBeGreaterThanOrEqual(2);
    });

    it('should include traceability in issues', () => {
      const result = generator.generate(sampleSDS);

      const userIssue = result.issues.find((i) =>
        i.traceability.sdsComponent.startsWith('CMP-001')
      );

      expect(userIssue).toBeDefined();
      expect(userIssue?.traceability.srsFeature).toBe('SF-001');
    });

    it('should resolve dependencies between issues', () => {
      const result = generator.generate(sampleSDS);

      const authIssue = result.issues.find((i) =>
        i.traceability.sdsComponent.startsWith('CMP-002')
      );

      expect(authIssue).toBeDefined();
      expect(authIssue?.dependencies.blockedBy.length).toBeGreaterThan(0);
      expect(
        authIssue?.dependencies.blockedBy.every((d) => d.startsWith('ISS-'))
      ).toBe(true);
    });

    it('should generate effort estimations', () => {
      const result = generator.generate(sampleSDS);

      for (const issue of result.issues) {
        expect(issue.estimation.size).toMatch(/^(XS|S|M|L|XL)$/);
        expect(issue.estimation.hours).toBeGreaterThan(0);
      }
    });

    it('should build dependency graph', () => {
      const result = generator.generate(sampleSDS);

      expect(result.dependencyGraph.nodes.length).toBeGreaterThan(0);
      expect(result.dependencyGraph.executionOrder.length).toBeGreaterThan(0);
      expect(result.dependencyGraph.parallelGroups.length).toBeGreaterThan(0);
    });

    it('should generate summary statistics', () => {
      const result = generator.generate(sampleSDS);

      expect(result.summary.totalIssues).toBeGreaterThan(0);
      expect(result.summary.componentsProcessed).toBe(2);
      expect(result.summary.totalEstimatedHours).toBeGreaterThan(0);
      expect(result.summary.generatedAt).toBeDefined();
    });
  });

  describe('generateFromFile', () => {
    it('should generate issues from SDS file', async () => {
      const sdsPath = path.join(testDir, 'sds.md');
      fs.writeFileSync(sdsPath, sampleSDS);

      const result = await generator.generateFromFile(sdsPath, '001');

      expect(result.issues.length).toBeGreaterThanOrEqual(2);

      // Check output files were created
      const outputDir = path.join(testDir, 'output', '001');
      expect(fs.existsSync(path.join(outputDir, 'issue_list.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'dependency_graph.json'))).toBe(
        true
      );
      expect(fs.existsSync(path.join(outputDir, 'generation_summary.json'))).toBe(
        true
      );
    });

    it('should throw SDSNotFoundError for missing file', async () => {
      await expect(
        generator.generateFromFile('/nonexistent/path.md', '001')
      ).rejects.toThrow(SDSNotFoundError);
    });
  });

  describe('parse', () => {
    it('should parse SDS without generating issues', () => {
      const result = generator.parse(sampleSDS);

      expect(result.components.length).toBe(2);
      expect(result.metadata.documentId).toBe('SDS-001');
    });
  });

  describe('validate', () => {
    it('should return empty array for valid SDS', () => {
      const errors = generator.validate(sampleSDS);
      expect(errors.length).toBe(0);
    });

    it('should return errors for invalid SDS', () => {
      const errors = generator.validate('# Invalid SDS');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('getExecutionOrder', () => {
    it('should return ordered issue IDs', () => {
      const result = generator.generate(sampleSDS);
      const order = generator.getExecutionOrder(result);

      expect(order.length).toBe(result.issues.length);
      expect(order.every((id) => id.startsWith('ISS-'))).toBe(true);
    });
  });

  describe('getParallelGroups', () => {
    it('should return groups with issues', () => {
      const result = generator.generate(sampleSDS);
      const groups = generator.getParallelGroups(result);

      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0]?.issues.length).toBeGreaterThan(0);
    });
  });

  describe('getGraphStatistics', () => {
    it('should return graph statistics', () => {
      const result = generator.generate(sampleSDS);
      const stats = generator.getGraphStatistics(result);

      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.rootNodes).toBeGreaterThan(0);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getIssueGenerator', () => {
      const instance1 = getIssueGenerator();
      const instance2 = getIssueGenerator();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getIssueGenerator();
      resetIssueGenerator();
      const instance2 = getIssueGenerator();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('validation mode', () => {
    it('should skip validation when disabled', () => {
      const noValidateGenerator = new IssueGenerator({
        validateSDS: false,
        outputPath: testDir,
      });

      const invalidSDS = '# Empty SDS';
      expect(() => noValidateGenerator.generate(invalidSDS)).not.toThrow(
        SDSValidationError
      );
    });
  });
});
