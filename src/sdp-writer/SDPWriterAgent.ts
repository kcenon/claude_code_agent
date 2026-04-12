/**
 * SDP Writer Agent
 *
 * Generates a Software Development Plan (SDP) document from PRD and SRS
 * inputs. The SDP describes the lifecycle model, development environment,
 * artifact definitions, QA strategy, V&V strategy, risk management,
 * schedule, and configuration management for a project.
 *
 * Implements IAgent interface for AgentFactory integration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IAgent } from '../agents/types.js';

import type {
  SDPWriterAgentConfig,
  SDPGenerationSession,
  SDPGenerationResult,
  SDPGenerationStats,
  ParsedPRDExtract,
  ParsedSRSExtract,
  PRDTimelineEntry,
  GeneratedSDP,
  SDPMetadata,
  SDPMilestone,
  SDPRisk,
} from './types.js';
import {
  PRDNotFoundError,
  SRSNotFoundError,
  GenerationError,
  FileWriteError,
  SessionStateError,
} from './errors.js';
import { prependFrontmatter } from '../utilities/frontmatter.js';

/**
 * Default configuration for the SDP Writer Agent
 */
const DEFAULT_CONFIG: Required<SDPWriterAgentConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  templatePath: '.ad-sdlc/templates/sdp-template.md',
  publicDocsPath: 'docs/sdp',
  lifecycleModel: 'Iterative / Agile',
};

/**
 * Agent ID for SDPWriterAgent used in AgentFactory
 */
export const SDP_WRITER_AGENT_ID = 'sdp-writer-agent';

/**
 * SDP Writer Agent class
 *
 * Orchestrates the generation of SDP documents from PRD and SRS inputs.
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class SDPWriterAgent implements IAgent {
  public readonly agentId = SDP_WRITER_AGENT_ID;
  public readonly name = 'SDP Writer Agent';

  private readonly config: Required<SDPWriterAgentConfig>;
  private session: SDPGenerationSession | null = null;
  private initialized = false;

  constructor(config: SDPWriterAgentConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the agent (IAgent interface)
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Dispose of the agent and release resources (IAgent interface)
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.session = null;
    this.initialized = false;
  }

  /**
   * Get the current session
   * @returns Current SDP generation session or null if no session is active
   */
  public getSession(): SDPGenerationSession | null {
    return this.session;
  }

  /**
   * Start a new SDP generation session
   * @param projectId - Project identifier
   * @returns The new session
   */
  public async startSession(projectId: string): Promise<SDPGenerationSession> {
    await Promise.resolve();

    const docsDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const prdPath = path.join(docsDir, 'prd.md');
    const srsPath = path.join(docsDir, 'srs.md');

    if (!fs.existsSync(prdPath)) {
      throw new PRDNotFoundError(projectId, prdPath);
    }
    if (!fs.existsSync(srsPath)) {
      throw new SRSNotFoundError(projectId, srsPath);
    }

    const prdContent = fs.readFileSync(prdPath, 'utf-8');
    const srsContent = fs.readFileSync(srsPath, 'utf-8');

    const parsedPRD = this.extractPRD(prdContent, projectId);
    const parsedSRS = this.extractSRS(srsContent, projectId, parsedPRD.documentId);

    const warnings: string[] = [];
    if (parsedSRS.featureCount === 0) {
      warnings.push('No features detected in SRS — generated SDP uses default scope assumptions.');
    }

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'pending',
      parsedPRD,
      parsedSRS,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(warnings.length > 0 && { warnings }),
    };

    return this.session;
  }

  /**
   * Generate SDP from a project
   * @param projectId - Project identifier
   * @returns Generation result
   */
  public async generateFromProject(projectId: string): Promise<SDPGenerationResult> {
    const startTime = Date.now();

    if (!this.session || this.session.projectId !== projectId) {
      await this.startSession(projectId);
    }

    if (!this.session) {
      throw new GenerationError(projectId, 'initialization', 'Failed to create session');
    }

    try {
      this.updateSession({ status: 'parsing' });

      const { parsedPRD, parsedSRS } = this.session;

      this.updateSession({ status: 'generating' });

      // Carry forward warnings collected during startSession (e.g. empty SRS)
      // and let generateSDPDocument append further warnings (e.g. missing
      // PRD timeline) into the same array.
      const warnings: string[] = this.session.warnings ? [...this.session.warnings] : [];

      const generatedSDP = this.generateSDPDocument(projectId, parsedPRD, parsedSRS, warnings);

      this.updateSession({
        status: 'completed',
        generatedSDP,
        ...(warnings.length > 0 && { warnings }),
      });

      const paths = await this.writeOutputFiles(projectId, generatedSDP);

      const stats: SDPGenerationStats = {
        srsFeatureCount: parsedSRS.featureCount,
        nfrCount: parsedSRS.nfrCount,
        milestonesGenerated: generatedSDP.milestones.length,
        risksGenerated: generatedSDP.risks.length,
        processingTimeMs: Date.now() - startTime,
      };

      return {
        success: true,
        projectId,
        scratchpadPath: paths.scratchpadPath,
        publicPath: paths.publicPath,
        scratchpadPathKorean: paths.scratchpadPathKorean,
        publicPathKorean: paths.publicPathKorean,
        generatedSDP,
        stats,
        ...(warnings.length > 0 && { warnings }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateSession({
        status: 'failed',
        errorMessage,
      });
      throw error;
    }
  }

  /**
   * Finalize the current session and write output files
   * @returns Generation result based on the cached generated SDP
   */
  public async finalize(): Promise<SDPGenerationResult> {
    if (!this.session) {
      throw new SessionStateError('null', 'active', 'finalize');
    }

    if (this.session.status !== 'completed') {
      throw new SessionStateError(this.session.status, 'completed', 'finalize');
    }

    if (!this.session.generatedSDP) {
      throw new GenerationError(this.session.projectId, 'finalization', 'No generated SDP');
    }

    const paths = await this.writeOutputFiles(this.session.projectId, this.session.generatedSDP);

    return {
      success: true,
      projectId: this.session.projectId,
      scratchpadPath: paths.scratchpadPath,
      publicPath: paths.publicPath,
      scratchpadPathKorean: paths.scratchpadPathKorean,
      publicPathKorean: paths.publicPathKorean,
      generatedSDP: this.session.generatedSDP,
      stats: {
        srsFeatureCount: this.session.parsedSRS.featureCount,
        nfrCount: this.session.parsedSRS.nfrCount,
        milestonesGenerated: this.session.generatedSDP.milestones.length,
        risksGenerated: this.session.generatedSDP.risks.length,
        processingTimeMs: 0,
      },
    };
  }

  /**
   * Update session with partial data
   * @param updates - Partial session fields to merge into the current session
   */
  private updateSession(updates: Partial<SDPGenerationSession>): void {
    if (!this.session) return;

    this.session = {
      ...this.session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract a lightweight PRD summary from PRD markdown content.
   *
   * Looks for a top-level title and the first description paragraph; falls
   * back to defaults derived from the project ID if either is missing.
   * @param content - Raw PRD markdown
   * @param projectId - Project identifier (used as fallback)
   */
  private extractPRD(content: string, projectId: string): ParsedPRDExtract {
    const docIdMatch =
      content.match(/^doc_id:\s*['"]?([^'"\n]+)['"]?/m) ??
      content.match(/\|\s*\*\*Document ID\*\*\s*\|\s*([^|]+)\s*\|/);
    const documentId = docIdMatch?.[1]?.trim() ?? `PRD-${projectId}`;

    const titleMatch =
      content.match(/^#\s+(?:Product Requirements Document:\s*)?(.+)$/m) ??
      content.match(/^title:\s*['"]?([^'"\n]+)['"]?/m);
    const productName = titleMatch?.[1]?.trim() ?? projectId;

    // First non-empty paragraph after the first heading is treated as description
    const descMatch = content.match(/##[^\n]*\n+([^\n#][^\n]*)/);
    const productDescription = descMatch?.[1]?.trim() ?? '';

    const timelineEntries = this.extractPRDTimeline(content);

    return {
      documentId,
      productName,
      productDescription,
      timelineEntries,
    };
  }

  /**
   * Extract timeline / milestone entries from a PRD timeline section.
   *
   * Supports two PRD layouts:
   *   1. Markdown table — first column treated as phase, remaining columns
   *      concatenated into the description.
   *   2. Bullet list (`- Phase: description` or `- Phase — description`).
   *
   * Returns an empty array when no recognisable timeline section is found.
   * @param content - Raw PRD markdown
   */
  private extractPRDTimeline(content: string): readonly PRDTimelineEntry[] {
    // Locate a section header containing "Timeline", "Schedule", "Milestones",
    // or the Korean equivalents. We split into lines and walk forward instead
    // of relying on regex lookaheads with `^#` anchors, which behave
    // inconsistently across multiline / dotall combinations in ECMAScript.
    const lines = content.split('\n');
    // Note: do not use `\b` here — JavaScript's word boundary does not align
    // with CJK character classes, so it would prevent matches like "## 일정".
    const headingPattern =
      /^#{1,6}\s+(?:[\d.]+\s+)?(?:Timeline|Schedule|Milestones?|일정|마일스톤|타임라인)(?:[\s:]|$)/i;

    let startIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (headingPattern.test(lines[i] ?? '')) {
        startIdx = i + 1;
        break;
      }
    }
    if (startIdx === -1) {
      return [];
    }

    let endIdx = lines.length;
    for (let i = startIdx; i < lines.length; i++) {
      if (/^#{1,6}\s/.test(lines[i] ?? '')) {
        endIdx = i;
        break;
      }
    }

    const body = lines.slice(startIdx, endIdx).join('\n');
    const entries: PRDTimelineEntry[] = [];

    // Try table form first.
    const tableLines = body
      .split('\n')
      .filter((line) => line.trim().startsWith('|') && line.trim().endsWith('|'));
    if (tableLines.length >= 2) {
      // Skip header (first row) and separator (second row, contains ---).
      for (let i = 0; i < tableLines.length; i++) {
        const line = tableLines[i];
        if (line === undefined) continue;
        if (i < 2) continue; // header + separator
        if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue; // extra separator row
        const cells = line
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        if (cells.length === 0) continue;
        const phase = cells[0];
        if (phase === undefined || phase.length === 0) continue;
        const description = cells
          .slice(1)
          .filter((c) => c.length > 0)
          .join(' — ');
        entries.push({ phase, description });
      }
      if (entries.length > 0) {
        return entries;
      }
    }

    // Fall back to bullet list form.
    const bulletRegex = /^\s*[-*]\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = bulletRegex.exec(body)) !== null) {
      const text = match[1]?.trim();
      if (text === undefined || text.length === 0) continue;
      // Split on " — ", " – ", or ":" to separate phase from description.
      const splitMatch = text.match(/^([^:—–]+?)\s*[:—–]\s*(.+)$/);
      if (
        splitMatch !== null &&
        splitMatch[1] !== undefined &&
        splitMatch[1].length > 0 &&
        splitMatch[2] !== undefined &&
        splitMatch[2].length > 0
      ) {
        entries.push({
          phase: splitMatch[1].trim(),
          description: splitMatch[2].trim(),
        });
      } else {
        entries.push({ phase: text, description: '' });
      }
    }

    return entries;
  }

  /**
   * Extract a lightweight SRS summary from SRS markdown content.
   *
   * Counts feature headings (`### SF-xxx`) and NFR headings (`### NFR-xxx`).
   * @param content - Raw SRS markdown
   * @param projectId - Project identifier (used as fallback)
   * @param sourcePRD - PRD document ID to record as the source
   */
  private extractSRS(content: string, projectId: string, sourcePRD: string): ParsedSRSExtract {
    const docIdMatch =
      content.match(/^doc_id:\s*['"]?([^'"\n]+)['"]?/m) ??
      content.match(/\|\s*\*\*Document ID\*\*\s*\|\s*([^|]+)\s*\|/);
    const documentId = docIdMatch?.[1]?.trim() ?? `SRS-${projectId}`;

    const titleMatch =
      content.match(/^#\s+(?:Software Requirements Specification:\s*)?(.+)$/m) ??
      content.match(/^title:\s*['"]?([^'"\n]+)['"]?/m);
    const productName = titleMatch?.[1]?.trim() ?? projectId;

    const featureMatches = content.match(/^###\s+SF-\d+/gm);
    const featureCount = featureMatches?.length ?? 0;

    const nfrMatches = content.match(/^###\s+NFR-\d+/gm);
    const nfrCount = nfrMatches?.length ?? 0;

    return {
      documentId,
      sourcePRD,
      productName,
      featureCount,
      nfrCount,
    };
  }

  /**
   * Generate the complete SDP document object (metadata + content + milestones + risks).
   * @param projectId - Project identifier for document naming
   * @param prd - Parsed PRD extract
   * @param srs - Parsed SRS extract
   * @param warnings
   */
  private generateSDPDocument(
    projectId: string,
    prd: ParsedPRDExtract,
    srs: ParsedSRSExtract,
    warnings: string[]
  ): GeneratedSDP {
    const now = new Date().toISOString().split('T')[0] ?? '';

    const metadata: SDPMetadata = {
      documentId: `SDP-${projectId}`,
      sourcePRD: prd.documentId,
      sourceSRS: srs.documentId,
      version: '1.0.0',
      status: 'Draft',
      createdDate: now,
      updatedDate: now,
    };

    const lifecycle = this.selectLifecycleModel(srs);
    const milestones = this.generateMilestones(prd, warnings);
    const risks = this.generateRisks(srs);

    let content = this.generateMarkdownContent(metadata, prd, srs, lifecycle, milestones, risks);
    let contentKorean = this.generateMarkdownContentKorean(
      metadata,
      prd,
      srs,
      lifecycle,
      milestones,
      risks
    );

    content = prependFrontmatter(content, {
      docId: metadata.documentId,
      title: `SDP: ${prd.productName}`,
      version: metadata.version,
      status: metadata.status,
      generatedBy: 'AD-SDLC SDP Writer Agent',
      generatedAt: new Date().toISOString(),
      sourceDocuments: [metadata.sourcePRD, metadata.sourceSRS],
      changeHistory: [
        {
          version: metadata.version,
          date: now,
          author: 'AD-SDLC SDP Writer Agent',
          description: 'Initial document generation',
        },
      ],
    });

    contentKorean = prependFrontmatter(contentKorean, {
      docId: metadata.documentId,
      title: `SDP: ${prd.productName} (Korean)`,
      version: metadata.version,
      status: metadata.status,
      generatedBy: 'AD-SDLC SDP Writer Agent',
      generatedAt: new Date().toISOString(),
      sourceDocuments: [metadata.sourcePRD, metadata.sourceSRS],
      changeHistory: [
        {
          version: metadata.version,
          date: now,
          author: 'AD-SDLC SDP Writer Agent',
          description: 'Initial document generation (Korean variant)',
        },
      ],
    });

    return {
      metadata,
      content,
      contentKorean,
      milestones,
      risks,
    };
  }

  /**
   * Select a lifecycle model based on SRS scope.
   *
   * Heuristic (driven by SRS feature count):
   *   - feature count > 50  → V-Model (large project, formal stage gates)
   *   - 20 ≤ feature count ≤ 50 → Iterative (mid-size, balanced cadence)
   *   - feature count < 20  → Agile (small/exploratory, fast feedback)
   *
   * If a non-default lifecycle model is configured explicitly, the
   * configured value wins so callers can still override the heuristic.
   * @param srs - Parsed SRS extract used to size the project
   */
  private selectLifecycleModel(srs: ParsedSRSExtract): {
    model: string;
    rationale: string;
  } {
    // Allow explicit override via configuration.
    if (this.config.lifecycleModel !== DEFAULT_CONFIG.lifecycleModel) {
      return {
        model: this.config.lifecycleModel,
        rationale: `Lifecycle model "${this.config.lifecycleModel}" was explicitly configured for this project.`,
      };
    }

    const featureCount = srs.featureCount;
    if (featureCount > 50) {
      return {
        model: 'V-Model',
        rationale: `Selected V-Model because the SRS contains ${String(featureCount)} features (> 50). Large projects benefit from formal stage gates and explicit verification artifacts at every level.`,
      };
    }
    if (featureCount >= 20) {
      return {
        model: 'Iterative',
        rationale: `Selected an Iterative model because the SRS contains ${String(featureCount)} features (20-50). Mid-size projects benefit from incremental delivery with structured iteration boundaries.`,
      };
    }
    return {
      model: 'Agile',
      rationale: `Selected an Agile model because the SRS contains ${String(featureCount)} features (< 20). Small projects benefit from short feedback cycles and flexible scope adjustment.`,
    };
  }

  /**
   * Generate the project milestone list.
   *
   * If the PRD timeline section is non-empty, milestones are derived from it
   * (one milestone per timeline entry, prefixed with phase information). If
   * the PRD timeline is empty, falls back to a stable default milestone set
   * and pushes a warning describing the fallback.
   *
   * @param prd - Parsed PRD extract whose timeline is the primary source
   * @param warnings - Mutable warnings array to append fallback notices to
   */
  private generateMilestones(prd: ParsedPRDExtract, warnings: string[]): readonly SDPMilestone[] {
    if (prd.timelineEntries.length > 0) {
      return prd.timelineEntries.map((entry, index) => ({
        id: `M${String(index + 1)}`,
        name: entry.phase,
        description: entry.description.length > 0 ? entry.description : entry.phase,
        phase: entry.phase,
      }));
    }

    warnings.push(
      'PRD timeline section was empty or missing — SDP milestones fall back to the default lifecycle phases (Planning → Release).'
    );

    return [
      {
        id: 'M1',
        name: 'Requirements Baseline',
        description: 'PRD and SRS approved; SDP baseline established.',
        phase: 'Planning',
      },
      {
        id: 'M2',
        name: 'Design Baseline',
        description: 'SDS approved; architecture and component design frozen.',
        phase: 'Design',
      },
      {
        id: 'M3',
        name: 'Implementation Complete',
        description: 'All features implemented and unit-tested.',
        phase: 'Implementation',
      },
      {
        id: 'M4',
        name: 'Verification Complete',
        description: 'Integration and system tests passed; coverage thresholds met.',
        phase: 'Verification',
      },
      {
        id: 'M5',
        name: 'Release',
        description: 'Validation passed; product released and documentation published.',
        phase: 'Release',
      },
    ];
  }

  /**
   * Generate the default risk register, augmenting it based on SRS scope.
   * @param srs - Parsed SRS extract used to derive scope-aware risks
   */
  private generateRisks(srs: ParsedSRSExtract): readonly SDPRisk[] {
    const risks: SDPRisk[] = [
      {
        id: 'R1',
        description: 'Requirements churn during implementation phase.',
        likelihood: 'Medium',
        impact: 'High',
        mitigation: 'Lock SRS baseline before implementation; enforce change control board.',
      },
      {
        id: 'R2',
        description: 'Underestimated complexity in third-party integrations.',
        likelihood: 'Medium',
        impact: 'Medium',
        mitigation: 'Build integration spikes early; allocate buffer in schedule.',
      },
      {
        id: 'R3',
        description: 'Insufficient test coverage leading to regressions.',
        likelihood: 'Low',
        impact: 'High',
        mitigation: 'Enforce coverage thresholds in CI; require tests for every PR.',
      },
    ];

    if (srs.featureCount >= 10) {
      risks.push({
        id: 'R4',
        description: 'Large feature scope increases coordination overhead across teams.',
        likelihood: 'Medium',
        impact: 'Medium',
        mitigation:
          'Split work into vertical slices; use the AD-SDLC orchestrator to parallelize delivery.',
      });
    }

    if (srs.nfrCount >= 5) {
      risks.push({
        id: `R${String(risks.length + 1)}`,
        description: 'High number of non-functional requirements may impact delivery velocity.',
        likelihood: 'Medium',
        impact: 'Medium',
        mitigation:
          'Prioritize NFRs by business value; defer non-critical NFRs to post-release iterations.',
      });
    }

    return risks;
  }

  /**
   * Generate the English markdown content for the SDP.
   *
   * Layout follows the 9-section template defined in the SDP template file.
   * @param metadata - Document metadata for the header section
   * @param prd - Parsed PRD extract for project overview
   * @param srs - Parsed SRS extract for scope sizing
   * @param lifecycle
   * @param lifecycle.model
   * @param lifecycle.rationale
   * @param milestones - Milestones to render in the schedule section
   * @param risks - Risks to render in the risk management section
   */
  private generateMarkdownContent(
    metadata: SDPMetadata,
    prd: ParsedPRDExtract,
    srs: ParsedSRSExtract,
    lifecycle: { model: string; rationale: string },
    milestones: readonly SDPMilestone[],
    risks: readonly SDPRisk[]
  ): string {
    const lines: string[] = [];

    lines.push(`# Software Development Plan: ${prd.productName}`);
    lines.push('');

    lines.push('| **Document ID** | **Source PRD** | **Source SRS** | **Version** | **Status** |');
    lines.push('|-----------------|----------------|----------------|-------------|------------|');
    lines.push(
      `| ${metadata.documentId} | ${metadata.sourcePRD} | ${metadata.sourceSRS} | ${metadata.version} | ${metadata.status} |`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Table of Contents');
    lines.push('');
    lines.push('1. [Project Overview](#1-project-overview)');
    lines.push('2. [Lifecycle Model](#2-lifecycle-model)');
    lines.push('3. [Development Environment](#3-development-environment)');
    lines.push('4. [Artifact Definitions](#4-artifact-definitions)');
    lines.push('5. [QA Strategy](#5-qa-strategy)');
    lines.push('6. [V&V Strategy](#6-vv-strategy)');
    lines.push('7. [Risk Management](#7-risk-management)');
    lines.push('8. [Schedule and Milestones](#8-schedule-and-milestones)');
    lines.push('9. [Configuration Management](#9-configuration-management)');
    lines.push('');

    // Section 1: Project Overview
    lines.push('## 1. Project Overview');
    lines.push('');
    lines.push('### 1.1 Product');
    lines.push('');
    lines.push(`- **Name:** ${prd.productName}`);
    lines.push(`- **Source PRD:** ${metadata.sourcePRD}`);
    lines.push(`- **Source SRS:** ${metadata.sourceSRS}`);
    lines.push('');
    lines.push('### 1.2 Description');
    lines.push('');
    lines.push(prd.productDescription || 'See referenced PRD for the full product description.');
    lines.push('');
    lines.push('### 1.3 Scope Sizing');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Software Features (SRS) | ${String(srs.featureCount)} |`);
    lines.push(`| Non-Functional Requirements (SRS) | ${String(srs.nfrCount)} |`);
    lines.push('');

    // Section 2: Lifecycle Model
    lines.push('## 2. Lifecycle Model');
    lines.push('');
    lines.push(`- **Selected Model:** ${lifecycle.model}`);
    lines.push(`- **Rationale:** ${lifecycle.rationale}`);
    lines.push('');
    lines.push('### Selection Heuristic');
    lines.push('');
    lines.push('| SRS Feature Count | Lifecycle Model |');
    lines.push('|-------------------|-----------------|');
    lines.push('| > 50 | V-Model |');
    lines.push('| 20 – 50 | Iterative |');
    lines.push('| < 20 | Agile |');
    lines.push('');
    lines.push('### 2.1 Phases');
    lines.push('');
    lines.push('1. **Planning** — requirements baseline (PRD, SRS, SDP).');
    lines.push('2. **Design** — system and component design (SDS).');
    lines.push('3. **Implementation** — feature delivery via parallel worker agents.');
    lines.push('4. **Verification** — automated tests, integration, and traceability checks.');
    lines.push('5. **Release** — validation, packaging, and documentation publication.');
    lines.push('');

    // Section 3: Development Environment
    lines.push('## 3. Development Environment');
    lines.push('');
    lines.push('### 3.1 Tooling');
    lines.push('');
    lines.push('| Category | Tool |');
    lines.push('|----------|------|');
    lines.push('| Language | TypeScript 5.x |');
    lines.push('| Runtime | Node.js 20.x LTS |');
    lines.push('| Package Manager | npm |');
    lines.push('| Test Runner | Vitest |');
    lines.push('| Version Control | Git / GitHub |');
    lines.push('| CI/CD | GitHub Actions |');
    lines.push('| Documentation | Markdown + Mermaid diagrams |');
    lines.push('');
    lines.push('### 3.2 Team Structure');
    lines.push('');
    lines.push('- **AD-SDLC Pipeline Operator** — drives the orchestrator and reviews approvals.');
    lines.push('- **Worker Agents** — implement individual issues in parallel.');
    lines.push('- **PR Reviewer Agent** — validates pull requests against quality gates.');
    lines.push('- **Validation Agent** — verifies acceptance criteria before release.');
    lines.push('');

    // Section 4: Artifact Definitions
    lines.push('## 4. Artifact Definitions');
    lines.push('');
    lines.push('| Artifact | Producer | Consumer | Storage |');
    lines.push('|----------|----------|----------|---------|');
    lines.push('| PRD | PRD Writer Agent | SRS Writer, SDP Writer | `docs/prd/` |');
    lines.push('| SRS | SRS Writer Agent | SDS Writer, SDP Writer | `docs/srs/` |');
    lines.push('| SDP | SDP Writer Agent | All downstream agents | `docs/sdp/` |');
    lines.push('| SDS | SDS Writer Agent | Issue Generator, Workers | `docs/sds/` |');
    lines.push('| Issues | Issue Generator | Workers | GitHub Issues |');
    lines.push('| Pull Requests | Worker Agents | PR Reviewer | GitHub Pull Requests |');
    lines.push('');

    // Section 5: QA Strategy
    lines.push('## 5. QA Strategy');
    lines.push('');
    lines.push('### 5.1 Quality Goals');
    lines.push('');
    lines.push('- Maintain ≥80% unit-test coverage on all production modules.');
    lines.push('- Block merges on lint, type-check, and test failures.');
    lines.push('- Require human approval at every pipeline stage gate.');
    lines.push('');
    lines.push('### 5.2 Quality Activities');
    lines.push('');
    lines.push('- **Static Analysis:** TypeScript strict mode + ESLint on every commit.');
    lines.push('- **Unit Tests:** Vitest, executed in CI on every PR.');
    lines.push('- **Code Review:** PR Reviewer Agent + human reviewer for every PR.');
    lines.push('- **Documentation Review:** SDP/SDS/SRS reviewed against PRD acceptance criteria.');
    lines.push('');

    // Section 6: V&V Strategy
    lines.push('## 6. V&V Strategy');
    lines.push('');
    lines.push('### 6.1 Scope Under V&V');
    lines.push('');
    lines.push(
      `The V&V activities below cover **${String(srs.featureCount)} software feature(s) (SF-xxx)** and **${String(srs.nfrCount)} non-functional requirement(s) (NFR-xxx)** as defined in ${metadata.sourceSRS}.`
    );
    lines.push('');
    lines.push('| Requirement Class | Count | Source |');
    lines.push('|-------------------|-------|--------|');
    lines.push(
      `| Software Features (SF-xxx) | ${String(srs.featureCount)} | ${metadata.sourceSRS} |`
    );
    lines.push(
      `| Non-Functional Requirements (NFR-xxx) | ${String(srs.nfrCount)} | ${metadata.sourceSRS} |`
    );
    lines.push('');
    lines.push('### 6.2 Verification');
    lines.push('');
    lines.push('Verification answers: *"Did we build the product right?"*');
    lines.push('');
    lines.push(
      `- Static analysis (TypeScript + ESLint) covering source for all ${String(srs.featureCount)} SF requirements.`
    );
    lines.push(
      `- Unit tests for every module — each of the ${String(srs.featureCount)} SF requirements requires at least one dedicated unit test.`
    );
    lines.push('- Integration tests for cross-module flows.');
    lines.push(
      `- Traceability matrix linking each of the ${String(srs.featureCount)} SF and ${String(srs.nfrCount)} NFR entries to design (SDS) and tests.`
    );
    lines.push('');
    lines.push('### 6.3 Validation');
    lines.push('');
    lines.push('Validation answers: *"Did we build the right product?"*');
    lines.push('');
    lines.push(
      `- Acceptance tests covering all ${String(srs.featureCount)} SRS use cases referenced in ${metadata.sourceSRS}.`
    );
    lines.push(
      `- NFR validation suites for the ${String(srs.nfrCount)} non-functional requirements (performance, security, usability).`
    );
    lines.push('- Demo to stakeholders at each milestone.');
    lines.push('- Validation Agent enforces acceptance criteria from PRD before release.');
    lines.push('');

    // Section 7: Risk Management
    lines.push('## 7. Risk Management');
    lines.push('');
    lines.push('### 7.1 Risk Register');
    lines.push('');
    lines.push('| ID | Risk | Likelihood | Impact | Mitigation |');
    lines.push('|----|------|------------|--------|------------|');
    for (const risk of risks) {
      lines.push(
        `| ${risk.id} | ${risk.description} | ${risk.likelihood} | ${risk.impact} | ${risk.mitigation} |`
      );
    }
    lines.push('');
    lines.push('### 7.2 Risk Review Cadence');
    lines.push('');
    lines.push('- Risks reviewed at each milestone.');
    lines.push('- New risks added to the register as they are discovered.');
    lines.push('');

    // Section 8: Schedule & Milestones
    lines.push('## 8. Schedule and Milestones');
    lines.push('');
    lines.push('### 8.1 Milestones');
    lines.push('');
    lines.push('| ID | Milestone | Phase | Description |');
    lines.push('|----|-----------|-------|-------------|');
    for (const milestone of milestones) {
      lines.push(
        `| ${milestone.id} | ${milestone.name} | ${milestone.phase} | ${milestone.description} |`
      );
    }
    lines.push('');
    lines.push('### 8.2 Delivery Cadence');
    lines.push('');
    lines.push(
      '- Milestones are delivered iteratively; each milestone gates the next phase via human approval.'
    );
    lines.push('');

    // Section 9: Configuration Management
    lines.push('## 9. Configuration Management');
    lines.push('');
    lines.push('### 9.1 Source Control');
    lines.push('');
    lines.push('- All code, documents, and infrastructure-as-code are stored in Git.');
    lines.push('- Branching: feature branches per issue, merged via squash to `main`.');
    lines.push('');
    lines.push('### 9.2 Document Control');
    lines.push('');
    lines.push('- PRD/SRS/SDP/SDS carry YAML frontmatter (`doc_id`, `version`, `status`).');
    lines.push('- Change history is recorded in the document frontmatter.');
    lines.push('- Bilingual variants (`.md`, `.kr.md`) are produced for end-user documents.');
    lines.push('');
    lines.push('### 9.3 Release Control');
    lines.push('');
    lines.push('- Releases are tagged in Git using semantic versioning.');
    lines.push('- Each release records the PRD, SRS, SDP, and SDS document versions in scope.');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate the Korean variant of the SDP markdown content.
   *
   * Mirrors the English structure with localized headings and prose.
   * @param metadata - Document metadata for the header section
   * @param prd - Parsed PRD extract for project overview
   * @param srs - Parsed SRS extract for scope sizing
   * @param lifecycle
   * @param lifecycle.model
   * @param lifecycle.rationale
   * @param milestones - Milestones to render in the schedule section
   * @param risks - Risks to render in the risk management section
   */
  private generateMarkdownContentKorean(
    metadata: SDPMetadata,
    prd: ParsedPRDExtract,
    srs: ParsedSRSExtract,
    lifecycle: { model: string; rationale: string },
    milestones: readonly SDPMilestone[],
    risks: readonly SDPRisk[]
  ): string {
    const lines: string[] = [];

    lines.push(`# 소프트웨어 개발 계획서: ${prd.productName}`);
    lines.push('');

    lines.push('| **문서 ID** | **출처 PRD** | **출처 SRS** | **버전** | **상태** |');
    lines.push('|-------------|--------------|--------------|----------|----------|');
    lines.push(
      `| ${metadata.documentId} | ${metadata.sourcePRD} | ${metadata.sourceSRS} | ${metadata.version} | ${metadata.status} |`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## 목차');
    lines.push('');
    lines.push('1. [프로젝트 개요](#1-프로젝트-개요)');
    lines.push('2. [생명주기 모델](#2-생명주기-모델)');
    lines.push('3. [개발 환경](#3-개발-환경)');
    lines.push('4. [산출물 정의](#4-산출물-정의)');
    lines.push('5. [품질 보증 전략](#5-품질-보증-전략)');
    lines.push('6. [V&V 전략](#6-vv-전략)');
    lines.push('7. [리스크 관리](#7-리스크-관리)');
    lines.push('8. [일정 및 마일스톤](#8-일정-및-마일스톤)');
    lines.push('9. [형상 관리](#9-형상-관리)');
    lines.push('');

    lines.push('## 1. 프로젝트 개요');
    lines.push('');
    lines.push('### 1.1 제품');
    lines.push('');
    lines.push(`- **이름:** ${prd.productName}`);
    lines.push(`- **출처 PRD:** ${metadata.sourcePRD}`);
    lines.push(`- **출처 SRS:** ${metadata.sourceSRS}`);
    lines.push('');
    lines.push('### 1.2 설명');
    lines.push('');
    lines.push(prd.productDescription || '전체 제품 설명은 참조된 PRD를 확인하세요.');
    lines.push('');
    lines.push('### 1.3 범위 산정');
    lines.push('');
    lines.push('| 지표 | 값 |');
    lines.push('|------|-----|');
    lines.push(`| 소프트웨어 기능 (SRS) | ${String(srs.featureCount)} |`);
    lines.push(`| 비기능 요구사항 (SRS) | ${String(srs.nfrCount)} |`);
    lines.push('');

    lines.push('## 2. 생명주기 모델');
    lines.push('');
    lines.push(`- **선택 모델:** ${lifecycle.model}`);
    lines.push(`- **근거:** ${lifecycle.rationale}`);
    lines.push('');
    lines.push('### 선택 휴리스틱');
    lines.push('');
    lines.push('| SRS 기능 수 | 생명주기 모델 |');
    lines.push('|-------------|---------------|');
    lines.push('| 50 초과 | V-Model |');
    lines.push('| 20 ~ 50 | Iterative |');
    lines.push('| 20 미만 | Agile |');
    lines.push('');
    lines.push('### 2.1 단계');
    lines.push('');
    lines.push('1. **계획** — 요구사항 베이스라인(PRD, SRS, SDP) 확립.');
    lines.push('2. **설계** — 시스템 및 컴포넌트 설계(SDS).');
    lines.push('3. **구현** — 병렬 워커 에이전트를 통한 기능 인도.');
    lines.push('4. **검증** — 자동화 테스트, 통합, 추적성 점검.');
    lines.push('5. **출시** — 유효성 검사, 패키징, 문서 공개.');
    lines.push('');

    lines.push('## 3. 개발 환경');
    lines.push('');
    lines.push('### 3.1 도구');
    lines.push('');
    lines.push('| 분류 | 도구 |');
    lines.push('|------|------|');
    lines.push('| 언어 | TypeScript 5.x |');
    lines.push('| 런타임 | Node.js 20.x LTS |');
    lines.push('| 패키지 관리 | npm |');
    lines.push('| 테스트 러너 | Vitest |');
    lines.push('| 형상 관리 | Git / GitHub |');
    lines.push('| CI/CD | GitHub Actions |');
    lines.push('| 문서화 | Markdown + Mermaid 다이어그램 |');
    lines.push('');
    lines.push('### 3.2 팀 구성');
    lines.push('');
    lines.push('- **AD-SDLC 파이프라인 운영자** — 오케스트레이터를 구동하고 승인을 검토합니다.');
    lines.push('- **워커 에이전트** — 개별 이슈를 병렬로 구현합니다.');
    lines.push('- **PR 리뷰어 에이전트** — 품질 게이트를 통해 풀 리퀘스트를 검증합니다.');
    lines.push('- **검증 에이전트** — 출시 전 인수 기준을 확인합니다.');
    lines.push('');

    lines.push('## 4. 산출물 정의');
    lines.push('');
    lines.push('| 산출물 | 생성자 | 소비자 | 저장 위치 |');
    lines.push('|--------|--------|--------|-----------|');
    lines.push('| PRD | PRD Writer Agent | SRS Writer, SDP Writer | `docs/prd/` |');
    lines.push('| SRS | SRS Writer Agent | SDS Writer, SDP Writer | `docs/srs/` |');
    lines.push('| SDP | SDP Writer Agent | 모든 후속 에이전트 | `docs/sdp/` |');
    lines.push('| SDS | SDS Writer Agent | Issue Generator, Workers | `docs/sds/` |');
    lines.push('| 이슈 | Issue Generator | Workers | GitHub Issues |');
    lines.push('| 풀 리퀘스트 | Worker Agents | PR Reviewer | GitHub Pull Requests |');
    lines.push('');

    lines.push('## 5. 품질 보증 전략');
    lines.push('');
    lines.push('### 5.1 품질 목표');
    lines.push('');
    lines.push('- 모든 운영 모듈에서 단위 테스트 커버리지 80% 이상 유지.');
    lines.push('- 린트, 타입 체크, 테스트 실패 시 머지 차단.');
    lines.push('- 모든 파이프라인 단계 게이트에서 사람의 승인 요구.');
    lines.push('');
    lines.push('### 5.2 품질 활동');
    lines.push('');
    lines.push('- **정적 분석:** 모든 커밋에 TypeScript strict + ESLint 적용.');
    lines.push('- **단위 테스트:** Vitest, 모든 PR마다 CI에서 실행.');
    lines.push('- **코드 리뷰:** 모든 PR에 대해 PR Reviewer Agent + 사람 리뷰어.');
    lines.push('- **문서 리뷰:** SDP/SDS/SRS를 PRD 인수 기준 대비 검토.');
    lines.push('');

    lines.push('## 6. V&V 전략');
    lines.push('');
    lines.push('### 6.1 V&V 대상 범위');
    lines.push('');
    lines.push(
      `아래 V&V 활동은 ${metadata.sourceSRS}에 정의된 **소프트웨어 기능 ${String(srs.featureCount)}건(SF-xxx)** 과 **비기능 요구사항 ${String(srs.nfrCount)}건(NFR-xxx)** 을 대상으로 합니다.`
    );
    lines.push('');
    lines.push('| 요구사항 분류 | 개수 | 출처 |');
    lines.push('|---------------|------|------|');
    lines.push(
      `| 소프트웨어 기능 (SF-xxx) | ${String(srs.featureCount)} | ${metadata.sourceSRS} |`
    );
    lines.push(`| 비기능 요구사항 (NFR-xxx) | ${String(srs.nfrCount)} | ${metadata.sourceSRS} |`);
    lines.push('');
    lines.push('### 6.2 검증(Verification)');
    lines.push('');
    lines.push('검증은 *"제품을 올바르게 만들었는가?"* 에 대한 답입니다.');
    lines.push('');
    lines.push(
      `- ${String(srs.featureCount)}개 SF 요구사항 전체 소스에 대한 정적 분석(TypeScript + ESLint).`
    );
    lines.push(
      `- 모든 모듈에 대한 단위 테스트 — ${String(srs.featureCount)}개 SF 요구사항마다 최소 한 건의 단위 테스트가 필요합니다.`
    );
    lines.push('- 모듈 간 흐름에 대한 통합 테스트.');
    lines.push(
      `- ${String(srs.featureCount)}개 SF와 ${String(srs.nfrCount)}개 NFR 항목을 설계(SDS) 및 테스트와 연결하는 추적성 매트릭스.`
    );
    lines.push('');
    lines.push('### 6.3 유효성 확인(Validation)');
    lines.push('');
    lines.push('유효성 확인은 *"올바른 제품을 만들었는가?"* 에 대한 답입니다.');
    lines.push('');
    lines.push(
      `- ${metadata.sourceSRS}에 참조된 ${String(srs.featureCount)}개 SRS 사용 사례 전체에 대한 인수 테스트.`
    );
    lines.push(
      `- ${String(srs.nfrCount)}개 비기능 요구사항(성능, 보안, 사용성)에 대한 NFR 검증 스위트.`
    );
    lines.push('- 각 마일스톤에서 이해관계자 시연.');
    lines.push('- 출시 전 Validation Agent가 PRD 인수 기준을 강제 적용.');
    lines.push('');

    lines.push('## 7. 리스크 관리');
    lines.push('');
    lines.push('### 7.1 리스크 등록부');
    lines.push('');
    lines.push('| ID | 리스크 | 발생 가능성 | 영향 | 완화 방안 |');
    lines.push('|----|--------|-------------|------|-----------|');
    for (const risk of risks) {
      lines.push(
        `| ${risk.id} | ${risk.description} | ${risk.likelihood} | ${risk.impact} | ${risk.mitigation} |`
      );
    }
    lines.push('');
    lines.push('### 7.2 리스크 검토 주기');
    lines.push('');
    lines.push('- 각 마일스톤에서 리스크를 검토합니다.');
    lines.push('- 새로운 리스크는 발견 시점에 등록부에 추가됩니다.');
    lines.push('');

    lines.push('## 8. 일정 및 마일스톤');
    lines.push('');
    lines.push('### 8.1 마일스톤');
    lines.push('');
    lines.push('| ID | 마일스톤 | 단계 | 설명 |');
    lines.push('|----|----------|------|------|');
    for (const milestone of milestones) {
      lines.push(
        `| ${milestone.id} | ${milestone.name} | ${milestone.phase} | ${milestone.description} |`
      );
    }
    lines.push('');
    lines.push('### 8.2 인도 주기');
    lines.push('');
    lines.push(
      '- 마일스톤은 반복적으로 인도되며, 각 마일스톤은 사람의 승인을 통해 다음 단계로 게이트됩니다.'
    );
    lines.push('');

    lines.push('## 9. 형상 관리');
    lines.push('');
    lines.push('### 9.1 소스 관리');
    lines.push('');
    lines.push('- 모든 코드, 문서, IaC는 Git에 저장됩니다.');
    lines.push('- 브랜치 전략: 이슈별 피처 브랜치를 squash 머지로 `main`에 통합합니다.');
    lines.push('');
    lines.push('### 9.2 문서 관리');
    lines.push('');
    lines.push('- PRD/SRS/SDP/SDS는 YAML 프론트매터(`doc_id`, `version`, `status`)를 포함합니다.');
    lines.push('- 변경 이력은 문서 프론트매터에 기록됩니다.');
    lines.push('- 최종 사용자 문서는 한/영 이중 언어 변형(`.md`, `.kr.md`)으로 생성됩니다.');
    lines.push('');
    lines.push('### 9.3 릴리스 관리');
    lines.push('');
    lines.push('- 릴리스는 Git에서 시맨틱 버저닝으로 태깅됩니다.');
    lines.push('- 각 릴리스는 범위에 포함된 PRD, SRS, SDP, SDS 문서 버전을 기록합니다.');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Write the SDP output files (English + Korean) to scratchpad and public locations.
   * @param projectId - Project identifier for directory and file naming
   * @param sdp - Generated SDP document to write
   * @returns Paths to all four written files
   */
  private async writeOutputFiles(
    projectId: string,
    sdp: GeneratedSDP
  ): Promise<{
    scratchpadPath: string;
    publicPath: string;
    scratchpadPathKorean: string;
    publicPathKorean: string;
  }> {
    await Promise.resolve();

    const scratchpadDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const scratchpadPath = path.join(scratchpadDir, 'sdp.md');
    const scratchpadPathKorean = path.join(scratchpadDir, 'sdp.kr.md');

    const publicDir = this.config.publicDocsPath;
    const publicPath = path.join(publicDir, `SDP-${projectId}.md`);
    const publicPathKorean = path.join(publicDir, `SDP-${projectId}.kr.md`);

    try {
      fs.mkdirSync(scratchpadDir, { recursive: true });
      fs.mkdirSync(publicDir, { recursive: true });

      fs.writeFileSync(scratchpadPath, sdp.content, 'utf-8');
      fs.writeFileSync(publicPath, sdp.content, 'utf-8');
      fs.writeFileSync(scratchpadPathKorean, sdp.contentKorean, 'utf-8');
      fs.writeFileSync(publicPathKorean, sdp.contentKorean, 'utf-8');

      return { scratchpadPath, publicPath, scratchpadPathKorean, publicPathKorean };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new FileWriteError(scratchpadPath, message);
    }
  }
}

// Singleton pattern
let instance: SDPWriterAgent | null = null;

/**
 * Get the singleton instance of SDPWriterAgent
 * @param config - Optional configuration (used only for the first call)
 * @returns The singleton instance
 */
export function getSDPWriterAgent(config?: SDPWriterAgentConfig): SDPWriterAgent {
  if (!instance) {
    instance = new SDPWriterAgent(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetSDPWriterAgent(): void {
  instance = null;
}
