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
} from './types.js';

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
  readonly components: readonly string[];
}

/** Work order extracted from scratchpad */
interface ParsedWorkOrder {
  readonly id: string;
  readonly issueId: string;
}

/** Implementation result extracted from scratchpad */
interface ParsedImplResult {
  readonly workOrderId: string;
  readonly status: 'completed' | 'failed' | 'blocked';
  readonly testsPassed: boolean;
  readonly buildPassed: boolean;
}

/** Review result extracted from scratchpad */
interface ParsedReview {
  readonly workOrderId: string;
  readonly pullRequestId: string;
}

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
    const { projectDir, projectId, pipelineMode } = context;

    // 1. Parse all source artifacts
    const requirements = await this.parseRequirements(projectDir, projectId);
    const features = await this.parseFeatures(projectDir, projectId);
    const components = await this.parseComponents(projectDir, projectId);
    const issues = await this.parseIssues(projectDir, projectId);
    const workOrders = await this.parseWorkOrders(projectDir, projectId);
    const implResults = await this.parseImplementationResults(projectDir, projectId);
    const reviews = await this.parseReviews(projectDir, projectId);

    // 2. Build lookup maps for efficient linking
    const featuresByReq = this.buildFeaturesByRequirement(features);
    const useCasesByFeature = this.buildUseCasesByFeature(features);
    const componentsByFeature = this.buildComponentsByFeature(components);
    const issuesByComponent = this.buildIssuesByComponent(issues);
    const workOrdersByIssue = this.buildWorkOrdersByIssue(workOrders);
    const implByWorkOrder = this.buildImplByWorkOrder(implResults);
    const reviewByWorkOrder = this.buildReviewByWorkOrder(reviews);

    // 3. Assemble RTM entries
    const entries = this.assembleEntries(
      requirements,
      featuresByReq,
      useCasesByFeature,
      componentsByFeature,
      issuesByComponent,
      workOrdersByIssue,
      implByWorkOrder,
      reviewByWorkOrder
    );

    // 4. Calculate coverage metrics
    const allComponentIds = new Set(components.map((c) => c.id));
    const tracedComponentIds = new Set(entries.flatMap((e) => e.components));
    const coverageMetrics = this.calculateCoverage(entries, allComponentIds, tracedComponentIds);

    // 5. Identify gaps
    const gaps = this.identifyGaps(entries, allComponentIds, tracedComponentIds);

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
          const validated = ac.validated ? 'Yes' : 'No';
          const method = ac.validationMethod ?? '-';
          lines.push(`| ${ac.id} | ${ac.description} | ${validated} | ${method} |`);
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
   * @returns Parsed requirements extracted from the PRD
   */
  private async parseRequirements(
    projectDir: string,
    projectId: string
  ): Promise<readonly ParsedRequirement[]> {
    const content = await this.readDocumentMarkdown(projectDir, projectId, 'prd');
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
   * @returns Parsed features with their source requirements and use cases
   */
  private async parseFeatures(
    projectDir: string,
    projectId: string
  ): Promise<readonly ParsedFeature[]> {
    const content = await this.readDocumentMarkdown(projectDir, projectId, 'srs');
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
   * @returns Parsed components with their source feature mappings
   */
  private async parseComponents(
    projectDir: string,
    projectId: string
  ): Promise<readonly ParsedComponent[]> {
    const content = await this.readDocumentMarkdown(projectDir, projectId, 'sds');
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
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @returns Parsed issues with their component references
   */
  private async parseIssues(
    projectDir: string,
    projectId: string
  ): Promise<readonly ParsedIssue[]> {
    const issues: ParsedIssue[] = [];

    // Try JSON format first
    const jsonPath = path.join(projectDir, SCRATCHPAD_BASE, 'issues', projectId, 'issue_list.json');
    const jsonContent = await this.readFileGracefully(jsonPath);
    if (jsonContent !== null) {
      try {
        const parsed = JSON.parse(jsonContent) as unknown;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const issue = item as Record<string, unknown>;
            const id = this.safeToString(issue['id'] ?? issue['issueId'] ?? issue['number'] ?? '');
            const comps = this.extractStringArray(
              issue['components'] ?? issue['relatedComponents']
            );
            if (id.length > 0) {
              issues.push({ id, components: comps });
            }
          }
        }
        return issues;
      } catch {
        this.logger.warn(`Failed to parse issues JSON at ${jsonPath}`);
      }
    }

    // Try YAML format
    const yamlPath = path.join(projectDir, SCRATCHPAD_BASE, 'issues', projectId, 'issues.yaml');
    const yamlContent = await this.readFileGracefully(yamlPath);
    if (yamlContent !== null) {
      try {
        const jsYaml = await import('js-yaml');
        const parsed = jsYaml.load(yamlContent);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const issue = item as Record<string, unknown>;
            const id = this.safeToString(issue['id'] ?? issue['issueId'] ?? issue['number'] ?? '');
            const comps = this.extractStringArray(
              issue['components'] ?? issue['relatedComponents']
            );
            if (id.length > 0) {
              issues.push({ id, components: comps });
            }
          }
        }
      } catch {
        this.logger.warn(`Failed to parse issues YAML at ${yamlPath}`);
      }
    }

    return issues;
  }

  /**
   * Parse work orders from scratchpad
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @returns Parsed work orders with their issue mappings
   */
  private async parseWorkOrders(
    projectDir: string,
    projectId: string
  ): Promise<readonly ParsedWorkOrder[]> {
    const workOrders: ParsedWorkOrder[] = [];
    const dirPath = path.join(projectDir, SCRATCHPAD_BASE, 'progress', projectId, 'work_orders');
    const files = await this.readDirGracefully(dirPath);

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml') && !file.endsWith('.json')) {
        continue;
      }
      const filePath = path.join(dirPath, file);
      const content = await this.readFileGracefully(filePath);
      if (content === null) continue;

      try {
        let parsed: unknown;
        if (file.endsWith('.json')) {
          parsed = JSON.parse(content);
        } else {
          const jsYaml = await import('js-yaml');
          parsed = jsYaml.load(content);
        }
        const wo = parsed as Record<string, unknown>;
        const id = this.safeToString(wo['id'] ?? wo['workOrderId'] ?? '');
        const issueId = this.safeToString(wo['issueId'] ?? wo['issue'] ?? '');
        if (id.length > 0) {
          workOrders.push({ id, issueId });
        }
      } catch {
        this.logger.warn(`Failed to parse work order file: ${filePath}`);
      }
    }

    return workOrders;
  }

  /**
   * Parse implementation results from scratchpad
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @returns Parsed implementation results with status and test info
   */
  private async parseImplementationResults(
    projectDir: string,
    projectId: string
  ): Promise<readonly ParsedImplResult[]> {
    const results: ParsedImplResult[] = [];
    const dirPath = path.join(projectDir, SCRATCHPAD_BASE, 'progress', projectId, 'results');
    const files = await this.readDirGracefully(dirPath);

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml') && !file.endsWith('.json')) {
        continue;
      }
      const filePath = path.join(dirPath, file);
      const content = await this.readFileGracefully(filePath);
      if (content === null) continue;

      try {
        let parsed: unknown;
        if (file.endsWith('.json')) {
          parsed = JSON.parse(content);
        } else {
          const jsYaml = await import('js-yaml');
          parsed = jsYaml.load(content);
        }
        const res = parsed as Record<string, unknown>;
        const workOrderId = this.safeToString(res['workOrderId'] ?? res['work_order_id'] ?? '');
        const status = this.normalizeImplStatus(res['status']);
        const testsPassed = Boolean(res['testsPassed'] ?? res['tests_passed'] ?? false);
        const buildPassed = Boolean(res['buildPassed'] ?? res['build_passed'] ?? false);
        if (workOrderId.length > 0) {
          results.push({ workOrderId, status, testsPassed, buildPassed });
        }
      } catch {
        this.logger.warn(`Failed to parse implementation result: ${filePath}`);
      }
    }

    return results;
  }

  /**
   * Parse review results from scratchpad
   *
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @returns Parsed review results with PR info
   */
  private async parseReviews(
    projectDir: string,
    projectId: string
  ): Promise<readonly ParsedReview[]> {
    const reviews: ParsedReview[] = [];
    const dirPath = path.join(projectDir, SCRATCHPAD_BASE, 'progress', projectId, 'reviews');
    const files = await this.readDirGracefully(dirPath);

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml') && !file.endsWith('.json')) {
        continue;
      }
      const filePath = path.join(dirPath, file);
      const content = await this.readFileGracefully(filePath);
      if (content === null) continue;

      try {
        let parsed: unknown;
        if (file.endsWith('.json')) {
          parsed = JSON.parse(content);
        } else {
          const jsYaml = await import('js-yaml');
          parsed = jsYaml.load(content);
        }
        const rev = parsed as Record<string, unknown>;
        const workOrderId = this.safeToString(rev['workOrderId'] ?? rev['work_order_id'] ?? '');
        const pullRequestId = this.safeToString(
          rev['pullRequestId'] ?? rev['pull_request_id'] ?? rev['prNumber'] ?? rev['pr_url'] ?? ''
        );
        if (workOrderId.length > 0 && pullRequestId.length > 0) {
          reviews.push({ workOrderId, pullRequestId });
        }
      } catch {
        this.logger.warn(`Failed to parse review result: ${filePath}`);
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
   * Build a map from work order ID to implementation result
   * @param results - Parsed implementation results
   * @returns Map of work order ID to implementation result
   */
  private buildImplByWorkOrder(
    results: readonly ParsedImplResult[]
  ): ReadonlyMap<string, ParsedImplResult> {
    const map = new Map<string, ParsedImplResult>();
    for (const result of results) {
      map.set(result.workOrderId, result);
    }
    return map;
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
   * @param requirements - Parsed functional requirements
   * @param featuresByReq - Map of requirement ID to feature IDs
   * @param useCasesByFeature - Map of feature ID to use case IDs
   * @param componentsByFeature - Map of feature ID to component IDs
   * @param issuesByComponent - Map of component ID to issue IDs
   * @param workOrdersByIssue - Map of issue ID to work order IDs
   * @param implByWorkOrder - Map of work order ID to implementation result
   * @param reviewByWorkOrder - Map of work order ID to review record
   * @returns Assembled RTM entries
   */
  private assembleEntries(
    requirements: readonly ParsedRequirement[],
    featuresByReq: ReadonlyMap<string, readonly string[]>,
    useCasesByFeature: ReadonlyMap<string, readonly string[]>,
    componentsByFeature: ReadonlyMap<string, readonly string[]>,
    issuesByComponent: ReadonlyMap<string, readonly string[]>,
    workOrdersByIssue: ReadonlyMap<string, readonly string[]>,
    implByWorkOrder: ReadonlyMap<string, ParsedImplResult>,
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

      // CMP -> ISS
      const issueIds = new Set<string>();
      for (const cmpId of componentIds) {
        const iss = issuesByComponent.get(cmpId) ?? [];
        for (const i of iss) {
          issueIds.add(i);
        }
      }

      // ISS -> WO
      const workOrderIds = new Set<string>();
      for (const issId of issueIds) {
        const wos = workOrdersByIssue.get(issId) ?? [];
        for (const wo of wos) {
          workOrderIds.add(wo);
        }
      }

      // WO -> Implementations
      const implementations: RtmImplStatus[] = [];
      for (const woId of workOrderIds) {
        const impl = implByWorkOrder.get(woId);
        if (impl) {
          implementations.push({
            workOrderId: impl.workOrderId,
            status: impl.status,
            testsPassed: impl.testsPassed,
            buildPassed: impl.buildPassed,
          });
        }
      }

      // WO -> PRs (from reviews)
      const pullRequests = new Set<string>();
      for (const woId of workOrderIds) {
        const review = reviewByWorkOrder.get(woId);
        if (review !== undefined && review.pullRequestId.length > 0) {
          pullRequests.add(review.pullRequestId);
        }
      }

      // Determine status
      const status = this.determineStatus(
        featureIds,
        [...componentIds],
        implementations,
        req.acceptanceCriteria
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
        pullRequests: [...pullRequests],
        acceptanceCriteria: [...req.acceptanceCriteria],
        status,
      };
    });
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
   * @param entries - Assembled RTM entries
   * @param allComponentIds - Set of all component IDs found in SDS
   * @param tracedComponentIds - Set of component IDs traced to requirements
   * @returns Array of identified gaps
   */
  private identifyGaps(
    entries: readonly RtmEntry[],
    allComponentIds: ReadonlySet<string>,
    tracedComponentIds: ReadonlySet<string>
  ): readonly RtmGap[] {
    const gaps: RtmGap[] = [];

    // Uncovered requirements: FR with no SF
    const uncovered = entries.filter((e) => e.features.length === 0);
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
    for (const entry of entries) {
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
   * Checks scratchpad first, then falls back to docs/ directory.
   * @param projectDir - Absolute path to project root
   * @param projectId - Unique project identifier
   * @param docType - Document type to read
   * @returns Document content or null if not found
   */
  private async readDocumentMarkdown(
    projectDir: string,
    projectId: string,
    docType: 'prd' | 'srs' | 'sds'
  ): Promise<string | null> {
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
   * @returns Overall status of the requirement chain
   */
  private determineStatus(
    features: readonly string[],
    components: readonly string[],
    implementations: readonly RtmImplStatus[],
    acceptanceCriteria: readonly RtmAcceptanceCriterion[]
  ): 'not_started' | 'in_progress' | 'implemented' | 'verified' {
    // No features mapped yet — not started
    if (features.length === 0) {
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
    if (components.length > 0) {
      return 'in_progress';
    }

    return 'not_started';
  }

  /**
   * Extract a string array from an unknown value
   * @param value - Unknown value to extract strings from
   * @returns Array of strings, or empty array if value is not an array
   */
  private extractStringArray(value: unknown): readonly string[] {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    return [];
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
