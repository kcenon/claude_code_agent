/**
 * Document Reader Agent
 *
 * Parses and analyzes existing PRD/SRS/SDS documents to understand
 * the current project state for the Enhancement Pipeline.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  CurrentState,
  DocumentInfo,
  DocumentMetadata,
  DocumentReaderConfig,
  DocumentReadingResult,
  DocumentReadingSession,
  DocumentSection,
  DocumentType,
  FunctionalRequirement,
  NonFunctionalRequirement,
  ParsedDocument,
  PRDToSRSTrace,
  RequirementPriority,
  SRSToSDSTrace,
  SystemComponent,
  SystemFeature,
  UseCase,
} from './types.js';
import { DEFAULT_DOCUMENT_READER_CONFIG } from './types.js';
import {
  DocumentNotFoundError,
  FileSizeLimitError,
  NoActiveSessionError,
  OutputWriteError,
} from './errors.js';

// YAML import with dynamic loading for compatibility
let yaml: { dump: (obj: unknown) => string } | null = null;

async function loadYaml(): Promise<void> {
  if (yaml === null) {
    const jsYaml = await import('js-yaml');
    yaml = { dump: jsYaml.dump };
  }
}

/**
 * Document Reader Agent class
 *
 * Responsible for:
 * - Parsing PRD, SRS, SDS markdown documents
 * - Extracting requirements, features, and components
 * - Building traceability mappings
 * - Generating current_state.yaml output
 */
export class DocumentReaderAgent {
  private readonly config: Required<DocumentReaderConfig>;
  private session: DocumentReadingSession | null = null;

  constructor(config: DocumentReaderConfig = {}) {
    this.config = { ...DEFAULT_DOCUMENT_READER_CONFIG, ...config };
  }

  /**
   * Start a new document reading session
   */
  public async startSession(projectId: string): Promise<DocumentReadingSession> {
    await loadYaml();

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'reading',
      documents: [],
      currentState: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warnings: [],
      errors: [],
    };

    return this.session;
  }

  /**
   * Read and process all documents in the project
   */
  public async readDocuments(): Promise<DocumentReadingResult> {
    const session = this.ensureSession();
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Update session status
      this.session = { ...session, status: 'processing', updatedAt: new Date().toISOString() };

      // Discover and parse all documents
      const prdDocs = await this.discoverAndParseDocuments('prd');
      const srsDocs = await this.discoverAndParseDocuments('srs');
      const sdsDocs = await this.discoverAndParseDocuments('sds');

      const allDocs = [...prdDocs, ...srsDocs, ...sdsDocs];

      // Update session with parsed documents
      this.session = {
        ...this.session,
        documents: allDocs,
        updatedAt: new Date().toISOString(),
      };

      // Extract all items from documents
      const functionalReqs = this.extractFunctionalRequirements(prdDocs);
      const nonFunctionalReqs = this.extractNonFunctionalRequirements(prdDocs);
      const features = this.extractFeatures(srsDocs);
      const useCases = this.extractUseCases(srsDocs);
      const components = this.extractComponents(sdsDocs);

      // Build traceability if enabled
      let prdToSrs: PRDToSRSTrace[] = [];
      let srsToSds: SRSToSDSTrace[] = [];

      if (this.config.extractTraceability) {
        prdToSrs = this.buildPRDToSRSTraceability(functionalReqs, nonFunctionalReqs, features);
        srsToSds = this.buildSRSToSDSTraceability(features, components);
      }

      // Calculate statistics
      const stats = this.calculateStatistics(
        prdToSrs,
        srsToSds,
        functionalReqs.length + nonFunctionalReqs.length,
        features.length,
        components.length
      );

      // Build current state
      const prdInfo = this.buildDocumentInfo(prdDocs, 'prd');
      const srsInfo = this.buildDocumentInfo(srsDocs, 'srs');
      const sdsInfo = this.buildDocumentInfo(sdsDocs, 'sds');

      const currentState: CurrentState = {
        project: {
          name: this.extractProjectName(prdDocs) ?? session.projectId,
          version: this.extractProjectVersion(prdDocs) ?? '1.0.0',
          lastUpdated: new Date().toISOString(),
        },
        documents: {
          ...(prdInfo !== undefined && { prd: prdInfo }),
          ...(srsInfo !== undefined && { srs: srsInfo }),
          ...(sdsInfo !== undefined && { sds: sdsInfo }),
        },
        requirements: {
          functional: functionalReqs,
          nonFunctional: nonFunctionalReqs,
        },
        features,
        useCases,
        components,
        apis: [], // API extraction from SDS not yet implemented
        traceability: {
          prdToSrs,
          srsToSds,
        },
        statistics: {
          totalRequirements: functionalReqs.length + nonFunctionalReqs.length,
          totalFeatures: features.length,
          totalUseCases: useCases.length,
          totalComponents: components.length,
          totalApis: 0,
          coveragePrdToSrs: stats.coveragePrdToSrs,
          coverageSrsToSds: stats.coverageSrsToSds,
        },
      };

      // Write output
      const outputPath = await this.writeCurrentState(session.projectId, currentState);

      // Update session
      this.session = {
        ...this.session,
        status: 'completed',
        currentState,
        warnings,
        updatedAt: new Date().toISOString(),
      };

      const processingTimeMs = Date.now() - startTime;

      return {
        success: true,
        projectId: session.projectId,
        outputPath,
        currentState,
        stats: {
          documentsProcessed: allDocs.length,
          prdCount: prdDocs.length,
          srsCount: srsDocs.length,
          sdsCount: sdsDocs.length,
          requirementsExtracted: functionalReqs.length + nonFunctionalReqs.length,
          featuresExtracted: features.length,
          componentsExtracted: components.length,
          traceabilityLinks: prdToSrs.length + srsToSds.length,
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
  public getSession(): DocumentReadingSession | null {
    return this.session;
  }

  /**
   * Reset the agent state
   */
  public reset(): void {
    this.session = null;
  }

  // ============ Private Helper Methods ============

  private ensureSession(): DocumentReadingSession {
    if (this.session === null) {
      throw new NoActiveSessionError();
    }
    return this.session;
  }

  private async discoverAndParseDocuments(type: DocumentType): Promise<ParsedDocument[]> {
    const subdir = this.getSubdirForType(type);
    const docsPath = path.join(this.config.docsBasePath, subdir);

    try {
      await fs.access(docsPath);
    } catch {
      // Directory doesn't exist, return empty array
      return [];
    }

    const files = await fs.readdir(docsPath);
    const markdownFiles = files.filter((f) => f.endsWith('.md'));

    const parsedDocs: ParsedDocument[] = [];

    for (const file of markdownFiles) {
      const filePath = path.join(docsPath, file);
      try {
        const doc = await this.parseDocument(filePath, type);
        parsedDocs.push(doc);
      } catch (error) {
        // Log warning but continue with other documents
        const currentSession = this.session;
        if (currentSession !== null) {
          this.session = {
            ...currentSession,
            warnings: [
              ...currentSession.warnings,
              `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
            ],
          };
        }
      }
    }

    return parsedDocs;
  }

  private getSubdirForType(type: DocumentType): string {
    switch (type) {
      case 'prd':
        return this.config.prdSubdir;
      case 'srs':
        return this.config.srsSubdir;
      case 'sds':
        return this.config.sdsSubdir;
    }
  }

  private async parseDocument(filePath: string, type: DocumentType): Promise<ParsedDocument> {
    // Check file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new DocumentNotFoundError(filePath, type);
    }

    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size > this.config.maxFileSize) {
      throw new FileSizeLimitError(filePath, stats.size, this.config.maxFileSize);
    }

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Parse metadata from frontmatter or content
    const metadata = this.extractMetadata(content, filePath);

    // Parse sections
    const sections = this.parseSections(content);

    return {
      type,
      path: filePath,
      metadata,
      rawContent: content,
      sections,
      lastModified: stats.mtime.toISOString(),
    };
  }

  private extractMetadata(content: string, filePath: string): DocumentMetadata {
    const lines = content.split('\n');
    let title = path.basename(filePath, '.md');
    let version: string | undefined;
    let status: string | undefined;
    let id: string | undefined;

    // Try to extract from frontmatter (YAML between ---)
    if (lines[0]?.trim() === '---') {
      const endIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
      if (endIndex > 0) {
        const frontmatter = lines.slice(1, endIndex).join('\n');
        // Simple parsing without full YAML parser
        const versionMatch = frontmatter.match(/version:\s*["']?([^"'\n]+)["']?/i);
        const statusMatch = frontmatter.match(/status:\s*["']?([^"'\n]+)["']?/i);
        const titleMatch = frontmatter.match(/title:\s*["']?([^"'\n]+)["']?/i);
        const idMatch = frontmatter.match(/id:\s*["']?([^"'\n]+)["']?/i);

        if (versionMatch?.[1] !== undefined) version = versionMatch[1].trim();
        if (statusMatch?.[1] !== undefined) status = statusMatch[1].trim();
        if (titleMatch?.[1] !== undefined) title = titleMatch[1].trim();
        if (idMatch?.[1] !== undefined) id = idMatch[1].trim();
      }
    }

    // Try to extract from first heading (always prefer heading over filename)
    const headingMatch = content.match(/^#\s+(.+?)(?:\s*\n|$)/m);
    if (headingMatch?.[1] !== undefined) {
      title = headingMatch[1].trim();
    }

    // Try to extract from metadata table
    const tableMatch = content.match(/\|\s*(?:Version|버전)\s*\|\s*([^|]+)\|/i);
    if (tableMatch?.[1] !== undefined && version === undefined) {
      version = tableMatch[1].trim();
    }

    const docIdMatch = content.match(/\|\s*(?:Document ID|문서 ID)\s*\|\s*([^|]+)\|/i);
    if (docIdMatch?.[1] !== undefined && id === undefined) {
      id = docIdMatch[1].trim();
    }

    return {
      title,
      ...(id !== undefined && { id }),
      ...(version !== undefined && { version }),
      ...(status !== undefined && { status }),
    };
  }

  private parseSections(content: string): DocumentSection[] {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    const sectionStack: Array<{ section: DocumentSection; level: number }> = [];

    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch?.[1] !== undefined && headingMatch[2] !== undefined) {
        // Save current content to previous section
        if (sectionStack.length > 0 && currentContent.length > 0) {
          const lastEntry = sectionStack[sectionStack.length - 1];
          if (lastEntry) {
            (lastEntry.section as { content: string }).content = currentContent.join('\n').trim();
          }
        }

        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        const newSection: DocumentSection = {
          title,
          level,
          content: '',
          children: [],
          startLine: i + 1,
        };

        // Pop sections of equal or higher level
        while (sectionStack.length > 0) {
          const lastEntry = sectionStack[sectionStack.length - 1];
          if (lastEntry && lastEntry.level >= level) {
            sectionStack.pop();
          } else {
            break;
          }
        }

        // Add as child to parent or to root
        if (sectionStack.length > 0) {
          const parentEntry = sectionStack[sectionStack.length - 1];
          if (parentEntry) {
            (parentEntry.section.children as DocumentSection[]).push(newSection);
          }
        } else {
          sections.push(newSection);
        }

        sectionStack.push({ section: newSection, level });
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save remaining content
    if (sectionStack.length > 0 && currentContent.length > 0) {
      const lastEntry = sectionStack[sectionStack.length - 1];
      if (lastEntry) {
        (lastEntry.section as { content: string }).content = currentContent.join('\n').trim();
      }
    }

    return sections;
  }

  private extractFunctionalRequirements(docs: ParsedDocument[]): FunctionalRequirement[] {
    const requirements: FunctionalRequirement[] = [];

    for (const doc of docs) {
      const frPattern = /###\s*(FR-\d{3}):\s*(.+?)(?:\n|$)/gi;
      let match;

      while ((match = frPattern.exec(doc.rawContent)) !== null) {
        const id = match[1] ?? '';
        const titleMatch = match[2] ?? '';
        const title = titleMatch.trim();

        if (id === '' || title === '') continue;

        // Find the section content for this requirement
        const sectionStart = match.index;
        const nextSection = doc.rawContent.slice(sectionStart).match(/\n###\s/);
        const sectionEnd =
          nextSection?.index !== undefined
            ? sectionStart + nextSection.index
            : doc.rawContent.length;
        const sectionContent = doc.rawContent.slice(sectionStart, sectionEnd);

        // Extract details
        const description = this.extractField(sectionContent, 'Description');
        const priority = this.extractPriority(sectionContent);
        const userStory = this.extractField(sectionContent, 'User Story');
        const acceptanceCriteria = this.extractList(sectionContent, 'Acceptance Criteria');
        const dependencies = this.extractList(sectionContent, 'Dependencies');

        const lineNumber = doc.rawContent.slice(0, sectionStart).split('\n').length;

        requirements.push({
          id,
          title,
          description: description ?? title,
          priority,
          status: 'active',
          ...(userStory !== undefined && { userStory }),
          ...(acceptanceCriteria.length > 0 && { acceptanceCriteria }),
          ...(dependencies.length > 0 && { dependencies }),
          sourceLocation: `${doc.path}:${String(lineNumber)}`,
        });
      }
    }

    return requirements;
  }

  private extractNonFunctionalRequirements(docs: ParsedDocument[]): NonFunctionalRequirement[] {
    const requirements: NonFunctionalRequirement[] = [];

    for (const doc of docs) {
      const nfrPattern = /###\s*(NFR-\d{3}):\s*(.+?)(?:\n|$)/gi;
      let match;

      while ((match = nfrPattern.exec(doc.rawContent)) !== null) {
        const id = match[1] ?? '';
        const titleMatch = match[2] ?? '';
        const title = titleMatch.trim();

        if (id === '' || title === '') continue;

        const sectionStart = match.index;
        const nextSection = doc.rawContent.slice(sectionStart).match(/\n###\s/);
        const sectionEnd =
          nextSection?.index !== undefined
            ? sectionStart + nextSection.index
            : doc.rawContent.length;
        const sectionContent = doc.rawContent.slice(sectionStart, sectionEnd);

        const description = this.extractField(sectionContent, 'Description');
        const category = this.extractNFRCategory(sectionContent);
        const targetMetric = this.extractField(sectionContent, 'Target Metric');
        const priority = this.extractPriority(sectionContent);

        const lineNumber = doc.rawContent.slice(0, sectionStart).split('\n').length;

        requirements.push({
          id,
          title,
          description: description ?? title,
          category,
          ...(targetMetric !== undefined && { targetMetric }),
          priority,
          status: 'active',
          sourceLocation: `${doc.path}:${String(lineNumber)}`,
        });
      }
    }

    return requirements;
  }

  private extractFeatures(docs: ParsedDocument[]): SystemFeature[] {
    const features: SystemFeature[] = [];

    for (const doc of docs) {
      const sfPattern = /###\s*(SF-\d{3}):\s*(.+?)(?:\n|$)/gi;
      let match;

      while ((match = sfPattern.exec(doc.rawContent)) !== null) {
        const id = match[1] ?? '';
        const nameMatch = match[2] ?? '';
        const name = nameMatch.trim();

        if (id === '' || name === '') continue;

        const sectionStart = match.index;
        const nextSection = doc.rawContent.slice(sectionStart).match(/\n###\s/);
        const sectionEnd =
          nextSection?.index !== undefined
            ? sectionStart + nextSection.index
            : doc.rawContent.length;
        const sectionContent = doc.rawContent.slice(sectionStart, sectionEnd);

        const description = this.extractField(sectionContent, 'Description');
        const useCases = this.extractList(sectionContent, 'Use Cases');
        const sourceRequirements = this.extractTraceableIds(sectionContent, /FR-\d{3}|NFR-\d{3}/g);

        const lineNumber = doc.rawContent.slice(0, sectionStart).split('\n').length;

        features.push({
          id,
          name,
          description: description ?? name,
          useCases,
          sourceRequirements,
          status: 'active',
          sourceLocation: `${doc.path}:${String(lineNumber)}`,
        });
      }
    }

    return features;
  }

  private extractUseCases(docs: ParsedDocument[]): UseCase[] {
    const useCases: UseCase[] = [];

    for (const doc of docs) {
      const ucPattern = /###\s*(UC-\d{3}):\s*(.+?)(?:\n|$)/gi;
      let match;

      while ((match = ucPattern.exec(doc.rawContent)) !== null) {
        const id = match[1] ?? '';
        const nameMatch = match[2] ?? '';
        const name = nameMatch.trim();

        if (id === '' || name === '') continue;

        const sectionStart = match.index;
        const nextSection = doc.rawContent.slice(sectionStart).match(/\n###\s/);
        const sectionEnd =
          nextSection?.index !== undefined
            ? sectionStart + nextSection.index
            : doc.rawContent.length;
        const sectionContent = doc.rawContent.slice(sectionStart, sectionEnd);

        const primaryActor = this.extractField(sectionContent, 'Primary Actor');
        const preconditions = this.extractList(sectionContent, 'Preconditions');
        const mainFlow = this.extractList(sectionContent, 'Main Flow');
        const alternativeFlows = this.extractList(sectionContent, 'Alternative Flows');
        const postconditions = this.extractList(sectionContent, 'Postconditions');

        const lineNumber = doc.rawContent.slice(0, sectionStart).split('\n').length;

        useCases.push({
          id,
          name,
          ...(primaryActor !== undefined && { primaryActor }),
          ...(preconditions.length > 0 && { preconditions }),
          ...(mainFlow.length > 0 && { mainFlow }),
          ...(alternativeFlows.length > 0 && { alternativeFlows }),
          ...(postconditions.length > 0 && { postconditions }),
          sourceLocation: `${doc.path}:${String(lineNumber)}`,
        });
      }
    }

    return useCases;
  }

  private extractComponents(docs: ParsedDocument[]): SystemComponent[] {
    const components: SystemComponent[] = [];

    for (const doc of docs) {
      const cmpPattern = /###\s*(CMP-\d{3}):\s*(.+?)(?:\n|$)/gi;
      let match;

      while ((match = cmpPattern.exec(doc.rawContent)) !== null) {
        const id = match[1] ?? '';
        const nameMatch = match[2] ?? '';
        const name = nameMatch.trim();

        if (id === '' || name === '') continue;

        const sectionStart = match.index;
        const nextSection = doc.rawContent.slice(sectionStart).match(/\n###\s/);
        const sectionEnd =
          nextSection?.index !== undefined
            ? sectionStart + nextSection.index
            : doc.rawContent.length;
        const sectionContent = doc.rawContent.slice(sectionStart, sectionEnd);

        const description = this.extractField(sectionContent, 'Description');
        const typeStr = this.extractField(sectionContent, 'Type');
        const responsibilities = this.extractList(sectionContent, 'Responsibilities');
        const dependencies = this.extractList(sectionContent, 'Dependencies');
        const sourceFeatures = this.extractTraceableIds(sectionContent, /SF-\d{3}/g);

        const lineNumber = doc.rawContent.slice(0, sectionStart).split('\n').length;

        components.push({
          id,
          name,
          type: this.parseComponentType(typeStr),
          description: description ?? name,
          responsibilities,
          dependencies,
          sourceFeatures,
          sourceLocation: `${doc.path}:${String(lineNumber)}`,
        });
      }
    }

    return components;
  }

  private extractField(content: string, fieldName: string): string | undefined {
    const patterns = [
      new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?:\\n|$)`, 'i'),
      new RegExp(`-\\s*\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?:\\n|$)`, 'i'),
      new RegExp(`${fieldName}:\\s*(.+?)(?:\\n|$)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match?.[1] !== undefined) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractList(content: string, listName: string): string[] {
    const items: string[] = [];

    // Find section with the list name
    const sectionPattern = new RegExp(
      `(?:\\*\\*${listName}\\*\\*|${listName}):?\\s*\\n([\\s\\S]*?)(?=\\n(?:\\*\\*|###)|$)`,
      'i'
    );
    const sectionMatch = content.match(sectionPattern);

    if (sectionMatch?.[1] !== undefined) {
      const listContent = sectionMatch[1];
      // Match list items (- or * or numbered)
      const itemPattern = /^\s*(?:[-*]|\d+\.)\s+\[?\s*[xX ]?\s*\]?\s*(.+)$/gm;
      let itemMatch;
      while ((itemMatch = itemPattern.exec(listContent)) !== null) {
        const item = itemMatch[1];
        if (item !== undefined) {
          items.push(item.trim());
        }
      }
    }

    return items;
  }

  private extractPriority(content: string): RequirementPriority {
    const priorityMatch = content.match(/\*\*Priority\*\*:\s*(P[0-3])/i);
    if (priorityMatch?.[1] !== undefined) {
      return priorityMatch[1].toUpperCase() as RequirementPriority;
    }
    return 'P2'; // Default priority
  }

  private extractNFRCategory(
    content: string
  ): 'performance' | 'security' | 'scalability' | 'usability' | 'reliability' | 'maintainability' {
    type NFRCategoryType =
      | 'performance'
      | 'security'
      | 'scalability'
      | 'usability'
      | 'reliability'
      | 'maintainability';
    const categoryMatch = content.match(
      /\*\*Category\*\*:\s*(performance|security|scalability|usability|reliability|maintainability)/i
    );
    if (categoryMatch?.[1] !== undefined) {
      return categoryMatch[1].toLowerCase() as NFRCategoryType;
    }
    return 'performance'; // Default category
  }

  private extractTraceableIds(content: string, pattern: RegExp): string[] {
    const ids: string[] = [];
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (!ids.includes(match[0])) {
        ids.push(match[0]);
      }
    }
    return ids;
  }

  private parseComponentType(
    typeStr: string | undefined
  ): 'service' | 'library' | 'module' | 'api' {
    if (typeStr === undefined || typeStr === '') return 'module';
    const lower = typeStr.toLowerCase();
    if (lower.includes('service')) return 'service';
    if (lower.includes('library')) return 'library';
    if (lower.includes('api')) return 'api';
    return 'module';
  }

  private buildPRDToSRSTraceability(
    functionalReqs: FunctionalRequirement[],
    nonFunctionalReqs: NonFunctionalRequirement[],
    features: SystemFeature[]
  ): PRDToSRSTrace[] {
    const traces: PRDToSRSTrace[] = [];

    const allReqIds = [...functionalReqs.map((r) => r.id), ...nonFunctionalReqs.map((r) => r.id)];

    for (const reqId of allReqIds) {
      const linkedFeatures = features
        .filter((f) => f.sourceRequirements.includes(reqId))
        .map((f) => f.id);

      if (linkedFeatures.length > 0) {
        traces.push({
          prdId: reqId,
          srsIds: linkedFeatures,
        });
      }
    }

    return traces;
  }

  private buildSRSToSDSTraceability(
    features: SystemFeature[],
    components: SystemComponent[]
  ): SRSToSDSTrace[] {
    const traces: SRSToSDSTrace[] = [];

    for (const feature of features) {
      const linkedComponents = components
        .filter((c) => c.sourceFeatures.includes(feature.id))
        .map((c) => c.id);

      if (linkedComponents.length > 0) {
        traces.push({
          srsId: feature.id,
          sdsIds: linkedComponents,
        });
      }
    }

    return traces;
  }

  private calculateStatistics(
    prdToSrs: PRDToSRSTrace[],
    srsToSds: SRSToSDSTrace[],
    totalRequirements: number,
    totalFeatures: number,
    _totalComponents: number
  ): { coveragePrdToSrs: number; coverageSrsToSds: number } {
    // Note: _totalComponents is available for future use in coverage metrics
    const coveragePrdToSrs = totalRequirements > 0 ? prdToSrs.length / totalRequirements : 0;
    const coverageSrsToSds = totalFeatures > 0 ? srsToSds.length / totalFeatures : 0;

    return {
      coveragePrdToSrs: Math.round(coveragePrdToSrs * 100) / 100,
      coverageSrsToSds: Math.round(coverageSrsToSds * 100) / 100,
    };
  }

  private buildDocumentInfo(docs: ParsedDocument[], type: DocumentType): DocumentInfo | undefined {
    if (docs.length === 0) return undefined;

    // Use the first document or find the main one
    const mainDoc = docs.find((d) => d.path.toLowerCase().includes(type)) ?? docs[0];

    if (!mainDoc) return undefined;

    return {
      path: mainDoc.path,
      version: mainDoc.metadata.version ?? '1.0.0',
      itemCount: this.countItemsInDocument(mainDoc, type),
      lastModified: mainDoc.lastModified,
    };
  }

  private countItemsInDocument(doc: ParsedDocument, type: DocumentType): number {
    let pattern: RegExp;
    switch (type) {
      case 'prd':
        pattern = /(?:FR|NFR)-\d{3}/g;
        break;
      case 'srs':
        pattern = /(?:SF|UC)-\d{3}/g;
        break;
      case 'sds':
        pattern = /(?:CMP|API)-\d{3}/g;
        break;
    }

    const matches = doc.rawContent.match(pattern);
    return matches ? new Set(matches).size : 0;
  }

  private extractProjectName(docs: ParsedDocument[]): string | undefined {
    for (const doc of docs) {
      // Try to extract from title like "PRD: Project Name"
      const titleMatch = doc.metadata.title.match(/(?:PRD|SRS|SDS):\s*(.+)/i);
      if (titleMatch?.[1] !== undefined) {
        return titleMatch[1].trim();
      }
    }
    return undefined;
  }

  private extractProjectVersion(docs: ParsedDocument[]): string | undefined {
    for (const doc of docs) {
      if (doc.metadata.version !== undefined) {
        return doc.metadata.version;
      }
    }
    return undefined;
  }

  private async writeCurrentState(projectId: string, currentState: CurrentState): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'state', projectId);
    const outputPath = path.join(outputDir, 'current_state.yaml');

    try {
      await fs.mkdir(outputDir, { recursive: true });

      // Ensure yaml is loaded
      if (yaml === null) {
        await loadYaml();
      }
      // At this point yaml is guaranteed to be non-null
      const yamlModule = yaml;
      if (yamlModule === null) {
        throw new Error('YAML module failed to load');
      }

      // Convert to YAML-friendly format
      const yamlContent = yamlModule.dump({
        current_state: {
          project: currentState.project,
          documents: currentState.documents,
          requirements: currentState.requirements,
          features: currentState.features,
          use_cases: currentState.useCases,
          components: currentState.components,
          apis: currentState.apis,
          traceability: {
            prd_to_srs: currentState.traceability.prdToSrs,
            srs_to_sds: currentState.traceability.srsToSds,
          },
          statistics: currentState.statistics,
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
}

// ============ Singleton Pattern ============

let globalDocumentReaderAgent: DocumentReaderAgent | null = null;

/**
 * Get the global Document Reader Agent instance
 */
export function getDocumentReaderAgent(config?: DocumentReaderConfig): DocumentReaderAgent {
  if (globalDocumentReaderAgent === null) {
    globalDocumentReaderAgent = new DocumentReaderAgent(config);
  }
  return globalDocumentReaderAgent;
}

/**
 * Reset the global Document Reader Agent instance
 */
export function resetDocumentReaderAgent(): void {
  if (globalDocumentReaderAgent !== null) {
    globalDocumentReaderAgent.reset();
    globalDocumentReaderAgent = null;
  }
}
