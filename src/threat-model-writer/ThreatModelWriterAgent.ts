/**
 * Threat Model Writer Agent
 *
 * Generates a Threat Model (TM) document from an SDS (Software Design
 * Specification) input. The Threat Model describes the system overview
 * (including a data-flow diagram), identifies threats using STRIDE
 * categorization, scores risks using the DREAD model, documents mitigation
 * strategies, and summarizes residual risk.
 *
 * Implements IAgent interface for AgentFactory integration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IAgent } from '../agents/types.js';

import type {
  ThreatModelWriterAgentConfig,
  ThreatModelGenerationSession,
  ThreatModelGenerationResult,
  ThreatModelGenerationStats,
  ParsedSDSExtract,
  ParsedSDSComponent,
  GeneratedThreatModel,
  ThreatModelMetadata,
  ThreatEntry,
  DreadScore,
} from './types.js';
import { StrideCategory } from './types.js';
import { SDSNotFoundError, GenerationError, FileWriteError, SessionStateError } from './errors.js';
import { prependFrontmatter } from '../utilities/frontmatter.js';

/**
 * Default configuration for the Threat Model Writer Agent
 */
const DEFAULT_CONFIG: Required<ThreatModelWriterAgentConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  publicDocsPath: 'docs/tm',
};

/**
 * Agent ID for ThreatModelWriterAgent used in AgentFactory
 */
export const THREAT_MODEL_WRITER_AGENT_ID = 'threat-model-writer-agent';

/**
 * Threshold above which a threat's DREAD overall score is considered high-risk.
 */
const HIGH_RISK_DREAD_THRESHOLD = 7;

/**
 * Threat Model Writer Agent class
 *
 * Orchestrates the generation of Threat Model documents from SDS input.
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class ThreatModelWriterAgent implements IAgent {
  public readonly agentId = THREAT_MODEL_WRITER_AGENT_ID;
  public readonly name = 'Threat Model Writer Agent';

  private readonly config: Required<ThreatModelWriterAgentConfig>;
  private session: ThreatModelGenerationSession | null = null;
  private initialized = false;

  constructor(config: ThreatModelWriterAgentConfig = {}) {
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
   * @returns Current generation session or null if no session is active
   */
  public getSession(): ThreatModelGenerationSession | null {
    return this.session;
  }

  /**
   * Start a new Threat Model generation session
   * @param projectId - Project identifier
   * @returns The new session
   */
  public async startSession(projectId: string): Promise<ThreatModelGenerationSession> {
    await Promise.resolve();

    const docsDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const sdsPath = path.join(docsDir, 'sds.md');

    if (!fs.existsSync(sdsPath)) {
      throw new SDSNotFoundError(projectId, sdsPath);
    }

    const sdsContent = fs.readFileSync(sdsPath, 'utf-8');
    const parsedSDS = this.extractSDS(sdsContent, projectId);

    const warnings: string[] = [];
    if (parsedSDS.components.length === 0) {
      warnings.push(
        'No components detected in SDS — generated Threat Model uses a minimal default threat set.'
      );
    }

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'pending',
      parsedSDS,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(warnings.length > 0 && { warnings }),
    };

    return this.session;
  }

  /**
   * Generate a Threat Model from a project
   * @param projectId - Project identifier
   * @returns Generation result
   */
  public async generateFromProject(projectId: string): Promise<ThreatModelGenerationResult> {
    const startTime = Date.now();

    if (!this.session || this.session.projectId !== projectId) {
      await this.startSession(projectId);
    }

    if (!this.session) {
      throw new GenerationError(projectId, 'initialization', 'Failed to create session');
    }

    try {
      this.updateSession({ status: 'parsing' });

      const { parsedSDS } = this.session;

      this.updateSession({ status: 'generating' });

      // Carry forward warnings collected during startSession so any
      // additional warnings are appended to the same list.
      const warnings: string[] = this.session.warnings ? [...this.session.warnings] : [];

      const generatedThreatModel = this.generateThreatModelDocument(projectId, parsedSDS, warnings);

      this.updateSession({
        status: 'completed',
        generatedThreatModel,
        ...(warnings.length > 0 && { warnings }),
      });

      const paths = await this.writeOutputFiles(projectId, generatedThreatModel);

      const highRiskThreats = generatedThreatModel.threats.filter(
        (t) => t.dread.overall >= HIGH_RISK_DREAD_THRESHOLD
      ).length;

      const stats: ThreatModelGenerationStats = {
        sdsComponentCount: parsedSDS.components.length,
        threatsIdentified: generatedThreatModel.threats.length,
        highRiskThreats,
        processingTimeMs: Date.now() - startTime,
      };

      return {
        success: true,
        projectId,
        scratchpadPath: paths.scratchpadPath,
        publicPath: paths.publicPath,
        scratchpadPathKorean: paths.scratchpadPathKorean,
        publicPathKorean: paths.publicPathKorean,
        generatedThreatModel,
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
   * @returns Generation result based on the cached generated Threat Model
   */
  public async finalize(): Promise<ThreatModelGenerationResult> {
    if (!this.session) {
      throw new SessionStateError('null', 'active', 'finalize');
    }

    if (this.session.status !== 'completed') {
      throw new SessionStateError(this.session.status, 'completed', 'finalize');
    }

    if (!this.session.generatedThreatModel) {
      throw new GenerationError(
        this.session.projectId,
        'finalization',
        'No generated Threat Model'
      );
    }

    const paths = await this.writeOutputFiles(
      this.session.projectId,
      this.session.generatedThreatModel
    );

    const highRiskThreats = this.session.generatedThreatModel.threats.filter(
      (t) => t.dread.overall >= HIGH_RISK_DREAD_THRESHOLD
    ).length;

    return {
      success: true,
      projectId: this.session.projectId,
      scratchpadPath: paths.scratchpadPath,
      publicPath: paths.publicPath,
      scratchpadPathKorean: paths.scratchpadPathKorean,
      publicPathKorean: paths.publicPathKorean,
      generatedThreatModel: this.session.generatedThreatModel,
      stats: {
        sdsComponentCount: this.session.parsedSDS.components.length,
        threatsIdentified: this.session.generatedThreatModel.threats.length,
        highRiskThreats,
        processingTimeMs: 0,
      },
    };
  }

  /**
   * Update session with partial data
   * @param updates - Partial session fields to merge into the current session
   */
  private updateSession(updates: Partial<ThreatModelGenerationSession>): void {
    if (!this.session) return;

    this.session = {
      ...this.session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract a lightweight SDS summary from SDS markdown content.
   *
   * Looks for the document ID, product title, component headings
   * (`### CMP-xxx`), and indicator sections for API and data layers.
   * @param content - Raw SDS markdown
   * @param projectId - Project identifier (used as fallback)
   */
  private extractSDS(content: string, projectId: string): ParsedSDSExtract {
    const docIdMatch =
      content.match(/^doc_id:\s*['"]?([^'"\n]+)['"]?/m) ??
      content.match(/\|\s*\*\*Document ID\*\*\s*\|\s*([^|]+)\s*\|/);
    const documentId = docIdMatch?.[1]?.trim() ?? `SDS-${projectId}`;

    const titleMatch =
      content.match(/^#\s+(?:Software Design Specification:\s*)?(.+)$/m) ??
      content.match(/^title:\s*['"]?([^'"\n]+)['"]?/m);
    const productName = titleMatch?.[1]?.trim() ?? projectId;

    const components = this.extractComponents(content);

    // Heuristic detection of API and data sections (based on SDS writer
    // template section names). Matches are case-insensitive and tolerate
    // optional section numbering like "## 5. Interface Design".
    const hasApiSurface =
      /^#{1,6}\s+[\d.]*\s*(?:Interface Design|API Endpoints?|API Specification|API Design)/im.test(
        content
      );
    const hasDataLayer =
      /^#{1,6}\s+[\d.]*\s*(?:Data Design|Data Models?|Database Design|Persistence)/im.test(content);

    return {
      documentId,
      productName,
      components,
      hasApiSurface,
      hasDataLayer,
    };
  }

  /**
   * Extract components from an SDS markdown document.
   *
   * Supports the two layouts produced by `SDSWriterAgent`:
   *   1. `### CMP-001: Component Name`
   *   2. `### CMP-001` followed by a description block.
   *
   * @param content - Raw SDS markdown
   */
  private extractComponents(content: string): readonly ParsedSDSComponent[] {
    const components: ParsedSDSComponent[] = [];
    const headingRegex = /^###\s+(CMP-\d+)(?::\s*(.+))?$/gm;

    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(content)) !== null) {
      const id = match[1];
      if (id === undefined) continue;

      const name = match[2]?.trim() ?? id;

      // Capture the short description from the next non-empty line(s)
      // before the following heading or end of document. We don't need
      // the full component body — just a one-line summary for the
      // threat model's target column.
      const afterHeadingIdx = match.index + match[0].length;
      const rest = content.slice(afterHeadingIdx);
      const nextHeadingMatch = /\n#{1,6}\s/.exec(rest);
      const block = nextHeadingMatch !== null ? rest.slice(0, nextHeadingMatch.index) : rest;
      const descriptionLine = block
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0 && !line.startsWith('|') && !line.startsWith('-'));
      const description = descriptionLine ?? '';

      components.push({ id, name, description });
    }

    return components;
  }

  /**
   * Generate the complete Threat Model document object.
   * @param projectId - Project identifier for document naming
   * @param sds - Parsed SDS extract
   * @param warnings - Mutable warnings array for fallbacks
   */
  private generateThreatModelDocument(
    projectId: string,
    sds: ParsedSDSExtract,
    warnings: string[]
  ): GeneratedThreatModel {
    const now = new Date().toISOString().split('T')[0] ?? '';

    const metadata: ThreatModelMetadata = {
      documentId: `TM-${projectId}`,
      sourceSDS: sds.documentId,
      version: '1.0.0',
      status: 'Draft',
      createdDate: now,
      updatedDate: now,
    };

    const threats = this.generateThreats(sds, warnings);

    let content = this.generateMarkdownContent(metadata, sds, threats);
    let contentKorean = this.generateMarkdownContentKorean(metadata, sds, threats);

    content = prependFrontmatter(content, {
      docId: metadata.documentId,
      title: `Threat Model: ${sds.productName}`,
      version: metadata.version,
      status: metadata.status,
      generatedBy: 'AD-SDLC Threat Model Writer Agent',
      generatedAt: new Date().toISOString(),
      sourceDocuments: [metadata.sourceSDS],
      changeHistory: [
        {
          version: metadata.version,
          date: now,
          author: 'AD-SDLC Threat Model Writer Agent',
          description: 'Initial document generation',
        },
      ],
    });

    contentKorean = prependFrontmatter(contentKorean, {
      docId: metadata.documentId,
      title: `Threat Model: ${sds.productName} (Korean)`,
      version: metadata.version,
      status: metadata.status,
      generatedBy: 'AD-SDLC Threat Model Writer Agent',
      generatedAt: new Date().toISOString(),
      sourceDocuments: [metadata.sourceSDS],
      changeHistory: [
        {
          version: metadata.version,
          date: now,
          author: 'AD-SDLC Threat Model Writer Agent',
          description: 'Initial document generation (Korean variant)',
        },
      ],
    });

    return {
      metadata,
      content,
      contentKorean,
      threats,
    };
  }

  /**
   * Generate the threat list using heuristics derived from the parsed SDS.
   *
   * The heuristics guarantee one threat per STRIDE category (six threats)
   * so the output always exercises the full STRIDE spectrum. Additional
   * threats are appended when the SDS exposes an API surface or a data
   * layer, since those signals reliably increase the attack surface.
   *
   * @param sds - Parsed SDS extract used for target selection
   * @param warnings - Mutable warnings array for fallbacks
   */
  private generateThreats(sds: ParsedSDSExtract, warnings: string[]): readonly ThreatEntry[] {
    const primaryComponent = sds.components[0];
    const primaryTarget = primaryComponent?.name ?? sds.productName;
    const secondaryTarget = sds.components[1]?.name ?? primaryComponent?.name ?? sds.productName;

    if (sds.components.length === 0) {
      warnings.push(
        'SDS had no components — STRIDE threats are generated against a single default target.'
      );
    }

    const threats: ThreatEntry[] = [];

    threats.push({
      id: 'T1',
      category: StrideCategory.Spoofing,
      title: 'Authentication bypass via forged credentials',
      target: primaryTarget,
      description:
        'An attacker impersonates a legitimate user by submitting forged or stolen credentials, gaining unauthorized access to the system.',
      dread: this.makeDread(8, 6, 5, 8, 6),
      mitigation:
        'Enforce strong password policies, use multi-factor authentication, and rotate session tokens on privilege changes.',
      residualRisk: 'Low',
    });

    threats.push({
      id: 'T2',
      category: StrideCategory.Tampering,
      title: 'Unauthorized modification of persisted data',
      target: sds.hasDataLayer ? 'Data store' : secondaryTarget,
      description:
        'An attacker alters data at rest or in transit to change application state or corrupt records.',
      dread: this.makeDread(7, 5, 4, 7, 5),
      mitigation:
        'Apply parameterized queries, validate all inputs, and protect payloads with TLS and integrity checks (HMAC or signed hashes).',
      residualRisk: 'Low',
    });

    threats.push({
      id: 'T3',
      category: StrideCategory.Repudiation,
      title: 'Insufficient audit trail for privileged actions',
      target: primaryTarget,
      description:
        'Users deny performing privileged actions because audit logs are incomplete or tamperable.',
      dread: this.makeDread(5, 6, 4, 6, 5),
      mitigation:
        'Emit append-only, timestamped audit logs with user identity and tie log records to an immutable store.',
      residualRisk: 'Medium',
    });

    threats.push({
      id: 'T4',
      category: StrideCategory.InformationDisclosure,
      title: 'Sensitive data exposure in responses or logs',
      target: sds.hasDataLayer ? 'Data store' : primaryTarget,
      description:
        'Sensitive data (credentials, PII, tokens) leaks through API responses, error messages, or log files.',
      dread: this.makeDread(8, 7, 6, 8, 7),
      mitigation:
        'Classify data, mask sensitive fields in responses and logs, and encrypt data at rest and in transit.',
      residualRisk: 'Medium',
    });

    threats.push({
      id: 'T5',
      category: StrideCategory.DenialOfService,
      title: 'Resource exhaustion via uncontrolled request load',
      target: sds.hasApiSurface ? 'Public API' : primaryTarget,
      description:
        'An attacker sends a flood of requests or expensive queries that degrade or halt service availability.',
      dread: this.makeDread(6, 8, 7, 9, 8),
      mitigation:
        'Apply rate limiting, input size limits, circuit breakers, and horizontal scaling behind a load balancer.',
      residualRisk: 'Medium',
    });

    threats.push({
      id: 'T6',
      category: StrideCategory.ElevationOfPrivilege,
      title: 'Privilege escalation through missing authorization checks',
      target: primaryTarget,
      description:
        'An authenticated user accesses functions or data beyond their role because authorization is missing or bypassable.',
      dread: this.makeDread(9, 5, 4, 7, 5),
      mitigation:
        'Enforce role-based access control at every layer, deny-by-default, and cover authorization paths with automated tests.',
      residualRisk: 'Low',
    });

    if (sds.hasApiSurface) {
      threats.push({
        id: `T${String(threats.length + 1)}`,
        category: StrideCategory.InformationDisclosure,
        title: 'Injection attack against public API',
        target: 'Public API',
        description:
          'Attackers inject crafted payloads (SQL, command, XSS) into API inputs to exfiltrate data or gain control over the system.',
        dread: this.makeDread(9, 7, 6, 8, 7),
        mitigation:
          'Use parameterized queries, schema-based input validation, output encoding, and Web Application Firewall (WAF) rules.',
        residualRisk: 'Low',
      });
    }

    if (sds.hasDataLayer) {
      threats.push({
        id: `T${String(threats.length + 1)}`,
        category: StrideCategory.Tampering,
        title: 'Data integrity violation during migration or backup restore',
        target: 'Data store',
        description:
          'Database migrations or backup restores leave data in an inconsistent or unauthorized state.',
        dread: this.makeDread(6, 4, 3, 6, 4),
        mitigation:
          'Run migrations inside transactions, require peer review on schema changes, and validate backups via integrity hashes.',
        residualRisk: 'Low',
      });
    }

    return threats;
  }

  /**
   * Build a DREAD score from individual attribute values and compute the
   * overall average. Values are clamped to 1..10.
   * @param damage - Damage potential (1-10)
   * @param reproducibility - Reproducibility (1-10)
   * @param exploitability - Exploitability (1-10)
   * @param affectedUsers - Affected users (1-10)
   * @param discoverability - Discoverability (1-10)
   */
  private makeDread(
    damage: number,
    reproducibility: number,
    exploitability: number,
    affectedUsers: number,
    discoverability: number
  ): DreadScore {
    const clamp = (v: number): number => Math.max(1, Math.min(10, v));
    const d = clamp(damage);
    const r = clamp(reproducibility);
    const e = clamp(exploitability);
    const a = clamp(affectedUsers);
    const disc = clamp(discoverability);
    // One-decimal precision for the overall average.
    const overall = Math.round(((d + r + e + a + disc) / 5) * 10) / 10;
    return {
      damage: d,
      reproducibility: r,
      exploitability: e,
      affectedUsers: a,
      discoverability: disc,
      overall,
    };
  }

  /**
   * Render the English markdown content for the Threat Model document.
   *
   * Five-section layout:
   *   1. System Overview (with Mermaid data-flow diagram)
   *   2. Threat Identification (STRIDE table)
   *   3. Risk Assessment (DREAD table)
   *   4. Mitigation Strategies
   *   5. Residual Risk Summary
   *
   * @param metadata - Threat Model metadata
   * @param sds - Parsed SDS extract
   * @param threats - Threats to render
   */
  private generateMarkdownContent(
    metadata: ThreatModelMetadata,
    sds: ParsedSDSExtract,
    threats: readonly ThreatEntry[]
  ): string {
    const lines: string[] = [];

    lines.push(`# Threat Model: ${sds.productName}`);
    lines.push('');

    lines.push('| **Document ID** | **Source SDS** | **Version** | **Status** |');
    lines.push('|-----------------|----------------|-------------|------------|');
    lines.push(
      `| ${metadata.documentId} | ${metadata.sourceSDS} | ${metadata.version} | ${metadata.status} |`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Table of Contents');
    lines.push('');
    lines.push('1. [System Overview](#1-system-overview)');
    lines.push('2. [Threat Identification (STRIDE)](#2-threat-identification-stride)');
    lines.push('3. [Risk Assessment (DREAD)](#3-risk-assessment-dread)');
    lines.push('4. [Mitigation Strategies](#4-mitigation-strategies)');
    lines.push('5. [Residual Risk Summary](#5-residual-risk-summary)');
    lines.push('');

    // Section 1: System Overview
    lines.push('## 1. System Overview');
    lines.push('');
    lines.push(`- **Product:** ${sds.productName}`);
    lines.push(`- **Source SDS:** ${metadata.sourceSDS}`);
    lines.push(`- **Components analysed:** ${String(sds.components.length)}`);
    lines.push(`- **API surface detected:** ${sds.hasApiSurface ? 'Yes' : 'No'}`);
    lines.push(`- **Data layer detected:** ${sds.hasDataLayer ? 'Yes' : 'No'}`);
    lines.push('');
    lines.push('### 1.1 Data Flow Diagram');
    lines.push('');
    lines.push('```mermaid');
    lines.push('flowchart LR');
    lines.push('    User([External User])');
    if (sds.hasApiSurface) {
      lines.push('    API[API Gateway]');
      lines.push('    User -->|HTTPS| API');
    }
    if (sds.components.length === 0) {
      lines.push('    App[Application]');
      if (sds.hasApiSurface) {
        lines.push('    API --> App');
      } else {
        lines.push('    User --> App');
      }
      if (sds.hasDataLayer) {
        lines.push('    App --> DB[(Data Store)]');
      }
    } else {
      for (const component of sds.components.slice(0, 5)) {
        const safeId = component.id.replace(/[^A-Za-z0-9_]/g, '_');
        lines.push(`    ${safeId}[${component.name}]`);
        if (sds.hasApiSurface) {
          lines.push(`    API --> ${safeId}`);
        } else {
          lines.push(`    User --> ${safeId}`);
        }
      }
      if (sds.hasDataLayer) {
        lines.push('    DB[(Data Store)]');
        for (const component of sds.components.slice(0, 5)) {
          const safeId = component.id.replace(/[^A-Za-z0-9_]/g, '_');
          lines.push(`    ${safeId} --> DB`);
        }
      }
    }
    lines.push('```');
    lines.push('');

    if (sds.components.length > 0) {
      lines.push('### 1.2 Components in Scope');
      lines.push('');
      lines.push('| ID | Name | Description |');
      lines.push('|----|------|-------------|');
      for (const component of sds.components) {
        const desc = component.description.length > 0 ? component.description : '—';
        lines.push(`| ${component.id} | ${component.name} | ${desc} |`);
      }
      lines.push('');
    }

    // Section 2: Threat Identification (STRIDE)
    lines.push('## 2. Threat Identification (STRIDE)');
    lines.push('');
    lines.push(
      'Threats are categorised using Microsoft STRIDE: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege.'
    );
    lines.push('');
    lines.push('| ID | STRIDE Category | Target | Threat | Description |');
    lines.push('|----|-----------------|--------|--------|-------------|');
    for (const threat of threats) {
      lines.push(
        `| ${threat.id} | ${threat.category} | ${threat.target} | ${threat.title} | ${threat.description} |`
      );
    }
    lines.push('');

    // Section 3: Risk Assessment (DREAD)
    lines.push('## 3. Risk Assessment (DREAD)');
    lines.push('');
    lines.push(
      'Each threat is scored on five DREAD attributes from 1 (lowest) to 10 (highest). The overall column is the average of the five attributes.'
    );
    lines.push('');
    lines.push(
      '| ID | Damage | Reproducibility | Exploitability | Affected Users | Discoverability | Overall |'
    );
    lines.push(
      '|----|--------|-----------------|----------------|----------------|-----------------|---------|'
    );
    for (const threat of threats) {
      const d = threat.dread;
      lines.push(
        `| ${threat.id} | ${String(d.damage)} | ${String(d.reproducibility)} | ${String(d.exploitability)} | ${String(d.affectedUsers)} | ${String(d.discoverability)} | ${d.overall.toFixed(1)} |`
      );
    }
    lines.push('');
    lines.push('### 3.1 Risk Ranking');
    lines.push('');
    lines.push('| Rank | ID | Overall | Category |');
    lines.push('|------|----|---------|----------|');
    const ranked = [...threats].sort((a, b) => b.dread.overall - a.dread.overall);
    ranked.forEach((threat, index) => {
      lines.push(
        `| ${String(index + 1)} | ${threat.id} | ${threat.dread.overall.toFixed(1)} | ${threat.category} |`
      );
    });
    lines.push('');

    // Section 4: Mitigation Strategies
    lines.push('## 4. Mitigation Strategies');
    lines.push('');
    lines.push('| ID | Threat | Mitigation |');
    lines.push('|----|--------|------------|');
    for (const threat of threats) {
      lines.push(`| ${threat.id} | ${threat.title} | ${threat.mitigation} |`);
    }
    lines.push('');

    // Section 5: Residual Risk Summary
    lines.push('## 5. Residual Risk Summary');
    lines.push('');
    const highCount = threats.filter((t) => t.residualRisk === 'High').length;
    const mediumCount = threats.filter((t) => t.residualRisk === 'Medium').length;
    const lowCount = threats.filter((t) => t.residualRisk === 'Low').length;
    lines.push('| Residual Risk Level | Count |');
    lines.push('|---------------------|-------|');
    lines.push(`| High | ${String(highCount)} |`);
    lines.push(`| Medium | ${String(mediumCount)} |`);
    lines.push(`| Low | ${String(lowCount)} |`);
    lines.push('');
    lines.push('### 5.1 Per-Threat Residual Risk');
    lines.push('');
    lines.push('| ID | Category | Residual Risk |');
    lines.push('|----|----------|---------------|');
    for (const threat of threats) {
      lines.push(`| ${threat.id} | ${threat.category} | ${threat.residualRisk} |`);
    }
    lines.push('');
    lines.push('### 5.2 Review Cadence');
    lines.push('');
    lines.push(
      '- Residual risks are re-assessed at every major release and after any security incident.'
    );
    lines.push(
      '- High residual risks require written acceptance by the product owner before release.'
    );
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Render the Korean variant of the Threat Model markdown content.
   * Mirrors the English structure with localised headings and prose.
   * @param metadata - Threat Model metadata
   * @param sds - Parsed SDS extract
   * @param threats - Threats to render
   */
  private generateMarkdownContentKorean(
    metadata: ThreatModelMetadata,
    sds: ParsedSDSExtract,
    threats: readonly ThreatEntry[]
  ): string {
    const lines: string[] = [];

    lines.push(`# 위협 모델: ${sds.productName}`);
    lines.push('');

    lines.push('| **문서 ID** | **출처 SDS** | **버전** | **상태** |');
    lines.push('|-------------|--------------|----------|----------|');
    lines.push(
      `| ${metadata.documentId} | ${metadata.sourceSDS} | ${metadata.version} | ${metadata.status} |`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## 목차');
    lines.push('');
    lines.push('1. [시스템 개요](#1-시스템-개요)');
    lines.push('2. [위협 식별 (STRIDE)](#2-위협-식별-stride)');
    lines.push('3. [위험 평가 (DREAD)](#3-위험-평가-dread)');
    lines.push('4. [완화 전략](#4-완화-전략)');
    lines.push('5. [잔여 위험 요약](#5-잔여-위험-요약)');
    lines.push('');

    // Section 1: System Overview (Korean)
    lines.push('## 1. 시스템 개요');
    lines.push('');
    lines.push(`- **제품:** ${sds.productName}`);
    lines.push(`- **출처 SDS:** ${metadata.sourceSDS}`);
    lines.push(`- **분석 대상 컴포넌트 수:** ${String(sds.components.length)}`);
    lines.push(`- **API 인터페이스 감지:** ${sds.hasApiSurface ? '예' : '아니오'}`);
    lines.push(`- **데이터 계층 감지:** ${sds.hasDataLayer ? '예' : '아니오'}`);
    lines.push('');
    lines.push('### 1.1 데이터 흐름도');
    lines.push('');
    lines.push('```mermaid');
    lines.push('flowchart LR');
    lines.push('    User([외부 사용자])');
    if (sds.hasApiSurface) {
      lines.push('    API[API Gateway]');
      lines.push('    User -->|HTTPS| API');
    }
    if (sds.components.length === 0) {
      lines.push('    App[Application]');
      if (sds.hasApiSurface) {
        lines.push('    API --> App');
      } else {
        lines.push('    User --> App');
      }
      if (sds.hasDataLayer) {
        lines.push('    App --> DB[(Data Store)]');
      }
    } else {
      for (const component of sds.components.slice(0, 5)) {
        const safeId = component.id.replace(/[^A-Za-z0-9_]/g, '_');
        lines.push(`    ${safeId}[${component.name}]`);
        if (sds.hasApiSurface) {
          lines.push(`    API --> ${safeId}`);
        } else {
          lines.push(`    User --> ${safeId}`);
        }
      }
      if (sds.hasDataLayer) {
        lines.push('    DB[(Data Store)]');
        for (const component of sds.components.slice(0, 5)) {
          const safeId = component.id.replace(/[^A-Za-z0-9_]/g, '_');
          lines.push(`    ${safeId} --> DB`);
        }
      }
    }
    lines.push('```');
    lines.push('');

    if (sds.components.length > 0) {
      lines.push('### 1.2 분석 범위 컴포넌트');
      lines.push('');
      lines.push('| ID | 이름 | 설명 |');
      lines.push('|----|------|------|');
      for (const component of sds.components) {
        const desc = component.description.length > 0 ? component.description : '—';
        lines.push(`| ${component.id} | ${component.name} | ${desc} |`);
      }
      lines.push('');
    }

    // Section 2: STRIDE (Korean)
    lines.push('## 2. 위협 식별 (STRIDE)');
    lines.push('');
    lines.push(
      '위협은 Microsoft STRIDE 분류 체계를 따릅니다: Spoofing(위장), Tampering(변조), Repudiation(부인), Information Disclosure(정보 유출), Denial of Service(서비스 거부), Elevation of Privilege(권한 상승).'
    );
    lines.push('');
    lines.push('| ID | STRIDE 분류 | 대상 | 위협 | 설명 |');
    lines.push('|----|-------------|------|------|------|');
    for (const threat of threats) {
      lines.push(
        `| ${threat.id} | ${threat.category} | ${threat.target} | ${threat.title} | ${threat.description} |`
      );
    }
    lines.push('');

    // Section 3: DREAD (Korean)
    lines.push('## 3. 위험 평가 (DREAD)');
    lines.push('');
    lines.push(
      '각 위협은 DREAD 5개 속성을 1(최저)~10(최고) 척도로 평가합니다. Overall 컬럼은 5개 속성의 평균값입니다.'
    );
    lines.push('');
    lines.push('| ID | 피해 | 재현성 | 악용 난이도 | 영향 사용자 | 발견 용이성 | 종합 |');
    lines.push('|----|------|--------|-------------|-------------|-------------|------|');
    for (const threat of threats) {
      const d = threat.dread;
      lines.push(
        `| ${threat.id} | ${String(d.damage)} | ${String(d.reproducibility)} | ${String(d.exploitability)} | ${String(d.affectedUsers)} | ${String(d.discoverability)} | ${d.overall.toFixed(1)} |`
      );
    }
    lines.push('');
    lines.push('### 3.1 위험 순위');
    lines.push('');
    lines.push('| 순위 | ID | 종합 점수 | 분류 |');
    lines.push('|------|----|-----------|------|');
    const ranked = [...threats].sort((a, b) => b.dread.overall - a.dread.overall);
    ranked.forEach((threat, index) => {
      lines.push(
        `| ${String(index + 1)} | ${threat.id} | ${threat.dread.overall.toFixed(1)} | ${threat.category} |`
      );
    });
    lines.push('');

    // Section 4: Mitigation (Korean)
    lines.push('## 4. 완화 전략');
    lines.push('');
    lines.push('| ID | 위협 | 완화 방안 |');
    lines.push('|----|------|-----------|');
    for (const threat of threats) {
      lines.push(`| ${threat.id} | ${threat.title} | ${threat.mitigation} |`);
    }
    lines.push('');

    // Section 5: Residual Risk (Korean)
    lines.push('## 5. 잔여 위험 요약');
    lines.push('');
    const highCount = threats.filter((t) => t.residualRisk === 'High').length;
    const mediumCount = threats.filter((t) => t.residualRisk === 'Medium').length;
    const lowCount = threats.filter((t) => t.residualRisk === 'Low').length;
    lines.push('| 잔여 위험 수준 | 개수 |');
    lines.push('|----------------|------|');
    lines.push(`| High | ${String(highCount)} |`);
    lines.push(`| Medium | ${String(mediumCount)} |`);
    lines.push(`| Low | ${String(lowCount)} |`);
    lines.push('');
    lines.push('### 5.1 위협별 잔여 위험');
    lines.push('');
    lines.push('| ID | 분류 | 잔여 위험 |');
    lines.push('|----|------|-----------|');
    for (const threat of threats) {
      lines.push(`| ${threat.id} | ${threat.category} | ${threat.residualRisk} |`);
    }
    lines.push('');
    lines.push('### 5.2 검토 주기');
    lines.push('');
    lines.push('- 잔여 위험은 주요 릴리스 및 보안 사고 직후 재평가합니다.');
    lines.push('- 높은(High) 잔여 위험은 릴리스 전에 제품 책임자의 서면 승인이 필요합니다.');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Write Threat Model output files (English + Korean) to scratchpad and
   * public locations.
   * @param projectId - Project identifier
   * @param tm - Generated Threat Model
   * @returns Paths of all four written files
   */
  private async writeOutputFiles(
    projectId: string,
    tm: GeneratedThreatModel
  ): Promise<{
    scratchpadPath: string;
    publicPath: string;
    scratchpadPathKorean: string;
    publicPathKorean: string;
  }> {
    await Promise.resolve();

    const scratchpadDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const scratchpadPath = path.join(scratchpadDir, 'tm.md');
    const scratchpadPathKorean = path.join(scratchpadDir, 'tm.kr.md');

    const publicDir = this.config.publicDocsPath;
    const publicPath = path.join(publicDir, `TM-${projectId}.md`);
    const publicPathKorean = path.join(publicDir, `TM-${projectId}.kr.md`);

    try {
      fs.mkdirSync(scratchpadDir, { recursive: true });
      fs.mkdirSync(publicDir, { recursive: true });

      fs.writeFileSync(scratchpadPath, tm.content, 'utf-8');
      fs.writeFileSync(publicPath, tm.content, 'utf-8');
      fs.writeFileSync(scratchpadPathKorean, tm.contentKorean, 'utf-8');
      fs.writeFileSync(publicPathKorean, tm.contentKorean, 'utf-8');

      return { scratchpadPath, publicPath, scratchpadPathKorean, publicPathKorean };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new FileWriteError(scratchpadPath, message);
    }
  }
}

// Singleton pattern
let instance: ThreatModelWriterAgent | null = null;

/**
 * Get the singleton instance of ThreatModelWriterAgent
 * @param config - Optional configuration (used only for the first call)
 * @returns The singleton instance
 */
export function getThreatModelWriterAgent(
  config?: ThreatModelWriterAgentConfig
): ThreatModelWriterAgent {
  if (!instance) {
    instance = new ThreatModelWriterAgent(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetThreatModelWriterAgent(): void {
  instance = null;
}
