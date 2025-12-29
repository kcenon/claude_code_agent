/**
 * SRS Updater Agent
 *
 * Performs incremental updates to existing SRS documents instead of full rewrites.
 * Supports adding features and use cases, modifying existing items, updating
 * interfaces, and maintaining PRD→SRS traceability.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  AddedFeature,
  AddedUseCase,
  ConsistencyCheckResult,
  DocumentSection,
  FeaturePriority,
  FeatureStatus,
  ModifiedFeature,
  ModifiedInterface,
  ModifiedUseCase,
  NewFeature,
  NewUseCase,
  ItemModification,
  ParsedFeature,
  ParsedSRS,
  ParsedUseCase,
  SRSChangeRequest,
  SRSDocumentMetadata,
  SRSUpdateChanges,
  SRSUpdateOperationResult,
  SRSUpdaterConfig,
  SRSUpdaterSession,
  SRSUpdateResult,
  TraceabilityEntry,
} from './types.js';
import { DEFAULT_SRS_UPDATER_CONFIG } from './types.js';
import {
  DuplicateFeatureError,
  DuplicateUseCaseError,
  FeatureNotFoundError,
  InvalidSRSChangeRequestError,
  NoActiveSRSSessionError,
  SRSDocumentParseError,
  SRSFileSizeLimitError,
  SRSNotFoundError,
  SRSNotLoadedError,
  SRSOutputWriteError,
  UseCaseNotFoundError,
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
 * SRS Updater Agent class
 *
 * Responsible for:
 * - Loading and parsing existing SRS documents
 * - Adding new software features
 * - Adding new use cases
 * - Modifying existing features/use cases
 * - Updating interface definitions
 * - Maintaining PRD→SRS traceability matrix
 */
export class SRSUpdaterAgent {
  private readonly config: Required<SRSUpdaterConfig>;
  private session: SRSUpdaterSession | null = null;

  constructor(config: SRSUpdaterConfig = {}) {
    this.config = { ...DEFAULT_SRS_UPDATER_CONFIG, ...config };
  }

  /**
   * Start a new SRS update session
   */
  public async startSession(projectId: string): Promise<SRSUpdaterSession> {
    await loadYaml();

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'idle',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warnings: [],
      errors: [],
    };

    return this.session;
  }

  /**
   * Load an existing SRS document for updating
   */
  public async loadSRS(srsPath?: string): Promise<ParsedSRS> {
    const session = this.ensureSession();

    // Update session status
    this.session = { ...session, status: 'loading', updatedAt: new Date().toISOString() };

    try {
      // Find SRS file
      const resolvedPath = srsPath ?? (await this.findSRSFile(session.projectId));

      // Check file exists and size
      await this.validateFile(resolvedPath);

      // Read and parse SRS
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const stats = await fs.stat(resolvedPath);

      const parsedSRS = this.parseSRS(resolvedPath, content, stats.mtime.toISOString());

      // Update session
      this.session = {
        ...this.session,
        srsPath: resolvedPath,
        parsedSRS,
        updatedAt: new Date().toISOString(),
      };

      return parsedSRS;
    } catch (error) {
      // Session is guaranteed non-null here since ensureSession() was called at the start
      this.session = {
        ...this.session,
        status: 'failed',
        errors: [...this.session.errors, error instanceof Error ? error.message : String(error)],
        updatedAt: new Date().toISOString(),
      };
      throw error;
    }
  }

  /**
   * Apply a change request to the loaded SRS
   */
  public async applyChange(changeRequest: SRSChangeRequest): Promise<SRSUpdateOperationResult> {
    const session = this.ensureSession();
    const parsedSRS = this.ensureSRSLoaded();

    // Validate change request
    this.validateChangeRequest(changeRequest);

    // Update session status
    this.session = { ...session, status: 'updating', updatedAt: new Date().toISOString() };

    try {
      const changes: {
        featuresAdded: AddedFeature[];
        useCasesAdded: AddedUseCase[];
        featuresModified: ModifiedFeature[];
        useCasesModified: ModifiedUseCase[];
        interfacesModified: ModifiedInterface[];
      } = {
        featuresAdded: [],
        useCasesAdded: [],
        featuresModified: [],
        useCasesModified: [],
        interfacesModified: [],
      };

      const traceabilityUpdates: TraceabilityEntry[] = [];

      let updatedContent = parsedSRS.rawContent;
      const versionBefore = parsedSRS.metadata.version;

      // Apply the change based on type
      switch (changeRequest.type) {
        case 'add_feature': {
          if (changeRequest.newFeature === undefined) {
            throw new InvalidSRSChangeRequestError('newFeature', 'Required for add_feature');
          }
          const result = this.addFeature(updatedContent, changeRequest.newFeature, parsedSRS);
          updatedContent = result.content;
          changes.featuresAdded.push(result.added);
          if (changeRequest.newFeature.linkedPrdIds.length > 0) {
            for (const prdId of changeRequest.newFeature.linkedPrdIds) {
              traceabilityUpdates.push({
                prdId,
                srsIds: [result.added.id],
              });
            }
          }
          break;
        }
        case 'add_use_case': {
          if (changeRequest.newUseCase === undefined) {
            throw new InvalidSRSChangeRequestError('newUseCase', 'Required for add_use_case');
          }
          const result = this.addUseCase(updatedContent, changeRequest.newUseCase, parsedSRS);
          updatedContent = result.content;
          changes.useCasesAdded.push(result.added);
          break;
        }
        case 'modify_feature': {
          if (changeRequest.itemId === undefined) {
            throw new InvalidSRSChangeRequestError('itemId', 'Required for modify_feature');
          }
          if (
            changeRequest.modifications === undefined ||
            changeRequest.modifications.length === 0
          ) {
            throw new InvalidSRSChangeRequestError('modifications', 'Required for modify_feature');
          }
          const result = this.modifyFeature(
            updatedContent,
            changeRequest.itemId,
            changeRequest.modifications,
            parsedSRS
          );
          updatedContent = result.content;
          changes.featuresModified.push(...result.modified);
          break;
        }
        case 'modify_use_case': {
          if (changeRequest.itemId === undefined) {
            throw new InvalidSRSChangeRequestError('itemId', 'Required for modify_use_case');
          }
          if (
            changeRequest.modifications === undefined ||
            changeRequest.modifications.length === 0
          ) {
            throw new InvalidSRSChangeRequestError('modifications', 'Required for modify_use_case');
          }
          const result = this.modifyUseCase(
            updatedContent,
            changeRequest.itemId,
            changeRequest.modifications,
            parsedSRS
          );
          updatedContent = result.content;
          changes.useCasesModified.push(...result.modified);
          break;
        }
        case 'update_interface': {
          if (changeRequest.interfaceName === undefined) {
            throw new InvalidSRSChangeRequestError(
              'interfaceName',
              'Required for update_interface'
            );
          }
          if (changeRequest.interfaceChanges === undefined) {
            throw new InvalidSRSChangeRequestError(
              'interfaceChanges',
              'Required for update_interface'
            );
          }
          const result = this.updateInterface(
            updatedContent,
            changeRequest.interfaceName,
            changeRequest.interfaceChanges
          );
          updatedContent = result.content;
          changes.interfacesModified.push(result.modified);
          break;
        }
        case 'update_traceability': {
          if (
            changeRequest.traceabilityUpdates === undefined ||
            changeRequest.traceabilityUpdates.length === 0
          ) {
            throw new InvalidSRSChangeRequestError(
              'traceabilityUpdates',
              'Required for update_traceability'
            );
          }
          const result = this.updateTraceability(updatedContent, changeRequest.traceabilityUpdates);
          updatedContent = result.content;
          traceabilityUpdates.push(...changeRequest.traceabilityUpdates);
          break;
        }
      }

      // Calculate new version
      const versionAfter = this.calculateNewVersion(versionBefore, changes);

      // Update version in content
      updatedContent = this.updateVersionInContent(updatedContent, versionBefore, versionAfter);

      // Update last updated date
      updatedContent = this.updateLastUpdatedDate(updatedContent);

      // Run consistency check
      const consistencyCheck = this.runConsistencyCheck(updatedContent, parsedSRS);

      // Build update result
      const updateResult: SRSUpdateResult = {
        document: parsedSRS.metadata.id ?? path.basename(parsedSRS.path, '.md'),
        versionBefore,
        versionAfter,
        updatedAt: new Date().toISOString(),
        changes,
        traceabilityUpdates,
        consistencyCheck,
        changelogEntry: this.generateChangelogEntry(versionAfter, changes),
      };

      // Write outputs
      const srsPath = session.srsPath ?? parsedSRS.path;
      await this.writeUpdatedSRS(srsPath, updatedContent);

      let changelogPath = '';
      if (this.config.generateChangelog) {
        changelogPath = await this.writeChangelog(session.projectId, updateResult);
      }

      const resultPath = await this.writeUpdateResult(session.projectId, updateResult);

      // Update session
      this.session = {
        ...this.session,
        status: 'completed',
        updateResult,
        updatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        projectId: session.projectId,
        srsPath,
        outputPath: resultPath,
        changelogPath,
        updateResult,
        warnings: this.session.warnings,
      };
    } catch (error) {
      // Session is guaranteed non-null here since ensureSession() was called at the start
      this.session = {
        ...this.session,
        status: 'failed',
        errors: [...this.session.errors, error instanceof Error ? error.message : String(error)],
        updatedAt: new Date().toISOString(),
      };
      throw error;
    }
  }

  /**
   * Get the current session
   */
  public getSession(): SRSUpdaterSession | null {
    return this.session;
  }

  /**
   * Reset the agent state
   */
  public reset(): void {
    this.session = null;
  }

  // ============ Private Helper Methods ============

  private ensureSession(): SRSUpdaterSession {
    if (this.session === null) {
      throw new NoActiveSRSSessionError();
    }
    return this.session;
  }

  private ensureSRSLoaded(): ParsedSRS {
    const session = this.ensureSession();
    if (session.parsedSRS === undefined) {
      throw new SRSNotLoadedError();
    }
    return session.parsedSRS;
  }

  private async findSRSFile(projectId: string): Promise<string> {
    const srsDir = path.join(this.config.docsBasePath, this.config.srsSubdir);

    try {
      await fs.access(srsDir);
    } catch {
      throw new SRSNotFoundError(srsDir);
    }

    const files = await fs.readdir(srsDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    // Try to find by project ID first
    const matchingFile = mdFiles.find(
      (f) => f.toLowerCase().includes(projectId.toLowerCase()) || f.includes('SRS')
    );

    if (matchingFile !== undefined) {
      return path.join(srsDir, matchingFile);
    }

    // Fall back to first .md file
    if (mdFiles.length > 0 && mdFiles[0] !== undefined) {
      return path.join(srsDir, mdFiles[0]);
    }

    throw new SRSNotFoundError(srsDir);
  }

  private async validateFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      throw new SRSNotFoundError(filePath);
    }

    const stats = await fs.stat(filePath);
    if (stats.size > this.config.maxFileSize) {
      throw new SRSFileSizeLimitError(filePath, stats.size, this.config.maxFileSize);
    }
  }

  private parseSRS(filePath: string, content: string, lastModified: string): ParsedSRS {
    try {
      const metadata = this.extractMetadata(content, filePath);
      const sections = this.parseSections(content);
      const features = this.extractFeatures(content);
      const useCases = this.extractUseCases(content);
      const traceabilityMatrix = this.extractTraceabilityMatrix(content);

      return {
        path: filePath,
        metadata,
        rawContent: content,
        features,
        useCases,
        sections,
        traceabilityMatrix,
        lastModified,
      };
    } catch (error) {
      throw new SRSDocumentParseError(
        filePath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private extractMetadata(content: string, filePath: string): SRSDocumentMetadata {
    const lines = content.split('\n');
    let title = path.basename(filePath, '.md');
    let version = '1.0.0';
    let status: string | undefined;
    let id: string | undefined;
    let created: string | undefined;
    let lastUpdated: string | undefined;

    // Extract from metadata table
    const versionMatch = content.match(/\|\s*Version\s*\|\s*([^|]+)\|/i);
    if (versionMatch?.[1] !== undefined) {
      version = versionMatch[1].trim();
    }

    const idMatch = content.match(/\|\s*Document ID\s*\|\s*([^|]+)\|/i);
    if (idMatch?.[1] !== undefined) {
      id = idMatch[1].trim();
    }

    const statusMatch = content.match(/\|\s*Status\s*\|\s*([^|]+)\|/i);
    if (statusMatch?.[1] !== undefined) {
      status = statusMatch[1].trim();
    }

    const createdMatch = content.match(/\|\s*Created\s*\|\s*([^|]+)\|/i);
    if (createdMatch?.[1] !== undefined) {
      created = createdMatch[1].trim();
    }

    const lastUpdatedMatch = content.match(/\|\s*Last Updated\s*\|\s*([^|]+)\|/i);
    if (lastUpdatedMatch?.[1] !== undefined) {
      lastUpdated = lastUpdatedMatch[1].trim();
    }

    // Try frontmatter
    if (lines[0]?.trim() === '---') {
      const endIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
      if (endIndex > 0) {
        const frontmatter = lines.slice(1, endIndex).join('\n');
        const fmVersion = frontmatter.match(/version:\s*["']?([^"'\n]+)["']?/i);
        const fmTitle = frontmatter.match(/title:\s*["']?([^"'\n]+)["']?/i);

        if (fmVersion?.[1] !== undefined && version === '1.0.0') {
          version = fmVersion[1].trim();
        }
        if (fmTitle?.[1] !== undefined) {
          title = fmTitle[1].trim();
        }
      }
    }

    // Extract title from heading
    const headingMatch = content.match(/^#\s+(?:SRS:\s*)?(.+?)(?:\s*\n|$)/m);
    if (headingMatch?.[1] !== undefined) {
      title = headingMatch[1].trim();
    }

    return {
      title,
      version,
      ...(id !== undefined && { id }),
      ...(status !== undefined && { status }),
      ...(created !== undefined && { created }),
      ...(lastUpdated !== undefined && { lastUpdated }),
    };
  }

  private parseSections(content: string): DocumentSection[] {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    let currentSection: {
      title: string;
      level: number;
      startLine: number;
      lines: string[];
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch?.[1] !== undefined && headingMatch[2] !== undefined) {
        // Save previous section
        if (currentSection !== null) {
          sections.push({
            title: currentSection.title,
            level: currentSection.level,
            content: currentSection.lines.join('\n').trim(),
            startLine: currentSection.startLine,
            endLine: i,
          });
        }

        // Start new section
        currentSection = {
          title: headingMatch[2].trim(),
          level: headingMatch[1].length,
          startLine: i + 1,
          lines: [],
        };
      } else if (currentSection !== null) {
        currentSection.lines.push(line);
      }
    }

    // Save last section
    if (currentSection !== null) {
      sections.push({
        title: currentSection.title,
        level: currentSection.level,
        content: currentSection.lines.join('\n').trim(),
        startLine: currentSection.startLine,
        endLine: lines.length,
      });
    }

    return sections;
  }

  private extractFeatures(content: string): ParsedFeature[] {
    const features: ParsedFeature[] = [];

    // Extract software features
    const sfPattern =
      /###\s*(SF-\d{3}):\s*(.+?)(?:\s*\[(NEW|MODIFIED|DEPRECATED)\])?\s*\n([\s\S]*?)(?=\n###\s|$)/gi;
    let match;

    while ((match = sfPattern.exec(content)) !== null) {
      const id = match[1] ?? '';
      const title = match[2]?.trim() ?? '';
      const statusTag = match[3]?.toUpperCase();
      const sectionContent = match[4] ?? '';

      if (id === '' || title === '') continue;

      const lineNumber = content.slice(0, match.index).split('\n').length;

      features.push({
        id,
        title,
        description: this.extractField(sectionContent, 'Description') ?? title,
        priority: this.extractPriority(sectionContent),
        status: this.parseStatus(statusTag),
        linkedPrdIds: this.extractLinkedPrdIds(sectionContent),
        preconditions: this.extractList(sectionContent, 'Preconditions'),
        postconditions: this.extractList(sectionContent, 'Postconditions'),
        dependencies: this.extractList(sectionContent, 'Dependencies'),
        notes: this.extractField(sectionContent, 'Notes'),
        lineNumber,
        rawContent: match[0],
      });
    }

    return features;
  }

  private extractUseCases(content: string): ParsedUseCase[] {
    const useCases: ParsedUseCase[] = [];

    // Extract use cases
    const ucPattern =
      /###\s*(UC-\d{3}):\s*(.+?)(?:\s*\[(NEW|MODIFIED|DEPRECATED)\])?\s*\n([\s\S]*?)(?=\n###\s|$)/gi;
    let match;

    while ((match = ucPattern.exec(content)) !== null) {
      const id = match[1] ?? '';
      const title = match[2]?.trim() ?? '';
      const statusTag = match[3]?.toUpperCase();
      const sectionContent = match[4] ?? '';

      if (id === '' || title === '') continue;

      const lineNumber = content.slice(0, match.index).split('\n').length;

      useCases.push({
        id,
        title,
        description: this.extractField(sectionContent, 'Description') ?? title,
        primaryActor: this.extractField(sectionContent, 'Primary Actor') ?? 'User',
        featureId: this.extractField(sectionContent, 'Feature') ?? '',
        status: this.parseStatus(statusTag),
        preconditions: this.extractList(sectionContent, 'Preconditions'),
        postconditions: this.extractList(sectionContent, 'Postconditions'),
        mainFlow: this.extractMainFlow(sectionContent),
        notes: this.extractField(sectionContent, 'Notes'),
        lineNumber,
        rawContent: match[0],
      });
    }

    return useCases;
  }

  private extractTraceabilityMatrix(content: string): TraceabilityEntry[] {
    const entries: TraceabilityEntry[] = [];

    // Look for traceability matrix section
    const matrixPattern =
      /##\s*\d*\.?\s*(?:PRD→SRS\s*)?Traceability(?:\s+Matrix)?\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i;
    const matrixMatch = content.match(matrixPattern);

    if (matrixMatch?.[1] !== undefined) {
      const matrixContent = matrixMatch[1];

      // Parse table rows (| PRD ID | SRS IDs |)
      const rowPattern = /\|\s*(FR-\d{3}|NFR-\d{3})\s*\|\s*([^|]+)\|/gi;
      let rowMatch;

      while ((rowMatch = rowPattern.exec(matrixContent)) !== null) {
        const prdId = rowMatch[1] ?? '';
        const srsIdsStr = rowMatch[2] ?? '';

        if (prdId !== '') {
          const srsIds = srsIdsStr
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter((s) => s.match(/^(?:SF|UC)-\d{3}$/));

          if (srsIds.length > 0) {
            entries.push({ prdId, srsIds });
          }
        }
      }
    }

    return entries;
  }

  private extractField(content: string, fieldName: string): string | undefined {
    const patterns = [
      new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?:\\n|$)`, 'i'),
      new RegExp(`-\\s*\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?:\\n|$)`, 'i'),
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

    const sectionPattern = new RegExp(
      `(?:\\*\\*${listName}\\*\\*|${listName}):?\\s*\\n([\\s\\S]*?)(?=\\n(?:\\*\\*|###)|$)`,
      'i'
    );
    const sectionMatch = content.match(sectionPattern);

    if (sectionMatch?.[1] !== undefined) {
      const listContent = sectionMatch[1];
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

  private extractMainFlow(content: string): string[] {
    const steps: string[] = [];

    const flowPattern =
      /(?:\*\*Main Flow\*\*|Main Flow):?\s*\n([\s\S]*?)(?=\n(?:\*\*|###|Alternative|Exception)|$)/i;
    const flowMatch = content.match(flowPattern);

    if (flowMatch?.[1] !== undefined) {
      const flowContent = flowMatch[1];
      const stepPattern = /^\s*\d+\.\s+(.+)$/gm;
      let stepMatch;
      while ((stepMatch = stepPattern.exec(flowContent)) !== null) {
        const step = stepMatch[1];
        if (step !== undefined) {
          steps.push(step.trim());
        }
      }
    }

    return steps;
  }

  private extractLinkedPrdIds(content: string): string[] {
    const ids: string[] = [];

    // Look for Linked PRD field
    const linkedMatch = content.match(/\*\*Linked PRD\*\*:\s*(.+?)(?:\n|$)/i);
    if (linkedMatch?.[1] !== undefined) {
      const idsStr = linkedMatch[1];
      const idPattern = /(FR-\d{3}|NFR-\d{3})/g;
      let idMatch;
      while ((idMatch = idPattern.exec(idsStr)) !== null) {
        if (idMatch[1] !== undefined) {
          ids.push(idMatch[1]);
        }
      }
    }

    return ids;
  }

  private extractPriority(content: string): FeaturePriority {
    const match = content.match(/\*\*Priority\*\*:\s*(P[0-3])/i);
    if (match?.[1] !== undefined) {
      return match[1].toUpperCase() as FeaturePriority;
    }
    return 'P2';
  }

  private parseStatus(statusTag: string | undefined): FeatureStatus {
    if (statusTag === 'DEPRECATED') return 'deprecated';
    if (statusTag === 'NEW') return 'pending';
    return 'active';
  }

  private validateChangeRequest(changeRequest: SRSChangeRequest): void {
    if (changeRequest.type === 'add_feature' && changeRequest.newFeature === undefined) {
      throw new InvalidSRSChangeRequestError('newFeature', 'Required for add_feature type');
    }
    if (changeRequest.type === 'add_use_case' && changeRequest.newUseCase === undefined) {
      throw new InvalidSRSChangeRequestError('newUseCase', 'Required for add_use_case type');
    }
    if (changeRequest.type === 'modify_feature') {
      if (changeRequest.itemId === undefined) {
        throw new InvalidSRSChangeRequestError('itemId', 'Required for modify_feature type');
      }
      if (changeRequest.modifications === undefined || changeRequest.modifications.length === 0) {
        throw new InvalidSRSChangeRequestError(
          'modifications',
          'At least one modification required'
        );
      }
    }
    if (changeRequest.type === 'modify_use_case') {
      if (changeRequest.itemId === undefined) {
        throw new InvalidSRSChangeRequestError('itemId', 'Required for modify_use_case type');
      }
      if (changeRequest.modifications === undefined || changeRequest.modifications.length === 0) {
        throw new InvalidSRSChangeRequestError(
          'modifications',
          'At least one modification required'
        );
      }
    }
    if (changeRequest.type === 'update_interface') {
      if (changeRequest.interfaceName === undefined) {
        throw new InvalidSRSChangeRequestError(
          'interfaceName',
          'Required for update_interface type'
        );
      }
      if (changeRequest.interfaceChanges === undefined) {
        throw new InvalidSRSChangeRequestError(
          'interfaceChanges',
          'Required for update_interface type'
        );
      }
    }
    if (changeRequest.type === 'update_traceability') {
      if (
        changeRequest.traceabilityUpdates === undefined ||
        changeRequest.traceabilityUpdates.length === 0
      ) {
        throw new InvalidSRSChangeRequestError(
          'traceabilityUpdates',
          'At least one traceability update required'
        );
      }
    }
  }

  private addFeature(
    content: string,
    newFeature: NewFeature,
    parsedSRS: ParsedSRS
  ): { content: string; added: AddedFeature } {
    // Generate new ID
    const existingIds = parsedSRS.features.map((f) => parseInt(f.id.split('-')[1] ?? '0', 10));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const newId = `SF-${String(maxId + 1).padStart(3, '0')}`;

    // Check for duplicate
    if (parsedSRS.features.some((f) => f.id === newId)) {
      throw new DuplicateFeatureError(newId);
    }

    // Find the section to add to
    const sectionTitle = 'Software Features';
    const sectionPattern = new RegExp(
      `(## \\d+\\.\\s*${sectionTitle}[\\s\\S]*?)(?=\\n## \\d+\\.|$)`,
      'i'
    );
    const sectionMatch = content.match(sectionPattern);

    // Build new feature markdown
    const today = new Date().toISOString().split('T')[0] ?? '';
    let featureMarkdown = `\n### ${newId}: ${newFeature.title} [NEW]\n`;
    featureMarkdown += `- **Description**: ${newFeature.description}\n`;
    if (newFeature.linkedPrdIds.length > 0) {
      featureMarkdown += `- **Linked PRD**: ${newFeature.linkedPrdIds.join(', ')}\n`;
    }
    featureMarkdown += `- **Priority**: ${newFeature.priority}\n`;
    if (newFeature.preconditions !== undefined && newFeature.preconditions.length > 0) {
      featureMarkdown += `- **Preconditions**:\n`;
      for (const precondition of newFeature.preconditions) {
        featureMarkdown += `  - ${precondition}\n`;
      }
    }
    if (newFeature.postconditions !== undefined && newFeature.postconditions.length > 0) {
      featureMarkdown += `- **Postconditions**:\n`;
      for (const postcondition of newFeature.postconditions) {
        featureMarkdown += `  - ${postcondition}\n`;
      }
    }
    if (newFeature.dependencies !== undefined && newFeature.dependencies.length > 0) {
      featureMarkdown += `- **Dependencies**: ${newFeature.dependencies.join(', ')}\n`;
    }
    featureMarkdown += `- **Added**: ${today}\n`;
    if (newFeature.notes !== undefined) {
      featureMarkdown += `- **Notes**: ${newFeature.notes}\n`;
    }

    let updatedContent: string;
    let lineNumber: number;

    if (sectionMatch !== null && sectionMatch[1] !== undefined) {
      // Insert at end of section
      const sectionEnd = (sectionMatch.index ?? 0) + sectionMatch[1].length;
      updatedContent = content.slice(0, sectionEnd) + featureMarkdown + content.slice(sectionEnd);
      lineNumber = content.slice(0, sectionEnd).split('\n').length + 1;
    } else {
      // Append at end
      updatedContent = content + featureMarkdown;
      lineNumber = content.split('\n').length + 1;
    }

    return {
      content: updatedContent,
      added: {
        id: newId,
        title: newFeature.title,
        linkedPrd: newFeature.linkedPrdIds[0] ?? '',
        lineNumber,
      },
    };
  }

  private addUseCase(
    content: string,
    newUseCase: NewUseCase,
    parsedSRS: ParsedSRS
  ): { content: string; added: AddedUseCase } {
    // Generate new ID
    const existingIds = parsedSRS.useCases.map((uc) => parseInt(uc.id.split('-')[1] ?? '0', 10));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const newId = `UC-${String(maxId + 1).padStart(3, '0')}`;

    // Check for duplicate
    if (parsedSRS.useCases.some((uc) => uc.id === newId)) {
      throw new DuplicateUseCaseError(newId);
    }

    // Find the section to add to
    const sectionTitle = 'Use Cases';
    const sectionPattern = new RegExp(
      `(## \\d+\\.\\s*${sectionTitle}[\\s\\S]*?)(?=\\n## \\d+\\.|$)`,
      'i'
    );
    const sectionMatch = content.match(sectionPattern);

    // Build new use case markdown
    const today = new Date().toISOString().split('T')[0] ?? '';
    let ucMarkdown = `\n### ${newId}: ${newUseCase.title} [NEW]\n`;
    ucMarkdown += `- **Description**: ${newUseCase.description}\n`;
    ucMarkdown += `- **Feature**: ${newUseCase.featureId}\n`;
    ucMarkdown += `- **Primary Actor**: ${newUseCase.primaryActor}\n`;

    if (newUseCase.preconditions !== undefined && newUseCase.preconditions.length > 0) {
      ucMarkdown += `- **Preconditions**:\n`;
      for (const precondition of newUseCase.preconditions) {
        ucMarkdown += `  - ${precondition}\n`;
      }
    }

    if (newUseCase.mainFlow.length > 0) {
      ucMarkdown += `\n**Main Flow**:\n`;
      for (let i = 0; i < newUseCase.mainFlow.length; i++) {
        const step = newUseCase.mainFlow[i] ?? '';
        ucMarkdown += `${String(i + 1)}. ${step}\n`;
      }
    }

    if (newUseCase.postconditions !== undefined && newUseCase.postconditions.length > 0) {
      ucMarkdown += `\n- **Postconditions**:\n`;
      for (const postcondition of newUseCase.postconditions) {
        ucMarkdown += `  - ${postcondition}\n`;
      }
    }

    ucMarkdown += `- **Added**: ${today}\n`;
    if (newUseCase.notes !== undefined) {
      ucMarkdown += `- **Notes**: ${newUseCase.notes}\n`;
    }

    let updatedContent: string;
    let lineNumber: number;

    if (sectionMatch !== null && sectionMatch[1] !== undefined) {
      // Insert at end of section
      const sectionEnd = (sectionMatch.index ?? 0) + sectionMatch[1].length;
      updatedContent = content.slice(0, sectionEnd) + ucMarkdown + content.slice(sectionEnd);
      lineNumber = content.slice(0, sectionEnd).split('\n').length + 1;
    } else {
      // Append at end
      updatedContent = content + ucMarkdown;
      lineNumber = content.split('\n').length + 1;
    }

    return {
      content: updatedContent,
      added: {
        id: newId,
        title: newUseCase.title,
        feature: newUseCase.featureId,
        lineNumber,
      },
    };
  }

  private modifyFeature(
    content: string,
    featureId: string,
    modifications: readonly ItemModification[],
    parsedSRS: ParsedSRS
  ): { content: string; modified: ModifiedFeature[] } {
    const feature = parsedSRS.features.find((f) => f.id === featureId);
    if (feature === undefined) {
      throw new FeatureNotFoundError(featureId, parsedSRS.path);
    }

    let updatedContent = content;
    const modifiedItems: ModifiedFeature[] = [];
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find the feature section
    const featurePattern = new RegExp(
      `(### ${featureId}:)\\s*(.+?)(?:\\s*\\[(NEW|MODIFIED|DEPRECATED)\\])?\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`,
      'i'
    );
    const featureMatch = updatedContent.match(featurePattern);

    if (featureMatch === null) {
      throw new FeatureNotFoundError(featureId, parsedSRS.path);
    }

    let featureTitle = featureMatch[2]?.trim() ?? '';
    let featureBody = featureMatch[4] ?? '';

    for (const mod of modifications) {
      if (mod.field.toLowerCase() === 'title') {
        modifiedItems.push({
          id: featureId,
          field: 'title',
          oldValue: featureTitle,
          newValue: mod.newValue,
        });
        featureTitle = mod.newValue;
      } else if (mod.field.toLowerCase() === 'priority') {
        const priorityPattern = /(\*\*Priority\*\*:\s*)(P[0-3])/i;
        const priorityMatch = featureBody.match(priorityPattern);
        if (priorityMatch !== null) {
          modifiedItems.push({
            id: featureId,
            field: 'priority',
            oldValue: priorityMatch[2] ?? '',
            newValue: mod.newValue,
          });
          featureBody = featureBody.replace(priorityPattern, `$1${mod.newValue}`);
        }
      } else if (mod.field.toLowerCase() === 'description') {
        const descPattern = /(\*\*Description\*\*:\s*)(.+?)(?=\n)/i;
        const descMatch = featureBody.match(descPattern);
        if (descMatch !== null) {
          modifiedItems.push({
            id: featureId,
            field: 'description',
            oldValue: descMatch[2] ?? '',
            newValue: mod.newValue,
          });
          featureBody = featureBody.replace(descPattern, `$1${mod.newValue}`);
        }
      } else {
        // Generic field modification
        const fieldPattern = new RegExp(`(\\*\\*${mod.field}\\*\\*:\\s*)(.+?)(?=\\n)`, 'i');
        const fieldMatch = featureBody.match(fieldPattern);
        if (fieldMatch !== null) {
          modifiedItems.push({
            id: featureId,
            field: mod.field,
            oldValue: fieldMatch[2] ?? '',
            newValue: mod.newValue,
          });
          featureBody = featureBody.replace(fieldPattern, `$1${mod.newValue}`);
        }
      }
    }

    // Add modified date if not present
    if (!featureBody.includes('**Modified**:')) {
      featureBody = featureBody.trimEnd() + `\n- **Modified**: ${today}\n`;
    } else {
      featureBody = featureBody.replace(/(\*\*Modified\*\*:\s*)[\d-]+/, `$1${today}`);
    }

    // Rebuild the feature section
    const featureHeader = featureMatch[1] ?? '';
    const updatedFeature = `${featureHeader} ${featureTitle} [MODIFIED]\n${featureBody}`;
    updatedContent = updatedContent.replace(featureMatch[0], updatedFeature);

    return {
      content: updatedContent,
      modified: modifiedItems,
    };
  }

  private modifyUseCase(
    content: string,
    useCaseId: string,
    modifications: readonly ItemModification[],
    parsedSRS: ParsedSRS
  ): { content: string; modified: ModifiedUseCase[] } {
    const useCase = parsedSRS.useCases.find((uc) => uc.id === useCaseId);
    if (useCase === undefined) {
      throw new UseCaseNotFoundError(useCaseId, parsedSRS.path);
    }

    let updatedContent = content;
    const modifiedItems: ModifiedUseCase[] = [];
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find the use case section
    const ucPattern = new RegExp(
      `(### ${useCaseId}:)\\s*(.+?)(?:\\s*\\[(NEW|MODIFIED|DEPRECATED)\\])?\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`,
      'i'
    );
    const ucMatch = updatedContent.match(ucPattern);

    if (ucMatch === null) {
      throw new UseCaseNotFoundError(useCaseId, parsedSRS.path);
    }

    let ucTitle = ucMatch[2]?.trim() ?? '';
    let ucBody = ucMatch[4] ?? '';

    for (const mod of modifications) {
      if (mod.field.toLowerCase() === 'title') {
        modifiedItems.push({
          id: useCaseId,
          field: 'title',
          oldValue: ucTitle,
          newValue: mod.newValue,
        });
        ucTitle = mod.newValue;
      } else if (mod.field.toLowerCase() === 'description') {
        const descPattern = /(\*\*Description\*\*:\s*)(.+?)(?=\n)/i;
        const descMatch = ucBody.match(descPattern);
        if (descMatch !== null) {
          modifiedItems.push({
            id: useCaseId,
            field: 'description',
            oldValue: descMatch[2] ?? '',
            newValue: mod.newValue,
          });
          ucBody = ucBody.replace(descPattern, `$1${mod.newValue}`);
        }
      } else if (mod.field.toLowerCase() === 'primary actor') {
        const actorPattern = /(\*\*Primary Actor\*\*:\s*)(.+?)(?=\n)/i;
        const actorMatch = ucBody.match(actorPattern);
        if (actorMatch !== null) {
          modifiedItems.push({
            id: useCaseId,
            field: 'Primary Actor',
            oldValue: actorMatch[2] ?? '',
            newValue: mod.newValue,
          });
          ucBody = ucBody.replace(actorPattern, `$1${mod.newValue}`);
        }
      } else {
        // Generic field modification
        const fieldPattern = new RegExp(`(\\*\\*${mod.field}\\*\\*:\\s*)(.+?)(?=\\n)`, 'i');
        const fieldMatch = ucBody.match(fieldPattern);
        if (fieldMatch !== null) {
          modifiedItems.push({
            id: useCaseId,
            field: mod.field,
            oldValue: fieldMatch[2] ?? '',
            newValue: mod.newValue,
          });
          ucBody = ucBody.replace(fieldPattern, `$1${mod.newValue}`);
        }
      }
    }

    // Add modified date if not present
    if (!ucBody.includes('**Modified**:')) {
      ucBody = ucBody.trimEnd() + `\n- **Modified**: ${today}\n`;
    } else {
      ucBody = ucBody.replace(/(\*\*Modified\*\*:\s*)[\d-]+/, `$1${today}`);
    }

    // Rebuild the use case section
    const ucHeader = ucMatch[1] ?? '';
    const updatedUC = `${ucHeader} ${ucTitle} [MODIFIED]\n${ucBody}`;
    updatedContent = updatedContent.replace(ucMatch[0], updatedUC);

    return {
      content: updatedContent,
      modified: modifiedItems,
    };
  }

  private updateInterface(
    content: string,
    interfaceName: string,
    changes: string
  ): { content: string; modified: ModifiedInterface } {
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find interface section
    const interfacePattern = new RegExp(
      `(## \\d+\\.\\s*(?:External\\s*)?Interfaces?[\\s\\S]*?)(?=\\n## \\d+\\.|$)`,
      'i'
    );
    const interfaceMatch = content.match(interfacePattern);

    let updatedContent = content;

    if (interfaceMatch !== null && interfaceMatch[1] !== undefined) {
      const sectionEnd = (interfaceMatch.index ?? 0) + interfaceMatch[1].length;
      const interfaceNote = `\n\n**Interface Update (${today})**: ${interfaceName}\n${changes}\n`;
      updatedContent = content.slice(0, sectionEnd) + interfaceNote + content.slice(sectionEnd);
    } else {
      // Add interface section if not found
      updatedContent += `\n\n## External Interfaces\n\n**Interface Update (${today})**: ${interfaceName}\n${changes}\n`;
    }

    return {
      content: updatedContent,
      modified: {
        name: interfaceName,
        changes,
      },
    };
  }

  private updateTraceability(
    content: string,
    updates: readonly TraceabilityEntry[]
  ): { content: string } {
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find traceability matrix section
    const matrixPattern =
      /(## \d+\.?\s*(?:PRD→SRS\s*)?Traceability(?:\s+Matrix)?[\s\S]*?)(?=\n## \d+\.|$)/i;
    const matrixMatch = content.match(matrixPattern);

    let updatedContent = content;

    if (matrixMatch !== null && matrixMatch[1] !== undefined) {
      let matrixSection = matrixMatch[1];

      for (const update of updates) {
        // Check if PRD ID already exists in matrix
        const rowPattern = new RegExp(`\\|\\s*${update.prdId}\\s*\\|\\s*([^|]+)\\|`, 'i');
        const rowMatch = matrixSection.match(rowPattern);

        if (rowMatch !== null) {
          // Update existing row
          const existingSrsIds = rowMatch[1]?.trim() ?? '';
          const newSrsIds = [...new Set([...existingSrsIds.split(/[,;]\s*/), ...update.srsIds])];
          matrixSection = matrixSection.replace(
            rowPattern,
            `| ${update.prdId} | ${newSrsIds.join(', ')} |`
          );
        } else {
          // Add new row to table
          const tableEndPattern = /(\|[^|]+\|[^|]+\|)\s*$/;
          const tableEnd = matrixSection.match(tableEndPattern);
          if (tableEnd !== null) {
            matrixSection += `\n| ${update.prdId} | ${update.srsIds.join(', ')} |`;
          }
        }
      }

      // Add update note
      matrixSection += `\n\n*Traceability matrix updated: ${today}*`;
      updatedContent = content.replace(matrixMatch[1], matrixSection);
    } else {
      // Create new traceability matrix section
      let newSection = `\n\n## PRD→SRS Traceability Matrix\n\n`;
      newSection += `| PRD ID | SRS IDs |\n`;
      newSection += `|--------|--------|\n`;
      for (const update of updates) {
        newSection += `| ${update.prdId} | ${update.srsIds.join(', ')} |\n`;
      }
      newSection += `\n*Traceability matrix created: ${today}*`;
      updatedContent += newSection;
    }

    return { content: updatedContent };
  }

  private calculateNewVersion(currentVersion: string, changes: SRSUpdateChanges): string {
    const parts = currentVersion.split('.');
    const major = parseInt(parts[0] ?? '1', 10);
    let minor = parseInt(parts[1] ?? '0', 10);
    let patch = parseInt(parts[2] ?? '0', 10);

    const hasFeaturesAdded = changes.featuresAdded.length > 0;
    const hasInterfaceChanges = changes.interfacesModified.length > 0;
    const hasUseCasesAdded = changes.useCasesAdded.length > 0;
    const hasModifications =
      changes.featuresModified.length > 0 || changes.useCasesModified.length > 0;

    if (hasFeaturesAdded || hasInterfaceChanges) {
      // Minor version bump for new features or interface changes
      minor += 1;
      patch = 0;
    } else if (hasUseCasesAdded || hasModifications) {
      // Patch version bump for use cases or modifications
      patch += 1;
    }

    return `${String(major)}.${String(minor)}.${String(patch)}`;
  }

  private updateVersionInContent(content: string, _oldVersion: string, newVersion: string): string {
    // Update in metadata table
    const tablePattern = /(\|\s*Version\s*\|\s*)([^|]+)(\|)/i;
    let updated = content.replace(tablePattern, `$1${newVersion} $3`);

    // Also update in frontmatter if present
    const frontmatterPattern = /(version:\s*)["']?[\d.]+["']?/i;
    updated = updated.replace(frontmatterPattern, `$1"${newVersion}"`);

    return updated;
  }

  private updateLastUpdatedDate(content: string): string {
    const today = new Date().toISOString().split('T')[0] ?? '';
    const pattern = /(\|\s*Last Updated\s*\|\s*)([^|]+)(\|)/i;
    return content.replace(pattern, `$1${today} $3`);
  }

  private runConsistencyCheck(content: string, _parsedSRS: ParsedSRS): ConsistencyCheckResult {
    const issues: string[] = [];

    // Check for duplicate feature IDs (only definition headers, not references)
    const sfDefPattern = /### (SF-\d{3}):/g;
    const ucDefPattern = /### (UC-\d{3}):/g;

    const sfIds: string[] = [];
    const ucIds: string[] = [];

    let match;
    while ((match = sfDefPattern.exec(content)) !== null) {
      if (match[1] !== undefined) {
        sfIds.push(match[1]);
      }
    }
    while ((match = ucDefPattern.exec(content)) !== null) {
      if (match[1] !== undefined) {
        ucIds.push(match[1]);
      }
    }

    const sfDuplicates = sfIds.filter((id, index) => sfIds.indexOf(id) !== index);
    const ucDuplicates = ucIds.filter((id, index) => ucIds.indexOf(id) !== index);

    if (sfDuplicates.length > 0) {
      issues.push(`Duplicate feature IDs found: ${[...new Set(sfDuplicates)].join(', ')}`);
    }
    if (ucDuplicates.length > 0) {
      issues.push(`Duplicate use case IDs found: ${[...new Set(ucDuplicates)].join(', ')}`);
    }

    // Check for features without priority
    const featurePattern = /### SF-\d{3}:[\s\S]*?(?=\n#{2,3}\s|$)/gi;
    while ((match = featurePattern.exec(content)) !== null) {
      if (!match[0].includes('**Priority**:')) {
        const idMatch = match[0].match(/(SF-\d{3})/);
        if (idMatch !== null && idMatch[1] !== undefined) {
          issues.push(`Feature ${idMatch[1]} is missing priority`);
        }
      }
    }

    // Check for use cases without feature link
    const useCasePattern = /### UC-\d{3}:[\s\S]*?(?=\n#{2,3}\s|$)/gi;
    while ((match = useCasePattern.exec(content)) !== null) {
      if (!match[0].includes('**Feature**:')) {
        const idMatch = match[0].match(/(UC-\d{3})/);
        if (idMatch !== null && idMatch[1] !== undefined) {
          issues.push(`Use case ${idMatch[1]} is missing feature link`);
        }
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }

  private generateChangelogEntry(version: string, changes: SRSUpdateChanges): string {
    const today = new Date().toISOString().split('T')[0] ?? '';
    let entry = `## [${version}] - ${today}\n\n`;

    if (changes.featuresAdded.length > 0) {
      entry += '### Features Added\n';
      for (const added of changes.featuresAdded) {
        entry += `- ${added.id}: ${added.title}`;
        if (added.linkedPrd !== '') {
          entry += ` (linked to ${added.linkedPrd})`;
        }
        entry += '\n';
      }
      entry += '\n';
    }

    if (changes.useCasesAdded.length > 0) {
      entry += '### Use Cases Added\n';
      for (const added of changes.useCasesAdded) {
        entry += `- ${added.id}: ${added.title} (${added.feature})\n`;
      }
      entry += '\n';
    }

    if (changes.featuresModified.length > 0) {
      entry += '### Features Modified\n';
      for (const modified of changes.featuresModified) {
        entry += `- ${modified.id}: ${modified.field} changed from "${modified.oldValue}" to "${modified.newValue}"\n`;
      }
      entry += '\n';
    }

    if (changes.useCasesModified.length > 0) {
      entry += '### Use Cases Modified\n';
      for (const modified of changes.useCasesModified) {
        entry += `- ${modified.id}: ${modified.field} changed from "${modified.oldValue}" to "${modified.newValue}"\n`;
      }
      entry += '\n';
    }

    if (changes.interfacesModified.length > 0) {
      entry += '### Interfaces Modified\n';
      for (const modified of changes.interfacesModified) {
        entry += `- ${modified.name}: ${modified.changes}\n`;
      }
      entry += '\n';
    }

    return entry;
  }

  private async writeUpdatedSRS(srsPath: string, content: string): Promise<void> {
    try {
      await fs.writeFile(srsPath, content, 'utf-8');
    } catch (error) {
      throw new SRSOutputWriteError(
        srsPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async writeChangelog(projectId: string, updateResult: SRSUpdateResult): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const changelogPath = path.join(outputDir, 'srs_changelog.md');

    try {
      await fs.mkdir(outputDir, { recursive: true });

      // Read existing changelog or create new
      let existingContent = '';
      try {
        existingContent = await fs.readFile(changelogPath, 'utf-8');
      } catch {
        existingContent = '# SRS Changelog\n\nAll notable changes to the SRS document.\n\n';
      }

      // Insert new entry after header
      const headerEnd = existingContent.indexOf('\n\n', existingContent.indexOf('# SRS Changelog'));
      const newContent =
        existingContent.slice(0, headerEnd + 2) +
        updateResult.changelogEntry +
        existingContent.slice(headerEnd + 2);

      await fs.writeFile(changelogPath, newContent, 'utf-8');
      return changelogPath;
    } catch (error) {
      throw new SRSOutputWriteError(
        changelogPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async writeUpdateResult(
    projectId: string,
    updateResult: SRSUpdateResult
  ): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const resultPath = path.join(outputDir, 'srs_update_result.yaml');

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
        update_result: {
          document: updateResult.document,
          version_before: updateResult.versionBefore,
          version_after: updateResult.versionAfter,
          updated_at: updateResult.updatedAt,
          changes: {
            features_added: updateResult.changes.featuresAdded,
            use_cases_added: updateResult.changes.useCasesAdded,
            features_modified: updateResult.changes.featuresModified,
            use_cases_modified: updateResult.changes.useCasesModified,
            interfaces_modified: updateResult.changes.interfacesModified,
          },
          traceability_updates: updateResult.traceabilityUpdates,
          consistency_check: {
            passed: updateResult.consistencyCheck.passed,
            issues: updateResult.consistencyCheck.issues,
          },
          changelog_entry: updateResult.changelogEntry,
        },
      });

      await fs.writeFile(resultPath, yamlContent, 'utf-8');
      return resultPath;
    } catch (error) {
      throw new SRSOutputWriteError(
        resultPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// ============ Singleton Pattern ============

let globalSRSUpdaterAgent: SRSUpdaterAgent | null = null;

/**
 * Get the global SRS Updater Agent instance
 */
export function getSRSUpdaterAgent(config?: SRSUpdaterConfig): SRSUpdaterAgent {
  if (globalSRSUpdaterAgent === null) {
    globalSRSUpdaterAgent = new SRSUpdaterAgent(config);
  }
  return globalSRSUpdaterAgent;
}

/**
 * Reset the global SRS Updater Agent instance
 */
export function resetSRSUpdaterAgent(): void {
  if (globalSRSUpdaterAgent !== null) {
    globalSRSUpdaterAgent.reset();
    globalSRSUpdaterAgent = null;
  }
}
