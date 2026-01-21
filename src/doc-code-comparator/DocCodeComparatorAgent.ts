/**
 * Doc-Code Comparator Agent
 *
 * Compares documentation specifications against actual code implementations
 * to identify gaps, inconsistencies, and improvement opportunities.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { IAgent } from '../agents/types.js';
import type {
  AgentMapping,
  CodeItem,
  ComparisonResult,
  ComparisonSession,
  ComparisonStatistics,
  DocCodeComparisonResult,
  DocCodeComparatorConfig,
  DocumentItem,
  GapItem,
  GapPriority,
  GapSummary,
  GapType,
  GeneratedIssue,
  MappingResult,
  MappingStatus,
} from './types.js';
import { DEFAULT_DOC_CODE_COMPARATOR_CONFIG } from './types.js';
import {
  CodeInventoryNotFoundError,
  DocumentInventoryNotFoundError,
  InvalidInventoryError,
  NoActiveSessionError,
  OutputWriteError,
} from './errors.js';

// YAML import with dynamic loading for compatibility
let yaml: { dump: (obj: unknown) => string; load: (str: string) => unknown } | null = null;

async function loadYaml(): Promise<void> {
  if (yaml === null) {
    const jsYaml = await import('js-yaml');
    yaml = { dump: jsYaml.dump, load: jsYaml.load };
  }
}

/**
 * Default agent to module mappings based on project structure
 */
const DEFAULT_AGENT_MAPPINGS: readonly AgentMapping[] = [
  {
    agentId: 'collector',
    agentName: 'Collector Agent',
    expectedModulePath: 'src/collector',
    alternativePaths: ['src/collector-agent'],
  },
  {
    agentId: 'prd-writer',
    agentName: 'PRD Writer Agent',
    expectedModulePath: 'src/prd-writer',
    alternativePaths: ['src/prd-generator'],
  },
  {
    agentId: 'srs-writer',
    agentName: 'SRS Writer Agent',
    expectedModulePath: 'src/srs-writer',
    alternativePaths: ['src/architecture-generator'],
  },
  {
    agentId: 'sds-writer',
    agentName: 'SDS Writer Agent',
    expectedModulePath: 'src/sds-writer',
    alternativePaths: ['src/sds-generator'],
  },
  {
    agentId: 'issue-generator',
    agentName: 'Issue Generator Agent',
    expectedModulePath: 'src/issue-generator',
  },
  {
    agentId: 'controller',
    agentName: 'Controller Agent',
    expectedModulePath: 'src/controller',
  },
  {
    agentId: 'worker',
    agentName: 'Worker Agent',
    expectedModulePath: 'src/worker',
  },
  {
    agentId: 'pr-reviewer',
    agentName: 'PR Reviewer Agent',
    expectedModulePath: 'src/pr-reviewer',
  },
  {
    agentId: 'document-reader',
    agentName: 'Document Reader Agent',
    expectedModulePath: 'src/document-reader',
  },
  {
    agentId: 'code-reader',
    agentName: 'Code Reader Agent',
    expectedModulePath: 'src/code-reader',
  },
  {
    agentId: 'prd-updater',
    agentName: 'PRD Updater Agent',
    expectedModulePath: 'src/prd-updater',
  },
  {
    agentId: 'srs-updater',
    agentName: 'SRS Updater Agent',
    expectedModulePath: 'src/srs-updater',
  },
  {
    agentId: 'doc-code-comparator',
    agentName: 'Doc-Code Comparator Agent',
    expectedModulePath: 'src/doc-code-comparator',
  },
] as const;

/**
 * Raw document state from YAML
 */
interface RawDocumentState {
  current_state?: {
    project?: { name?: string; version?: string };
    requirements?: {
      functional?: Array<{
        id?: string;
        title?: string;
        description?: string;
        sourceLocation?: string;
      }>;
      nonFunctional?: Array<{
        id?: string;
        title?: string;
        description?: string;
        sourceLocation?: string;
      }>;
    };
    features?: Array<{ id?: string; name?: string; description?: string; sourceLocation?: string }>;
    components?: Array<{
      id?: string;
      name?: string;
      description?: string;
      sourceLocation?: string;
    }>;
    apis?: Array<{ id?: string; name?: string; description?: string; sourceLocation?: string }>;
  };
}

/**
 * Raw code inventory from YAML
 */
interface RawCodeInventory {
  code_inventory?: {
    project?: { name?: string };
    modules?: Array<{
      name?: string;
      path?: string;
      classes?: Array<{ name?: string }>;
      functions?: Array<{ name?: string }>;
      interfaces?: Array<{ name?: string }>;
      statistics?: { linesOfCode?: number };
    }>;
  };
}

/**
 * Agent ID for DocCodeComparatorAgent used in AgentFactory
 */
export const DOC_CODE_COMPARATOR_AGENT_ID = 'doc-code-comparator-agent';

/**
 * Doc-Code Comparator Agent class
 *
 * Responsible for:
 * - Loading document and code inventories
 * - Mapping documented items to code modules
 * - Detecting gaps and inconsistencies
 * - Generating actionable issues
 * - Outputting comparison results
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class DocCodeComparatorAgent implements IAgent {
  public readonly agentId = DOC_CODE_COMPARATOR_AGENT_ID;
  public readonly name = 'Doc-Code Comparator Agent';

  private readonly config: Required<DocCodeComparatorConfig>;
  private session: ComparisonSession | null = null;
  private gapIdCounter: number = 0;
  private initialized = false;

  constructor(config: DocCodeComparatorConfig = {}) {
    this.config = { ...DEFAULT_DOC_CODE_COMPARATOR_CONFIG, ...config };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await loadYaml();
    this.initialized = true;
  }

  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.session = null;
    this.gapIdCounter = 0;
    this.initialized = false;
  }

  /**
   * Start a new comparison session
   */
  public async startSession(projectId: string): Promise<ComparisonSession> {
    await loadYaml();

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'idle',
      documentInventoryPath: null,
      codeInventoryPath: null,
      result: null,
      generatedIssues: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warnings: [],
      errors: [],
    };

    return this.session;
  }

  /**
   * Run the comparison process
   */
  public async compare(
    documentInventoryPath?: string,
    codeInventoryPath?: string
  ): Promise<DocCodeComparisonResult> {
    const session = this.ensureSession();
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Update session status
      this.session = { ...session, status: 'loading', updatedAt: new Date().toISOString() };

      // Resolve paths
      const docPath =
        documentInventoryPath ??
        path.join(this.config.scratchpadBasePath, 'state', session.projectId, 'current_state.yaml');
      const codePath =
        codeInventoryPath ??
        path.join(
          this.config.scratchpadBasePath,
          'analysis',
          session.projectId,
          'code_inventory.yaml'
        );

      // Update session with paths
      this.session = {
        ...this.session,
        documentInventoryPath: docPath,
        codeInventoryPath: codePath,
        updatedAt: new Date().toISOString(),
      };

      // Load inventories
      const documentItems = await this.loadDocumentInventory(docPath);
      const codeItems = await this.loadCodeInventory(codePath);

      // Update to comparing status
      this.session = { ...this.session, status: 'comparing', updatedAt: new Date().toISOString() };

      // Create mappings
      const mappings = this.createMappings(documentItems, codeItems);

      // Detect gaps
      this.gapIdCounter = 0;
      const gaps = this.detectGaps(documentItems, codeItems, mappings, warnings);

      // Calculate statistics
      const statistics = this.calculateStatistics(documentItems, codeItems, mappings);

      // Create gap summary
      const gapSummary = this.createGapSummary(gaps);

      // Build comparison result
      const result: ComparisonResult = {
        project: {
          name: session.projectId,
          comparedAt: new Date().toISOString(),
        },
        mappings,
        gaps,
        gapSummary,
        statistics,
      };

      // Generate issues if configured
      let issues: GeneratedIssue[] = [];
      let gapIssuesPath: string | null = null;

      if (this.config.generateIssues && gaps.length > 0) {
        issues = this.generateIssues(gaps);
        gapIssuesPath = await this.writeGapIssues(session.projectId, issues);
      }

      // Write comparison result
      const comparisonResultPath = await this.writeComparisonResult(session.projectId, result);

      // Update session
      this.session = {
        ...this.session,
        status: 'completed',
        result,
        generatedIssues: issues,
        warnings,
        updatedAt: new Date().toISOString(),
      };

      const processingTimeMs = Date.now() - startTime;

      return {
        success: true,
        projectId: session.projectId,
        comparisonResultPath,
        gapIssuesPath,
        result,
        issues,
        stats: {
          documentItemsAnalyzed: documentItems.length,
          codeModulesAnalyzed: codeItems.length,
          mappingsCreated: mappings.length,
          gapsDetected: gaps.length,
          issuesGenerated: issues.length,
          processingTimeMs,
        },
        warnings,
      };
    } catch (error) {
      const currentSession = this.session;
      if (currentSession !== null) {
        this.session = {
          ...currentSession,
          status: 'failed',
          errors: [
            ...currentSession.errors,
            error instanceof Error ? error.message : String(error),
          ],
          updatedAt: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  /**
   * Get the current session
   */
  public getSession(): ComparisonSession | null {
    return this.session;
  }

  /**
   * Reset the agent state
   */
  public reset(): void {
    this.session = null;
    this.gapIdCounter = 0;
  }

  // ============ Private Helper Methods ============

  private ensureSession(): ComparisonSession {
    if (this.session === null) {
      throw new NoActiveSessionError();
    }
    return this.session;
  }

  private async loadDocumentInventory(inventoryPath: string): Promise<DocumentItem[]> {
    try {
      await fs.access(inventoryPath);
    } catch {
      throw new DocumentInventoryNotFoundError(inventoryPath);
    }

    try {
      const content = await fs.readFile(inventoryPath, 'utf-8');

      if (yaml === null) {
        await loadYaml();
      }
      const yamlModule = yaml;
      if (yamlModule === null) {
        throw new Error('YAML module failed to load');
      }

      const data = yamlModule.load(content) as RawDocumentState;
      return this.extractDocumentItems(data);
    } catch (error) {
      if (error instanceof DocumentInventoryNotFoundError) {
        throw error;
      }
      throw new InvalidInventoryError(
        inventoryPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private extractDocumentItems(data: RawDocumentState): DocumentItem[] {
    const items: DocumentItem[] = [];
    const currentState = data.current_state;

    if (!currentState) {
      return items;
    }

    // Extract functional requirements
    if (currentState.requirements?.functional) {
      for (const req of currentState.requirements.functional) {
        if (req.id !== undefined && req.id !== '') {
          items.push({
            id: req.id,
            name: req.title ?? req.id,
            description: req.description ?? '',
            type: 'requirement',
            sourceLocation: req.sourceLocation ?? '',
          });
        }
      }
    }

    // Extract non-functional requirements
    if (currentState.requirements?.nonFunctional) {
      for (const req of currentState.requirements.nonFunctional) {
        if (req.id !== undefined && req.id !== '') {
          items.push({
            id: req.id,
            name: req.title ?? req.id,
            description: req.description ?? '',
            type: 'requirement',
            sourceLocation: req.sourceLocation ?? '',
          });
        }
      }
    }

    // Extract features
    if (currentState.features) {
      for (const feature of currentState.features) {
        if (feature.id !== undefined && feature.id !== '') {
          items.push({
            id: feature.id,
            name: feature.name ?? feature.id,
            description: feature.description ?? '',
            type: 'feature',
            sourceLocation: feature.sourceLocation ?? '',
          });
        }
      }
    }

    // Extract components
    if (currentState.components) {
      for (const component of currentState.components) {
        if (component.id !== undefined && component.id !== '') {
          items.push({
            id: component.id,
            name: component.name ?? component.id,
            description: component.description ?? '',
            type: 'component',
            sourceLocation: component.sourceLocation ?? '',
          });
        }
      }
    }

    // Extract APIs
    if (currentState.apis) {
      for (const api of currentState.apis) {
        if (api.id !== undefined && api.id !== '') {
          items.push({
            id: api.id,
            name: api.name ?? api.id,
            description: api.description ?? '',
            type: 'api',
            sourceLocation: api.sourceLocation ?? '',
          });
        }
      }
    }

    return items;
  }

  private async loadCodeInventory(inventoryPath: string): Promise<CodeItem[]> {
    try {
      await fs.access(inventoryPath);
    } catch {
      throw new CodeInventoryNotFoundError(inventoryPath);
    }

    try {
      const content = await fs.readFile(inventoryPath, 'utf-8');

      if (yaml === null) {
        await loadYaml();
      }
      const yamlModule = yaml;
      if (yamlModule === null) {
        throw new Error('YAML module failed to load');
      }

      const data = yamlModule.load(content) as RawCodeInventory;
      return this.extractCodeItems(data);
    } catch (error) {
      if (error instanceof CodeInventoryNotFoundError) {
        throw error;
      }
      throw new InvalidInventoryError(
        inventoryPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private extractCodeItems(data: RawCodeInventory): CodeItem[] {
    const items: CodeItem[] = [];
    const inventory = data.code_inventory;

    if (!inventory?.modules) {
      return items;
    }

    for (const mod of inventory.modules) {
      if (mod.name !== undefined && mod.name !== '' && mod.path !== undefined && mod.path !== '') {
        items.push({
          moduleName: mod.name,
          modulePath: mod.path,
          classes: (mod.classes ?? []).map((c) => c.name ?? '').filter((n) => n !== ''),
          functions: (mod.functions ?? []).map((f) => f.name ?? '').filter((n) => n !== ''),
          interfaces: (mod.interfaces ?? []).map((i) => i.name ?? '').filter((n) => n !== ''),
          linesOfCode: mod.statistics?.linesOfCode ?? 0,
        });
      }
    }

    return items;
  }

  private createMappings(documentItems: DocumentItem[], codeItems: CodeItem[]): MappingResult[] {
    const mappings: MappingResult[] = [];
    const allMappingConfigs = [...DEFAULT_AGENT_MAPPINGS, ...this.config.customMappings];

    // Map components from documents to code modules
    const componentItems = documentItems.filter((item) => item.type === 'component');

    for (const component of componentItems) {
      const mapping = this.findBestMatch(component, codeItems, allMappingConfigs);
      mappings.push(mapping);
    }

    // Also try to map agents from agent definitions
    for (const agentMapping of allMappingConfigs) {
      const existingMapping = mappings.find(
        (m) =>
          m.documentId.toLowerCase() === agentMapping.agentId.toLowerCase() ||
          m.documentName.toLowerCase().includes(agentMapping.agentName.toLowerCase())
      );

      if (!existingMapping) {
        const codeMatch = this.findCodeModuleByPath(agentMapping, codeItems);
        mappings.push({
          documentId: agentMapping.agentId,
          documentName: agentMapping.agentName,
          codeModulePath: codeMatch?.modulePath ?? null,
          status: codeMatch ? 'matched' : 'unmatched',
          confidence: codeMatch ? 1.0 : 0.0,
          matchDetails: codeMatch
            ? `Matched by path: ${codeMatch.modulePath}`
            : `Expected at: ${agentMapping.expectedModulePath}`,
        });
      }
    }

    return mappings;
  }

  private findBestMatch(
    documentItem: DocumentItem,
    codeItems: CodeItem[],
    agentMappings: readonly AgentMapping[]
  ): MappingResult {
    // Try exact name match first
    const normalizedName = this.normalizeName(documentItem.name);

    for (const codeItem of codeItems) {
      const normalizedModuleName = this.normalizeName(codeItem.moduleName);

      if (normalizedName === normalizedModuleName) {
        return {
          documentId: documentItem.id,
          documentName: documentItem.name,
          codeModulePath: codeItem.modulePath,
          status: 'matched',
          confidence: 1.0,
          matchDetails: `Exact name match: ${codeItem.moduleName}`,
        };
      }
    }

    // Try agent mapping
    for (const mapping of agentMappings) {
      if (
        documentItem.name.toLowerCase().includes(mapping.agentName.toLowerCase()) ||
        documentItem.id.toLowerCase() === mapping.agentId.toLowerCase()
      ) {
        const codeMatch = this.findCodeModuleByPath(mapping, codeItems);
        if (codeMatch) {
          return {
            documentId: documentItem.id,
            documentName: documentItem.name,
            codeModulePath: codeMatch.modulePath,
            status: 'matched',
            confidence: 0.9,
            matchDetails: `Matched via agent mapping: ${mapping.agentId}`,
          };
        }
      }
    }

    // Try fuzzy matching
    let bestMatch: CodeItem | null = null;
    let bestScore = 0;

    for (const codeItem of codeItems) {
      const score = this.calculateSimilarity(documentItem.name, codeItem.moduleName);
      if (score > bestScore && score >= this.config.minMatchConfidence) {
        bestScore = score;
        bestMatch = codeItem;
      }
    }

    if (bestMatch) {
      const status: MappingStatus = bestScore >= 0.8 ? 'matched' : 'partial';
      return {
        documentId: documentItem.id,
        documentName: documentItem.name,
        codeModulePath: bestMatch.modulePath,
        status,
        confidence: bestScore,
        matchDetails: `Fuzzy match (${String(Math.round(bestScore * 100))}%): ${bestMatch.moduleName}`,
      };
    }

    return {
      documentId: documentItem.id,
      documentName: documentItem.name,
      codeModulePath: null,
      status: 'unmatched',
      confidence: 0,
      matchDetails: 'No matching code module found',
    };
  }

  private findCodeModuleByPath(mapping: AgentMapping, codeItems: CodeItem[]): CodeItem | null {
    const paths = [mapping.expectedModulePath, ...(mapping.alternativePaths ?? [])];

    for (const expectedPath of paths) {
      const match = codeItems.find(
        (item) =>
          item.modulePath === expectedPath ||
          item.modulePath.endsWith(expectedPath) ||
          expectedPath.endsWith(item.modulePath)
      );
      if (match) {
        return match;
      }
    }

    return null;
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/agent$/i, '')
      .replace(/writer$/i, '')
      .replace(/reader$/i, '')
      .replace(/generator$/i, '');
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1.0;

    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) {
      const shorter = Math.min(s1.length, s2.length);
      const longer = Math.max(s1.length, s2.length);
      return shorter / longer;
    }

    // Simple word overlap
    const words1 = new Set(s1.split(/[^a-z0-9]+/).filter((w) => w.length > 2));
    const words2 = new Set(s2.split(/[^a-z0-9]+/).filter((w) => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        overlap++;
      }
    }

    return overlap / Math.max(words1.size, words2.size);
  }

  private detectGaps(
    _documentItems: DocumentItem[],
    codeItems: CodeItem[],
    mappings: MappingResult[],
    warnings: string[]
  ): GapItem[] {
    const gaps: GapItem[] = [];

    // Detect documented but not implemented
    for (const mapping of mappings) {
      if (mapping.status === 'unmatched') {
        gaps.push(
          this.createGap(
            'documented_not_implemented',
            this.determinePriority('documented_not_implemented', mapping.documentId),
            `${mapping.documentName} not implemented`,
            `The documented item "${mapping.documentName}" (${mapping.documentId}) has no corresponding code implementation.`,
            mapping.documentId,
            undefined,
            `Create implementation for ${mapping.documentName}`,
            [mapping.documentId]
          )
        );
      } else if (mapping.status === 'partial') {
        gaps.push(
          this.createGap(
            'partial_implementation',
            this.determinePriority('partial_implementation', mapping.documentId),
            `${mapping.documentName} partially implemented`,
            `The documented item "${mapping.documentName}" (${mapping.documentId}) appears to have only partial implementation at ${mapping.codeModulePath ?? 'unknown'}.`,
            mapping.documentId,
            mapping.codeModulePath ?? undefined,
            `Review and complete implementation for ${mapping.documentName}`,
            [mapping.documentId]
          )
        );
      }
    }

    // Detect implemented but not documented (if configured)
    if (this.config.reportUndocumentedCode) {
      const mappedPaths = new Set(
        mappings.filter((m) => m.codeModulePath !== null).map((m) => m.codeModulePath)
      );

      for (const codeItem of codeItems) {
        // Skip common infrastructure modules
        if (this.isInfrastructureModule(codeItem.moduleName)) {
          continue;
        }

        if (!mappedPaths.has(codeItem.modulePath)) {
          gaps.push(
            this.createGap(
              'implemented_not_documented',
              'P3',
              `${codeItem.moduleName} not documented`,
              `The code module "${codeItem.moduleName}" at ${codeItem.modulePath} has no corresponding documentation.`,
              undefined,
              codeItem.modulePath,
              `Add documentation for ${codeItem.moduleName}`,
              []
            )
          );
        }
      }
    }

    // Log warnings for any issues
    if (gaps.filter((g) => g.priority === 'P0').length > 0) {
      warnings.push('Critical gaps detected (P0) - core functionality may be missing');
    }

    return gaps;
  }

  private isInfrastructureModule(moduleName: string): boolean {
    const infraPatterns = [
      /^utils?$/i,
      /^helpers?$/i,
      /^common$/i,
      /^shared$/i,
      /^types?$/i,
      /^interfaces?$/i,
      /^constants?$/i,
      /^config$/i,
      /^test/i,
      /^__/,
    ];

    return infraPatterns.some((pattern) => pattern.test(moduleName));
  }

  private createGap(
    type: GapType,
    priority: GapPriority,
    title: string,
    description: string,
    documentReference: string | undefined,
    codeReference: string | undefined,
    suggestedAction: string,
    relatedIds: string[]
  ): GapItem {
    this.gapIdCounter++;
    return {
      id: `GAP-${String(this.gapIdCounter).padStart(3, '0')}`,
      type,
      priority,
      title,
      description,
      ...(documentReference !== undefined && { documentReference }),
      ...(codeReference !== undefined && { codeReference }),
      suggestedAction,
      relatedIds,
    };
  }

  private determinePriority(gapType: GapType, itemId: string): GapPriority {
    // Core pipeline agents are P0
    const coreAgents = [
      'collector',
      'prd-writer',
      'srs-writer',
      'sds-writer',
      'issue-generator',
      'controller',
      'worker',
    ];

    const isCore = coreAgents.some(
      (agent) =>
        itemId.toLowerCase().includes(agent) ||
        itemId.toLowerCase().includes(agent.replace('-', ''))
    );

    if (gapType === 'documented_not_implemented') {
      return isCore ? 'P0' : 'P1';
    }

    if (gapType === 'partial_implementation') {
      return isCore ? 'P1' : 'P2';
    }

    if (gapType === 'documentation_code_mismatch') {
      return 'P2';
    }

    return 'P3'; // implemented_not_documented
  }

  private calculateStatistics(
    documentItems: DocumentItem[],
    codeItems: CodeItem[],
    mappings: MappingResult[]
  ): ComparisonStatistics {
    const fullyMatched = mappings.filter((m) => m.status === 'matched').length;
    const partiallyMatched = mappings.filter((m) => m.status === 'partial').length;
    const unmatchedDocumented = mappings.filter((m) => m.status === 'unmatched').length;

    const mappedPaths = new Set(
      mappings.filter((m) => m.codeModulePath !== null).map((m) => m.codeModulePath)
    );
    const undocumentedCode = codeItems.filter(
      (c) => !mappedPaths.has(c.modulePath) && !this.isInfrastructureModule(c.moduleName)
    ).length;

    const totalItems = mappings.length;
    const overallMatchScore =
      totalItems > 0 ? (fullyMatched + partiallyMatched * 0.5) / totalItems : 0;

    // Calculate coverage by category
    const requirementItems = documentItems.filter((i) => i.type === 'requirement');
    const featureItems = documentItems.filter((i) => i.type === 'feature');
    const componentItems = documentItems.filter((i) => i.type === 'component');
    const apiItems = documentItems.filter((i) => i.type === 'api');

    const getCoverage = (items: DocumentItem[]): number => {
      if (items.length === 0) return 1.0;
      const itemIds = new Set(items.map((i) => i.id));
      const matchedCount = mappings.filter(
        (m) => itemIds.has(m.documentId) && m.status !== 'unmatched'
      ).length;
      return matchedCount / items.length;
    };

    return {
      totalDocumentedItems: documentItems.length,
      totalImplementedModules: codeItems.length,
      fullyMatched,
      partiallyMatched,
      unmatchedDocumented,
      undocumentedCode,
      overallMatchScore: Math.round(overallMatchScore * 100) / 100,
      coverageByCategory: {
        requirements: Math.round(getCoverage(requirementItems) * 100) / 100,
        features: Math.round(getCoverage(featureItems) * 100) / 100,
        components: Math.round(getCoverage(componentItems) * 100) / 100,
        apis: Math.round(getCoverage(apiItems) * 100) / 100,
      },
    };
  }

  private createGapSummary(gaps: GapItem[]): GapSummary {
    return {
      byType: {
        documentedNotImplemented: gaps.filter((g) => g.type === 'documented_not_implemented')
          .length,
        implementedNotDocumented: gaps.filter((g) => g.type === 'implemented_not_documented')
          .length,
        partialImplementation: gaps.filter((g) => g.type === 'partial_implementation').length,
        documentationCodeMismatch: gaps.filter((g) => g.type === 'documentation_code_mismatch')
          .length,
      },
      byPriority: {
        P0: gaps.filter((g) => g.priority === 'P0').length,
        P1: gaps.filter((g) => g.priority === 'P1').length,
        P2: gaps.filter((g) => g.priority === 'P2').length,
        P3: gaps.filter((g) => g.priority === 'P3').length,
      },
      totalGaps: gaps.length,
      criticalGapsCount: gaps.filter((g) => g.priority === 'P0' || g.priority === 'P1').length,
    };
  }

  private generateIssues(gaps: GapItem[]): GeneratedIssue[] {
    const issues: GeneratedIssue[] = [];

    for (const gap of gaps) {
      const labels = this.getLabelsForGap(gap);

      issues.push({
        title: `[${gap.priority}] ${gap.title}`,
        body: this.formatIssueBody(gap),
        labels,
        priority: gap.priority,
        sourceGapId: gap.id,
        relatedDocumentIds: gap.relatedIds,
        relatedCodePaths: gap.codeReference !== undefined ? [gap.codeReference] : [],
      });
    }

    return issues;
  }

  private getLabelsForGap(gap: GapItem): string[] {
    const labels: string[] = [];

    // Priority label
    labels.push(`priority-${gap.priority.toLowerCase()}`);

    // Type label
    switch (gap.type) {
      case 'documented_not_implemented':
        labels.push('implementation');
        labels.push('missing');
        break;
      case 'implemented_not_documented':
        labels.push('documentation');
        break;
      case 'partial_implementation':
        labels.push('implementation');
        labels.push('incomplete');
        break;
      case 'documentation_code_mismatch':
        labels.push('documentation');
        labels.push('mismatch');
        break;
    }

    labels.push('gap-analysis');

    return labels;
  }

  private formatIssueBody(gap: GapItem): string {
    const lines: string[] = [];

    lines.push('## Description');
    lines.push('');
    lines.push(gap.description);
    lines.push('');

    lines.push('## Gap Details');
    lines.push('');
    lines.push(`- **Gap ID:** ${gap.id}`);
    lines.push(`- **Type:** ${gap.type.replace(/_/g, ' ')}`);
    lines.push(`- **Priority:** ${gap.priority}`);

    if (gap.documentReference !== undefined) {
      lines.push(`- **Document Reference:** ${gap.documentReference}`);
    }

    if (gap.codeReference !== undefined) {
      lines.push(`- **Code Reference:** ${gap.codeReference}`);
    }

    lines.push('');

    lines.push('## Suggested Action');
    lines.push('');
    lines.push(gap.suggestedAction);
    lines.push('');

    if (gap.relatedIds.length > 0) {
      lines.push('## Related Items');
      lines.push('');
      for (const id of gap.relatedIds) {
        lines.push(`- ${id}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('_Generated by Doc-Code Comparator Agent_');

    return lines.join('\n');
  }

  private async writeComparisonResult(
    projectId: string,
    result: ComparisonResult
  ): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'analysis', projectId);
    const outputPath = path.join(outputDir, 'comparison_result.yaml');

    try {
      await fs.mkdir(outputDir, { recursive: true });

      if (yaml === null) {
        await loadYaml();
      }
      const yamlModule = yaml;
      if (yamlModule === null) {
        throw new Error('YAML module failed to load');
      }

      const yamlContent = yamlModule.dump({
        comparison_result: {
          project: result.project,
          mappings: result.mappings,
          gaps: result.gaps,
          gap_summary: {
            by_type: result.gapSummary.byType,
            by_priority: result.gapSummary.byPriority,
            total_gaps: result.gapSummary.totalGaps,
            critical_gaps_count: result.gapSummary.criticalGapsCount,
          },
          statistics: result.statistics,
        },
      });

      await fs.writeFile(outputPath, yamlContent, 'utf-8');
      return outputPath;
    } catch (error) {
      throw new OutputWriteError(
        outputPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async writeGapIssues(projectId: string, issues: GeneratedIssue[]): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'analysis', projectId);
    const outputPath = path.join(outputDir, 'gap_issues.json');

    try {
      await fs.mkdir(outputDir, { recursive: true });

      const jsonContent = JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          total_issues: issues.length,
          issues: issues.map((issue) => ({
            title: issue.title,
            body: issue.body,
            labels: issue.labels,
            priority: issue.priority,
            source_gap_id: issue.sourceGapId,
            related_document_ids: issue.relatedDocumentIds,
            related_code_paths: issue.relatedCodePaths,
          })),
        },
        null,
        2
      );

      await fs.writeFile(outputPath, jsonContent, 'utf-8');
      return outputPath;
    } catch (error) {
      throw new OutputWriteError(
        outputPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// ============ Singleton Pattern ============

let globalDocCodeComparatorAgent: DocCodeComparatorAgent | null = null;

/**
 * Get the global Doc-Code Comparator Agent instance
 */
export function getDocCodeComparatorAgent(
  config?: DocCodeComparatorConfig
): DocCodeComparatorAgent {
  if (globalDocCodeComparatorAgent === null) {
    globalDocCodeComparatorAgent = new DocCodeComparatorAgent(config);
  }
  return globalDocCodeComparatorAgent;
}

/**
 * Reset the global Doc-Code Comparator Agent instance
 */
export function resetDocCodeComparatorAgent(): void {
  if (globalDocCodeComparatorAgent !== null) {
    globalDocCodeComparatorAgent.reset();
    globalDocCodeComparatorAgent = null;
  }
}
