/**
 * PRD Updater Agent
 *
 * Performs incremental updates to existing PRD documents instead of full rewrites.
 * Supports adding, modifying, and deprecating requirements while maintaining
 * document consistency and version history.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  AddedRequirement,
  ChangeRequest,
  ConsistencyCheckResult,
  DeprecatedRequirement,
  DocumentMetadata,
  DocumentSection,
  ModifiedRequirement,
  NewRequirement,
  ParsedPRD,
  ParsedRequirement,
  PRDUpdateOperationResult,
  PRDUpdaterConfig,
  PRDUpdaterSession,
  RequirementModification,
  RequirementPriority,
  RequirementStatus,
  TraceabilityImpact,
  UpdateChanges,
  UpdateResult,
} from './types.js';
import { DEFAULT_PRD_UPDATER_CONFIG } from './types.js';
import {
  DocumentParseError,
  DuplicateRequirementError,
  FileSizeLimitError,
  InvalidChangeRequestError,
  NoActiveSessionError,
  OutputWriteError,
  PRDNotFoundError,
  PRDNotLoadedError,
  RequirementNotFoundError,
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
 * PRD Updater Agent class
 *
 * Responsible for:
 * - Loading and parsing existing PRD documents
 * - Adding new requirements
 * - Modifying existing requirements
 * - Deprecating requirements
 * - Maintaining version history and changelog
 */
export class PRDUpdaterAgent {
  private readonly config: Required<PRDUpdaterConfig>;
  private session: PRDUpdaterSession | null = null;

  constructor(config: PRDUpdaterConfig = {}) {
    this.config = { ...DEFAULT_PRD_UPDATER_CONFIG, ...config };
  }

  /**
   * Start a new PRD update session
   */
  public async startSession(projectId: string): Promise<PRDUpdaterSession> {
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
   * Load an existing PRD document for updating
   */
  public async loadPRD(prdPath?: string): Promise<ParsedPRD> {
    const session = this.ensureSession();

    // Update session status
    this.session = { ...session, status: 'loading', updatedAt: new Date().toISOString() };

    try {
      // Find PRD file
      const resolvedPath = prdPath ?? (await this.findPRDFile(session.projectId));

      // Check file exists and size
      await this.validateFile(resolvedPath);

      // Read and parse PRD
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const stats = await fs.stat(resolvedPath);

      const parsedPRD = this.parsePRD(resolvedPath, content, stats.mtime.toISOString());

      // Update session
      this.session = {
        ...this.session,
        prdPath: resolvedPath,
        parsedPRD,
        updatedAt: new Date().toISOString(),
      };

      return parsedPRD;
    } catch (error) {
      // Session is guaranteed non-null here since ensureSession() was called at the start
      this.session = {
        ...this.session,
        status: 'failed',
        errors: [
          ...this.session.errors,
          error instanceof Error ? error.message : String(error),
        ],
        updatedAt: new Date().toISOString(),
      };
      throw error;
    }
  }

  /**
   * Apply a change request to the loaded PRD
   */
  public async applyChange(changeRequest: ChangeRequest): Promise<PRDUpdateOperationResult> {
    const session = this.ensureSession();
    const parsedPRD = this.ensurePRDLoaded();

    // Validate change request
    this.validateChangeRequest(changeRequest);

    // Update session status
    this.session = { ...session, status: 'updating', updatedAt: new Date().toISOString() };

    try {
      const changes: {
        added: AddedRequirement[];
        modified: ModifiedRequirement[];
        deprecated: DeprecatedRequirement[];
      } = {
        added: [],
        modified: [],
        deprecated: [],
      };

      let updatedContent = parsedPRD.rawContent;
      const versionBefore = parsedPRD.metadata.version;

      // Apply the change based on type
      switch (changeRequest.type) {
        case 'add_requirement': {
          if (changeRequest.newRequirement === undefined) {
            throw new InvalidChangeRequestError('newRequirement', 'Required for add_requirement');
          }
          const result = this.addRequirement(updatedContent, changeRequest.newRequirement, parsedPRD);
          updatedContent = result.content;
          changes.added.push(result.added);
          break;
        }
        case 'modify_requirement': {
          if (changeRequest.requirementId === undefined) {
            throw new InvalidChangeRequestError('requirementId', 'Required for modify_requirement');
          }
          if (changeRequest.modifications === undefined || changeRequest.modifications.length === 0) {
            throw new InvalidChangeRequestError('modifications', 'Required for modify_requirement');
          }
          const result = this.modifyRequirement(
            updatedContent,
            changeRequest.requirementId,
            changeRequest.modifications,
            parsedPRD
          );
          updatedContent = result.content;
          changes.modified.push(...result.modified);
          break;
        }
        case 'deprecate_requirement': {
          if (changeRequest.requirementId === undefined) {
            throw new InvalidChangeRequestError('requirementId', 'Required for deprecate_requirement');
          }
          if (changeRequest.deprecationReason === undefined) {
            throw new InvalidChangeRequestError('deprecationReason', 'Required for deprecate_requirement');
          }
          const result = this.deprecateRequirement(
            updatedContent,
            changeRequest.requirementId,
            changeRequest.deprecationReason,
            changeRequest.replacementId,
            parsedPRD
          );
          updatedContent = result.content;
          changes.deprecated.push(result.deprecated);
          break;
        }
        case 'extend_scope': {
          // For now, extend_scope adds to the scope section
          if (changeRequest.scopeExtension !== undefined) {
            updatedContent = this.extendScope(updatedContent, changeRequest.scopeExtension);
          }
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
      const consistencyCheck = this.runConsistencyCheck(updatedContent, parsedPRD);

      // Build update result
      const updateResult: UpdateResult = {
        document: parsedPRD.metadata.id ?? path.basename(parsedPRD.path, '.md'),
        versionBefore,
        versionAfter,
        updatedAt: new Date().toISOString(),
        changes,
        consistencyCheck,
        changelogEntry: this.generateChangelogEntry(versionAfter, changes),
        traceabilityImpact: this.calculateTraceabilityImpact(changes),
      };

      // Write outputs
      const prdPath = session.prdPath ?? parsedPRD.path;
      await this.writeUpdatedPRD(prdPath, updatedContent);

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
        prdPath,
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
        errors: [
          ...this.session.errors,
          error instanceof Error ? error.message : String(error),
        ],
        updatedAt: new Date().toISOString(),
      };
      throw error;
    }
  }

  /**
   * Get the current session
   */
  public getSession(): PRDUpdaterSession | null {
    return this.session;
  }

  /**
   * Reset the agent state
   */
  public reset(): void {
    this.session = null;
  }

  // ============ Private Helper Methods ============

  private ensureSession(): PRDUpdaterSession {
    if (this.session === null) {
      throw new NoActiveSessionError();
    }
    return this.session;
  }

  private ensurePRDLoaded(): ParsedPRD {
    const session = this.ensureSession();
    if (session.parsedPRD === undefined) {
      throw new PRDNotLoadedError();
    }
    return session.parsedPRD;
  }

  private async findPRDFile(projectId: string): Promise<string> {
    const prdDir = path.join(this.config.docsBasePath, this.config.prdSubdir);

    try {
      await fs.access(prdDir);
    } catch {
      throw new PRDNotFoundError(prdDir);
    }

    const files = await fs.readdir(prdDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    // Try to find by project ID first
    const matchingFile = mdFiles.find(
      (f) => f.toLowerCase().includes(projectId.toLowerCase()) || f.includes('PRD')
    );

    if (matchingFile !== undefined) {
      return path.join(prdDir, matchingFile);
    }

    // Fall back to first .md file
    if (mdFiles.length > 0 && mdFiles[0] !== undefined) {
      return path.join(prdDir, mdFiles[0]);
    }

    throw new PRDNotFoundError(prdDir);
  }

  private async validateFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      throw new PRDNotFoundError(filePath);
    }

    const stats = await fs.stat(filePath);
    if (stats.size > this.config.maxFileSize) {
      throw new FileSizeLimitError(filePath, stats.size, this.config.maxFileSize);
    }
  }

  private parsePRD(filePath: string, content: string, lastModified: string): ParsedPRD {
    try {
      const metadata = this.extractMetadata(content, filePath);
      const sections = this.parseSections(content);
      const requirements = this.extractRequirements(content, filePath);

      return {
        path: filePath,
        metadata,
        rawContent: content,
        requirements,
        sections,
        lastModified,
      };
    } catch (error) {
      throw new DocumentParseError(
        filePath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private extractMetadata(content: string, filePath: string): DocumentMetadata {
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
    const headingMatch = content.match(/^#\s+(?:PRD:\s*)?(.+?)(?:\s*\n|$)/m);
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
    let currentSection: { title: string; level: number; startLine: number; lines: string[] } | null = null;

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

  private extractRequirements(content: string, _filePath: string): ParsedRequirement[] {
    const requirements: ParsedRequirement[] = [];

    // Extract functional requirements
    const frPattern = /###\s*(FR-\d{3}):\s*(.+?)(?:\s*\[(NEW|MODIFIED|DEPRECATED)\])?\s*\n([\s\S]*?)(?=\n###\s|$)/gi;
    let match;

    while ((match = frPattern.exec(content)) !== null) {
      const id = match[1] ?? '';
      const title = match[2]?.trim() ?? '';
      const statusTag = match[3]?.toUpperCase();
      const sectionContent = match[4] ?? '';

      if (id === '' || title === '') continue;

      const lineNumber = content.slice(0, match.index).split('\n').length;

      requirements.push({
        id,
        title,
        type: 'functional',
        description: this.extractField(sectionContent, 'Description') ?? title,
        priority: this.extractPriority(sectionContent),
        status: this.parseStatus(statusTag),
        userStory: this.extractField(sectionContent, 'User Story'),
        acceptanceCriteria: this.extractList(sectionContent, 'Acceptance Criteria'),
        dependencies: this.extractList(sectionContent, 'Dependencies'),
        notes: this.extractField(sectionContent, 'Notes'),
        lineNumber,
        rawContent: match[0],
      });
    }

    // Extract non-functional requirements
    const nfrPattern = /###\s*(NFR-\d{3}):\s*(.+?)(?:\s*\[(NEW|MODIFIED|DEPRECATED)\])?\s*\n([\s\S]*?)(?=\n###\s|$)/gi;

    while ((match = nfrPattern.exec(content)) !== null) {
      const id = match[1] ?? '';
      const title = match[2]?.trim() ?? '';
      const statusTag = match[3]?.toUpperCase();
      const sectionContent = match[4] ?? '';

      if (id === '' || title === '') continue;

      const lineNumber = content.slice(0, match.index).split('\n').length;

      requirements.push({
        id,
        title,
        type: 'non_functional',
        description: this.extractField(sectionContent, 'Description') ?? title,
        priority: this.extractPriority(sectionContent),
        status: this.parseStatus(statusTag),
        notes: this.extractField(sectionContent, 'Notes'),
        lineNumber,
        rawContent: match[0],
      });
    }

    return requirements;
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

  private extractPriority(content: string): RequirementPriority {
    const match = content.match(/\*\*Priority\*\*:\s*(P[0-3])/i);
    if (match?.[1] !== undefined) {
      return match[1].toUpperCase() as RequirementPriority;
    }
    return 'P2';
  }

  private parseStatus(statusTag: string | undefined): RequirementStatus {
    if (statusTag === 'DEPRECATED') return 'deprecated';
    if (statusTag === 'NEW') return 'pending';
    return 'active';
  }

  private validateChangeRequest(changeRequest: ChangeRequest): void {
    if (changeRequest.type === 'add_requirement' && changeRequest.newRequirement === undefined) {
      throw new InvalidChangeRequestError('newRequirement', 'Required for add_requirement type');
    }
    if (changeRequest.type === 'modify_requirement') {
      if (changeRequest.requirementId === undefined) {
        throw new InvalidChangeRequestError('requirementId', 'Required for modify_requirement type');
      }
      if (changeRequest.modifications === undefined || changeRequest.modifications.length === 0) {
        throw new InvalidChangeRequestError('modifications', 'At least one modification required');
      }
    }
    if (changeRequest.type === 'deprecate_requirement') {
      if (changeRequest.requirementId === undefined) {
        throw new InvalidChangeRequestError('requirementId', 'Required for deprecate_requirement type');
      }
      if (changeRequest.deprecationReason === undefined) {
        throw new InvalidChangeRequestError('deprecationReason', 'Required for deprecate_requirement type');
      }
    }
  }

  private addRequirement(
    content: string,
    newReq: NewRequirement,
    parsedPRD: ParsedPRD
  ): { content: string; added: AddedRequirement } {
    // Generate new ID
    const prefix = newReq.type === 'functional' ? 'FR' : 'NFR';
    const existingIds = parsedPRD.requirements
      .filter((r) => r.id.startsWith(prefix))
      .map((r) => parseInt(r.id.split('-')[1] ?? '0', 10));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const newId = `${prefix}-${String(maxId + 1).padStart(3, '0')}`;

    // Check for duplicate
    if (parsedPRD.requirements.some((r) => r.id === newId)) {
      throw new DuplicateRequirementError(newId);
    }

    // Find the section to add to
    const sectionTitle = newReq.type === 'functional' ? 'Functional Requirements' : 'Non-Functional Requirements';
    const sectionPattern = new RegExp(`(## \\d+\\.\\s*${sectionTitle}[\\s\\S]*?)(?=\\n## \\d+\\.|$)`, 'i');
    const sectionMatch = content.match(sectionPattern);

    // Build new requirement markdown
    const today = new Date().toISOString().split('T')[0] ?? '';
    let reqMarkdown = `\n### ${newId}: ${newReq.title} [NEW]\n`;
    reqMarkdown += `- **Description**: ${newReq.description}\n`;
    if (newReq.userStory !== undefined) {
      reqMarkdown += `- **User Story**: ${newReq.userStory}\n`;
    }
    if (newReq.acceptanceCriteria !== undefined && newReq.acceptanceCriteria.length > 0) {
      reqMarkdown += `- **Acceptance Criteria**:\n`;
      for (const criterion of newReq.acceptanceCriteria) {
        reqMarkdown += `  - [ ] ${criterion}\n`;
      }
    }
    reqMarkdown += `- **Priority**: ${newReq.priority}\n`;
    if (newReq.dependencies !== undefined && newReq.dependencies.length > 0) {
      reqMarkdown += `- **Dependencies**: ${newReq.dependencies.join(', ')}\n`;
    }
    reqMarkdown += `- **Added**: ${today}\n`;
    if (newReq.notes !== undefined) {
      reqMarkdown += `- **Notes**: ${newReq.notes}\n`;
    }

    let updatedContent: string;
    let lineNumber: number;

    if (sectionMatch !== null && sectionMatch[1] !== undefined) {
      // Insert at end of section
      const sectionEnd = (sectionMatch.index ?? 0) + sectionMatch[1].length;
      updatedContent = content.slice(0, sectionEnd) + reqMarkdown + content.slice(sectionEnd);
      lineNumber = content.slice(0, sectionEnd).split('\n').length + 1;
    } else {
      // Append at end
      updatedContent = content + reqMarkdown;
      lineNumber = content.split('\n').length + 1;
    }

    return {
      content: updatedContent,
      added: {
        id: newId,
        title: newReq.title,
        section: sectionTitle,
        lineNumber,
      },
    };
  }

  private modifyRequirement(
    content: string,
    requirementId: string,
    modifications: readonly RequirementModification[],
    parsedPRD: ParsedPRD
  ): { content: string; modified: ModifiedRequirement[] } {
    const requirement = parsedPRD.requirements.find((r) => r.id === requirementId);
    if (requirement === undefined) {
      throw new RequirementNotFoundError(requirementId, parsedPRD.path);
    }

    let updatedContent = content;
    const modifiedItems: ModifiedRequirement[] = [];
    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find the requirement section
    const reqPattern = new RegExp(
      `(### ${requirementId}:)\\s*(.+?)(?:\\s*\\[(NEW|MODIFIED|DEPRECATED)\\])?\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`,
      'i'
    );
    const reqMatch = updatedContent.match(reqPattern);

    if (reqMatch === null) {
      throw new RequirementNotFoundError(requirementId, parsedPRD.path);
    }

    let reqTitle = reqMatch[2]?.trim() ?? '';
    let reqBody = reqMatch[4] ?? '';

    for (const mod of modifications) {
      if (mod.field.toLowerCase() === 'title') {
        modifiedItems.push({
          id: requirementId,
          field: 'title',
          oldValue: reqTitle,
          newValue: mod.newValue,
        });
        reqTitle = mod.newValue;
      } else if (mod.field.toLowerCase() === 'priority') {
        const priorityPattern = /(\*\*Priority\*\*:\s*)(P[0-3])/i;
        const priorityMatch = reqBody.match(priorityPattern);
        if (priorityMatch !== null) {
          modifiedItems.push({
            id: requirementId,
            field: 'priority',
            oldValue: priorityMatch[2] ?? '',
            newValue: mod.newValue,
          });
          reqBody = reqBody.replace(priorityPattern, `$1${mod.newValue}`);
        }
      } else if (mod.field.toLowerCase() === 'description') {
        const descPattern = /(\*\*Description\*\*:\s*)(.+?)(?=\n)/i;
        const descMatch = reqBody.match(descPattern);
        if (descMatch !== null) {
          modifiedItems.push({
            id: requirementId,
            field: 'description',
            oldValue: descMatch[2] ?? '',
            newValue: mod.newValue,
          });
          reqBody = reqBody.replace(descPattern, `$1${mod.newValue}`);
        }
      } else {
        // Generic field modification
        const fieldPattern = new RegExp(`(\\*\\*${mod.field}\\*\\*:\\s*)(.+?)(?=\\n)`, 'i');
        const fieldMatch = reqBody.match(fieldPattern);
        if (fieldMatch !== null) {
          modifiedItems.push({
            id: requirementId,
            field: mod.field,
            oldValue: fieldMatch[2] ?? '',
            newValue: mod.newValue,
          });
          reqBody = reqBody.replace(fieldPattern, `$1${mod.newValue}`);
        }
      }
    }

    // Add modified date if not present
    if (!reqBody.includes('**Modified**:')) {
      reqBody = reqBody.trimEnd() + `\n- **Modified**: ${today}\n`;
    } else {
      reqBody = reqBody.replace(/(\*\*Modified\*\*:\s*)[\d-]+/, `$1${today}`);
    }

    // Rebuild the requirement section
    const reqHeader = reqMatch[1] ?? '';
    const updatedReq = `${reqHeader} ${reqTitle} [MODIFIED]\n${reqBody}`;
    updatedContent = updatedContent.replace(reqMatch[0], updatedReq);

    return {
      content: updatedContent,
      modified: modifiedItems,
    };
  }

  private deprecateRequirement(
    content: string,
    requirementId: string,
    reason: string,
    replacementId: string | undefined,
    parsedPRD: ParsedPRD
  ): { content: string; deprecated: DeprecatedRequirement } {
    const requirement = parsedPRD.requirements.find((r) => r.id === requirementId);
    if (requirement === undefined) {
      throw new RequirementNotFoundError(requirementId, parsedPRD.path);
    }

    const today = new Date().toISOString().split('T')[0] ?? '';

    // Find and update the requirement section
    const reqPattern = new RegExp(
      `(### ${requirementId}:)\\s*(.+?)(?:\\s*\\[(NEW|MODIFIED|DEPRECATED)\\])?\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`,
      'i'
    );
    const reqMatch = content.match(reqPattern);

    if (reqMatch === null) {
      throw new RequirementNotFoundError(requirementId, parsedPRD.path);
    }

    const reqTitle = reqMatch[2]?.trim() ?? '';
    let reqBody = reqMatch[4] ?? '';

    // Add deprecation info
    if (!reqBody.includes('**Deprecated**:')) {
      reqBody = reqBody.trimEnd() + `\n- **Deprecated**: ${today}\n`;
    }
    if (!reqBody.includes('**Deprecation Reason**:')) {
      reqBody = reqBody.trimEnd() + `\n- **Deprecation Reason**: ${reason}\n`;
    }
    if (replacementId !== undefined && !reqBody.includes('**Replaced By**:')) {
      reqBody = reqBody.trimEnd() + `\n- **Replaced By**: ${replacementId}\n`;
    }

    // Rebuild the requirement section
    const reqHeader = reqMatch[1] ?? '';
    const updatedReq = `${reqHeader} ${reqTitle} [DEPRECATED]\n${reqBody}`;
    const updatedContent = content.replace(reqMatch[0], updatedReq);

    return {
      content: updatedContent,
      deprecated: {
        id: requirementId,
        reason,
        replacementId,
      },
    };
  }

  private extendScope(content: string, extension: string): string {
    // Find the scope/out of scope section
    const scopePattern = /(## \d+\.\s*(?:Out of )?Scope[\s\S]*?)(?=\n## \d+\.|$)/i;
    const scopeMatch = content.match(scopePattern);

    if (scopeMatch !== null && scopeMatch[1] !== undefined) {
      const updated = scopeMatch[1].trimEnd() + `\n\n**Added**: ${extension}\n`;
      return content.replace(scopeMatch[1], updated);
    }

    // If no scope section found, append at end
    return content + `\n\n## Scope Extension\n\n${extension}\n`;
  }


  private calculateNewVersion(currentVersion: string, changes: UpdateChanges): string {
    const parts = currentVersion.split('.');
    const major = parseInt(parts[0] ?? '1', 10);
    let minor = parseInt(parts[1] ?? '0', 10);
    let patch = parseInt(parts[2] ?? '0', 10);

    const hasAdded = changes.added.length > 0;
    const hasDeprecated = changes.deprecated.length > 0;
    const hasModified = changes.modified.length > 0;

    if (hasAdded || hasDeprecated) {
      // Minor version bump for new requirements or deprecations
      minor += 1;
      patch = 0;
    } else if (hasModified) {
      // Patch version bump for modifications
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

  private runConsistencyCheck(content: string, _parsedPRD: ParsedPRD): ConsistencyCheckResult {
    const issues: string[] = [];

    // Check for duplicate requirement IDs (only definition headers, not references)
    const frDefPattern = /### (FR-\d{3}):/g;
    const nfrDefPattern = /### (NFR-\d{3}):/g;

    const frIds: string[] = [];
    const nfrIds: string[] = [];

    let match;
    while ((match = frDefPattern.exec(content)) !== null) {
      if (match[1] !== undefined) {
        frIds.push(match[1]);
      }
    }
    while ((match = nfrDefPattern.exec(content)) !== null) {
      if (match[1] !== undefined) {
        nfrIds.push(match[1]);
      }
    }

    const frDuplicates = frIds.filter((id, index) => frIds.indexOf(id) !== index);
    const nfrDuplicates = nfrIds.filter((id, index) => nfrIds.indexOf(id) !== index);

    if (frDuplicates.length > 0) {
      issues.push(`Duplicate functional requirement IDs found: ${[...new Set(frDuplicates)].join(', ')}`);
    }
    if (nfrDuplicates.length > 0) {
      issues.push(`Duplicate non-functional requirement IDs found: ${[...new Set(nfrDuplicates)].join(', ')}`);
    }

    // Check for requirements without priority
    // Pattern matches until next heading (## or ###) or end of string
    const reqPattern = /### (?:FR|NFR)-\d{3}:[\s\S]*?(?=\n#{2,3}\s|$)/gi;
    while ((match = reqPattern.exec(content)) !== null) {
      if (!match[0].includes('**Priority**:')) {
        const idMatch = match[0].match(/((?:FR|NFR)-\d{3})/);
        if (idMatch !== null && idMatch[1] !== undefined) {
          issues.push(`Requirement ${idMatch[1]} is missing priority`);
        }
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }

  private generateChangelogEntry(version: string, changes: UpdateChanges): string {
    const today = new Date().toISOString().split('T')[0] ?? '';
    let entry = `## [${version}] - ${today}\n\n`;

    if (changes.added.length > 0) {
      entry += '### Added\n';
      for (const added of changes.added) {
        entry += `- ${added.id}: ${added.title}\n`;
      }
      entry += '\n';
    }

    if (changes.modified.length > 0) {
      entry += '### Changed\n';
      for (const modified of changes.modified) {
        entry += `- ${modified.id}: ${modified.field} changed from "${modified.oldValue}" to "${modified.newValue}"\n`;
      }
      entry += '\n';
    }

    if (changes.deprecated.length > 0) {
      entry += '### Deprecated\n';
      for (const deprecated of changes.deprecated) {
        entry += `- ${deprecated.id}: ${deprecated.reason}`;
        if (deprecated.replacementId !== undefined) {
          entry += ` (replaced by ${deprecated.replacementId})`;
        }
        entry += '\n';
      }
      entry += '\n';
    }

    return entry;
  }

  private calculateTraceabilityImpact(_changes: UpdateChanges): TraceabilityImpact {
    // For now, return empty arrays - in a full implementation,
    // this would query the current_state.yaml to find affected SRS/SDS items
    return {
      affectedSrsIds: [],
      affectedSdsIds: [],
    };
  }

  private async writeUpdatedPRD(prdPath: string, content: string): Promise<void> {
    try {
      await fs.writeFile(prdPath, content, 'utf-8');
    } catch (error) {
      throw new OutputWriteError(prdPath, error instanceof Error ? error.message : String(error));
    }
  }

  private async writeChangelog(projectId: string, updateResult: UpdateResult): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const changelogPath = path.join(outputDir, 'prd_changelog.md');

    try {
      await fs.mkdir(outputDir, { recursive: true });

      // Read existing changelog or create new
      let existingContent = '';
      try {
        existingContent = await fs.readFile(changelogPath, 'utf-8');
      } catch {
        existingContent = '# PRD Changelog\n\nAll notable changes to the PRD document.\n\n';
      }

      // Insert new entry after header
      const headerEnd = existingContent.indexOf('\n\n', existingContent.indexOf('# PRD Changelog'));
      const newContent =
        existingContent.slice(0, headerEnd + 2) +
        updateResult.changelogEntry +
        existingContent.slice(headerEnd + 2);

      await fs.writeFile(changelogPath, newContent, 'utf-8');
      return changelogPath;
    } catch (error) {
      throw new OutputWriteError(changelogPath, error instanceof Error ? error.message : String(error));
    }
  }

  private async writeUpdateResult(projectId: string, updateResult: UpdateResult): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const resultPath = path.join(outputDir, 'prd_update_result.yaml');

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
            added: updateResult.changes.added,
            modified: updateResult.changes.modified,
            deprecated: updateResult.changes.deprecated,
          },
          consistency_check: {
            passed: updateResult.consistencyCheck.passed,
            issues: updateResult.consistencyCheck.issues,
          },
          changelog_entry: updateResult.changelogEntry,
          traceability_impact: {
            affected_srs_ids: updateResult.traceabilityImpact.affectedSrsIds,
            affected_sds_ids: updateResult.traceabilityImpact.affectedSdsIds,
          },
        },
      });

      await fs.writeFile(resultPath, yamlContent, 'utf-8');
      return resultPath;
    } catch (error) {
      throw new OutputWriteError(resultPath, error instanceof Error ? error.message : String(error));
    }
  }
}

// ============ Singleton Pattern ============

let globalPRDUpdaterAgent: PRDUpdaterAgent | null = null;

/**
 * Get the global PRD Updater Agent instance
 */
export function getPRDUpdaterAgent(config?: PRDUpdaterConfig): PRDUpdaterAgent {
  if (globalPRDUpdaterAgent === null) {
    globalPRDUpdaterAgent = new PRDUpdaterAgent(config);
  }
  return globalPRDUpdaterAgent;
}

/**
 * Reset the global PRD Updater Agent instance
 */
export function resetPRDUpdaterAgent(): void {
  if (globalPRDUpdaterAgent !== null) {
    globalPRDUpdaterAgent.reset();
    globalPRDUpdaterAgent = null;
  }
}
