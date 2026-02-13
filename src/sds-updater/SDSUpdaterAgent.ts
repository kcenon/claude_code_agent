/**
 * SDS Updater Agent
 *
 * Performs incremental updates to existing SDS documents instead of full rewrites.
 * Supports adding components and APIs, modifying existing items, updating
 * data models, architecture changes, and maintaining SRS→SDS traceability.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { IAgent } from '../agents/types.js';
import type {
  AddedComponent,
  AddedAPI,
  ArchitectureChange,
  ArchitectureModification,
  ComponentStatus,
  ComponentType,
  ConsistencyCheckResult,
  DataModelChange,
  DataModelUpdate,
  DocumentSection,
  ItemModification,
  ModifiedComponent,
  ModifiedAPI,
  NewComponent,
  NewAPI,
  ParsedComponent,
  ParsedAPI,
  ParsedSDS,
  SDSChangeRequest,
  SDSDocumentMetadata,
  SDSTraceabilityEntry,
  SDSUpdateChanges,
  SDSUpdateOperationResult,
  SDSUpdaterConfig,
  SDSUpdaterSession,
  SDSUpdateResult,
} from './types.js';
import { DEFAULT_SDS_UPDATER_CONFIG } from './types.js';
import {
  APINotFoundError,
  ComponentNotFoundError,
  DuplicateAPIError,
  DuplicateComponentError,
  InvalidSDSChangeRequestError,
  NoActiveSDSSessionError,
  SDSDocumentParseError,
  SDSFileSizeLimitError,
  SDSNotFoundError,
  SDSNotLoadedError,
  SDSOutputWriteError,
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
 * Agent ID for SDSUpdaterAgent used in AgentFactory
 */
export const SDS_UPDATER_AGENT_ID = 'sds-updater-agent';

/**
 * SDS Updater Agent class
 *
 * Responsible for:
 * - Loading and parsing existing SDS documents
 * - Adding new components
 * - Adding new API endpoints
 * - Modifying existing components/APIs
 * - Updating data models
 * - Managing architecture changes
 * - Maintaining SRS→SDS traceability matrix
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class SDSUpdaterAgent implements IAgent {
  public readonly agentId = SDS_UPDATER_AGENT_ID;
  public readonly name = 'SDS Updater Agent';

  private readonly config: Required<SDSUpdaterConfig>;
  private session: SDSUpdaterSession | null = null;
  private initialized = false;

  constructor(config: SDSUpdaterConfig = {}) {
    this.config = { ...DEFAULT_SDS_UPDATER_CONFIG, ...config };
  }

  /**
   *
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await loadYaml();
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
   * Start a new SDS update session
   * @param projectId
   */
  public async startSession(projectId: string): Promise<SDSUpdaterSession> {
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
   * Load an existing SDS document for updating
   * @param sdsPath
   */
  public async loadSDS(sdsPath?: string): Promise<ParsedSDS> {
    const session = this.ensureSession();

    // Update session status
    this.session = { ...session, status: 'loading', updatedAt: new Date().toISOString() };

    try {
      // Find SDS file
      const resolvedPath = sdsPath ?? (await this.findSDSFile(session.projectId));

      // Check file exists and size
      await this.validateFile(resolvedPath);

      // Read and parse SDS
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const stats = await fs.stat(resolvedPath);

      const parsedSDS = this.parseSDS(resolvedPath, content, stats.mtime.toISOString());

      // Update session
      this.session = {
        ...this.session,
        sdsPath: resolvedPath,
        parsedSDS,
        updatedAt: new Date().toISOString(),
      };

      return parsedSDS;
    } catch (error) {
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
   * Apply a change request to the loaded SDS
   * @param changeRequest
   */
  public async applyChange(changeRequest: SDSChangeRequest): Promise<SDSUpdateOperationResult> {
    const session = this.ensureSession();
    const parsedSDS = this.ensureSDSLoaded();

    // Validate change request
    this.validateChangeRequest(changeRequest);

    // Update session status
    this.session = { ...session, status: 'updating', updatedAt: new Date().toISOString() };

    try {
      const changes: {
        componentsAdded: AddedComponent[];
        apisAdded: AddedAPI[];
        componentsModified: ModifiedComponent[];
        apisModified: ModifiedAPI[];
        dataModelsChanged: DataModelChange[];
        architectureChanges: ArchitectureModification[];
      } = {
        componentsAdded: [],
        apisAdded: [],
        componentsModified: [],
        apisModified: [],
        dataModelsChanged: [],
        architectureChanges: [],
      };

      const traceabilityUpdates: SDSTraceabilityEntry[] = [];

      let updatedContent = parsedSDS.rawContent;
      const versionBefore = parsedSDS.metadata.version;

      // Apply the change based on type
      switch (changeRequest.type) {
        case 'add_component': {
          if (changeRequest.newComponent === undefined) {
            throw new InvalidSDSChangeRequestError('newComponent', 'Required for add_component');
          }
          const result = this.addComponent(updatedContent, changeRequest.newComponent, parsedSDS);
          updatedContent = result.content;
          changes.componentsAdded.push(result.added);
          if (changeRequest.newComponent.linkedSrsIds.length > 0) {
            for (const srsId of changeRequest.newComponent.linkedSrsIds) {
              traceabilityUpdates.push({
                srsId,
                sdsIds: [result.added.id],
              });
            }
          }
          break;
        }
        case 'add_api': {
          if (changeRequest.newAPI === undefined) {
            throw new InvalidSDSChangeRequestError('newAPI', 'Required for add_api');
          }
          const result = this.addAPI(updatedContent, changeRequest.newAPI, parsedSDS);
          updatedContent = result.content;
          changes.apisAdded.push(result.added);
          break;
        }
        case 'modify_component': {
          if (changeRequest.itemId === undefined) {
            throw new InvalidSDSChangeRequestError('itemId', 'Required for modify_component');
          }
          if (
            changeRequest.modifications === undefined ||
            changeRequest.modifications.length === 0
          ) {
            throw new InvalidSDSChangeRequestError(
              'modifications',
              'Required for modify_component'
            );
          }
          const result = this.modifyComponent(
            updatedContent,
            changeRequest.itemId,
            changeRequest.modifications,
            parsedSDS
          );
          updatedContent = result.content;
          changes.componentsModified.push(...result.modified);
          break;
        }
        case 'modify_api': {
          if (changeRequest.itemId === undefined) {
            throw new InvalidSDSChangeRequestError('itemId', 'Required for modify_api');
          }
          if (
            changeRequest.modifications === undefined ||
            changeRequest.modifications.length === 0
          ) {
            throw new InvalidSDSChangeRequestError('modifications', 'Required for modify_api');
          }
          const result = this.modifyAPI(
            updatedContent,
            changeRequest.itemId,
            changeRequest.modifications,
            parsedSDS
          );
          updatedContent = result.content;
          changes.apisModified.push(...result.modified);
          break;
        }
        case 'update_data_model': {
          if (changeRequest.dataModelUpdate === undefined) {
            throw new InvalidSDSChangeRequestError(
              'dataModelUpdate',
              'Required for update_data_model'
            );
          }
          const result = this.updateDataModel(updatedContent, changeRequest.dataModelUpdate);
          updatedContent = result.content;
          changes.dataModelsChanged.push(...result.changes);
          break;
        }
        case 'update_architecture': {
          if (changeRequest.architectureChange === undefined) {
            throw new InvalidSDSChangeRequestError(
              'architectureChange',
              'Required for update_architecture'
            );
          }
          const result = this.updateArchitecture(updatedContent, changeRequest.architectureChange);
          updatedContent = result.content;
          changes.architectureChanges.push(result.change);
          break;
        }
        case 'update_traceability': {
          if (
            changeRequest.traceabilityUpdates === undefined ||
            changeRequest.traceabilityUpdates.length === 0
          ) {
            throw new InvalidSDSChangeRequestError(
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
      const consistencyCheck = this.runConsistencyCheck(updatedContent, parsedSDS);

      // Build update result
      const updateResult: SDSUpdateResult = {
        document: parsedSDS.metadata.id ?? path.basename(parsedSDS.path, '.md'),
        versionBefore,
        versionAfter,
        updatedAt: new Date().toISOString(),
        changes,
        traceabilityUpdates,
        consistencyCheck,
        changelogEntry: this.generateChangelogEntry(versionAfter, changes),
      };

      // Write outputs
      const sdsPath = session.sdsPath ?? parsedSDS.path;
      await this.writeUpdatedSDS(sdsPath, updatedContent);

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
        sdsPath,
        outputPath: resultPath,
        changelogPath,
        updateResult,
        warnings: this.session.warnings,
      };
    } catch (error) {
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
  public getSession(): SDSUpdaterSession | null {
    return this.session;
  }

  /**
   * Reset the agent state
   */
  public reset(): void {
    this.session = null;
  }

  // ============ Private Helper Methods ============

  private ensureSession(): SDSUpdaterSession {
    if (this.session === null) {
      throw new NoActiveSDSSessionError();
    }
    return this.session;
  }

  private ensureSDSLoaded(): ParsedSDS {
    const session = this.ensureSession();
    if (session.parsedSDS === undefined) {
      throw new SDSNotLoadedError();
    }
    return session.parsedSDS;
  }

  private async findSDSFile(projectId: string): Promise<string> {
    const sdsDir = path.join(this.config.docsBasePath, this.config.sdsSubdir);

    try {
      await fs.access(sdsDir);
    } catch {
      throw new SDSNotFoundError(sdsDir);
    }

    const files = await fs.readdir(sdsDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    // Try to find by project ID first
    const matchingFile = mdFiles.find(
      (f) => f.toLowerCase().includes(projectId.toLowerCase()) || f.includes('SDS')
    );

    if (matchingFile !== undefined) {
      return path.join(sdsDir, matchingFile);
    }

    // Fall back to first .md file
    if (mdFiles.length > 0 && mdFiles[0] !== undefined) {
      return path.join(sdsDir, mdFiles[0]);
    }

    throw new SDSNotFoundError(sdsDir);
  }

  private async validateFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      throw new SDSNotFoundError(filePath);
    }

    const stats = await fs.stat(filePath);
    if (stats.size > this.config.maxFileSize) {
      throw new SDSFileSizeLimitError(filePath, stats.size, this.config.maxFileSize);
    }
  }

  private parseSDS(filePath: string, content: string, lastModified: string): ParsedSDS {
    try {
      const metadata = this.extractMetadata(content, filePath);
      const sections = this.parseSections(content);
      const components = this.extractComponents(content);
      const apis = this.extractAPIs(content);
      const traceabilityMatrix = this.extractTraceabilityMatrix(content);

      return {
        path: filePath,
        metadata,
        rawContent: content,
        components,
        apis,
        sections,
        traceabilityMatrix,
        lastModified,
      };
    } catch (error) {
      throw new SDSDocumentParseError(
        filePath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private extractMetadata(content: string, filePath: string): SDSDocumentMetadata {
    const lines = content.split('\n');
    let title = path.basename(filePath, '.md');
    let version = '1.0.0';
    let status: string | undefined;
    let id: string | undefined;
    let sourceSrs: string | undefined;
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

    const srsMatch = content.match(/\|\s*Source SRS\s*\|\s*([^|]+)\|/i);
    if (srsMatch?.[1] !== undefined) {
      sourceSrs = srsMatch[1].trim();
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
    const headingMatch = content.match(/^#\s+(?:SDS:\s*)?(.+?)(?:\s*\n|$)/m);
    if (headingMatch?.[1] !== undefined) {
      title = headingMatch[1].trim();
    }

    return {
      title,
      version,
      ...(id !== undefined && { id }),
      ...(sourceSrs !== undefined && { sourceSrs }),
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

  private extractComponents(content: string): ParsedComponent[] {
    const components: ParsedComponent[] = [];

    // Extract components (CMP-XXX pattern)
    const cmpPattern =
      /###\s*(CMP-\d{3}):\s*(.+?)(?:\s*\[(NEW|MODIFIED|DEPRECATED)\])?\s*\n([\s\S]*?)(?=\n###\s|$)/gi;
    let match;

    while ((match = cmpPattern.exec(content)) !== null) {
      const id = match[1] ?? '';
      const name = match[2]?.trim() ?? '';
      const statusTag = match[3]?.toUpperCase();
      const sectionContent = match[4] ?? '';

      if (id === '' || name === '') continue;

      const lineNumber = content.slice(0, match.index).split('\n').length;

      components.push({
        id,
        name,
        description: this.extractField(sectionContent, 'Responsibility') ?? name,
        type: this.extractComponentType(sectionContent),
        status: this.parseStatus(statusTag),
        linkedSrsIds: this.extractLinkedSrsIds(sectionContent),
        notes: this.extractField(sectionContent, 'Notes'),
        lineNumber,
        rawContent: match[0],
      });
    }

    return components;
  }

  private extractAPIs(content: string): ParsedAPI[] {
    const apis: ParsedAPI[] = [];

    // Extract API endpoints (e.g., "#### GET /api/v1/resource" or "#### POST /api/v1/resource")
    const apiPattern =
      /####\s*(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s]+)(?:\s*\[(NEW|MODIFIED|DEPRECATED)\])?\s*\n([\s\S]*?)(?=\n####\s|$)/gi;
    let match;

    while ((match = apiPattern.exec(content)) !== null) {
      const method = match[1] ?? 'GET';
      const endpoint = match[2] ?? '';
      const statusTag = match[3]?.toUpperCase();
      const sectionContent = match[4] ?? '';

      if (endpoint === '') continue;

      const lineNumber = content.slice(0, match.index).split('\n').length;

      apis.push({
        endpoint,
        method,
        componentId: this.extractField(sectionContent, 'Component') ?? '',
        linkedUseCase: this.extractField(sectionContent, 'Source Use Case'),
        status: this.parseStatus(statusTag),
        authentication: this.extractField(sectionContent, 'Authentication'),
        notes: this.extractField(sectionContent, 'Notes'),
        lineNumber,
        rawContent: match[0],
      });
    }

    return apis;
  }

  private extractTraceabilityMatrix(content: string): SDSTraceabilityEntry[] {
    const entries: SDSTraceabilityEntry[] = [];

    // Look for traceability matrix section
    const matrixPattern =
      /##\s*\d*\.?\s*(?:SRS→SDS\s*)?Traceability(?:\s+Matrix)?\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i;
    const matrixMatch = content.match(matrixPattern);

    if (matrixMatch?.[1] !== undefined) {
      const matrixContent = matrixMatch[1];

      // Parse table rows (| SRS Feature | SDS Components |)
      const rowPattern = /\|\s*(SF-\d{3}|UC-\d{3})\s*\|\s*([^|]+)\|/gi;
      let rowMatch;

      while ((rowMatch = rowPattern.exec(matrixContent)) !== null) {
        const srsId = rowMatch[1] ?? '';
        const sdsIdsStr = rowMatch[2] ?? '';

        if (srsId !== '') {
          const sdsIds = sdsIdsStr
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter((s) => s.match(/^CMP-\d{3}$/));

          if (sdsIds.length > 0) {
            entries.push({ srsId, sdsIds });
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

  private extractLinkedSrsIds(content: string): string[] {
    const ids: string[] = [];

    // Look for Source Features field
    const linkedMatch = content.match(/\*\*Source Features\*\*:\s*(.+?)(?:\n|$)/i);
    if (linkedMatch?.[1] !== undefined) {
      const idsStr = linkedMatch[1];
      const idPattern = /(SF-\d{3}|UC-\d{3})/g;
      let idMatch;
      while ((idMatch = idPattern.exec(idsStr)) !== null) {
        if (idMatch[1] !== undefined) {
          ids.push(idMatch[1]);
        }
      }
    }

    return ids;
  }

  private extractComponentType(content: string): ComponentType {
    const match = content.match(
      /\*\*Type\*\*:\s*(service|controller|repository|utility|middleware)/i
    );
    if (match?.[1] !== undefined) {
      return match[1].toLowerCase() as ComponentType;
    }
    return 'service';
  }

  private parseStatus(statusTag: string | undefined): ComponentStatus {
    if (statusTag === 'DEPRECATED') return 'deprecated';
    if (statusTag === 'NEW') return 'pending';
    return 'active';
  }

  private validateChangeRequest(changeRequest: SDSChangeRequest): void {
    if (changeRequest.type === 'add_component' && changeRequest.newComponent === undefined) {
      throw new InvalidSDSChangeRequestError('newComponent', 'Required for add_component type');
    }
    if (changeRequest.type === 'add_api' && changeRequest.newAPI === undefined) {
      throw new InvalidSDSChangeRequestError('newAPI', 'Required for add_api type');
    }
    if (changeRequest.type === 'modify_component') {
      if (changeRequest.itemId === undefined) {
        throw new InvalidSDSChangeRequestError('itemId', 'Required for modify_component type');
      }
      if (changeRequest.modifications === undefined || changeRequest.modifications.length === 0) {
        throw new InvalidSDSChangeRequestError(
          'modifications',
          'At least one modification required'
        );
      }
    }
    if (changeRequest.type === 'modify_api') {
      if (changeRequest.itemId === undefined) {
        throw new InvalidSDSChangeRequestError('itemId', 'Required for modify_api type');
      }
      if (changeRequest.modifications === undefined || changeRequest.modifications.length === 0) {
        throw new InvalidSDSChangeRequestError(
          'modifications',
          'At least one modification required'
        );
      }
    }
    if (changeRequest.type === 'update_data_model' && changeRequest.dataModelUpdate === undefined) {
      throw new InvalidSDSChangeRequestError(
        'dataModelUpdate',
        'Required for update_data_model type'
      );
    }
    if (
      changeRequest.type === 'update_architecture' &&
      changeRequest.architectureChange === undefined
    ) {
      throw new InvalidSDSChangeRequestError(
        'architectureChange',
        'Required for update_architecture type'
      );
    }
    if (changeRequest.type === 'update_traceability') {
      if (
        changeRequest.traceabilityUpdates === undefined ||
        changeRequest.traceabilityUpdates.length === 0
      ) {
        throw new InvalidSDSChangeRequestError(
          'traceabilityUpdates',
          'At least one traceability update required'
        );
      }
    }
  }

  private addComponent(
    content: string,
    newComponent: NewComponent,
    parsedSDS: ParsedSDS
  ): { content: string; added: AddedComponent } {
    // Generate new ID
    const existingIds = parsedSDS.components.map((c) => parseInt(c.id.split('-')[1] ?? '0', 10));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const newId = `CMP-${String(maxId + 1).padStart(3, '0')}`;

    // Check for duplicate
    if (parsedSDS.components.some((c) => c.id === newId)) {
      throw new DuplicateComponentError(newId);
    }

    // Find the section to add to
    const sectionTitle = 'Component Design';
    const sectionPattern = new RegExp(
      `(## \\d+\\.\\s*${sectionTitle}[\\s\\S]*?)(?=\\n## \\d+\\.|$)`,
      'i'
    );
    const sectionMatch = content.match(sectionPattern);

    // Build new component markdown
    const today = new Date().toISOString().split('T')[0] ?? '';
    let componentMarkdown = `\n### ${newId}: ${newComponent.name} [NEW]\n`;
    componentMarkdown += `**Source Features**: ${newComponent.linkedSrsIds.join(', ')}\n`;
    componentMarkdown += `**Type**: ${newComponent.type}\n`;
    componentMarkdown += `**Responsibility**: ${newComponent.description}\n`;
    componentMarkdown += `**Added**: ${today}\n`;

    if (
      newComponent.interfaces?.provided !== undefined &&
      newComponent.interfaces.provided.length > 0
    ) {
      componentMarkdown += `\n#### Interface Definition\n`;
      componentMarkdown += '```typescript\n';
      for (const iface of newComponent.interfaces.provided) {
        componentMarkdown += `interface ${iface.name} {\n`;
        for (const method of iface.methods) {
          const params = method.parameters.join(', ');
          const asyncKeyword = method.async ? 'Promise<' : '';
          const asyncClose = method.async ? '>' : '';
          componentMarkdown += `  ${method.name}(${params}): ${asyncKeyword}${method.returnType}${asyncClose};\n`;
        }
        componentMarkdown += '}\n';
      }
      componentMarkdown += '```\n';
    }

    if (
      newComponent.dependencies?.internal !== undefined &&
      newComponent.dependencies.internal.length > 0
    ) {
      componentMarkdown += `\n#### Dependencies\n`;
      componentMarkdown += `- Internal: ${newComponent.dependencies.internal.map((d) => d.componentId).join(', ')}\n`;
    }

    if (
      newComponent.dependencies?.external !== undefined &&
      newComponent.dependencies.external.length > 0
    ) {
      componentMarkdown += `- External: ${newComponent.dependencies.external.map((d) => `${d.name}@${d.version}`).join(', ')}\n`;
    }

    if (newComponent.notes !== undefined) {
      componentMarkdown += `\n**Notes**: ${newComponent.notes}\n`;
    }

    let updatedContent: string;
    let lineNumber: number;

    if (sectionMatch !== null && sectionMatch[1] !== undefined) {
      // Insert at end of section
      const sectionEnd = (sectionMatch.index ?? 0) + sectionMatch[1].length;
      updatedContent = content.slice(0, sectionEnd) + componentMarkdown + content.slice(sectionEnd);
      lineNumber = content.slice(0, sectionEnd).split('\n').length + 1;
    } else {
      // Append at end
      updatedContent = content + componentMarkdown;
      lineNumber = content.split('\n').length + 1;
    }

    return {
      content: updatedContent,
      added: {
        id: newId,
        name: newComponent.name,
        linkedSrs: newComponent.linkedSrsIds[0] ?? '',
        lineNumber,
      },
    };
  }

  private addAPI(
    content: string,
    newAPI: NewAPI,
    parsedSDS: ParsedSDS
  ): { content: string; added: AddedAPI } {
    // Check for duplicate
    const existingEndpoint = parsedSDS.apis.find(
      (a) => a.endpoint === newAPI.endpoint && a.method === (newAPI.method ?? 'GET')
    );
    if (existingEndpoint !== undefined) {
      throw new DuplicateAPIError(`${newAPI.method ?? 'GET'} ${newAPI.endpoint}`);
    }

    // Find the section to add to
    const sectionTitle = 'Interface Design';
    const sectionPattern = new RegExp(
      `(## \\d+\\.\\s*${sectionTitle}[\\s\\S]*?)(?=\\n## \\d+\\.|$)`,
      'i'
    );
    const sectionMatch = content.match(sectionPattern);

    // Build new API markdown
    const today = new Date().toISOString().split('T')[0] ?? '';
    const method = newAPI.method ?? 'POST';
    let apiMarkdown = `\n#### ${method} ${newAPI.endpoint} [NEW]\n`;
    if (newAPI.linkedUseCase !== undefined) {
      apiMarkdown += `**Source Use Case**: ${newAPI.linkedUseCase}\n`;
    }
    apiMarkdown += `**Component**: ${newAPI.componentId}\n`;
    apiMarkdown += `**Added**: ${today}\n`;

    if (newAPI.requestSchema !== undefined) {
      apiMarkdown += `\n**Request**:\n`;
      apiMarkdown += '```json\n';
      apiMarkdown += JSON.stringify(newAPI.requestSchema, null, 2);
      apiMarkdown += '\n```\n';
    }

    if (newAPI.responseSchema !== undefined) {
      apiMarkdown += `\n**Response** (200 OK):\n`;
      apiMarkdown += '```json\n';
      apiMarkdown += JSON.stringify(newAPI.responseSchema, null, 2);
      apiMarkdown += '\n```\n';
    }

    if (newAPI.errorResponses !== undefined && newAPI.errorResponses.length > 0) {
      apiMarkdown += `\n**Error Responses**:\n`;
      apiMarkdown += `| Code | Condition | Response |\n`;
      apiMarkdown += `|------|-----------|----------|\n`;
      for (const err of newAPI.errorResponses) {
        apiMarkdown += `| ${String(err.code)} | ${err.condition} | ${err.response} |\n`;
      }
    }

    if (newAPI.authentication !== undefined) {
      apiMarkdown += `\n**Authentication**: ${newAPI.authentication}\n`;
    }

    if (newAPI.notes !== undefined) {
      apiMarkdown += `**Notes**: ${newAPI.notes}\n`;
    }

    let updatedContent: string;
    let lineNumber: number;

    if (sectionMatch !== null && sectionMatch[1] !== undefined) {
      // Insert at end of section
      const sectionEnd = (sectionMatch.index ?? 0) + sectionMatch[1].length;
      updatedContent = content.slice(0, sectionEnd) + apiMarkdown + content.slice(sectionEnd);
      lineNumber = content.slice(0, sectionEnd).split('\n').length + 1;
    } else {
      // Append at end
      updatedContent = content + apiMarkdown;
      lineNumber = content.split('\n').length + 1;
    }

    return {
      content: updatedContent,
      added: {
        endpoint: `${method} ${newAPI.endpoint}`,
        component: newAPI.componentId,
        useCase: newAPI.linkedUseCase,
        lineNumber,
      },
    };
  }

  private modifyComponent(
    content: string,
    componentId: string,
    modifications: readonly ItemModification[],
    parsedSDS: ParsedSDS
  ): { content: string; modified: ModifiedComponent[] } {
    const component = parsedSDS.components.find((c) => c.id === componentId);
    if (component === undefined) {
      throw new ComponentNotFoundError(componentId, parsedSDS.path);
    }

    let updatedContent = content;
    const modifiedItems: ModifiedComponent[] = [];
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find the component section
    const componentPattern = new RegExp(
      `(### ${componentId}:)\\s*(.+?)(?:\\s*\\[(NEW|MODIFIED|DEPRECATED)\\])?\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`,
      'i'
    );
    const componentMatch = updatedContent.match(componentPattern);

    if (componentMatch === null) {
      throw new ComponentNotFoundError(componentId, parsedSDS.path);
    }

    let componentName = componentMatch[2]?.trim() ?? '';
    let componentBody = componentMatch[4] ?? '';

    for (const mod of modifications) {
      if (mod.field.toLowerCase() === 'name') {
        modifiedItems.push({
          id: componentId,
          field: 'name',
          oldValue: componentName,
          newValue: mod.newValue,
        });
        componentName = mod.newValue;
      } else if (mod.field.toLowerCase() === 'type') {
        const typePattern = /(\*\*Type\*\*:\s*)(service|controller|repository|utility|middleware)/i;
        const typeMatch = componentBody.match(typePattern);
        if (typeMatch !== null) {
          modifiedItems.push({
            id: componentId,
            field: 'type',
            oldValue: typeMatch[2] ?? '',
            newValue: mod.newValue,
          });
          componentBody = componentBody.replace(typePattern, `$1${mod.newValue}`);
        }
      } else if (mod.field.toLowerCase() === 'responsibility') {
        const respPattern = /(\*\*Responsibility\*\*:\s*)(.+?)(?=\n)/i;
        const respMatch = componentBody.match(respPattern);
        if (respMatch !== null) {
          modifiedItems.push({
            id: componentId,
            field: 'responsibility',
            oldValue: respMatch[2] ?? '',
            newValue: mod.newValue,
          });
          componentBody = componentBody.replace(respPattern, `$1${mod.newValue}`);
        }
      } else {
        // Generic field modification
        const fieldPattern = new RegExp(`(\\*\\*${mod.field}\\*\\*:\\s*)(.+?)(?=\\n)`, 'i');
        const fieldMatch = componentBody.match(fieldPattern);
        if (fieldMatch !== null) {
          modifiedItems.push({
            id: componentId,
            field: mod.field,
            oldValue: fieldMatch[2] ?? '',
            newValue: mod.newValue,
          });
          componentBody = componentBody.replace(fieldPattern, `$1${mod.newValue}`);
        }
      }
    }

    // Add modified date if not present
    if (!componentBody.includes('**Modified**:')) {
      componentBody = componentBody.trimEnd() + `\n**Modified**: ${today}\n`;
    } else {
      componentBody = componentBody.replace(/(\*\*Modified\*\*:\s*)[\d-]+/, `$1${today}`);
    }

    // Rebuild the component section
    const componentHeader = componentMatch[1] ?? '';
    const updatedComponent = `${componentHeader} ${componentName} [MODIFIED]\n${componentBody}`;
    updatedContent = updatedContent.replace(componentMatch[0], updatedComponent);

    return {
      content: updatedContent,
      modified: modifiedItems,
    };
  }

  private modifyAPI(
    content: string,
    endpoint: string,
    modifications: readonly ItemModification[],
    parsedSDS: ParsedSDS
  ): { content: string; modified: ModifiedAPI[] } {
    // Parse endpoint to get method and path
    const endpointParts = endpoint.split(' ');
    const method = endpointParts.length > 1 ? (endpointParts[0] ?? 'GET') : 'GET';
    const apiPath = endpointParts.length > 1 ? (endpointParts[1] ?? '') : (endpointParts[0] ?? '');

    const api = parsedSDS.apis.find((a) => a.endpoint === apiPath && a.method === method);
    if (api === undefined) {
      throw new APINotFoundError(endpoint, parsedSDS.path);
    }

    let updatedContent = content;
    const modifiedItems: ModifiedAPI[] = [];
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find the API section
    const escapedPath = apiPath.replace(/\//g, '\\/');
    const apiPattern = new RegExp(
      `(####\\s*${method}\\s+${escapedPath})(?:\\s*\\[(NEW|MODIFIED|DEPRECATED)\\])?\\s*\\n([\\s\\S]*?)(?=\\n####\\s|$)`,
      'i'
    );
    const apiMatch = updatedContent.match(apiPattern);

    if (apiMatch === null) {
      throw new APINotFoundError(endpoint, parsedSDS.path);
    }

    let apiBody = apiMatch[3] ?? '';

    for (const mod of modifications) {
      // Generic field modification
      const fieldPattern = new RegExp(`(\\*\\*${mod.field}\\*\\*:\\s*)(.+?)(?=\\n)`, 'i');
      const fieldMatch = apiBody.match(fieldPattern);
      if (fieldMatch !== null) {
        modifiedItems.push({
          endpoint,
          field: mod.field,
          oldValue: fieldMatch[2] ?? '',
          newValue: mod.newValue,
        });
        apiBody = apiBody.replace(fieldPattern, `$1${mod.newValue}`);
      }
    }

    // Add modified date if not present
    if (!apiBody.includes('**Modified**:')) {
      apiBody = apiBody.trimEnd() + `\n**Modified**: ${today}\n`;
    } else {
      apiBody = apiBody.replace(/(\*\*Modified\*\*:\s*)[\d-]+/, `$1${today}`);
    }

    // Rebuild the API section
    const apiHeader = apiMatch[1] ?? '';
    const updatedAPI = `${apiHeader} [MODIFIED]\n${apiBody}`;
    updatedContent = updatedContent.replace(apiMatch[0], updatedAPI);

    return {
      content: updatedContent,
      modified: modifiedItems,
    };
  }

  private updateDataModel(
    content: string,
    update: DataModelUpdate
  ): { content: string; changes: DataModelChange[] } {
    const today = new Date().toISOString().split('T')[0] ?? '';
    const changes: DataModelChange[] = [];

    // Find data design section
    const dataPattern = /(## \d+\.?\s*Data Design[\s\S]*?)(?=\n## \d+\.|$)/i;
    const dataMatch = content.match(dataPattern);

    let updatedContent = content;

    for (const change of update.dataChanges) {
      changes.push({
        entity: update.entityName,
        changeType: change.type,
        details: JSON.stringify(change.details),
      });
    }

    if (dataMatch !== null && dataMatch[1] !== undefined) {
      const sectionEnd = (dataMatch.index ?? 0) + dataMatch[1].length;
      const dataNote = `\n\n**Data Model Update (${today})**: ${update.entityName}\n`;
      let detailsNote = '';
      for (const change of update.dataChanges) {
        detailsNote += `- ${change.type}: ${JSON.stringify(change.details)}\n`;
      }
      updatedContent =
        content.slice(0, sectionEnd) + dataNote + detailsNote + content.slice(sectionEnd);
    } else {
      // Add data design section if not found
      let newSection = `\n\n## Data Design\n\n**Data Model Update (${today})**: ${update.entityName}\n`;
      for (const change of update.dataChanges) {
        newSection += `- ${change.type}: ${JSON.stringify(change.details)}\n`;
      }
      updatedContent += newSection;
    }

    return { content: updatedContent, changes };
  }

  private updateArchitecture(
    content: string,
    change: ArchitectureChange
  ): { content: string; change: ArchitectureModification } {
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find system architecture section
    const archPattern = /(## \d+\.?\s*System Architecture[\s\S]*?)(?=\n## \d+\.|$)/i;
    const archMatch = content.match(archPattern);

    let updatedContent = content;

    if (archMatch !== null && archMatch[1] !== undefined) {
      const sectionEnd = (archMatch.index ?? 0) + archMatch[1].length;
      const archNote = `\n\n### Architecture Update (${today}) [NEW]\n`;
      const detailsNote = `**Type**: ${change.type}\n**Description**: ${change.description}\n**Rationale**: ${change.rationale}\n`;
      updatedContent =
        content.slice(0, sectionEnd) + archNote + detailsNote + content.slice(sectionEnd);
    } else {
      // Add system architecture section if not found
      let newSection = `\n\n## System Architecture\n\n### Architecture Update (${today}) [NEW]\n`;
      newSection += `**Type**: ${change.type}\n**Description**: ${change.description}\n**Rationale**: ${change.rationale}\n`;
      updatedContent += newSection;
    }

    return {
      content: updatedContent,
      change: {
        type: change.type,
        description: change.description,
      },
    };
  }

  private updateTraceability(
    content: string,
    updates: readonly SDSTraceabilityEntry[]
  ): { content: string } {
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find traceability matrix section
    const matrixPattern =
      /(## \d+\.?\s*(?:SRS→SDS\s*)?Traceability(?:\s+Matrix)?[\s\S]*?)(?=\n## \d+\.|$)/i;
    const matrixMatch = content.match(matrixPattern);

    let updatedContent = content;

    if (matrixMatch !== null && matrixMatch[1] !== undefined) {
      let matrixSection = matrixMatch[1];

      for (const update of updates) {
        // Check if SRS ID already exists in matrix
        const rowPattern = new RegExp(`\\|\\s*${update.srsId}\\s*\\|\\s*([^|]+)\\|`, 'i');
        const rowMatch = matrixSection.match(rowPattern);

        if (rowMatch !== null) {
          // Update existing row
          const existingSdsIds = rowMatch[1]?.trim() ?? '';
          const newSdsIds = [...new Set([...existingSdsIds.split(/[,;]\s*/), ...update.sdsIds])];
          matrixSection = matrixSection.replace(
            rowPattern,
            `| ${update.srsId} | ${newSdsIds.join(', ')} |`
          );
        } else {
          // Add new row to table
          const tableEndPattern = /(\|[^|]+\|[^|]+\|)\s*$/;
          const tableEnd = matrixSection.match(tableEndPattern);
          if (tableEnd !== null) {
            matrixSection += `\n| ${update.srsId} | ${update.sdsIds.join(', ')} |`;
          }
        }
      }

      // Add update note
      matrixSection += `\n\n*Traceability matrix updated: ${today}*`;
      updatedContent = content.replace(matrixMatch[1], matrixSection);
    } else {
      // Create new traceability matrix section
      let newSection = `\n\n## SRS→SDS Traceability Matrix\n\n`;
      newSection += `| SRS Feature | SDS Components |\n`;
      newSection += `|-------------|----------------|\n`;
      for (const update of updates) {
        newSection += `| ${update.srsId} | ${update.sdsIds.join(', ')} |\n`;
      }
      newSection += `\n*Traceability matrix created: ${today}*`;
      updatedContent += newSection;
    }

    return { content: updatedContent };
  }

  private calculateNewVersion(currentVersion: string, changes: SDSUpdateChanges): string {
    const parts = currentVersion.split('.');
    const major = parseInt(parts[0] ?? '1', 10);
    let minor = parseInt(parts[1] ?? '0', 10);
    let patch = parseInt(parts[2] ?? '0', 10);

    const hasComponentsAdded = changes.componentsAdded.length > 0;
    const hasDataModelChanges = changes.dataModelsChanged.length > 0;
    const hasArchitectureChanges = changes.architectureChanges.length > 0;
    const hasAPIsAdded = changes.apisAdded.length > 0;
    const hasModifications =
      changes.componentsModified.length > 0 || changes.apisModified.length > 0;

    if (hasComponentsAdded || hasDataModelChanges || hasArchitectureChanges) {
      // Minor version bump for new components, data model changes, or architecture changes
      minor += 1;
      patch = 0;
    } else if (hasAPIsAdded || hasModifications) {
      // Patch version bump for APIs or modifications
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

  private runConsistencyCheck(content: string, _parsedSDS: ParsedSDS): ConsistencyCheckResult {
    const issues: string[] = [];

    // Check for duplicate component IDs (only definition headers, not references)
    const cmpDefPattern = /### (CMP-\d{3}):/g;

    const cmpIds: string[] = [];

    let match;
    while ((match = cmpDefPattern.exec(content)) !== null) {
      if (match[1] !== undefined) {
        cmpIds.push(match[1]);
      }
    }

    const cmpDuplicates = cmpIds.filter((id, index) => cmpIds.indexOf(id) !== index);

    if (cmpDuplicates.length > 0) {
      issues.push(`Duplicate component IDs found: ${[...new Set(cmpDuplicates)].join(', ')}`);
    }

    // Check for components without source features
    const componentPattern = /### CMP-\d{3}:[\s\S]*?(?=\n#{2,3}\s|$)/gi;
    while ((match = componentPattern.exec(content)) !== null) {
      if (!match[0].includes('**Source Features**:')) {
        const idMatch = match[0].match(/(CMP-\d{3})/);
        if (idMatch !== null && idMatch[1] !== undefined) {
          issues.push(`Component ${idMatch[1]} is missing source features`);
        }
      }
    }

    // Check for APIs without component link
    const apiPattern = /#### (?:GET|POST|PUT|DELETE|PATCH) \/[\s\S]*?(?=\n#{3,4}\s|$)/gi;
    while ((match = apiPattern.exec(content)) !== null) {
      if (!match[0].includes('**Component**:')) {
        const endpointMatch = match[0].match(/#### ((?:GET|POST|PUT|DELETE|PATCH) \/[^\s[]+)/);
        if (endpointMatch !== null && endpointMatch[1] !== undefined) {
          issues.push(`API ${endpointMatch[1]} is missing component link`);
        }
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }

  private generateChangelogEntry(version: string, changes: SDSUpdateChanges): string {
    const today = new Date().toISOString().split('T')[0] ?? '';
    let entry = `## [${version}] - ${today}\n\n`;

    if (changes.componentsAdded.length > 0) {
      entry += '### Components Added\n';
      for (const added of changes.componentsAdded) {
        entry += `- ${added.id}: ${added.name}`;
        if (added.linkedSrs !== '') {
          entry += ` (linked to ${added.linkedSrs})`;
        }
        entry += '\n';
      }
      entry += '\n';
    }

    if (changes.apisAdded.length > 0) {
      entry += '### APIs Added\n';
      for (const added of changes.apisAdded) {
        entry += `- ${added.endpoint} (${added.component})`;
        if (added.useCase !== undefined) {
          entry += ` for ${added.useCase}`;
        }
        entry += '\n';
      }
      entry += '\n';
    }

    if (changes.componentsModified.length > 0) {
      entry += '### Components Modified\n';
      for (const modified of changes.componentsModified) {
        entry += `- ${modified.id}: ${modified.field} changed from "${modified.oldValue}" to "${modified.newValue}"\n`;
      }
      entry += '\n';
    }

    if (changes.apisModified.length > 0) {
      entry += '### APIs Modified\n';
      for (const modified of changes.apisModified) {
        entry += `- ${modified.endpoint}: ${modified.field} changed from "${modified.oldValue}" to "${modified.newValue}"\n`;
      }
      entry += '\n';
    }

    if (changes.dataModelsChanged.length > 0) {
      entry += '### Data Models Changed\n';
      for (const changed of changes.dataModelsChanged) {
        entry += `- ${changed.entity}: ${changed.changeType}\n`;
      }
      entry += '\n';
    }

    if (changes.architectureChanges.length > 0) {
      entry += '### Architecture Changes\n';
      for (const changed of changes.architectureChanges) {
        entry += `- ${changed.type}: ${changed.description}\n`;
      }
      entry += '\n';
    }

    return entry;
  }

  private async writeUpdatedSDS(sdsPath: string, content: string): Promise<void> {
    try {
      await fs.writeFile(sdsPath, content, 'utf-8');
    } catch (error) {
      throw new SDSOutputWriteError(
        sdsPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async writeChangelog(projectId: string, updateResult: SDSUpdateResult): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const changelogPath = path.join(outputDir, 'sds_changelog.md');

    try {
      await fs.mkdir(outputDir, { recursive: true });

      // Read existing changelog or create new
      let existingContent = '';
      try {
        existingContent = await fs.readFile(changelogPath, 'utf-8');
      } catch {
        existingContent = '# SDS Changelog\n\nAll notable changes to the SDS document.\n\n';
      }

      // Insert new entry after header
      const headerEnd = existingContent.indexOf('\n\n', existingContent.indexOf('# SDS Changelog'));
      const newContent =
        existingContent.slice(0, headerEnd + 2) +
        updateResult.changelogEntry +
        existingContent.slice(headerEnd + 2);

      await fs.writeFile(changelogPath, newContent, 'utf-8');
      return changelogPath;
    } catch (error) {
      throw new SDSOutputWriteError(
        changelogPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async writeUpdateResult(
    projectId: string,
    updateResult: SDSUpdateResult
  ): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const resultPath = path.join(outputDir, 'sds_update_result.yaml');

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
            components_added: updateResult.changes.componentsAdded,
            apis_added: updateResult.changes.apisAdded,
            components_modified: updateResult.changes.componentsModified,
            apis_modified: updateResult.changes.apisModified,
            data_models_changed: updateResult.changes.dataModelsChanged,
            architecture_changes: updateResult.changes.architectureChanges,
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
      throw new SDSOutputWriteError(
        resultPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// ============ Singleton Pattern ============

let globalSDSUpdaterAgent: SDSUpdaterAgent | null = null;

/**
 * Get the global SDS Updater Agent instance
 * @param config
 */
export function getSDSUpdaterAgent(config?: SDSUpdaterConfig): SDSUpdaterAgent {
  if (globalSDSUpdaterAgent === null) {
    globalSDSUpdaterAgent = new SDSUpdaterAgent(config);
  }
  return globalSDSUpdaterAgent;
}

/**
 * Reset the global SDS Updater Agent instance
 */
export function resetSDSUpdaterAgent(): void {
  if (globalSDSUpdaterAgent !== null) {
    globalSDSUpdaterAgent.reset();
    globalSDSUpdaterAgent = null;
  }
}
