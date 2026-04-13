/**
 * Tech Decision Writer Agent
 *
 * Generates one Technology Decision (TD) comparison document per major
 * technology decision identified in the SDS (Software Design Specification).
 * Each decision reads the SDS technology stack table, assembles candidate
 * alternatives, scores them against weighted criteria, and records the
 * selected technology with rationale and consequences.
 *
 * Implements IAgent for AgentFactory integration and emits multi-file output
 * under `docs/decisions/TD-{number}-{topic-slug}.md` (one pair of files per
 * decision, bilingual English/Korean).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IAgent } from '../agents/types.js';

import {
  type Candidate,
  type Consequences,
  type Decision,
  type EvaluationCriterion,
  type EvaluationMatrix,
  type EvaluationMatrixRow,
  type GeneratedTechDecision,
  type ParsedSDSForDecisions,
  type TechDecision,
  type TechDecisionGenerationResult,
  type TechDecisionGenerationSession,
  type TechDecisionGenerationStats,
  type TechDecisionMetadata,
  type TechDecisionWriterAgentConfig,
} from './types.js';
import { FileWriteError, GenerationError, SDSNotFoundError, SessionStateError } from './errors.js';
import { detectDecisions } from './DecisionDetector.js';
import { DEFAULT_CRITERIA, generateDecisions, validateCriteria } from './ComparisonGenerator.js';
import { prependFrontmatter } from '../utilities/frontmatter.js';

/**
 * Default configuration for the Tech Decision Writer Agent.
 *
 * `publicDocsPath` defaults to `docs/decisions` so the generated files land
 * next to other architecture documents.
 */
const DEFAULT_CONFIG: Required<Omit<TechDecisionWriterAgentConfig, 'criteria'>> & {
  criteria: readonly EvaluationCriterion[];
} = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  publicDocsPath: 'docs/decisions',
  criteria: DEFAULT_CRITERIA,
};

/**
 * Agent ID for TechDecisionWriterAgent used in AgentFactory.
 */
export const TECH_DECISION_WRITER_AGENT_ID = 'tech-decision-writer-agent';

/**
 * Tech Decision Writer Agent class.
 *
 * Orchestrates the generation of one or more Technology Decision documents
 * from an SDS input. Implements IAgent for unified instantiation through
 * AgentFactory.
 */
export class TechDecisionWriterAgent implements IAgent {
  public readonly agentId = TECH_DECISION_WRITER_AGENT_ID;
  public readonly name = 'Tech Decision Writer Agent';

  private readonly config: Required<Omit<TechDecisionWriterAgentConfig, 'criteria'>> & {
    criteria: readonly EvaluationCriterion[];
  };
  private session: TechDecisionGenerationSession | null = null;
  private initialized = false;

  constructor(config: TechDecisionWriterAgentConfig = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    // Validate early so misconfigured criteria surface at construction time.
    validateCriteria(merged.criteria);
    this.config = merged;
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
  public getSession(): TechDecisionGenerationSession | null {
    return this.session;
  }

  /**
   * Start a new Tech Decision generation session.
   *
   * Loads and parses the SDS (mandatory) under the project scratchpad and
   * extracts the technology stack table plus component/NFR references.
   * @param projectId - Project identifier
   * @returns The new session
   * @throws {@link SDSNotFoundError} when the SDS document is missing
   */
  public async startSession(projectId: string): Promise<TechDecisionGenerationSession> {
    await Promise.resolve();

    const docsDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const sdsPath = path.join(docsDir, 'sds.md');

    if (!fs.existsSync(sdsPath)) {
      throw new SDSNotFoundError(projectId, sdsPath);
    }

    const sdsContent = fs.readFileSync(sdsPath, 'utf-8');
    const parsedSDS = detectDecisions(sdsContent, projectId);

    const warnings: string[] = [];
    if (parsedSDS.technologyStack.length === 0) {
      warnings.push(
        'No technology stack rows detected in SDS section 2.3 — no decision documents will be generated.'
      );
    }
    if (parsedSDS.components.length === 0) {
      warnings.push('No SDS components detected — decision references will omit component links.');
    }
    if (parsedSDS.nfrIds.length === 0) {
      warnings.push('No NFR references detected in SDS — decision references will omit NFR links.');
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
   * Generate Tech Decision documents for the given project.
   *
   * Loads inputs, builds one decision per technology stack row, renders
   * bilingual markdown, and writes all output files.
   * @param projectId - Project identifier
   */
  public async generateFromProject(projectId: string): Promise<TechDecisionGenerationResult> {
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
      const decisions = generateDecisions(parsedSDS, this.config.criteria);
      const generatedDocuments = decisions.map((decision) =>
        this.assembleDocument(parsedSDS, decision)
      );

      const paths = await this.writeOutputFiles(projectId, generatedDocuments);
      const stats = this.computeStats(decisions, Date.now() - startTime);
      const warnings: string[] = this.session.warnings ? [...this.session.warnings] : [];

      this.updateSession({
        status: 'completed',
        generatedDocuments,
        ...(warnings.length > 0 && { warnings }),
      });

      return {
        success: true,
        projectId,
        scratchpadPaths: paths.scratchpadPaths,
        publicPaths: paths.publicPaths,
        scratchpadPathsKorean: paths.scratchpadPathsKorean,
        publicPathsKorean: paths.publicPathsKorean,
        generatedDocuments,
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
   * Re-write the cached documents for a completed session.
   *
   * Useful when the caller wants to persist the same set of decisions to a
   * new scratchpad without re-parsing the SDS.
   */
  public async finalize(): Promise<TechDecisionGenerationResult> {
    if (!this.session) {
      throw new SessionStateError('null', 'active', 'finalize');
    }
    if (this.session.status !== 'completed') {
      throw new SessionStateError(this.session.status, 'completed', 'finalize');
    }
    if (!this.session.generatedDocuments || this.session.generatedDocuments.length === 0) {
      throw new GenerationError(
        this.session.projectId,
        'finalization',
        'No generated tech decisions'
      );
    }

    const paths = await this.writeOutputFiles(
      this.session.projectId,
      this.session.generatedDocuments
    );
    const decisions = this.session.generatedDocuments.map((d) => d.decision);
    const stats = this.computeStats(decisions, 0);

    return {
      success: true,
      projectId: this.session.projectId,
      scratchpadPaths: paths.scratchpadPaths,
      publicPaths: paths.publicPaths,
      scratchpadPathsKorean: paths.scratchpadPathsKorean,
      publicPathsKorean: paths.publicPathsKorean,
      generatedDocuments: this.session.generatedDocuments,
      stats,
    };
  }

  private updateSession(updates: Partial<TechDecisionGenerationSession>): void {
    if (!this.session) return;
    this.session = {
      ...this.session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Document assembly
  // ==========================================================================

  private assembleDocument(
    sds: ParsedSDSForDecisions,
    decision: TechDecision
  ): GeneratedTechDecision {
    const now = new Date().toISOString().split('T')[0] ?? '';
    const paddedNumber = String(decision.number).padStart(3, '0');

    const metadata: TechDecisionMetadata = {
      documentId: `TD-${paddedNumber}-${decision.topicSlug}`,
      sourceSDS: sds.documentId,
      version: '1.0.0',
      status: 'Draft',
      createdDate: now,
      updatedDate: now,
    };

    let content = this.renderEnglishMarkdown(sds, decision, metadata);
    let contentKorean = this.renderKoreanMarkdown(sds, decision, metadata);

    const frontmatter = {
      docId: metadata.documentId,
      title: `Tech Decision ${paddedNumber}: ${decision.topic}`,
      version: metadata.version,
      status: metadata.status,
      generatedBy: 'AD-SDLC Tech Decision Writer Agent',
      generatedAt: new Date().toISOString(),
      sourceDocuments: [metadata.sourceSDS],
      changeHistory: [
        {
          version: metadata.version,
          date: now,
          author: 'AD-SDLC Tech Decision Writer Agent',
          description: 'Initial document generation',
        },
      ],
    };

    content = prependFrontmatter(content, frontmatter);
    contentKorean = prependFrontmatter(contentKorean, frontmatter);

    return { decision, metadata, content, contentKorean };
  }

  private renderEnglishMarkdown(
    sds: ParsedSDSForDecisions,
    decision: TechDecision,
    metadata: TechDecisionMetadata
  ): string {
    const lines: string[] = [];
    const paddedNumber = String(decision.number).padStart(3, '0');

    lines.push(`# Tech Decision ${paddedNumber}: ${decision.topic}`);
    lines.push('');
    lines.push('| **Document ID** | **Source SDS** | **Version** | **Status** |');
    lines.push('|-----------------|----------------|-------------|------------|');
    lines.push(
      `| ${metadata.documentId} | ${metadata.sourceSDS} | ${metadata.version} | ${metadata.status} |`
    );
    lines.push('');
    lines.push(`> Product: ${sds.productName}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Table of Contents');
    lines.push('');
    lines.push('1. [Context](#1-context)');
    lines.push('2. [Candidates](#2-candidates)');
    lines.push('3. [Evaluation Criteria](#3-evaluation-criteria)');
    lines.push('4. [Evaluation Matrix](#4-evaluation-matrix)');
    lines.push('5. [Decision](#5-decision)');
    lines.push('6. [Consequences](#6-consequences)');
    lines.push('7. [References](#7-references)');
    lines.push('');

    // 1. Context
    lines.push('## 1. Context');
    lines.push('');
    lines.push(decision.context);
    lines.push('');

    // 2. Candidates
    lines.push('## 2. Candidates');
    lines.push('');
    lines.push(this.renderCandidatesTable(decision.candidates));

    // 3. Evaluation Criteria
    lines.push('## 3. Evaluation Criteria');
    lines.push('');
    lines.push(this.renderCriteriaTable(decision.matrix.criteria));

    // 4. Evaluation Matrix
    lines.push('## 4. Evaluation Matrix');
    lines.push('');
    lines.push(this.renderMatrix(decision.matrix));

    // 5. Decision
    lines.push('## 5. Decision');
    lines.push('');
    lines.push(this.renderDecision(decision.decision));

    // 6. Consequences
    lines.push('## 6. Consequences');
    lines.push('');
    lines.push(this.renderConsequences(decision.consequences));

    // 7. References
    lines.push('## 7. References');
    lines.push('');
    lines.push(this.renderReferences(decision.references));

    return lines.join('\n');
  }

  private renderKoreanMarkdown(
    sds: ParsedSDSForDecisions,
    decision: TechDecision,
    metadata: TechDecisionMetadata
  ): string {
    const lines: string[] = [];
    const paddedNumber = String(decision.number).padStart(3, '0');

    lines.push(`# 기술 결정 ${paddedNumber}: ${decision.topic}`);
    lines.push('');
    lines.push('| **문서 ID** | **출처 SDS** | **버전** | **상태** |');
    lines.push('|-------------|--------------|----------|----------|');
    lines.push(
      `| ${metadata.documentId} | ${metadata.sourceSDS} | ${metadata.version} | ${metadata.status} |`
    );
    lines.push('');
    lines.push(`> 제품: ${sds.productName}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## 목차');
    lines.push('');
    lines.push('1. [배경](#1-배경)');
    lines.push('2. [후보](#2-후보)');
    lines.push('3. [평가 기준](#3-평가-기준)');
    lines.push('4. [평가 매트릭스](#4-평가-매트릭스)');
    lines.push('5. [결정](#5-결정)');
    lines.push('6. [결과](#6-결과)');
    lines.push('7. [참조](#7-참조)');
    lines.push('');

    lines.push('## 1. 배경');
    lines.push('');
    lines.push(decision.context);
    lines.push('');

    lines.push('## 2. 후보');
    lines.push('');
    lines.push(this.renderCandidatesTableKorean(decision.candidates));

    lines.push('## 3. 평가 기준');
    lines.push('');
    lines.push(this.renderCriteriaTableKorean(decision.matrix.criteria));

    lines.push('## 4. 평가 매트릭스');
    lines.push('');
    lines.push(this.renderMatrixKorean(decision.matrix));

    lines.push('## 5. 결정');
    lines.push('');
    lines.push(this.renderDecisionKorean(decision.decision));

    lines.push('## 6. 결과');
    lines.push('');
    lines.push(this.renderConsequencesKorean(decision.consequences));

    lines.push('## 7. 참조');
    lines.push('');
    lines.push(this.renderReferences(decision.references));

    return lines.join('\n');
  }

  private renderCandidatesTableKorean(candidates: readonly Candidate[]): string {
    if (candidates.length === 0) {
      return '_이 결정에 대한 후보를 찾지 못했습니다._\n';
    }
    const lines: string[] = [];
    lines.push('| 이름 | 분류 | 라이선스 | 성숙도 | 설명 |');
    lines.push('|------|------|----------|--------|------|');
    for (const c of candidates) {
      lines.push(`| ${c.name} | ${c.category} | ${c.license} | ${c.maturity} | ${c.description} |`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private renderCriteriaTableKorean(criteria: readonly EvaluationCriterion[]): string {
    const lines: string[] = [];
    lines.push('| 기준 | 가중치 | 설명 |');
    lines.push('|------|--------|------|');
    for (const c of criteria) {
      const pct = `${(c.weight * 100).toFixed(0)}%`;
      lines.push(`| ${c.name} | ${pct} | ${c.description} |`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private renderMatrixKorean(matrix: EvaluationMatrix): string {
    if (matrix.rows.length === 0) {
      return '_평가 결과가 없습니다._\n';
    }
    const lines: string[] = [];
    const criterionNames = matrix.criteria.map((c) => c.name);

    const header = ['후보', ...criterionNames, '가중 합계'];
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`|${header.map(() => '---').join('|')}|`);

    for (const row of matrix.rows) {
      const scoreCells = criterionNames.map((name) => {
        const score = row.scores[name];
        return score !== undefined ? String(score) : '-';
      });
      lines.push(
        `| ${row.candidate} | ${scoreCells.join(' | ')} | ${row.weightedTotal.toFixed(1)} |`
      );
    }
    lines.push('');
    lines.push(
      '> 점수는 1-10 척도이며, 가중 합계는 각 점수와 해당 기준 가중치를 곱한 값의 총합입니다.'
    );
    lines.push('');
    return lines.join('\n');
  }

  private renderDecisionKorean(decision: Decision): string {
    const lines: string[] = [];
    lines.push(`**선택:** ${decision.selected}`);
    lines.push('');
    lines.push(`**결정일:** ${decision.decidedAt}`);
    lines.push('');
    lines.push('**근거:**');
    lines.push('');
    lines.push(decision.rationale);
    lines.push('');
    return lines.join('\n');
  }

  private renderConsequencesKorean(consequences: Consequences): string {
    const lines: string[] = [];
    lines.push('### 긍정적 결과');
    lines.push('');
    if (consequences.positive.length === 0) {
      lines.push('_식별된 항목이 없습니다._');
    } else {
      for (const item of consequences.positive) {
        lines.push(`- ${item}`);
      }
    }
    lines.push('');

    lines.push('### 부정적 결과');
    lines.push('');
    if (consequences.negative.length === 0) {
      lines.push('_식별된 항목이 없습니다._');
    } else {
      for (const item of consequences.negative) {
        lines.push(`- ${item}`);
      }
    }
    lines.push('');

    lines.push('### 리스크');
    lines.push('');
    if (consequences.risks.length === 0) {
      lines.push('_식별된 항목이 없습니다._');
    } else {
      for (const item of consequences.risks) {
        lines.push(`- ${item}`);
      }
    }
    lines.push('');
    return lines.join('\n');
  }

  private renderCandidatesTable(candidates: readonly Candidate[]): string {
    if (candidates.length === 0) {
      return '_No candidates were identified for this decision._\n';
    }
    const lines: string[] = [];
    lines.push('| Name | Category | License | Maturity | Description |');
    lines.push('|------|----------|---------|----------|-------------|');
    for (const c of candidates) {
      lines.push(`| ${c.name} | ${c.category} | ${c.license} | ${c.maturity} | ${c.description} |`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private renderCriteriaTable(criteria: readonly EvaluationCriterion[]): string {
    const lines: string[] = [];
    lines.push('| Criterion | Weight | Description |');
    lines.push('|-----------|--------|-------------|');
    for (const c of criteria) {
      const pct = `${(c.weight * 100).toFixed(0)}%`;
      lines.push(`| ${c.name} | ${pct} | ${c.description} |`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private renderMatrix(matrix: EvaluationMatrix): string {
    if (matrix.rows.length === 0) {
      return '_No evaluation rows were produced._\n';
    }
    const lines: string[] = [];
    const criterionNames = matrix.criteria.map((c) => c.name);

    const header = ['Candidate', ...criterionNames, 'Weighted Total'];
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`|${header.map(() => '---').join('|')}|`);

    for (const row of matrix.rows) {
      const scoreCells = criterionNames.map((name) => {
        const score = row.scores[name];
        return score !== undefined ? String(score) : '-';
      });
      lines.push(
        `| ${row.candidate} | ${scoreCells.join(' | ')} | ${row.weightedTotal.toFixed(1)} |`
      );
    }
    lines.push('');
    lines.push(
      '> Scores are on a 1-10 scale. The weighted total is the sum of each score multiplied by the corresponding criterion weight.'
    );
    lines.push('');
    return lines.join('\n');
  }

  private renderDecision(decision: Decision): string {
    const lines: string[] = [];
    lines.push(`**Selected:** ${decision.selected}`);
    lines.push('');
    lines.push(`**Decided on:** ${decision.decidedAt}`);
    lines.push('');
    lines.push('**Rationale:**');
    lines.push('');
    lines.push(decision.rationale);
    lines.push('');
    return lines.join('\n');
  }

  private renderConsequences(consequences: Consequences): string {
    const lines: string[] = [];
    lines.push('### Positive');
    lines.push('');
    if (consequences.positive.length === 0) {
      lines.push('_None identified._');
    } else {
      for (const item of consequences.positive) {
        lines.push(`- ${item}`);
      }
    }
    lines.push('');

    lines.push('### Negative');
    lines.push('');
    if (consequences.negative.length === 0) {
      lines.push('_None identified._');
    } else {
      for (const item of consequences.negative) {
        lines.push(`- ${item}`);
      }
    }
    lines.push('');

    lines.push('### Risks');
    lines.push('');
    if (consequences.risks.length === 0) {
      lines.push('_None identified._');
    } else {
      for (const item of consequences.risks) {
        lines.push(`- ${item}`);
      }
    }
    lines.push('');
    return lines.join('\n');
  }

  private renderReferences(references: readonly string[]): string {
    if (references.length === 0) {
      return '_No references available._\n';
    }
    const lines: string[] = [];
    for (const ref of references) {
      lines.push(`- ${ref}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private computeStats(
    decisions: readonly TechDecision[],
    processingTimeMs: number
  ): TechDecisionGenerationStats {
    const candidateCount = decisions.reduce((acc, d) => acc + d.candidates.length, 0);
    const techStackRowCount = this.session?.parsedSDS.technologyStack.length ?? decisions.length;
    return {
      decisionCount: decisions.length,
      techStackRowCount,
      candidateCount,
      processingTimeMs,
    };
  }

  // ==========================================================================
  // File output (multi-file)
  // ==========================================================================

  private async writeOutputFiles(
    projectId: string,
    documents: readonly GeneratedTechDecision[]
  ): Promise<{
    scratchpadPaths: readonly string[];
    publicPaths: readonly string[];
    scratchpadPathsKorean: readonly string[];
    publicPathsKorean: readonly string[];
  }> {
    await Promise.resolve();

    const scratchpadDir = path.join(
      this.config.scratchpadBasePath,
      'documents',
      projectId,
      'decisions'
    );
    const publicDir = this.config.publicDocsPath;

    const scratchpadPaths: string[] = [];
    const publicPaths: string[] = [];
    const scratchpadPathsKorean: string[] = [];
    const publicPathsKorean: string[] = [];

    try {
      fs.mkdirSync(scratchpadDir, { recursive: true });
      fs.mkdirSync(publicDir, { recursive: true });

      for (const doc of documents) {
        const baseName = doc.metadata.documentId;
        const filename = `${baseName}.md`;
        const filenameKorean = `${baseName}.kr.md`;

        const scratchpadPath = path.join(scratchpadDir, filename);
        const publicPath = path.join(publicDir, filename);
        const scratchpadPathKorean = path.join(scratchpadDir, filenameKorean);
        const publicPathKorean = path.join(publicDir, filenameKorean);

        fs.writeFileSync(scratchpadPath, doc.content, 'utf-8');
        fs.writeFileSync(publicPath, doc.content, 'utf-8');
        fs.writeFileSync(scratchpadPathKorean, doc.contentKorean, 'utf-8');
        fs.writeFileSync(publicPathKorean, doc.contentKorean, 'utf-8');

        scratchpadPaths.push(scratchpadPath);
        publicPaths.push(publicPath);
        scratchpadPathsKorean.push(scratchpadPathKorean);
        publicPathsKorean.push(publicPathKorean);
      }

      return { scratchpadPaths, publicPaths, scratchpadPathsKorean, publicPathsKorean };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const firstPath = scratchpadPaths[0] ?? scratchpadDir;
      throw new FileWriteError(firstPath, message);
    }
  }
}

// Singleton pattern (mirrors other writer agents)
let instance: TechDecisionWriterAgent | null = null;

/**
 * Get the singleton instance of TechDecisionWriterAgent.
 * @param config - Optional config (used only for the first call)
 */
export function getTechDecisionWriterAgent(
  config?: TechDecisionWriterAgentConfig
): TechDecisionWriterAgent {
  if (!instance) {
    instance = new TechDecisionWriterAgent(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (mainly for testing).
 */
export function resetTechDecisionWriterAgent(): void {
  instance = null;
}

/**
 * Matrix row helper re-exported for consumers that wish to format rows
 * outside of the agent.
 */
export type { EvaluationMatrixRow };
