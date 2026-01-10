/**
 * Scalability Test Fixtures
 *
 * Provides fixtures for testing system behavior under scale.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Configuration for large project simulation
 */
export interface LargeProjectConfig {
  /** Number of issues to generate */
  issueCount: number;
  /** Number of components */
  componentCount: number;
  /** Number of source files */
  sourceFileCount: number;
  /** Base directory for the project */
  baseDir: string;
}

/**
 * Simulated issue structure
 */
export interface SimulatedIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  dependencies: number[];
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
}

/**
 * Generate a large set of simulated issues
 */
export function generateLargeIssueSet(count: number): SimulatedIssue[] {
  const issues: SimulatedIssue[] = [];
  const priorities: SimulatedIssue['priority'][] = ['P0', 'P1', 'P2', 'P3'];
  const efforts: SimulatedIssue['effort'][] = ['XS', 'S', 'M', 'L', 'XL'];

  for (let i = 1; i <= count; i++) {
    // Create dependencies on previous issues (max 3)
    const dependencies: number[] = [];
    if (i > 1) {
      const depCount = Math.min(3, Math.floor(Math.random() * 4));
      for (let j = 0; j < depCount; j++) {
        const depNum = Math.floor(Math.random() * (i - 1)) + 1;
        if (!dependencies.includes(depNum)) {
          dependencies.push(depNum);
        }
      }
    }

    issues.push({
      number: i,
      title: `[IMPL] Feature ${i}: Implement component functionality`,
      body: generateIssueBody(i),
      labels: ['implementation', `priority-p${Math.floor(Math.random() * 4)}`],
      dependencies,
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      effort: efforts[Math.floor(Math.random() * efforts.length)],
    });
  }

  return issues;
}

/**
 * Generate issue body content
 */
function generateIssueBody(issueNumber: number): string {
  return `## Description
Implement feature ${issueNumber} according to the SDS specification.

## Acceptance Criteria
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Documentation updated
- [ ] Code review approved

## Technical Notes
This feature requires implementation of the core logic and API endpoints.

## Related
- SDS: CMP-${String(issueNumber).padStart(3, '0')}
- SRS: FR-${String(issueNumber).padStart(3, '0')}
`;
}

/**
 * Create a large simulated project structure
 */
export async function createLargeProject(config: LargeProjectConfig): Promise<void> {
  const { baseDir, componentCount, sourceFileCount } = config;

  // Create directory structure
  const dirs = [
    path.join(baseDir, 'src'),
    path.join(baseDir, 'tests'),
    path.join(baseDir, 'docs'),
    path.join(baseDir, '.ad-sdlc', 'scratchpad', 'issues'),
  ];

  for (let i = 0; i < componentCount; i++) {
    dirs.push(path.join(baseDir, 'src', `component-${i}`));
    dirs.push(path.join(baseDir, 'tests', `component-${i}`));
  }

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create source files
  const filesPerComponent = Math.ceil(sourceFileCount / componentCount);
  for (let c = 0; c < componentCount; c++) {
    for (let f = 0; f < filesPerComponent; f++) {
      const filePath = path.join(baseDir, 'src', `component-${c}`, `file-${f}.ts`);
      fs.writeFileSync(filePath, generateSourceFile(c, f));
    }
  }

  // Create package.json
  fs.writeFileSync(
    path.join(baseDir, 'package.json'),
    JSON.stringify(
      {
        name: 'large-test-project',
        version: '1.0.0',
        type: 'module',
        scripts: {
          build: 'tsc',
          test: 'vitest',
        },
      },
      null,
      2
    )
  );

  // Create tsconfig.json
  fs.writeFileSync(
    path.join(baseDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          outDir: './dist',
          strict: true,
        },
        include: ['src/**/*'],
      },
      null,
      2
    )
  );
}

/**
 * Generate a source file content
 */
function generateSourceFile(componentNum: number, fileNum: number): string {
  return `/**
 * Component ${componentNum} - File ${fileNum}
 */

export interface Data${fileNum} {
  id: string;
  name: string;
  value: number;
}

export function process${fileNum}(data: Data${fileNum}): Data${fileNum} {
  return {
    ...data,
    value: data.value * 2,
  };
}

export function validate${fileNum}(data: Data${fileNum}): boolean {
  return data.id.length > 0 && data.name.length > 0;
}

export class Handler${fileNum} {
  private data: Data${fileNum}[] = [];

  add(item: Data${fileNum}): void {
    if (validate${fileNum}(item)) {
      this.data.push(process${fileNum}(item));
    }
  }

  getAll(): Data${fileNum}[] {
    return [...this.data];
  }

  count(): number {
    return this.data.length;
  }
}
`;
}

/**
 * Input fixture for large-scale project generation
 */
export const LARGE_PROJECT_INPUT = `
# Enterprise Resource Planning (ERP) System

## Overview
Build a comprehensive ERP system with multiple integrated modules.

## Modules

### Module 1: Human Resources
${generateModuleRequirements('HR', 20)}

### Module 2: Finance
${generateModuleRequirements('FIN', 20)}

### Module 3: Inventory
${generateModuleRequirements('INV', 20)}

### Module 4: Sales
${generateModuleRequirements('SALES', 20)}

### Module 5: Purchasing
${generateModuleRequirements('PUR', 20)}

## Integration Requirements
${generateIntegrationRequirements(10)}

## Non-Functional Requirements
- NFR-001: Support 10,000 concurrent users
- NFR-002: 99.99% uptime
- NFR-003: Response time under 200ms for 95th percentile
- NFR-004: Data encryption at rest and in transit
- NFR-005: Audit logging for all transactions
- NFR-006: Multi-tenant architecture
- NFR-007: Horizontal scalability
- NFR-008: Geographic redundancy
- NFR-009: Backup and recovery within 4 hours
- NFR-010: Compliance with SOC 2 Type II
`;

/**
 * Generate module requirements
 */
function generateModuleRequirements(prefix: string, count: number): string {
  const reqs: string[] = [];
  for (let i = 1; i <= count; i++) {
    reqs.push(`- ${prefix}-${String(i).padStart(3, '0')}: Implement ${prefix.toLowerCase()} feature ${i}`);
  }
  return reqs.join('\n');
}

/**
 * Generate integration requirements
 */
function generateIntegrationRequirements(count: number): string {
  const reqs: string[] = [];
  for (let i = 1; i <= count; i++) {
    reqs.push(`- INT-${String(i).padStart(3, '0')}: Integration point ${i} between modules`);
  }
  return reqs.join('\n');
}

/**
 * Scalability test expectations
 */
export const SCALABILITY_EXPECTATIONS = {
  largeProject: {
    issueCount: 100,
    maxProcessingTimeMs: 300000, // 5 minutes
    memoryLimitMB: 512,
  },
  parallelWorkers: {
    workerCount: 5,
    maxParallelTimeMs: 60000, // 1 minute
    expectedSpeedup: 2.5, // Expected speedup compared to sequential
  },
};
