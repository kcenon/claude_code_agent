/**
 * RTM Builder Agent
 *
 * Assembles a Requirements Traceability Matrix (RTM) by reading project
 * artifacts from the scratchpad and docs directories. Traces functional
 * requirements (FR) forward through SRS features (SF), use cases (UC),
 * SDS components (CMP), issues, work orders, implementations, and PRs.
 *
 * Implements IAgent interface for AgentFactory integration.
 *
 * @module rtm-builder/RtmBuilderAgent
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { IAgent } from '../agents/types.js';
import { getLogger } from '../logging/index.js';
import type { Logger } from '../logging/index.js';
import type { PipelineMode } from '../ad-sdlc-orchestrator/types.js';
import { issueAcceptanceCriteria, normalizeCriterionId } from './issueCriteria.js';
import { RTM_SCHEMA_VERSION } from './schemas.js';
import type {
  RtmBuildContext,
  RequirementsTraceabilityMatrix,
  RtmEntry,
  RtmGap,
  RtmCoverageMetrics,
  RtmValidationResult,
  RtmAcceptanceCriterion,
  RtmImplStatus,
  RtmSourceLocations,
} from './types.js';

/** Explicit PRD, SRS, and SDS locations */
type RtmDocumentLocations = NonNullable<RtmSourceLocations['documents']>;

// =============================================================================
// Constants
// =============================================================================

/**
 * Agent ID for RtmBuilderAgent used in AgentFactory
 */
export const RTM_BUILDER_AGENT_ID = 'rtm-builder-agent';

/**
 * Scratchpad base path relative to project directory
 */
const SCRATCHPAD_BASE = '.ad-sdlc/scratchpad';

// =============================================================================
// Internal parsed-data structures
// =============================================================================

/** Functional requirement extracted from PRD */
interface ParsedRequirement {
  readonly id: string;
  readonly title: string;
  readonly priority: string;
  readonly acceptanceCriteria: readonly RtmAcceptanceCriterion[];
}

/** Feature extracted from SRS */
interface ParsedFeature {
  readonly id: string;
  readonly sourceRequirements: readonly string[];
  readonly useCases: readonly string[];
}

/** Component extracted from SDS */
interface ParsedComponent {
  readonly id: string;
  readonly sourceFeatures: readonly string[];
}

/** Issue record extracted from scratchpad */
interface ParsedIssue {
  readonly id: string;
  readonly title: string;
  readonly priority: string;
  readonly components: readonly string[];
  /** PRD requirements the issue implements (its traceability links) */
  readonly requirements: readonly string[];
  readonly acceptanceCriteria: readonly { readonly id: string; readonly description: string }[];
}

/** Work order extracted from scratchpad */
interface ParsedWorkOrder {
  readonly id: string;
  readonly issueId: string;
}

/** Evidence an implementation result reports for one acceptance criterion */
interface ParsedCriterionEvidence {
  readonly id: string;
  readonly met: boolean;
  readonly tests: readonly string[];
}

/** Implementation result extracted from scratchpad */
interface ParsedImplResult {
  readonly workOrderId: string;
  readonly issueId: string;
  readonly status: 'completed' | 'failed' | 'blocked';
  readonly testsPassed: boolean;
  readonly buildPassed: boolean;
  readonly changedFiles: readonly string[];
  /** Whether the result has an acceptance criteria evidence list at all */
  readonly reportsCriteria: boolean;
  readonly criteria: readonly ParsedCriterionEvidence[];
}

/** Review result extracted from scratchpad */
interface ParsedReview {
  readonly workOrderId: string;
  readonly pullRequestId: string;
}

/** Work, results, and per-criterion evidence found for one issue */
interface IssueTrace {
  readonly workOrders: readonly string[];
  readonly implementations: readonly RtmImplStatus[];
  readonly criteria: readonly RtmAcceptanceCriterion[];
}

/** A structured file read from a source location */
interface StructuredFile {
  readonly path: string;
  readonly data: unknown;
}

/** Status values a worker may use for a criterion it implemented */
const MET_STATUSES = new Set(['met', 'pass', 'passed', 'done', 'completed', 'satisfied']);

// =============================================================================
// Agent class
// =============================================================================

/**
 * RTM Builder Agent
 *
 * Reads project artifacts and assembles a full Requirements Traceability Matrix.
 */
export class RtmBuilderAgent implements IAgent {
  public readonly agentId = RTM_BUILDER_AGENT_ID;
  public readonly name = 'RTM Builder Agent';

  private initialized = false;
  private logger: Logger;

  constructor() {
    this.logger = getLogger();
  }

  // ---------------------------------------------------------------------------
  // IAgent lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize the agent
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Dispose of the agent and release resources
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.initialized = false;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Build a complete Requirements Traceability Matrix from project artifacts
   *
   * @param context - Build context specifying project directory, ID, and mode
   * @returns Complete RTM with entries, coverage metrics, and gap analysis
   */
  public async buildRTM(context: RtmBuildContext): Promise<RequirementsTraceabilityMatrix> {
    const { projectDir, projectId, pipelineMode, sources } = context;

    // 1. Parse the delivery artifacts shared by every mode
    const issues = await this.parseIssues(projectDir, projectId, sources?.issueLists);
    const workOrders = await this.parseWorkOrders(projectDir, projectId, sources?.workOrders);
    const implResults = await this.parseImplementationResults(
      projectDir,
      projectId,
      sources?.implementationResults
    );
    const reviews = await this.parseReviews(projectDir, projectId, sources?.reviews);

    // 2. Build lookup maps for efficient linking
    const workOrdersByIssue = this.buildWorkOrdersByIssue(workOrders);
    const reviewByWorkOrder = this.buildReviewByWorkOrder(reviews);
    const issueTraces = await this.traceIssues(projectDir, issues, workOrdersByIssue, implResults);

    // 3. Assemble RTM entries. Import mode has no PRD, SRS, or SDS: each
    // imported issue is a root, and no upstream document is read or implied.
    let entries: readonly RtmEntry[];
    let allComponentIds: ReadonlySet<string> = new Set();
    if (pipelineMode === 'import') {
      entries = this.assembleIssueEntries(issues, issueTraces, reviewByWorkOrder);
    } else {
      const documents = sources?.documents;
      const requirements = await this.parseRequirements(projectDir, projectId, documents);
      const features = await this.parseFeatures(projectDir, projectId, documents);
      const components = await this.parseComponents(projectDir, projectId, documents);
      allComponentIds = new Set(components.map((c) => c.id));
      entries = this.assembleEntries(
        requirements,
        this.buildFeaturesByRequirement(features),
        this.buildUseCasesByFeature(features),
        this.buildComponentsByFeature(components),
        this.buildIssuesByComponent(issues),
        this.buildIssuesByRequirement(issues),
        issueTraces,
        reviewByWorkOrder
      );
    }

    // 4. Calculate coverage metrics
    const tracedComponentIds = new Set(entries.flatMap((e) => e.components));
    const coverageMetrics = this.calculateCoverage(entries, allComponentIds, tracedComponentIds);

    // 5. Identify gaps
    const gaps = this.identifyGaps(
      entries,
      allComponentIds,
      tracedComponentIds,
      pipelineMode,
      issues.map((issue) => issue.id)
    );

    return {
      version: RTM_SCHEMA_VERSION,
      projectId,
      generatedAt: new Date().toISOString(),
      pipelineMode,
      entries,
      coverageMetrics,
      gaps,
    };
  }

  /**
   * Generate a markdown report from an RTM
   *
   * @param rtm - The Requirements Traceability Matrix
   * @returns Markdown-formatted report string
   */
  public async generateReport(rtm: RequirementsTraceabilityMatrix): Promise<string> {
    await Promise.resolve();

    const lines: string[] = [];

    // Header
    lines.push('# Requirements Traceability Matrix');
    lines.push('');
    lines.push(`**Project:** ${rtm.projectId}`);
    lines.push(`**Pipeline Mode:** ${rtm.pipelineMode}`);
    lines.push(`**Generated:** ${rtm.generatedAt}`);
    lines.push(`**Version:** ${rtm.version}`);
    lines.push('');

    // Coverage summary
    lines.push('## Coverage Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Requirements | ${String(rtm.coverageMetrics.totalRequirements)} |`);
    lines.push(
      `| With Features (SRS) | ${String(rtm.coverageMetrics.requirementsWithFeatures)}/${String(rtm.coverageMetrics.totalRequirements)} |`
    );
    lines.push(
      `| With Components (SDS) | ${String(rtm.coverageMetrics.requirementsWithComponents)}/${String(rtm.coverageMetrics.totalRequirements)} |`
    );
    lines.push(
      `| With Issues | ${String(rtm.coverageMetrics.requirementsWithIssues)}/${String(rtm.coverageMetrics.totalRequirements)} |`
    );
    lines.push(
      `| With Implementations | ${String(rtm.coverageMetrics.requirementsWithImplementations)}/${String(rtm.coverageMetrics.totalRequirements)} |`
    );
    lines.push(
      `| With PRs | ${String(rtm.coverageMetrics.requirementsWithPRs)}/${String(rtm.coverageMetrics.totalRequirements)} |`
    );
    lines.push(`| Forward Coverage | ${rtm.coverageMetrics.forwardCoveragePercent.toFixed(1)}% |`);
    lines.push(
      `| Backward Coverage | ${rtm.coverageMetrics.backwardCoveragePercent.toFixed(1)}% |`
    );
    lines.push(
      `| Acceptance Criteria Validated | ${String(rtm.coverageMetrics.acceptanceCriteriaValidated)}/${String(rtm.coverageMetrics.acceptanceCriteriaTotal)} |`
    );
    lines.push('');

    // Traceability matrix table
    lines.push('## Traceability Matrix');
    lines.push('');
    lines.push('| Requirement | Priority | Features | Use Cases | Components | Issues | Status |');
    lines.push('|-------------|----------|----------|-----------|------------|--------|--------|');

    for (const entry of rtm.entries) {
      const features = entry.features.length > 0 ? entry.features.join(', ') : '-';
      const useCases = entry.useCases.length > 0 ? entry.useCases.join(', ') : '-';
      const comps = entry.components.length > 0 ? entry.components.join(', ') : '-';
      const iss = entry.issues.length > 0 ? entry.issues.join(', ') : '-';
      lines.push(
        `| ${entry.requirementId}: ${entry.requirementTitle} | ${entry.priority} | ${features} | ${useCases} | ${comps} | ${iss} | ${entry.status} |`
      );
    }
    lines.push('');

    // Gaps section
    if (rtm.gaps.length > 0) {
      lines.push('## Gaps');
      lines.push('');
      for (const gap of rtm.gaps) {
        const icon = gap.severity === 'error' ? 'ERROR' : 'WARNING';
        lines.push(`- **[${icon}]** ${gap.message} (${gap.type}: ${gap.affectedIds.join(', ')})`);
      }
      lines.push('');
    }

    // Acceptance criteria status
    const entriesWithAC = rtm.entries.filter((e) => e.acceptanceCriteria.length > 0);
    if (entriesWithAC.length > 0) {
      lines.push('## Acceptance Criteria Status');
      lines.push('');
      for (const entry of entriesWithAC) {
        lines.push(`### ${entry.requirementId}: ${entry.requirementTitle}`);
        lines.push('');
        lines.push('| AC | Description | Validated | Method |');
        lines.push('|----|-------------|-----------|--------|');
        for (const ac of entry.acceptanceCriteria) {
          const id = ac.issueId === undefined ? ac.id : `${ac.issueId}/${ac.id}`;
          const validated = ac.validated ? 'Yes' : 'No';
          const method = ac.validationMethod ?? ac.uncoveredReason ?? '-';
          lines.push(`| ${id} | ${ac.description} | ${validated} | ${method} |`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Validate RTM completeness
   *
   * Checks for uncovered requirements, orphan components, missing tests,
   * broken chains, and unvalidated acceptance criteria.
   *
   * @param rtm - The Requirements Traceability Matrix to validate
   * @returns Validation result with gaps and coverage metrics
   */
  public async validateCompleteness(
    rtm: RequirementsTraceabilityMatrix
  ): Promise<RtmValidationResult> {
    await Promise.resolve();

    const gaps: RtmGap[] = [];

    // Check for uncovered requirements (FR with no SF mapping)
    for (const entry of rtm.entries) {
      if (entry.features.length === 0) {
        gaps.push({
          type: 'uncovered_requirement',
          severity: 'error',
          affectedIds: [entry.requirementId],
          message: `Requirement ${entry.requirementId} has no SRS feature mapping`,
        });
      }
    }

    // Check for missing tests (implementations without tests passing)
    for (const entry of rtm.entries) {
      for (const impl of entry.implementations) {
        if (impl.status === 'completed' && !impl.testsPassed) {
          gaps.push({
            type: 'missing_test',
            severity: 'error',
            affectedIds: [entry.requirementId, impl.workOrderId],
            message: `Work order ${impl.workOrderId} for ${entry.requirementId} completed without passing tests`,
          });
        }
      }
    }

    // Check for unvalidated acceptance criteria
    for (const entry of rtm.entries) {
      const unvalidated = entry.acceptanceCriteria.filter((ac) => !ac.validated);
      if (unvalidated.length > 0 && entry.status === 'implemented') {
        gaps.push({
          type: 'unvalidated_acceptance_criteria',
          severity: 'warning',
          affectedIds: [entry.requirementId, ...unvalidated.map((ac) => ac.id)],
          message: `Requirement ${entry.requirementId} is implemented but has ${String(unvalidated.length)} unvalidated acceptance criteria`,
        });
      }
    }

    // Check for broken chains: entries with components but no feature mapping
    for (const entry of rtm.entries) {
      for (const cmp of entry.components) {
        // Check backward: does the component trace through a feature to a requirement?
        if (entry.features.length === 0) {
          gaps.push({
            type: 'broken_chain',
            severity: 'error',
            affectedIds: [entry.requirementId, cmp],
            message: `Component ${cmp} is linked to ${entry.requirementId} but there is no feature in the chain`,
          });
        }
      }
    }

    const valid = gaps.filter((g) => g.severity === 'error').length === 0;

    return {
      valid,
      gaps,
      coverageMetrics: rtm.coverageMetrics,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: artifact parsers
  // ---------------------------------------------------------------------------

  /**
   * Parse functional requirements from PRD markdown
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @param documents - Explicit document locations, replacing discovery when present
   * @returns Parsed requirements extracted from the PRD
   */
  private async parseRequirements(
    projectDir: string,
    projectId: string,
    documents?: RtmDocumentLocations
  ): Promise<readonly ParsedRequirement[]> {
    const content = await this.readDocumentMarkdown(projectDir, projectId, 'prd', documents);
    if (content === null) {
      this.logger.warn('No PRD document found; returning empty requirements');
      return [];
    }

    const requirements: ParsedRequirement[] = [];

    // Match FR-XXX sections. Patterns:
    //   ### FR-001: Title
    //   ### FR-001 - Title
    //   ## FR-001 Title
    const frPattern = /^#{2,3}\s*FR-(\d{3})\s*[:\-–]\s*(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = frPattern.exec(content)) !== null) {
      const id = `FR-${match[1] ?? '000'}`;
      const title = (match[2] ?? '').trim();

      // Extract priority (look in the section below)
      const sectionEnd = this.findSectionEnd(content, match.index);
      const sectionContent = content.slice(match.index, sectionEnd);
      const priority = this.extractPriority(sectionContent);

      // Extract acceptance criteria
      const acceptanceCriteria = this.extractAcceptanceCriteria(sectionContent);

      requirements.push({ id, title, priority, acceptanceCriteria });
    }

    return requirements;
  }

  /**
   * Parse features and use cases from SRS markdown
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @param documents - Explicit document locations, replacing discovery when present
   * @returns Parsed features with their source requirements and use cases
   */
  private async parseFeatures(
    projectDir: string,
    projectId: string,
    documents?: RtmDocumentLocations
  ): Promise<readonly ParsedFeature[]> {
    const content = await this.readDocumentMarkdown(projectDir, projectId, 'srs', documents);
    if (content === null) {
      this.logger.warn('No SRS document found; returning empty features');
      return [];
    }

    const features: ParsedFeature[] = [];

    // Match SF-XXX sections
    const sfPattern = /^#{2,3}\s*SF-(\d{3})\s*[:\-–]\s*(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = sfPattern.exec(content)) !== null) {
      const id = `SF-${match[1] ?? '000'}`;
      const sectionEnd = this.findSectionEnd(content, match.index);
      const sectionContent = content.slice(match.index, sectionEnd);

      // Extract source FR references
      const frRefs: string[] = [];
      const frRefPattern = /FR-(\d{3})/g;
      let frMatch: RegExpExecArray | null;
      while ((frMatch = frRefPattern.exec(sectionContent)) !== null) {
        const frId = `FR-${frMatch[1] ?? '000'}`;
        if (!frRefs.includes(frId)) {
          frRefs.push(frId);
        }
      }

      // Extract UC references in this feature's section
      const ucRefs: string[] = [];
      const ucRefPattern = /UC-(\d{3})/g;
      let ucMatch: RegExpExecArray | null;
      while ((ucMatch = ucRefPattern.exec(sectionContent)) !== null) {
        const ucId = `UC-${ucMatch[1] ?? '000'}`;
        if (!ucRefs.includes(ucId)) {
          ucRefs.push(ucId);
        }
      }

      features.push({
        id,
        sourceRequirements: frRefs,
        useCases: ucRefs,
      });
    }

    return features;
  }

  /**
   * Parse components from SDS markdown
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @param documents - Explicit document locations, replacing discovery when present
   * @returns Parsed components with their source feature mappings
   */
  private async parseComponents(
    projectDir: string,
    projectId: string,
    documents?: RtmDocumentLocations
  ): Promise<readonly ParsedComponent[]> {
    const content = await this.readDocumentMarkdown(projectDir, projectId, 'sds', documents);
    if (content === null) {
      this.logger.warn('No SDS document found; returning empty components');
      return [];
    }

    const components: ParsedComponent[] = [];

    // Match CMP-XXX sections
    const cmpPattern = /^#{2,3}\s*CMP-(\d{3})\s*[:\-–]\s*(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = cmpPattern.exec(content)) !== null) {
      const id = `CMP-${match[1] ?? '000'}`;
      const sectionEnd = this.findSectionEnd(content, match.index);
      const sectionContent = content.slice(match.index, sectionEnd);

      // Extract source SF references
      const sfRefs: string[] = [];
      const sfRefPattern = /SF-(\d{3})/g;
      let sfMatch: RegExpExecArray | null;
      while ((sfMatch = sfRefPattern.exec(sectionContent)) !== null) {
        const sfId = `SF-${sfMatch[1] ?? '000'}`;
        if (!sfRefs.includes(sfId)) {
          sfRefs.push(sfId);
        }
      }

      components.push({ id, sourceFeatures: sfRefs });
    }

    return components;
  }

  /**
   * Parse issues from scratchpad
   *
   * Accepts a top-level array or the `issues`/`items` list that issue
   * generators and readers write.
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @param locations - Explicit issue list locations, replacing discovery when present
   * @returns Parsed issues with their component, requirement, and criteria references
   */
  private async parseIssues(
    projectDir: string,
    projectId: string,
    locations?: readonly string[]
  ): Promise<readonly ParsedIssue[]> {
    const issueDir = path.join(projectDir, SCRATCHPAD_BASE, 'issues', projectId);
    let files: readonly StructuredFile[];
    if (locations !== undefined) {
      files = await this.readStructuredFiles(projectDir, locations);
    } else {
      // Conventional lookup: the JSON list wins over the legacy YAML list
      files = await this.readStructuredFiles(projectDir, [path.join(issueDir, 'issue_list.json')]);
      if (files.length === 0)
        files = await this.readStructuredFiles(projectDir, [path.join(issueDir, 'issues.yaml')]);
    }

    const issues: ParsedIssue[] = [];
    for (const file of files) {
      const list = Array.isArray(file.data)
        ? file.data
        : this.isRecord(file.data)
          ? (file.data['issues'] ?? file.data['items'])
          : undefined;
      if (!Array.isArray(list)) {
        this.logger.warn(`Issue list has no issues array: ${file.path}`);
        continue;
      }
      for (const item of list) {
        if (!this.isRecord(item)) continue;
        const issue = this.parseIssue(item);
        if (issue !== null && !issues.some((existing) => existing.id === issue.id))
          issues.push(issue);
      }
    }
    return issues;
  }

  /**
   * Parse one issue entry.
   * @param issue - Issue object from an issue list
   * @returns Parsed issue, or null when it has no identifier
   */
  private parseIssue(issue: Record<string, unknown>): ParsedIssue | null {
    const id = this.safeToString(
      issue['id'] ?? issue['issueId'] ?? issue['github_number'] ?? issue['number'] ?? ''
    );
    if (id.length === 0) return null;
    const traceability = this.isRecord(issue['traceability']) ? issue['traceability'] : {};
    const labels = this.isRecord(issue['labels']) ? issue['labels'] : {};
    const priority = this.safeToString(labels['priority'] ?? issue['priority'] ?? '');
    const structuredRequirements = this.stringList(
      traceability['prd_requirement'] ??
        traceability['prdRequirement'] ??
        issue['requirements'] ??
        issue['prd_requirement']
    );
    const body = issue['body'] ?? issue['description'];
    // The issue template cites its PRD requirement in the body; use it only
    // when the issue has no structured traceability.
    const requirements =
      structuredRequirements.length > 0 || typeof body !== 'string'
        ? structuredRequirements
        : [...new Set(body.match(/FR-\d{3}/g) ?? [])];
    return {
      id,
      title: this.safeToString(issue['title'] ?? '') || id,
      priority: /^P[0-3]$/.test(priority) ? priority : 'P2',
      components: this.stringList(
        issue['components'] ??
          issue['relatedComponents'] ??
          traceability['sds_component'] ??
          traceability['sdsComponent']
      ),
      requirements,
      acceptanceCriteria: issueAcceptanceCriteria(issue),
    };
  }

  /**
   * Parse work orders from scratchpad
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @param locations - Explicit work order locations, replacing discovery when present
   * @returns Parsed work orders with their issue mappings
   */
  private async parseWorkOrders(
    projectDir: string,
    projectId: string,
    locations?: readonly string[]
  ): Promise<readonly ParsedWorkOrder[]> {
    const files = await this.readSourceFiles(
      projectDir,
      path.join(projectDir, SCRATCHPAD_BASE, 'progress', projectId, 'work_orders'),
      locations
    );
    const workOrders: ParsedWorkOrder[] = [];
    for (const file of files) {
      const wo = this.unwrap(file.data, 'work_order');
      if (wo === null) continue;
      const issue = wo['issue'];
      const id = this.safeToString(wo['id'] ?? wo['workOrderId'] ?? wo['work_order_id'] ?? '');
      const issueId = this.safeToString(
        wo['issueId'] ??
          wo['issue_id'] ??
          (this.isRecord(issue) ? (issue['id'] ?? issue['github_number']) : issue) ??
          ''
      );
      if (id.length > 0) {
        workOrders.push({ id, issueId });
      }
    }
    return workOrders;
  }

  /**
   * Parse implementation results from scratchpad
   *
   * The worker writes its result under an `implementation_result` root with
   * the test, build, and lint flags under `verification`; older results are
   * flat. `acceptance_criteria` lists the evidence for each criterion of the
   * issue: `{ id, status: met | not_met, tests: [test file, ...] }`.
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @param locations - Explicit result locations, replacing discovery when present
   * @returns Parsed implementation results with status, test info, and evidence
   */
  private async parseImplementationResults(
    projectDir: string,
    projectId: string,
    locations?: readonly string[]
  ): Promise<readonly ParsedImplResult[]> {
    const files = await this.readSourceFiles(
      projectDir,
      path.join(projectDir, SCRATCHPAD_BASE, 'progress', projectId, 'results'),
      locations
    );
    const results: ParsedImplResult[] = [];
    for (const file of files) {
      const res = this.unwrap(file.data, 'implementation_result');
      if (res === null) continue;
      const verification = this.isRecord(res['verification']) ? res['verification'] : {};
      const workOrderId = this.safeToString(res['workOrderId'] ?? res['work_order_id'] ?? '');
      const issueId = this.safeToString(res['issueId'] ?? res['issue_id'] ?? '');
      const evidence = res['acceptance_criteria'] ?? res['acceptanceCriteria'];
      if (workOrderId.length === 0 && issueId.length === 0) continue;
      results.push({
        workOrderId,
        issueId,
        status: this.normalizeImplStatus(res['status']),
        testsPassed:
          (res['testsPassed'] ??
            res['tests_passed'] ??
            verification['tests_passed'] ??
            verification['testsPassed']) === true,
        buildPassed:
          (res['buildPassed'] ??
            res['build_passed'] ??
            verification['build_passed'] ??
            verification['buildPassed']) === true,
        changedFiles: this.changedFiles(
          res['changes'] ?? res['changed_files'] ?? res['changedFiles']
        ),
        reportsCriteria: Array.isArray(evidence),
        criteria: Array.isArray(evidence) ? this.criterionEvidence(evidence) : [],
      });
    }
    return results;
  }

  /**
   * Locations of the files an implementation result records as changed.
   * @param changes - `changes` list of strings or `{ file_path }` objects
   * @returns Changed file locations
   */
  private changedFiles(changes: unknown): readonly string[] {
    if (!Array.isArray(changes)) return [];
    const locations = changes.map((change: unknown) =>
      this.safeToString(
        this.isRecord(change)
          ? (change['file_path'] ?? change['filePath'] ?? change['path'] ?? '')
          : change
      )
    );
    return [...new Set(locations.filter((location) => location.length > 0))];
  }

  /**
   * Per-criterion evidence reported by an implementation result.
   * @param list - `acceptance_criteria` entries
   * @returns Evidence entries that name a criterion
   */
  private criterionEvidence(list: readonly unknown[]): readonly ParsedCriterionEvidence[] {
    return list.flatMap((item): ParsedCriterionEvidence[] => {
      if (!this.isRecord(item)) return [];
      const id = this.safeToString(item['id'] ?? item['criterion_id'] ?? item['criterionId'] ?? '');
      if (id.length === 0) return [];
      const status = this.safeToString(item['status'] ?? '').toLowerCase();
      return [
        {
          id: normalizeCriterionId(id),
          met: item['met'] === true || MET_STATUSES.has(status),
          tests: this.stringList(item['tests'] ?? item['test_files'] ?? item['testFiles']),
        },
      ];
    });
  }

  /**
   * Parse review results from scratchpad
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @param locations - Explicit review locations, replacing discovery when present
   * @returns Parsed review results with PR info
   */
  private async parseReviews(
    projectDir: string,
    projectId: string,
    locations?: readonly string[]
  ): Promise<readonly ParsedReview[]> {
    const files = await this.readSourceFiles(
      projectDir,
      path.join(projectDir, SCRATCHPAD_BASE, 'progress', projectId, 'reviews'),
      locations
    );
    const reviews: ParsedReview[] = [];
    for (const file of files) {
      const rev = this.unwrap(file.data, 'pr_review_result');
      if (rev === null) continue;
      const pullRequest = this.isRecord(rev['pull_request']) ? rev['pull_request'] : {};
      const workOrderId = this.safeToString(rev['workOrderId'] ?? rev['work_order_id'] ?? '');
      const pullRequestId = this.safeToString(
        rev['pullRequestId'] ??
          rev['pull_request_id'] ??
          rev['prNumber'] ??
          rev['pr_url'] ??
          pullRequest['url'] ??
          pullRequest['number'] ??
          ''
      );
      if (workOrderId.length > 0 && pullRequestId.length > 0) {
        reviews.push({ workOrderId, pullRequestId });
      }
    }
    return reviews;
  }

  // ---------------------------------------------------------------------------
  // Private: lookup map builders
  // ---------------------------------------------------------------------------

  /**
   * Build a map from requirement ID to feature IDs
   * @param features - Parsed SRS features
   * @returns Map of requirement ID to array of feature IDs
   */
  private buildFeaturesByRequirement(
    features: readonly ParsedFeature[]
  ): ReadonlyMap<string, readonly string[]> {
    const map = new Map<string, string[]>();
    for (const feature of features) {
      for (const reqId of feature.sourceRequirements) {
        const existing = map.get(reqId) ?? [];
        if (!existing.includes(feature.id)) {
          existing.push(feature.id);
        }
        map.set(reqId, existing);
      }
    }
    return map;
  }

  /**
   * Build a map from feature ID to use case IDs
   * @param features - Parsed SRS features
   * @returns Map of feature ID to array of use case IDs
   */
  private buildUseCasesByFeature(
    features: readonly ParsedFeature[]
  ): ReadonlyMap<string, readonly string[]> {
    const map = new Map<string, readonly string[]>();
    for (const feature of features) {
      map.set(feature.id, feature.useCases);
    }
    return map;
  }

  /**
   * Build a map from feature ID to component IDs
   * @param components - Parsed SDS components
   * @returns Map of feature ID to array of component IDs
   */
  private buildComponentsByFeature(
    components: readonly ParsedComponent[]
  ): ReadonlyMap<string, readonly string[]> {
    const map = new Map<string, string[]>();
    for (const comp of components) {
      for (const featureId of comp.sourceFeatures) {
        const existing = map.get(featureId) ?? [];
        if (!existing.includes(comp.id)) {
          existing.push(comp.id);
        }
        map.set(featureId, existing);
      }
    }
    return map;
  }

  /**
   * Build a map from component ID to issue IDs
   * @param issues - Parsed issues from scratchpad
   * @returns Map of component ID to array of issue IDs
   */
  private buildIssuesByComponent(
    issues: readonly ParsedIssue[]
  ): ReadonlyMap<string, readonly string[]> {
    const map = new Map<string, string[]>();
    for (const issue of issues) {
      for (const compId of issue.components) {
        const existing = map.get(compId) ?? [];
        if (!existing.includes(issue.id)) {
          existing.push(issue.id);
        }
        map.set(compId, existing);
      }
    }
    return map;
  }

  /**
   * Build a map from issue ID to work order IDs
   * @param workOrders - Parsed work orders from scratchpad
   * @returns Map of issue ID to array of work order IDs
   */
  private buildWorkOrdersByIssue(
    workOrders: readonly ParsedWorkOrder[]
  ): ReadonlyMap<string, readonly string[]> {
    const map = new Map<string, string[]>();
    for (const wo of workOrders) {
      if (wo.issueId.length === 0) continue;
      const existing = map.get(wo.issueId) ?? [];
      if (!existing.includes(wo.id)) {
        existing.push(wo.id);
      }
      map.set(wo.issueId, existing);
    }
    return map;
  }

  /**
   * Build a map from requirement ID to the issues that cite it directly
   * @param issues - Parsed issues from scratchpad
   * @returns Map of requirement ID to array of issue IDs
   */
  private buildIssuesByRequirement(
    issues: readonly ParsedIssue[]
  ): ReadonlyMap<string, readonly string[]> {
    const map = new Map<string, string[]>();
    for (const issue of issues) {
      for (const reqId of issue.requirements) {
        const existing = map.get(reqId) ?? [];
        if (!existing.includes(issue.id)) {
          existing.push(issue.id);
        }
        map.set(reqId, existing);
      }
    }
    return map;
  }

  /**
   * Trace every issue to its work orders, implementation results, and the
   * evidence for each acceptance criterion it states.
   * @param projectDir - Absolute path to project root
   * @param issues - Parsed issues
   * @param workOrdersByIssue - Map of issue ID to work order IDs
   * @param results - Parsed implementation results
   * @returns Map of issue ID to its trace
   */
  private async traceIssues(
    projectDir: string,
    issues: readonly ParsedIssue[],
    workOrdersByIssue: ReadonlyMap<string, readonly string[]>,
    results: readonly ParsedImplResult[]
  ): Promise<ReadonlyMap<string, IssueTrace>> {
    const traces = new Map<string, IssueTrace>();
    for (const issue of issues) {
      const assigned = workOrdersByIssue.get(issue.id) ?? [];
      const issueResults = results.filter(
        (result) => assigned.includes(result.workOrderId) || result.issueId === issue.id
      );
      const workOrders = [
        ...new Set([...assigned, ...issueResults.map((result) => result.workOrderId)]),
      ].filter((id) => id.length > 0);
      const criteria: RtmAcceptanceCriterion[] = [];
      for (const criterion of issue.acceptanceCriteria)
        criteria.push(
          await this.traceCriterion(projectDir, issue.id, criterion, workOrders, issueResults)
        );
      traces.set(issue.id, {
        workOrders,
        implementations: issueResults
          .filter((result) => result.workOrderId.length > 0)
          .map((result) => ({
            workOrderId: result.workOrderId,
            status: result.status,
            testsPassed: result.testsPassed,
            buildPassed: result.buildPassed,
          })),
        criteria,
      });
    }
    return traces;
  }

  /**
   * Decide whether one issue criterion is implemented and tested.
   *
   * Implemented: a completed implementation result of the issue reports the
   * criterion as met. Tested: additionally, that result reports passing tests
   * and links at least one test file to the criterion, and every linked test
   * file exists inside the project.
   *
   * @param projectDir - Absolute path to project root
   * @param issueId - Issue stating the criterion
   * @param criterion - Criterion identifier and text
   * @param criterion.id - Identifier within the issue
   * @param criterion.description - Criterion text
   * @param workOrders - Work orders of the issue
   * @param results - Implementation results of the issue
   * @returns Criterion with its evidence and, when not validated, the reason
   */
  private async traceCriterion(
    projectDir: string,
    issueId: string,
    criterion: { readonly id: string; readonly description: string },
    workOrders: readonly string[],
    results: readonly ParsedImplResult[]
  ): Promise<RtmAcceptanceCriterion> {
    const completed = results.filter((result) => result.status === 'completed');
    const base = {
      id: criterion.id,
      description: criterion.description,
      issueId,
      workOrders: [...workOrders],
      changedFiles: [...new Set(completed.flatMap((result) => result.changedFiles))],
    };
    const uncovered = (
      reason: string,
      implemented: boolean,
      tests: readonly string[] = []
    ): RtmAcceptanceCriterion => ({
      ...base,
      validated: false,
      implemented,
      tests: [...tests],
      uncoveredReason: reason,
    });

    if (results.length === 0)
      return uncovered('No work order or implementation result covers the issue', false);
    if (completed.length === 0)
      return uncovered('No implementation result of the issue reports status completed', false);
    const evidence = completed.flatMap((result) =>
      result.criteria
        .filter((entry) => entry.id === criterion.id)
        .map((entry) => ({ entry, result }))
    );
    if (evidence.length === 0)
      return uncovered(
        completed.some((result) => result.reportsCriteria)
          ? 'The implementation result does not report this criterion'
          : 'The implementation result reports no acceptance criteria evidence',
        false
      );
    const met = evidence.filter(({ entry }) => entry.met);
    if (met.length === 0)
      return uncovered('The implementation result reports the criterion as not met', false);
    const tests = [...new Set(met.flatMap(({ entry }) => entry.tests))];
    if (tests.length === 0) return uncovered('No test is linked to the criterion', true);
    if (!met.every(({ result }) => result.testsPassed))
      return uncovered('The implementation result does not report passing tests', true, tests);
    const missing: string[] = [];
    for (const test of tests)
      if (!(await this.projectFileExists(projectDir, test))) missing.push(test);
    if (missing.length > 0)
      return uncovered(`Linked test file not found: ${missing.join(', ')}`, true, tests);
    return {
      ...base,
      validated: true,
      validationMethod: 'automated-test',
      implemented: true,
      tests,
    };
  }

  /**
   * Build a map from work order ID to review (PR)
   * @param reviews - Parsed review results
   * @returns Map of work order ID to review record
   */
  private buildReviewByWorkOrder(
    reviews: readonly ParsedReview[]
  ): ReadonlyMap<string, ParsedReview> {
    const map = new Map<string, ParsedReview>();
    for (const review of reviews) {
      map.set(review.workOrderId, review);
    }
    return map;
  }

  // ---------------------------------------------------------------------------
  // Private: assemble entries
  // ---------------------------------------------------------------------------

  /**
   * Assemble RtmEntry array by following the chain forward from each FR
   *
   * An issue belongs to a requirement through the FR → SF → CMP chain or by
   * citing the requirement in its traceability. The entry lists the PRD
   * criteria followed by the criteria of its issues. A PRD criterion is
   * validated (method `issue-acceptance-tests`) when every linked issue states
   * criteria and all of them are validated.
   *
   * @param requirements - Parsed functional requirements
   * @param featuresByReq - Map of requirement ID to feature IDs
   * @param useCasesByFeature - Map of feature ID to use case IDs
   * @param componentsByFeature - Map of feature ID to component IDs
   * @param issuesByComponent - Map of component ID to issue IDs
   * @param issuesByRequirement - Map of requirement ID to issues citing it
   * @param issueTraces - Map of issue ID to its trace
   * @param reviewByWorkOrder - Map of work order ID to review record
   * @returns Assembled RTM entries
   */
  private assembleEntries(
    requirements: readonly ParsedRequirement[],
    featuresByReq: ReadonlyMap<string, readonly string[]>,
    useCasesByFeature: ReadonlyMap<string, readonly string[]>,
    componentsByFeature: ReadonlyMap<string, readonly string[]>,
    issuesByComponent: ReadonlyMap<string, readonly string[]>,
    issuesByRequirement: ReadonlyMap<string, readonly string[]>,
    issueTraces: ReadonlyMap<string, IssueTrace>,
    reviewByWorkOrder: ReadonlyMap<string, ParsedReview>
  ): readonly RtmEntry[] {
    return requirements.map((req) => {
      // FR -> SF
      const featureIds = featuresByReq.get(req.id) ?? [];

      // SF -> UC (collect from all features)
      const useCaseIds = new Set<string>();
      // SF -> CMP
      const componentIds = new Set<string>();

      for (const sfId of featureIds) {
        // Collect use cases associated with this feature
        const ucs = useCasesByFeature.get(sfId) ?? [];
        for (const uc of ucs) {
          useCaseIds.add(uc);
        }

        const cmps = componentsByFeature.get(sfId) ?? [];
        for (const cmp of cmps) {
          componentIds.add(cmp);
        }
      }

      // CMP -> ISS, plus issues citing the requirement directly
      const issueIds = new Set<string>(issuesByRequirement.get(req.id) ?? []);
      for (const cmpId of componentIds) {
        const iss = issuesByComponent.get(cmpId) ?? [];
        for (const i of iss) {
          issueIds.add(i);
        }
      }

      // ISS -> WO -> Implementations and issue criteria
      const traces = [...issueIds].flatMap((id) => {
        const trace = issueTraces.get(id);
        return trace === undefined ? [] : [trace];
      });
      const workOrderIds = new Set(traces.flatMap((trace) => trace.workOrders));
      const implementations = this.uniqueImplementations(traces);
      const issueCriteria = traces.flatMap((trace) => trace.criteria);
      const issuesValidated =
        traces.length > 0 &&
        traces.length === issueIds.size &&
        traces.every(
          (trace) => trace.criteria.length > 0 && trace.criteria.every((c) => c.validated)
        );
      const acceptanceCriteria = [
        ...req.acceptanceCriteria.map((criterion) =>
          issuesValidated
            ? { ...criterion, validated: true, validationMethod: 'issue-acceptance-tests' }
            : criterion
        ),
        ...issueCriteria,
      ];

      // Determine status
      const status = this.determineStatus(
        featureIds,
        [...componentIds],
        implementations,
        acceptanceCriteria,
        [...issueIds]
      );

      return {
        requirementId: req.id,
        requirementTitle: req.title,
        priority: req.priority,
        features: [...featureIds],
        useCases: [...useCaseIds],
        components: [...componentIds],
        issues: [...issueIds],
        workOrders: [...workOrderIds],
        implementations,
        pullRequests: this.pullRequestsFor(workOrderIds, reviewByWorkOrder),
        acceptanceCriteria,
        status,
      };
    });
  }

  /**
   * Assemble one entry per imported issue (Import mode). The issue's own
   * criteria are the traceability roots; no PRD, SRS, or SDS link is implied.
   * @param issues - Parsed imported issues
   * @param issueTraces - Map of issue ID to its trace
   * @param reviewByWorkOrder - Map of work order ID to review record
   * @returns One entry per issue
   */
  private assembleIssueEntries(
    issues: readonly ParsedIssue[],
    issueTraces: ReadonlyMap<string, IssueTrace>,
    reviewByWorkOrder: ReadonlyMap<string, ParsedReview>
  ): readonly RtmEntry[] {
    return issues.map((issue) => {
      const trace = issueTraces.get(issue.id) ?? {
        workOrders: [],
        implementations: [],
        criteria: [],
      };
      const completed = trace.implementations.some((impl) => impl.status === 'completed');
      const verified = trace.criteria.length > 0 && trace.criteria.every((c) => c.validated);
      return {
        requirementId: issue.id,
        requirementTitle: issue.title,
        priority: issue.priority,
        features: [],
        useCases: [],
        components: [...issue.components],
        issues: [issue.id],
        workOrders: [...trace.workOrders],
        implementations: [...trace.implementations],
        pullRequests: this.pullRequestsFor(new Set(trace.workOrders), reviewByWorkOrder),
        acceptanceCriteria: [...trace.criteria],
        status: verified
          ? 'verified'
          : completed
            ? 'implemented'
            : trace.workOrders.length > 0
              ? 'in_progress'
              : 'not_started',
      };
    });
  }

  /**
   * Implementation results of several issue traces, one per work order.
   * @param traces - Issue traces
   * @returns Implementation results in trace order
   */
  private uniqueImplementations(traces: readonly IssueTrace[]): RtmImplStatus[] {
    const byWorkOrder = new Map<string, RtmImplStatus>();
    for (const impl of traces.flatMap((trace) => trace.implementations))
      if (!byWorkOrder.has(impl.workOrderId)) byWorkOrder.set(impl.workOrderId, impl);
    return [...byWorkOrder.values()];
  }

  /**
   * Pull requests reviewed for a set of work orders.
   * @param workOrderIds - Work order IDs
   * @param reviewByWorkOrder - Map of work order ID to review record
   * @returns Pull request identifiers or URLs
   */
  private pullRequestsFor(
    workOrderIds: ReadonlySet<string>,
    reviewByWorkOrder: ReadonlyMap<string, ParsedReview>
  ): string[] {
    const pullRequests = new Set<string>();
    for (const woId of workOrderIds) {
      const review = reviewByWorkOrder.get(woId);
      if (review !== undefined && review.pullRequestId.length > 0) {
        pullRequests.add(review.pullRequestId);
      }
    }
    return [...pullRequests];
  }

  // ---------------------------------------------------------------------------
  // Private: coverage metrics
  // ---------------------------------------------------------------------------

  /**
   * Calculate coverage metrics from assembled entries
   * @param entries - Assembled RTM entries
   * @param allComponentIds - Set of all component IDs found in SDS
   * @param tracedComponentIds - Set of component IDs traced to requirements
   * @returns Coverage metrics object
   */
  private calculateCoverage(
    entries: readonly RtmEntry[],
    allComponentIds: ReadonlySet<string>,
    tracedComponentIds: ReadonlySet<string>
  ): RtmCoverageMetrics {
    const total = entries.length;
    const withFeatures = entries.filter((e) => e.features.length > 0).length;
    const withComponents = entries.filter((e) => e.components.length > 0).length;
    const withIssues = entries.filter((e) => e.issues.length > 0).length;
    const withImplementations = entries.filter((e) => e.implementations.length > 0).length;
    const withPRs = entries.filter((e) => e.pullRequests.length > 0).length;

    const forwardCoveragePercent = total > 0 ? (withComponents / total) * 100 : 100;
    const backwardCoveragePercent =
      allComponentIds.size > 0 ? (tracedComponentIds.size / allComponentIds.size) * 100 : 100;

    let acTotal = 0;
    let acValidated = 0;
    for (const entry of entries) {
      acTotal += entry.acceptanceCriteria.length;
      acValidated += entry.acceptanceCriteria.filter((ac) => ac.validated).length;
    }

    return {
      totalRequirements: total,
      requirementsWithFeatures: withFeatures,
      requirementsWithComponents: withComponents,
      requirementsWithIssues: withIssues,
      requirementsWithImplementations: withImplementations,
      requirementsWithPRs: withPRs,
      forwardCoveragePercent: Math.round(forwardCoveragePercent * 10) / 10,
      backwardCoveragePercent: Math.round(backwardCoveragePercent * 10) / 10,
      acceptanceCriteriaTotal: acTotal,
      acceptanceCriteriaValidated: acValidated,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: gap identification
  // ---------------------------------------------------------------------------

  /**
   * Identify gaps in the traceability chain
   * Import mode has no PRD, SRS, or SDS, so the document-chain gaps
   * (uncovered requirement, orphan component, broken chain) do not apply.
   *
   * @param entries - Assembled RTM entries
   * @param allComponentIds - Set of all component IDs found in SDS
   * @param tracedComponentIds - Set of component IDs traced to requirements
   * @param pipelineMode - Mode that produced the traced artifacts
   * @param issueIds - Every parsed issue, for the backward issue check
   * @returns Array of identified gaps
   */
  private identifyGaps(
    entries: readonly RtmEntry[],
    allComponentIds: ReadonlySet<string>,
    tracedComponentIds: ReadonlySet<string>,
    pipelineMode: PipelineMode,
    issueIds: readonly string[] = []
  ): readonly RtmGap[] {
    const gaps: RtmGap[] = [];
    const documentChain = pipelineMode !== 'import';

    // Orphan issues: issues that trace back to no requirement
    const tracedIssues = new Set(entries.flatMap((e) => e.issues));
    const orphanIssues = documentChain ? issueIds.filter((id) => !tracedIssues.has(id)) : [];
    if (orphanIssues.length > 0) {
      gaps.push({
        type: 'orphan_issue',
        severity: 'warning',
        affectedIds: orphanIssues,
        message: `${String(orphanIssues.length)} issue(s) are not traced to any requirement`,
      });
    }

    // Uncovered requirements: FR with no SF
    const uncovered = documentChain ? entries.filter((e) => e.features.length === 0) : [];
    if (uncovered.length > 0) {
      gaps.push({
        type: 'uncovered_requirement',
        severity: 'error',
        affectedIds: uncovered.map((e) => e.requirementId),
        message: `${String(uncovered.length)} requirement(s) have no SRS feature mapping`,
      });
    }

    // Orphan components: CMP not traced back to any FR
    const orphanComponents: string[] = [];
    for (const cmpId of allComponentIds) {
      if (!tracedComponentIds.has(cmpId)) {
        orphanComponents.push(cmpId);
      }
    }
    if (orphanComponents.length > 0) {
      gaps.push({
        type: 'orphan_component',
        severity: 'warning',
        affectedIds: orphanComponents,
        message: `${String(orphanComponents.length)} component(s) are not traced to any requirement`,
      });
    }

    // Missing tests: completed implementations without passing tests
    for (const entry of entries) {
      for (const impl of entry.implementations) {
        if (impl.status === 'completed' && !impl.testsPassed) {
          gaps.push({
            type: 'missing_test',
            severity: 'error',
            affectedIds: [entry.requirementId, impl.workOrderId],
            message: `Work order ${impl.workOrderId} for ${entry.requirementId} completed without passing tests`,
          });
        }
      }
    }

    // Unvalidated acceptance criteria on implemented requirements
    for (const entry of entries) {
      if (entry.status === 'implemented' || entry.status === 'verified') {
        const unvalidated = entry.acceptanceCriteria.filter((ac) => !ac.validated);
        if (unvalidated.length > 0) {
          gaps.push({
            type: 'unvalidated_acceptance_criteria',
            severity: 'warning',
            affectedIds: [entry.requirementId, ...unvalidated.map((ac) => ac.id)],
            message: `Requirement ${entry.requirementId} has ${String(unvalidated.length)} unvalidated acceptance criteria`,
          });
        }
      }
    }

    // Broken chain: entries with components but no features (shouldn't happen if chain is intact)
    for (const entry of documentChain ? entries : []) {
      if (entry.components.length > 0 && entry.features.length === 0) {
        gaps.push({
          type: 'broken_chain',
          severity: 'error',
          affectedIds: [entry.requirementId, ...entry.components],
          message: `Requirement ${entry.requirementId} has components but no feature mapping — broken chain`,
        });
      }
    }

    return gaps;
  }

  // ---------------------------------------------------------------------------
  // Private: document reading helpers
  // ---------------------------------------------------------------------------

  /**
   * Read a document markdown file from scratchpad or docs directory
   *
   * Checks scratchpad first, then falls back to docs/ directory. Explicit
   * document locations replace this discovery: a document type they do not
   * list is treated as absent.
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @param docType - Document type to read
   * @param documents - Explicit document locations
   * @returns Document content or null if not found
   */
  private async readDocumentMarkdown(
    projectDir: string,
    projectId: string,
    docType: 'prd' | 'srs' | 'sds',
    documents?: RtmDocumentLocations
  ): Promise<string | null> {
    if (documents !== undefined) {
      const location = documents[docType];
      return location === undefined
        ? null
        : this.readFileGracefully(path.resolve(projectDir, location));
    }

    // Try scratchpad first
    const scratchpadPath = path.join(
      projectDir,
      SCRATCHPAD_BASE,
      'documents',
      projectId,
      `${docType}.md`
    );
    const scratchpadContent = await this.readFileGracefully(scratchpadPath);
    if (scratchpadContent !== null) {
      return scratchpadContent;
    }

    // Fall back to docs/ directory — look for files matching pattern
    const docsDir = path.join(projectDir, 'docs');
    const files = await this.readDirGracefully(docsDir);
    const prefix = docType.toUpperCase();
    const matchingFile = files.find((f) => f.startsWith(`${prefix}-`) && f.endsWith('.md'));
    if (matchingFile !== undefined) {
      return this.readFileGracefully(path.join(docsDir, matchingFile));
    }

    // Also check docs/srs/, docs/prd/, docs/sds/ subdirectories
    const subDir = path.join(docsDir, docType);
    const subFiles = await this.readDirGracefully(subDir);
    const subMatch = subFiles.find((f) => f.endsWith('.md'));
    if (subMatch !== undefined) {
      return this.readFileGracefully(path.join(subDir, subMatch));
    }

    return null;
  }

  /**
   * Read a file gracefully, returning null if it does not exist
   * @param filePath - Absolute file path
   * @returns File content or null on error
   */
  private async readFileGracefully(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Read directory contents gracefully, returning empty array if not found
   * @param dirPath - Absolute directory path
   * @returns Array of filenames or empty array on error
   */
  private async readDirGracefully(dirPath: string): Promise<readonly string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch {
      return [];
    }
  }

  /**
   * Read and parse structured files. Missing files are skipped; files that
   * are neither JSON nor YAML are skipped with a warning.
   * @param projectDir - Absolute path to project root
   * @param locations - Absolute or project-relative locations
   * @returns Parsed files in input order
   */
  private async readStructuredFiles(
    projectDir: string,
    locations: readonly string[]
  ): Promise<readonly StructuredFile[]> {
    const files: StructuredFile[] = [];
    for (const location of locations) {
      const filePath = path.resolve(projectDir, location);
      const content = await this.readFileGracefully(filePath);
      if (content === null) continue;
      try {
        const data: unknown = filePath.endsWith('.json')
          ? JSON.parse(content)
          : (await import('js-yaml')).load(content);
        files.push({ path: location, data });
      } catch {
        this.logger.warn(`Failed to parse structured file: ${filePath}`);
      }
    }
    return files;
  }

  /**
   * Read the structured files of one source category: the explicit
   * locations when given, otherwise every YAML or JSON file of the
   * conventional directory.
   * @param projectDir - Absolute path to project root
   * @param conventionalDir - Directory used without explicit locations
   * @param locations - Explicit locations
   * @returns Parsed files
   */
  private async readSourceFiles(
    projectDir: string,
    conventionalDir: string,
    locations: readonly string[] | undefined
  ): Promise<readonly StructuredFile[]> {
    if (locations !== undefined) return this.readStructuredFiles(projectDir, locations);
    const names = await this.readDirGracefully(conventionalDir);
    return this.readStructuredFiles(
      projectDir,
      names
        .filter((name) => /\.(?:ya?ml|json)$/.test(name))
        .map((name) => path.join(conventionalDir, name))
    );
  }

  /**
   * Whether a project-relative file exists inside the project.
   * @param projectDir - Absolute path to project root
   * @param location - Recorded file location
   * @returns False for missing files and for locations outside the project
   */
  private async projectFileExists(projectDir: string, location: string): Promise<boolean> {
    const target = path.resolve(projectDir, location);
    const fromRoot = path.relative(projectDir, target);
    if (
      fromRoot === '' ||
      fromRoot === '..' ||
      fromRoot.startsWith(`..${path.sep}`) ||
      path.isAbsolute(fromRoot)
    )
      return false;
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: extraction helpers
  // ---------------------------------------------------------------------------

  /**
   * Find the end of a markdown section starting at the given offset
   * @param content - Full document content
   * @param startOffset - Character offset where the section heading starts
   * @returns Character offset where the section ends
   */
  private findSectionEnd(content: string, startOffset: number): number {
    // Find the heading level of the current section
    const headingMatch = /^(#{2,3})\s/m.exec(content.slice(startOffset));
    if (!headingMatch) {
      return content.length;
    }
    const headingLevel = (headingMatch[1] ?? '##').length;

    // Find the next heading of same or higher level
    const afterHeading = startOffset + headingMatch[0].length;
    const nextHeadingPattern = new RegExp(`^#{1,${String(headingLevel)}}\\s`, 'm');
    const nextMatch = nextHeadingPattern.exec(content.slice(afterHeading));
    if (nextMatch) {
      return afterHeading + nextMatch.index;
    }
    return content.length;
  }

  /**
   * Extract priority from a section's content
   * @param sectionContent - Markdown content of a single requirement section
   * @returns Priority string (P0-P3)
   */
  private extractPriority(sectionContent: string): string {
    // Look for explicit priority markers
    const priorityMatch = /\b(P[0-3])\b/.exec(sectionContent);
    if (priorityMatch !== null && priorityMatch[1] !== undefined) {
      return priorityMatch[1];
    }

    // Look for priority keywords
    const lowerContent = sectionContent.toLowerCase();
    if (lowerContent.includes('critical') || lowerContent.includes('must have')) {
      return 'P0';
    }
    if (lowerContent.includes('high priority') || lowerContent.includes('should have')) {
      return 'P1';
    }
    if (lowerContent.includes('medium') || lowerContent.includes('could have')) {
      return 'P2';
    }
    if (lowerContent.includes('low priority') || lowerContent.includes('nice to have')) {
      return 'P3';
    }

    return 'P2'; // default
  }

  /**
   * Extract acceptance criteria from a section's content
   * @param sectionContent - Markdown content of a single requirement section
   * @returns Array of extracted acceptance criteria
   */
  private extractAcceptanceCriteria(sectionContent: string): readonly RtmAcceptanceCriterion[] {
    const criteria: RtmAcceptanceCriterion[] = [];

    // Match AC-XXX patterns
    const acPattern = /AC-(\d{3})\s*[:\-–]\s*(.+?)(?=\n|$)/g;
    let match: RegExpExecArray | null;
    while ((match = acPattern.exec(sectionContent)) !== null) {
      criteria.push({
        id: `AC-${match[1] ?? '000'}`,
        description: (match[2] ?? '').trim(),
        validated: false,
      });
    }

    // If no AC-XXX found, look for numbered acceptance criteria lists
    if (criteria.length === 0) {
      const acSectionMatch = /acceptance\s+criteria[:\s]*\n([\s\S]*?)(?=\n#{2,3}\s|\n\n\n|$)/i.exec(
        sectionContent
      );
      if (acSectionMatch) {
        const listPattern = /[-*]\s+(.+?)(?=\n|$)/g;
        let listMatch: RegExpExecArray | null;
        let index = 1;
        while ((listMatch = listPattern.exec(acSectionMatch[1] ?? '')) !== null) {
          criteria.push({
            id: `AC-${String(index).padStart(3, '0')}`,
            description: (listMatch[1] ?? '').trim(),
            validated: false,
          });
          index++;
        }
      }
    }

    return criteria;
  }

  /**
   * Normalize implementation status string
   * @param value - Raw status value from YAML/JSON
   * @returns Normalized status enum value
   */
  private normalizeImplStatus(value: unknown): 'completed' | 'failed' | 'blocked' {
    const str = this.safeToString(value ?? '').toLowerCase();
    if (str === 'completed' || str === 'success' || str === 'done') {
      return 'completed';
    }
    if (str === 'failed' || str === 'failure' || str === 'error') {
      return 'failed';
    }
    if (str === 'blocked' || str === 'pending' || str === 'waiting') {
      return 'blocked';
    }
    return 'failed';
  }

  /**
   * Determine overall status for an RTM entry
   * @param features - Feature IDs linked to this requirement
   * @param components - Component IDs linked through features
   * @param implementations - Implementation results for linked work orders
   * @param acceptanceCriteria - Acceptance criteria for this requirement
   * @param issues - Issues linked to the requirement
   * @returns Overall status of the requirement chain
   */
  private determineStatus(
    features: readonly string[],
    components: readonly string[],
    implementations: readonly RtmImplStatus[],
    acceptanceCriteria: readonly RtmAcceptanceCriterion[],
    issues: readonly string[] = []
  ): 'not_started' | 'in_progress' | 'implemented' | 'verified' {
    // No features mapped and no issue cites the requirement — not started
    if (features.length === 0 && issues.length === 0) {
      return 'not_started';
    }

    // Has implementations that completed
    const completedImpls = implementations.filter((i) => i.status === 'completed');
    if (completedImpls.length > 0) {
      // All acceptance criteria validated — verified
      if (acceptanceCriteria.length > 0 && acceptanceCriteria.every((ac) => ac.validated)) {
        return 'verified';
      }
      return 'implemented';
    }

    // Some work is in progress (has components or issues)
    if (components.length > 0 || issues.length > 0) {
      return 'in_progress';
    }

    return 'not_started';
  }

  /**
   * Extract a string list from a single string or an array
   * @param value - Unknown value to extract strings from
   * @returns Non-empty strings; empty when the value is neither
   */
  private stringList(value: unknown): readonly string[] {
    const items: unknown[] = Array.isArray(value) ? value : [value];
    return items.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  }

  /**
   * Narrow an unknown value to a plain object
   * @param value - Candidate value
   * @returns Whether the value is a non-array object
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Return the object under a documented root key (for example
   * `implementation_result:`), or the flat object of an older format
   * @param value - Parsed document
   * @param rootKey - Documented root key
   * @returns The wrapped object, the flat object, or null
   */
  private unwrap(value: unknown, rootKey: string): Record<string, unknown> | null {
    if (!this.isRecord(value)) return null;
    const inner = value[rootKey];
    return this.isRecord(inner) ? inner : value;
  }

  /**
   * Safely convert an unknown value to a string without triggering
   * no-base-to-string lint errors
   * @param value - Unknown value to convert
   * @returns String representation, or empty string for non-primitive values
   */
  private safeToString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }
}

// =============================================================================
// Singleton
// =============================================================================

/** Singleton instance */
let instance: RtmBuilderAgent | null = null;

/**
 * Get the singleton instance of RtmBuilderAgent
 *
 * @returns The singleton instance
 */
export function getRtmBuilderAgent(): RtmBuilderAgent {
  if (instance === null) {
    instance = new RtmBuilderAgent();
  }
  return instance;
}

/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetRtmBuilderAgent(): void {
  instance = null;
}
