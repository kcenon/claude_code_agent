/**
 * ExecutionScaffoldGenerator - Produces meaningful scaffold output for
 * controller, worker, validation, and review stages in local+stub mode.
 *
 * When no real AI bridge is available and the pipeline runs in localMode,
 * the dispatcher delegates to these functions instead of returning generic
 * stub strings. Each function reads prior-stage artifacts from the scratchpad
 * and writes structured scaffold files that downstream stages can consume.
 *
 * @packageDocumentation
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { OrchestratorSession } from '../ad-sdlc-orchestrator/types.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Work order scaffold written by the controller stage */
export interface ScaffoldWorkOrder {
  readonly orderId: string;
  readonly issueId: string;
  readonly title: string;
  readonly priority: number;
  readonly createdAt: string;
  readonly acceptanceCriteria: readonly string[];
}

/** V&V report scaffold written by the validation stage */
export interface ScaffoldVnvReport {
  readonly reportId: string;
  readonly projectId: string;
  readonly generatedAt: string;
  readonly overallResult: 'pass' | 'pass_with_warnings';
  readonly summary: {
    readonly totalRequirements: number;
    readonly implementedRequirements: number;
    readonly coveragePercent: number;
  };
  readonly notes: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Issue shape extracted from issue_list.json */
interface IssueEntry {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly labels?: { readonly priority?: string };
}

/**
 * Sanitize an external ID for safe use in file paths.
 * Strips path traversal sequences and replaces non-alphanumeric characters
 * (except hyphens) with underscores.
 * @param id - Raw ID from external source (e.g. issue_list.json)
 */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '_');
}

/**
 * Read issue_list.json and return the issues array.
 * @param issueDir - Directory containing issue_list.json
 */
async function readIssueList(issueDir: string): Promise<readonly IssueEntry[]> {
  const listPath = join(issueDir, 'issue_list.json');
  try {
    const raw = await readFile(listPath, 'utf-8');
    const data = JSON.parse(raw) as { issues?: unknown[] };
    return (data.issues ?? []) as IssueEntry[];
  } catch {
    logger.warn(
      `[Scaffold] Could not read issue list at ${listPath} — generating empty work orders`
    );
    return [];
  }
}

/**
 * Read all WO-*.json files from a directory.
 * @param dir - Directory containing work order JSON files
 */
async function readWorkOrders(dir: string): Promise<ScaffoldWorkOrder[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const orders: ScaffoldWorkOrder[] = [];
  for (const entry of entries) {
    if (entry.startsWith('WO-') && entry.endsWith('.json')) {
      try {
        const raw = await readFile(join(dir, entry), 'utf-8');
        orders.push(JSON.parse(raw) as ScaffoldWorkOrder);
      } catch {
        // Skip malformed work orders
      }
    }
  }

  return orders;
}

/**
 * Read the V&V report from the results directory.
 * Returns null if the file does not exist or is malformed.
 * @param resultsDir - Directory containing vnv-report.json
 */
async function readVnvReport(resultsDir: string): Promise<ScaffoldVnvReport | null> {
  const reportPath = join(resultsDir, 'vnv-report.json');
  try {
    const raw = await readFile(reportPath, 'utf-8');
    return JSON.parse(raw) as ScaffoldVnvReport;
  } catch {
    logger.warn(`[Scaffold] Could not read V&V report at ${reportPath}`);
    return null;
  }
}

/**
 * Map priority string to numeric score.
 * @param priority - Priority label (P0-P3)
 */
function priorityToScore(priority?: string): number {
  switch (priority) {
    case 'P0':
      return 100;
    case 'P1':
      return 75;
    case 'P2':
      return 50;
    case 'P3':
      return 25;
    default:
      return 50;
  }
}

/**
 * Extract acceptance criteria lines from issue body markdown.
 *
 * Looks for `- [ ] ...` checkbox lines under an "Acceptance Criteria" heading.
 * @param body - Issue body markdown
 */
function extractAcceptanceCriteria(body: string): string[] {
  const criteria: string[] = [];
  let inAcSection = false;

  for (const line of body.split('\n')) {
    if (/^##\s*acceptance\s*criteria/i.test(line)) {
      inAcSection = true;
      continue;
    }
    if (inAcSection && /^##\s/.test(line)) {
      break; // Next section
    }
    if (inAcSection) {
      const match = /^-\s*\[[ x]\]\s*(.+)/.exec(line);
      if (match !== null && match[1] !== undefined) {
        criteria.push(match[1].trim());
      }
    }
  }

  return criteria;
}

/**
 * Convert issue ID like "ISS-001" to a valid function name like "issueISS001".
 * Input is expected to be already sanitized via sanitizeId().
 * @param issueId - Sanitized issue identifier
 */
function issueIdToFunctionName(issueId: string): string {
  const cleaned = sanitizeId(issueId).replace(/[^a-zA-Z0-9]/g, '');
  return `issue${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
}

// ---------------------------------------------------------------------------
// Public scaffold generators (exported as namespace)
// ---------------------------------------------------------------------------

/**
 * Scaffold generators for execution stages.
 *
 * Each function reads prior-stage artifacts and writes scaffold files.
 * Grouped as a namespace object for clean imports.
 */
export const ExecutionScaffoldGenerator = {
  /**
   * Controller stage: read issue_list.json and produce work order files.
   *
   * Reads `scratchpad/issues/{projectId}/issue_list.json`, creates one
   * `WO-{issueId}.json` per open issue under
   * `scratchpad/progress/{projectId}/work_orders/`.
   *
   * @param session - Orchestrator session with project context
   * @returns JSON string summarising the generated work orders
   */
  async controller(session: OrchestratorSession): Promise<string> {
    const projectId = basename(session.projectDir);
    const issueDir = join(session.scratchpadDir, 'issues', projectId);
    const workOrderDir = join(session.scratchpadDir, 'progress', projectId, 'work_orders');

    await mkdir(workOrderDir, { recursive: true });

    // Read issue list from prior stage
    const issues = await readIssueList(issueDir);

    const workOrders: ScaffoldWorkOrder[] = [];

    for (const issue of issues) {
      const safeId = sanitizeId(issue.id);
      const wo: ScaffoldWorkOrder = {
        orderId: `WO-${safeId}`,
        issueId: safeId,
        title: issue.title,
        priority: priorityToScore(issue.labels?.priority),
        createdAt: new Date().toISOString(),
        acceptanceCriteria: extractAcceptanceCriteria(issue.body ?? ''),
      };

      const woPath = join(workOrderDir, `WO-${safeId}.json`);
      await writeFile(woPath, JSON.stringify(wo, null, 2), 'utf-8');
      workOrders.push(wo);
    }

    logger.info(`[Scaffold:Controller] Generated ${String(workOrders.length)} work orders`);

    return JSON.stringify({
      stage: 'controller',
      scaffold: true,
      workOrderDir,
      workOrderCount: workOrders.length,
      workOrders: workOrders.map((wo) => ({ orderId: wo.orderId, issueId: wo.issueId })),
    });
  },

  /**
   * Worker stage: read work orders and produce scaffold source files.
   *
   * For each work order, creates a minimal `src/index.ts` stub and
   * `package.json` under `{projectDir}/`.
   *
   * @param session - Orchestrator session with project context
   * @returns JSON string summarising the generated source files
   */
  async worker(session: OrchestratorSession): Promise<string> {
    const projectId = basename(session.projectDir);
    const workOrderDir = join(session.scratchpadDir, 'progress', projectId, 'work_orders');

    // Read work orders
    const workOrders = await readWorkOrders(workOrderDir);
    const filesCreated: string[] = [];

    // Generate project source scaffold
    const srcDir = join(session.projectDir, 'src');
    await mkdir(srcDir, { recursive: true });

    // Collect function stubs from all work orders
    const functions: string[] = [];
    for (const wo of workOrders) {
      const fnName = issueIdToFunctionName(wo.issueId);
      functions.push(
        `/**`,
        ` * ${wo.title}`,
        ` * @see Work order: ${wo.orderId}`,
        ` */`,
        `export function ${fnName}(): void {`,
        `  // TODO: Implement ${wo.issueId}`,
        `}`,
        ''
      );
    }

    const indexContent = [
      '// Auto-generated scaffold from AD-SDLC pipeline (local mode)',
      `// Project: ${projectId}`,
      `// Generated: ${new Date().toISOString()}`,
      '',
      ...functions,
    ].join('\n');

    const indexPath = join(srcDir, 'index.ts');
    await writeFile(indexPath, indexContent, 'utf-8');
    filesCreated.push(indexPath);

    // Generate package.json
    const pkgPath = join(session.projectDir, 'package.json');
    const pkg = {
      name: projectId,
      version: '0.1.0',
      description: `Scaffold generated by AD-SDLC pipeline`,
      main: 'src/index.ts',
      scripts: {
        build: 'tsc',
        test: 'echo "No tests yet"',
      },
    };
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
    filesCreated.push(pkgPath);

    logger.info(`[Scaffold:Worker] Generated ${String(filesCreated.length)} source files`);

    return JSON.stringify({
      stage: 'worker',
      scaffold: true,
      filesCreated,
      functionCount: workOrders.length,
    });
  },

  /**
   * Validation stage: produce a V&V report scaffold.
   *
   * Reads work order count from the progress directory and generates
   * `scratchpad/progress/{projectId}/results/vnv-report.json`.
   *
   * @param session - Orchestrator session with project context
   * @returns JSON string of the scaffold report
   */
  async validation(session: OrchestratorSession): Promise<string> {
    const projectId = basename(session.projectDir);
    const resultsDir = join(session.scratchpadDir, 'progress', projectId, 'results');
    await mkdir(resultsDir, { recursive: true });

    // Count work orders to estimate requirement coverage
    const workOrderDir = join(session.scratchpadDir, 'progress', projectId, 'work_orders');
    const workOrders = await readWorkOrders(workOrderDir).catch(() => []);
    const reqCount = workOrders.length || 1;

    const report: ScaffoldVnvReport = {
      reportId: `VNV-${randomUUID().slice(0, 8)}`,
      projectId,
      generatedAt: new Date().toISOString(),
      overallResult: 'pass_with_warnings',
      summary: {
        totalRequirements: reqCount,
        implementedRequirements: reqCount,
        coveragePercent: 100,
      },
      notes: 'Scaffold V&V report generated in local+stub mode. Manual verification recommended.',
    };

    const reportPath = join(resultsDir, 'vnv-report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    logger.info(`[Scaffold:Validation] Generated V&V report at ${reportPath}`);

    return JSON.stringify({
      stage: 'validation',
      scaffold: true,
      reportPath,
      overallResult: report.overallResult,
    });
  },

  /**
   * Review stage: produce a review report markdown document.
   *
   * Generates `scratchpad/progress/{projectId}/reviews/review-report.md`
   * summarising the scaffold pipeline output.
   *
   * @param session - Orchestrator session with project context
   * @returns JSON string pointing to the review document
   */
  async review(session: OrchestratorSession): Promise<string> {
    const projectId = basename(session.projectDir);
    const reviewDir = join(session.scratchpadDir, 'progress', projectId, 'reviews');
    await mkdir(reviewDir, { recursive: true });

    // Read context from prior stages
    const workOrderDir = join(session.scratchpadDir, 'progress', projectId, 'work_orders');
    const workOrders = await readWorkOrders(workOrderDir).catch(() => []);

    const resultsDir = join(session.scratchpadDir, 'progress', projectId, 'results');
    const vnvReport = await readVnvReport(resultsDir);

    const lines: string[] = [
      `# Review Report`,
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| **Project** | ${projectId} |`,
      `| **Generated** | ${new Date().toISOString()} |`,
      `| **Mode** | local+stub (scaffold) |`,
      '',
      `## Work Orders Reviewed`,
      '',
    ];

    if (workOrders.length === 0) {
      lines.push('No work orders found.');
    } else {
      lines.push('| Order ID | Issue ID | Title |');
      lines.push('|----------|----------|-------|');
      for (const wo of workOrders) {
        lines.push(`| ${wo.orderId} | ${wo.issueId} | ${wo.title} |`);
      }
    }

    lines.push('');
    lines.push('## Validation Summary');
    lines.push('');

    if (vnvReport !== null) {
      lines.push(`- **Result**: ${vnvReport.overallResult}`);
      lines.push(
        `- **Requirements**: ${String(vnvReport.summary.implementedRequirements)}/${String(vnvReport.summary.totalRequirements)}`
      );
      lines.push(`- **Coverage**: ${String(vnvReport.summary.coveragePercent)}%`);
    } else {
      lines.push('No V&V report found.');
    }

    lines.push('');
    lines.push('## Notes');
    lines.push('');
    lines.push('This report was auto-generated in local+stub mode. All scaffold output');
    lines.push('should be reviewed and replaced with real implementations before deployment.');
    lines.push('');

    const reviewPath = join(reviewDir, 'review-report.md');
    await writeFile(reviewPath, lines.join('\n'), 'utf-8');

    logger.info(`[Scaffold:Review] Generated review report at ${reviewPath}`);

    return JSON.stringify({
      stage: 'review',
      scaffold: true,
      reviewPath,
      workOrdersReviewed: workOrders.length,
    });
  },
} as const;
