/**
 * SVP Writer Agent
 *
 * Generates a Software Verification Plan (SVP) document from an SRS
 * (Software Requirements Specification) input. The SVP automatically derives
 * test cases from the SRS use cases and non-functional requirements,
 * classifies them by verification level (Unit / Integration / System), and
 * provides a traceability matrix back to the source requirements.
 *
 * Implements IAgent interface for AgentFactory integration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IAgent } from '../agents/types.js';

import {
  type GeneratedSVP,
  type NFRCategory,
  type ParsedNFR,
  type ParsedSDSInterfaces,
  type ParsedSRSExtract,
  type ParsedUseCase,
  type SVPGenerationResult,
  type SVPGenerationSession,
  type SVPGenerationStats,
  type SVPMetadata,
  type SVPWriterAgentConfig,
  type TestCase,
  type TestCasePriority,
  type TraceabilityEntry,
  TestLevel,
} from './types.js';
import { FileWriteError, GenerationError, SessionStateError, SRSNotFoundError } from './errors.js';
import { type DerivationContext, deriveTestCasesForUseCases } from './TestCaseDeriver.js';
import { generateNFRTestCases } from './NFRTestGenerator.js';
import { prependFrontmatter } from '../utilities/frontmatter.js';

/**
 * Default configuration for the SVP Writer Agent
 */
const DEFAULT_CONFIG: Required<SVPWriterAgentConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  publicDocsPath: 'docs/svp',
};

/**
 * Agent ID for SVPWriterAgent used in AgentFactory
 */
export const SVP_WRITER_AGENT_ID = 'svp-writer-agent';

/**
 * SVP Writer Agent class
 *
 * Orchestrates the generation of Software Verification Plan documents from
 * an SRS input (with optional SDS interfaces). Implements IAgent for
 * unified instantiation through AgentFactory.
 */
export class SVPWriterAgent implements IAgent {
  public readonly agentId = SVP_WRITER_AGENT_ID;
  public readonly name = 'SVP Writer Agent';

  private readonly config: Required<SVPWriterAgentConfig>;
  private session: SVPGenerationSession | null = null;
  private initialized = false;

  constructor(config: SVPWriterAgentConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   *
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   *
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.session = null;
    this.initialized = false;
  }

  /**
   *
   */
  public getSession(): SVPGenerationSession | null {
    return this.session;
  }

  /**
   * Start a new SVP generation session.
   * Loads and parses the SRS (mandatory) and SDS (optional) documents.
   *
   * @param projectId - Project identifier
   * @returns The new session
   * @throws {@link SRSNotFoundError} if the SRS document is missing
   */
  public async startSession(projectId: string): Promise<SVPGenerationSession> {
    await Promise.resolve();

    const docsDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const srsPath = path.join(docsDir, 'srs.md');
    const sdsPath = path.join(docsDir, 'sds.md');

    if (!fs.existsSync(srsPath)) {
      throw new SRSNotFoundError(projectId, srsPath);
    }

    const srsContent = fs.readFileSync(srsPath, 'utf-8');
    const parsedSRS = this.extractSRS(srsContent, projectId);

    const warnings: string[] = [];

    if (parsedSRS.useCases.length === 0) {
      warnings.push(
        'No use cases detected in SRS — SVP will rely on NFRs and a default smoke test only.'
      );
    }
    if (parsedSRS.nfrs.length === 0) {
      warnings.push(
        'No non-functional requirements detected in SRS — NFR test section will be empty.'
      );
    }

    let parsedSDS: ParsedSDSInterfaces;
    if (fs.existsSync(sdsPath)) {
      const sdsContent = fs.readFileSync(sdsPath, 'utf-8');
      parsedSDS = this.extractSDSInterfaces(sdsContent, projectId);
    } else {
      warnings.push(
        'SDS document not found — integration tests will reference SRS use cases only.'
      );
      parsedSDS = { documentId: `SDS-${projectId}`, interfaces: [] };
    }

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'pending',
      parsedSRS,
      parsedSDS,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(warnings.length > 0 && { warnings }),
    };

    return this.session;
  }

  /**
   * Generate the SVP for the given project.
   * Loads inputs, derives test cases, renders bilingual markdown, and
   * writes all output files.
   * @param projectId
   */
  public async generateFromProject(projectId: string): Promise<SVPGenerationResult> {
    const startTime = Date.now();

    if (!this.session || this.session.projectId !== projectId) {
      await this.startSession(projectId);
    }

    if (!this.session) {
      throw new GenerationError(projectId, 'initialization', 'Failed to create session');
    }

    try {
      this.updateSession({ status: 'parsing' });
      const { parsedSRS, parsedSDS } = this.session;

      this.updateSession({ status: 'deriving' });
      const derivationContext: DerivationContext = { nextId: 1, defaultPriority: 'P1' };
      const useCaseTests = deriveTestCasesForUseCases(parsedSRS.useCases, derivationContext);
      const nfrTests = generateNFRTestCases(parsedSRS.nfrs, derivationContext);
      const allTests: TestCase[] = [...useCaseTests, ...nfrTests];

      // Guarantee at least one test case so the SVP is never empty.
      if (allTests.length === 0) {
        allTests.push(this.buildDefaultSmokeTest(parsedSRS, derivationContext));
      }

      const traceability = this.buildTraceability(parsedSRS, allTests);

      this.updateSession({ status: 'generating' });
      const warnings: string[] = this.session.warnings ? [...this.session.warnings] : [];
      const generatedSVP = this.assembleSVP(
        projectId,
        parsedSRS,
        parsedSDS,
        allTests,
        traceability
      );

      this.updateSession({
        status: 'completed',
        generatedSVP,
        ...(warnings.length > 0 && { warnings }),
      });

      const paths = await this.writeOutputFiles(projectId, generatedSVP);
      const stats = this.computeStats(parsedSRS, allTests, Date.now() - startTime);

      return {
        success: true,
        projectId,
        scratchpadPath: paths.scratchpadPath,
        publicPath: paths.publicPath,
        scratchpadPathKorean: paths.scratchpadPathKorean,
        publicPathKorean: paths.publicPathKorean,
        generatedSVP,
        stats,
        ...(warnings.length > 0 && { warnings }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateSession({ status: 'failed', errorMessage });
      throw error;
    }
  }

  /**
   * Re-write the cached SVP for a completed session.
   */
  public async finalize(): Promise<SVPGenerationResult> {
    if (!this.session) {
      throw new SessionStateError('null', 'active', 'finalize');
    }
    if (this.session.status !== 'completed') {
      throw new SessionStateError(this.session.status, 'completed', 'finalize');
    }
    if (!this.session.generatedSVP) {
      throw new GenerationError(this.session.projectId, 'finalization', 'No generated SVP');
    }

    const paths = await this.writeOutputFiles(this.session.projectId, this.session.generatedSVP);
    const stats = this.computeStats(
      this.session.parsedSRS,
      [...this.session.generatedSVP.testCases],
      0
    );

    return {
      success: true,
      projectId: this.session.projectId,
      scratchpadPath: paths.scratchpadPath,
      publicPath: paths.publicPath,
      scratchpadPathKorean: paths.scratchpadPathKorean,
      publicPathKorean: paths.publicPathKorean,
      generatedSVP: this.session.generatedSVP,
      stats,
    };
  }

  private updateSession(updates: Partial<SVPGenerationSession>): void {
    if (!this.session) return;
    this.session = {
      ...this.session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // SRS / SDS parsing
  // ==========================================================================

  /**
   * Extract a lightweight SRS summary from SRS markdown content.
   *
   * Looks for the document ID, product title, use case sections
   * (`##### UC-XXX: Name`), and the NFR table rows under section 3.
   * @param content
   * @param projectId
   */
  private extractSRS(content: string, projectId: string): ParsedSRSExtract {
    const docIdMatch =
      content.match(/^doc_id:\s*['"]?([^'"\n]+)['"]?/m) ??
      content.match(/\|\s*\*\*Document ID\*\*\s*\|\s*([^|]+)\s*\|/);
    const documentId = docIdMatch?.[1]?.trim() ?? `SRS-${projectId}`;

    const titleMatch =
      content.match(/^#\s+(?:SRS:\s*)?(.+)$/m) ?? content.match(/^title:\s*['"]?([^'"\n]+)['"]?/m);
    const productName = titleMatch?.[1]?.trim() ?? projectId;

    const useCases = this.extractUseCases(content);
    const nfrs = this.extractNFRs(content);

    return { documentId, productName, useCases, nfrs };
  }

  private extractUseCases(content: string): readonly ParsedUseCase[] {
    const useCases: ParsedUseCase[] = [];
    // Match `##### UC-001: Name` lines, capturing id and title.
    const ucHeadingRegex = /^#####\s+(UC-\d+):\s*(.+)$/gm;

    let match: RegExpExecArray | null;
    while ((match = ucHeadingRegex.exec(content)) !== null) {
      const id = match[1];
      const title = match[2]?.trim() ?? '';
      if (id === undefined) continue;

      const startIdx = match.index + match[0].length;
      const rest = content.slice(startIdx);
      const nextUcMatch = /\n#####\s+UC-/.exec(rest);
      const nextSectionMatch = /\n##\s/.exec(rest);
      // Use the nearer of "next UC" or "next H2 section" as the body end.
      const bodyEnd = Math.min(
        nextUcMatch?.index ?? rest.length,
        nextSectionMatch?.index ?? rest.length
      );
      const body = rest.slice(0, bodyEnd);

      useCases.push({
        id,
        title,
        actor: this.extractField(body, 'Actor'),
        preconditions: this.extractListSection(body, 'Preconditions'),
        mainFlow: this.extractListSection(body, 'Main Flow'),
        alternativeFlows: this.extractListSection(body, 'Alternative Flows'),
        postconditions: this.extractListSection(body, 'Postconditions'),
      });
    }

    return useCases;
  }

  private extractField(body: string, label: string): string {
    const re = new RegExp(`-\\s*\\*\\*${label}\\*\\*\\s*:\\s*(.+)`);
    const match = re.exec(body);
    return match?.[1]?.trim() ?? '';
  }

  private extractListSection(body: string, label: string): readonly string[] {
    // Find the `**Label**:` marker and capture indented bullet/numbered items
    // until the next blank-line-then-bold-marker boundary or end of body.
    const re = new RegExp(`\\*\\*${label}\\*\\*\\s*:\\s*\\n([\\s\\S]*?)(?:\\n\\s*\\*\\*|\\n##|$)`);
    const match = re.exec(body);
    if (match?.[1] === undefined) return [];

    return match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))
      .filter((line) => line.length > 0);
  }

  private extractNFRs(content: string): readonly ParsedNFR[] {
    const nfrs: ParsedNFR[] = [];

    // Look for "### 3.X <Category> Requirements" then a `| NFR-... |` table.
    const sectionRegex = /^###\s+3\.\d+\s+(\w+)\s+Requirements\s*$/gm;
    let sectionMatch: RegExpExecArray | null;

    while ((sectionMatch = sectionRegex.exec(content)) !== null) {
      const categoryRaw = sectionMatch[1]?.toLowerCase() ?? 'other';
      const category = this.normalizeCategory(categoryRaw);
      const startIdx = sectionMatch.index + sectionMatch[0].length;
      const rest = content.slice(startIdx);
      const nextHeadingMatch = /\n##\s|\n###\s/.exec(rest);
      const block = nextHeadingMatch !== null ? rest.slice(0, nextHeadingMatch.index) : rest;

      const rowRegex = /\|\s*(NFR-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(P[0-3])\s*\|/g;
      let row: RegExpExecArray | null;
      while ((row = rowRegex.exec(block)) !== null) {
        const id = row[1];
        const description = row[2]?.trim() ?? '';
        const target = row[3]?.trim() ?? '';
        const priority = (row[4] as TestCasePriority | undefined) ?? 'P2';
        if (id === undefined) continue;
        nfrs.push({ id, category, description, target, priority });
      }
    }

    return nfrs;
  }

  private normalizeCategory(raw: string): NFRCategory {
    const known: readonly NFRCategory[] = [
      'performance',
      'security',
      'reliability',
      'availability',
      'usability',
      'maintainability',
      'scalability',
    ];
    if (known.includes(raw as NFRCategory)) {
      return raw as NFRCategory;
    }
    return 'other';
  }

  /**
   * Extract a lightweight SDS interface summary. The SVP only needs interface
   * identifiers — the bodies are referenced by use cases via traceability.
   * @param content
   * @param projectId
   */
  private extractSDSInterfaces(content: string, projectId: string): ParsedSDSInterfaces {
    const docIdMatch =
      content.match(/^doc_id:\s*['"]?([^'"\n]+)['"]?/m) ??
      content.match(/\|\s*\*\*Document ID\*\*\s*\|\s*([^|]+)\s*\|/);
    const documentId = docIdMatch?.[1]?.trim() ?? `SDS-${projectId}`;

    const interfaces: { id: string; description: string }[] = [];
    // Match common HTTP-style interface tables: | METHOD | /path | ... |
    const httpRegex = /\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*(\/[^\s|]+)\s*\|\s*([^|]*)\|/gi;
    let m: RegExpExecArray | null;
    while ((m = httpRegex.exec(content)) !== null) {
      const method = m[1]?.toUpperCase() ?? '';
      const url = m[2] ?? '';
      const description = m[3]?.trim() ?? '';
      interfaces.push({ id: `${method} ${url}`, description });
    }

    return { documentId, interfaces };
  }

  // ==========================================================================
  // Traceability and stats
  // ==========================================================================

  private buildTraceability(
    srs: ParsedSRSExtract,
    tests: readonly TestCase[]
  ): readonly TraceabilityEntry[] {
    const entries: TraceabilityEntry[] = [];

    for (const uc of srs.useCases) {
      const ids = tests.filter((t) => t.source === uc.id).map((t) => t.id);
      entries.push({ sourceId: uc.id, sourceKind: 'use_case', testCaseIds: ids });
    }
    for (const nfr of srs.nfrs) {
      const ids = tests.filter((t) => t.source === nfr.id).map((t) => t.id);
      entries.push({ sourceId: nfr.id, sourceKind: 'nfr', testCaseIds: ids });
    }

    return entries;
  }

  private computeStats(
    srs: ParsedSRSExtract,
    tests: readonly TestCase[],
    processingTimeMs: number
  ): SVPGenerationStats {
    return {
      useCaseCount: srs.useCases.length,
      nfrCount: srs.nfrs.length,
      totalTestCases: tests.length,
      unitTestCases: tests.filter((t) => t.level === TestLevel.Unit).length,
      integrationTestCases: tests.filter((t) => t.level === TestLevel.Integration).length,
      systemTestCases: tests.filter((t) => t.level === TestLevel.System).length,
      processingTimeMs,
    };
  }

  private buildDefaultSmokeTest(srs: ParsedSRSExtract, ctx: DerivationContext): TestCase {
    const id = `TC-${String(ctx.nextId).padStart(3, '0')}`;
    ctx.nextId += 1;
    return {
      id,
      title: `${srs.productName} — system smoke test`,
      source: srs.documentId,
      category: 'happy_path',
      level: TestLevel.System,
      priority: 'P1',
      preconditions: ['System is deployed in the test environment'],
      steps: ['Bring up the system', 'Exercise the primary user-facing entry point'],
      expected: 'System starts and serves a basic request without errors',
    };
  }

  // ==========================================================================
  // Document assembly
  // ==========================================================================

  private assembleSVP(
    projectId: string,
    srs: ParsedSRSExtract,
    sds: ParsedSDSInterfaces,
    tests: readonly TestCase[],
    traceability: readonly TraceabilityEntry[]
  ): GeneratedSVP {
    const now = new Date().toISOString().split('T')[0] ?? '';

    const metadata: SVPMetadata = {
      documentId: `SVP-${projectId}`,
      sourceSRS: srs.documentId,
      sourceSDS: sds.documentId,
      version: '1.0.0',
      status: 'Draft',
      createdDate: now,
      updatedDate: now,
    };

    let content = this.renderEnglishMarkdown(metadata, srs, sds, tests, traceability);
    let contentKorean = this.renderKoreanMarkdown(metadata, srs, sds, tests, traceability);

    const sources =
      sds.interfaces.length > 0 ? [metadata.sourceSRS, metadata.sourceSDS] : [metadata.sourceSRS];

    content = prependFrontmatter(content, {
      docId: metadata.documentId,
      title: `Software Verification Plan: ${srs.productName}`,
      version: metadata.version,
      status: metadata.status,
      generatedBy: 'AD-SDLC SVP Writer Agent',
      generatedAt: new Date().toISOString(),
      sourceDocuments: sources,
      changeHistory: [
        {
          version: metadata.version,
          date: now,
          author: 'AD-SDLC SVP Writer Agent',
          description: 'Initial document generation',
        },
      ],
    });

    contentKorean = prependFrontmatter(contentKorean, {
      docId: metadata.documentId,
      title: `Software Verification Plan: ${srs.productName} (Korean)`,
      version: metadata.version,
      status: metadata.status,
      generatedBy: 'AD-SDLC SVP Writer Agent',
      generatedAt: new Date().toISOString(),
      sourceDocuments: sources,
      changeHistory: [
        {
          version: metadata.version,
          date: now,
          author: 'AD-SDLC SVP Writer Agent',
          description: 'Initial document generation (Korean variant)',
        },
      ],
    });

    return { metadata, content, contentKorean, testCases: tests, traceability };
  }

  private renderEnglishMarkdown(
    metadata: SVPMetadata,
    srs: ParsedSRSExtract,
    sds: ParsedSDSInterfaces,
    tests: readonly TestCase[],
    traceability: readonly TraceabilityEntry[]
  ): string {
    const lines: string[] = [];
    const unit = tests.filter((t) => t.level === TestLevel.Unit);
    const integration = tests.filter((t) => t.level === TestLevel.Integration);
    const system = tests.filter((t) => t.level === TestLevel.System);

    lines.push(`# Software Verification Plan: ${srs.productName}`);
    lines.push('');
    lines.push('| **Document ID** | **Source SRS** | **Source SDS** | **Version** | **Status** |');
    lines.push('|-----------------|----------------|----------------|-------------|------------|');
    lines.push(
      `| ${metadata.documentId} | ${metadata.sourceSRS} | ${metadata.sourceSDS} | ${metadata.version} | ${metadata.status} |`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Table of Contents');
    lines.push('');
    lines.push('1. [Verification Strategy](#1-verification-strategy)');
    lines.push('2. [Test Environment](#2-test-environment)');
    lines.push('3. [Unit Verification](#3-unit-verification)');
    lines.push('4. [Integration Verification](#4-integration-verification)');
    lines.push('5. [System Verification](#5-system-verification)');
    lines.push('6. [Traceability Matrix](#6-traceability-matrix)');
    lines.push('7. [Coverage Summary](#7-coverage-summary)');
    lines.push('');

    // 1. Verification Strategy
    lines.push('## 1. Verification Strategy');
    lines.push('');
    lines.push(
      'The verification strategy follows the standard testing pyramid: a broad base of fast unit tests, a smaller set of integration tests covering interactions between modules, and a focused band of system tests that validate end-to-end use cases against acceptance criteria.'
    );
    lines.push('');
    lines.push('| Level | Scope | Source |');
    lines.push('|-------|-------|--------|');
    lines.push('| Unit | Single function or module in isolation | UC preconditions |');
    lines.push('| Integration | Two or more modules cooperating | UC alternative flows, NFRs |');
    lines.push('| System | End-to-end use case validation | UC main flows, system NFRs |');
    lines.push('');

    // 2. Test Environment
    lines.push('## 2. Test Environment');
    lines.push('');
    lines.push('- **Source SRS:** ' + metadata.sourceSRS);
    lines.push('- **Source SDS:** ' + metadata.sourceSDS);
    lines.push(`- **Use cases analysed:** ${String(srs.useCases.length)}`);
    lines.push(`- **NFRs analysed:** ${String(srs.nfrs.length)}`);
    lines.push(`- **Interfaces detected (SDS):** ${String(sds.interfaces.length)}`);
    lines.push('');
    lines.push(
      'Tests are executed in three environments: a developer workstation for Unit tests, a containerised CI environment for Integration tests, and a staging environment that mirrors production topology for System tests.'
    );
    lines.push('');

    // 3. Unit Verification
    lines.push('## 3. Unit Verification');
    lines.push('');
    lines.push(this.renderTestTable(unit, 'unit'));

    // 4. Integration Verification
    lines.push('## 4. Integration Verification');
    lines.push('');
    lines.push(this.renderTestTable(integration, 'integration'));

    // 5. System Verification
    lines.push('## 5. System Verification');
    lines.push('');
    lines.push(this.renderTestTable(system, 'system'));

    // 6. Traceability Matrix
    lines.push('## 6. Traceability Matrix');
    lines.push('');
    lines.push('| Source ID | Kind | Test Cases |');
    lines.push('|-----------|------|------------|');
    for (const entry of traceability) {
      const kind = entry.sourceKind === 'use_case' ? 'Use Case' : 'NFR';
      const cases = entry.testCaseIds.length > 0 ? entry.testCaseIds.join(', ') : '(none)';
      lines.push(`| ${entry.sourceId} | ${kind} | ${cases} |`);
    }
    lines.push('');

    // 7. Coverage Summary
    lines.push('## 7. Coverage Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total test cases | ${String(tests.length)} |`);
    lines.push(`| Unit tests | ${String(unit.length)} |`);
    lines.push(`| Integration tests | ${String(integration.length)} |`);
    lines.push(`| System tests | ${String(system.length)} |`);
    lines.push(`| Use cases covered | ${String(srs.useCases.length)} |`);
    lines.push(`| NFRs covered | ${String(srs.nfrs.length)} |`);
    lines.push('');
    lines.push(
      '> Coverage will be measured by the CI pipeline. The targets are 80% line coverage for Unit tests and 100% requirement coverage in the traceability matrix.'
    );
    lines.push('');

    return lines.join('\n');
  }

  private renderTestTable(tests: readonly TestCase[], emptyLabel: string): string {
    if (tests.length === 0) {
      return `_No ${emptyLabel} test cases were derived. Verify that the source SRS contains the relevant inputs._\n`;
    }
    const lines: string[] = [];
    lines.push('| ID | Source | Title | Priority | Expected |');
    lines.push('|----|--------|-------|----------|----------|');
    for (const tc of tests) {
      lines.push(`| ${tc.id} | ${tc.source} | ${tc.title} | ${tc.priority} | ${tc.expected} |`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private renderKoreanMarkdown(
    metadata: SVPMetadata,
    srs: ParsedSRSExtract,
    sds: ParsedSDSInterfaces,
    tests: readonly TestCase[],
    traceability: readonly TraceabilityEntry[]
  ): string {
    const lines: string[] = [];
    const unit = tests.filter((t) => t.level === TestLevel.Unit);
    const integration = tests.filter((t) => t.level === TestLevel.Integration);
    const system = tests.filter((t) => t.level === TestLevel.System);

    lines.push(`# 소프트웨어 검증 계획: ${srs.productName}`);
    lines.push('');
    lines.push('| **문서 ID** | **출처 SRS** | **출처 SDS** | **버전** | **상태** |');
    lines.push('|-------------|--------------|--------------|----------|----------|');
    lines.push(
      `| ${metadata.documentId} | ${metadata.sourceSRS} | ${metadata.sourceSDS} | ${metadata.version} | ${metadata.status} |`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## 목차');
    lines.push('');
    lines.push('1. [검증 전략](#1-검증-전략)');
    lines.push('2. [테스트 환경](#2-테스트-환경)');
    lines.push('3. [단위 검증](#3-단위-검증)');
    lines.push('4. [통합 검증](#4-통합-검증)');
    lines.push('5. [시스템 검증](#5-시스템-검증)');
    lines.push('6. [추적 매트릭스](#6-추적-매트릭스)');
    lines.push('7. [커버리지 요약](#7-커버리지-요약)');
    lines.push('');

    lines.push('## 1. 검증 전략');
    lines.push('');
    lines.push(
      '본 검증 전략은 표준 테스트 피라미드를 따릅니다: 빠른 단위 테스트가 넓은 기반을 이루고, 모듈 간 상호작용을 다루는 통합 테스트가 그 위에 위치하며, 최상단에 인수 기준을 검증하는 시스템 테스트가 배치됩니다.'
    );
    lines.push('');
    lines.push('| 수준 | 범위 | 출처 |');
    lines.push('|------|------|------|');
    lines.push('| 단위 | 단일 함수 또는 모듈의 격리된 검증 | UC 사전조건 |');
    lines.push('| 통합 | 두 개 이상의 모듈 협력 검증 | UC 대안 흐름, NFR |');
    lines.push('| 시스템 | 종단 간 유스케이스 검증 | UC 주 흐름, 시스템 NFR |');
    lines.push('');

    lines.push('## 2. 테스트 환경');
    lines.push('');
    lines.push('- **출처 SRS:** ' + metadata.sourceSRS);
    lines.push('- **출처 SDS:** ' + metadata.sourceSDS);
    lines.push(`- **분석된 유스케이스 수:** ${String(srs.useCases.length)}`);
    lines.push(`- **분석된 NFR 수:** ${String(srs.nfrs.length)}`);
    lines.push(`- **감지된 인터페이스 수 (SDS):** ${String(sds.interfaces.length)}`);
    lines.push('');
    lines.push(
      '테스트는 세 가지 환경에서 실행됩니다: 단위 테스트는 개발자 워크스테이션, 통합 테스트는 컨테이너화된 CI 환경, 시스템 테스트는 운영 환경과 유사한 스테이징 환경에서 수행됩니다.'
    );
    lines.push('');

    lines.push('## 3. 단위 검증');
    lines.push('');
    lines.push(this.renderTestTableKorean(unit, '단위'));

    lines.push('## 4. 통합 검증');
    lines.push('');
    lines.push(this.renderTestTableKorean(integration, '통합'));

    lines.push('## 5. 시스템 검증');
    lines.push('');
    lines.push(this.renderTestTableKorean(system, '시스템'));

    lines.push('## 6. 추적 매트릭스');
    lines.push('');
    lines.push('| 출처 ID | 종류 | 테스트 케이스 |');
    lines.push('|---------|------|---------------|');
    for (const entry of traceability) {
      const kind = entry.sourceKind === 'use_case' ? '유스케이스' : 'NFR';
      const cases = entry.testCaseIds.length > 0 ? entry.testCaseIds.join(', ') : '(없음)';
      lines.push(`| ${entry.sourceId} | ${kind} | ${cases} |`);
    }
    lines.push('');

    lines.push('## 7. 커버리지 요약');
    lines.push('');
    lines.push('| 항목 | 개수 |');
    lines.push('|------|------|');
    lines.push(`| 전체 테스트 케이스 | ${String(tests.length)} |`);
    lines.push(`| 단위 테스트 | ${String(unit.length)} |`);
    lines.push(`| 통합 테스트 | ${String(integration.length)} |`);
    lines.push(`| 시스템 테스트 | ${String(system.length)} |`);
    lines.push(`| 커버된 유스케이스 | ${String(srs.useCases.length)} |`);
    lines.push(`| 커버된 NFR | ${String(srs.nfrs.length)} |`);
    lines.push('');
    lines.push(
      '> 커버리지는 CI 파이프라인에서 측정합니다. 단위 테스트는 80% 라인 커버리지, 추적 매트릭스는 100% 요구사항 커버리지를 목표로 합니다.'
    );
    lines.push('');

    return lines.join('\n');
  }

  private renderTestTableKorean(tests: readonly TestCase[], emptyLabel: string): string {
    if (tests.length === 0) {
      return `_${emptyLabel} 테스트 케이스가 도출되지 않았습니다. 출처 SRS의 입력을 확인하십시오._\n`;
    }
    const lines: string[] = [];
    lines.push('| ID | 출처 | 제목 | 우선순위 | 기대 결과 |');
    lines.push('|----|------|------|----------|-----------|');
    for (const tc of tests) {
      lines.push(`| ${tc.id} | ${tc.source} | ${tc.title} | ${tc.priority} | ${tc.expected} |`);
    }
    lines.push('');
    return lines.join('\n');
  }

  // ==========================================================================
  // File output
  // ==========================================================================

  private async writeOutputFiles(
    projectId: string,
    svp: GeneratedSVP
  ): Promise<{
    scratchpadPath: string;
    publicPath: string;
    scratchpadPathKorean: string;
    publicPathKorean: string;
  }> {
    await Promise.resolve();

    const scratchpadDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const scratchpadPath = path.join(scratchpadDir, 'svp.md');
    const scratchpadPathKorean = path.join(scratchpadDir, 'svp.kr.md');

    const publicDir = this.config.publicDocsPath;
    const publicPath = path.join(publicDir, `SVP-${projectId}.md`);
    const publicPathKorean = path.join(publicDir, `SVP-${projectId}.kr.md`);

    try {
      fs.mkdirSync(scratchpadDir, { recursive: true });
      fs.mkdirSync(publicDir, { recursive: true });

      fs.writeFileSync(scratchpadPath, svp.content, 'utf-8');
      fs.writeFileSync(publicPath, svp.content, 'utf-8');
      fs.writeFileSync(scratchpadPathKorean, svp.contentKorean, 'utf-8');
      fs.writeFileSync(publicPathKorean, svp.contentKorean, 'utf-8');

      return { scratchpadPath, publicPath, scratchpadPathKorean, publicPathKorean };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new FileWriteError(scratchpadPath, message);
    }
  }
}

// Singleton pattern (mirrors other writer agents)
let instance: SVPWriterAgent | null = null;

/**
 * Get the singleton instance of SVPWriterAgent.
 * @param config - Optional config (used only for the first call)
 */
export function getSVPWriterAgent(config?: SVPWriterAgentConfig): SVPWriterAgent {
  if (!instance) {
    instance = new SVPWriterAgent(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (mainly for testing).
 */
export function resetSVPWriterAgent(): void {
  instance = null;
}
