/**
 * LocalIssueWriter - Generates local issue files from SRS features
 *
 * Reads SRS from the scratchpad, extracts features using SRSParser,
 * and writes issue_list.json + individual ISS-XXX.md files compatible
 * with LocalIssueReader.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { SRSParser } from '../sds-writer/SRSParser.js';
import type { ParsedSRSFeature } from '../sds-writer/types.js';
import type { EffortSize, Priority } from './types.js';
import { EFFORT_HOURS } from '../issue-reader/types.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

/**
 * Effort size mapping based on acceptance criteria count and description length
 * @param feature
 */
function estimateSize(feature: ParsedSRSFeature): EffortSize {
  const acCount = feature.acceptanceCriteria.length;
  const descLen = feature.description.length;

  if (acCount <= 1 && descLen < 80) return 'S';
  if (acCount <= 3 && descLen < 200) return 'M';
  if (acCount <= 5) return 'L';
  return 'XL';
}

/**
 * Shape of a single issue in issue_list.json
 */
export interface LocalIssueEntry {
  readonly id: string;
  readonly number: number;
  readonly url: string;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly labels: {
    readonly raw: readonly string[];
    readonly priority: Priority;
    readonly type: string;
    readonly size: EffortSize;
  };
  readonly milestone: string | null;
  readonly assignees: readonly string[];
  readonly dependencies: {
    readonly blocked_by: readonly string[];
    readonly blocks: readonly string[];
  };
  readonly estimation: {
    readonly size: EffortSize;
    readonly hours: number;
  };
}

/**
 * Schema for issue_list.json
 */
export interface LocalIssueListFile {
  readonly schemaVersion: string;
  readonly projectId: string;
  readonly generatedAt: string;
  readonly issues: readonly LocalIssueEntry[];
}

/**
 * Result returned by LocalIssueWriter.generate()
 */
export interface LocalIssueWriterResult {
  readonly issueListPath: string;
  readonly issueFiles: readonly string[];
  readonly issueCount: number;
}

/**
 * Options for LocalIssueWriter
 */
export interface LocalIssueWriterOptions {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
}

const DEFAULT_SCRATCHPAD = '.ad-sdlc/scratchpad';

/**
 * Generates local issue files from SRS features.
 */
export class LocalIssueWriter {
  private readonly scratchpadBasePath: string;

  constructor(options: LocalIssueWriterOptions = {}) {
    this.scratchpadBasePath = options.scratchpadBasePath ?? DEFAULT_SCRATCHPAD;
  }

  /**
   * Generate issue files from an SRS document.
   *
   * @param projectId - Project identifier used for directory paths
   * @param srsContent - Optional raw SRS markdown. If omitted, reads from scratchpad.
   * @returns Paths of generated files and issue count
   */
  async generate(projectId: string, srsContent?: string): Promise<LocalIssueWriterResult> {
    // 1. Read SRS
    const content = srsContent ?? (await this.readSRS(projectId));

    // 2. Parse features
    const parser = new SRSParser();
    const parsed = parser.parse(content);
    const features = parsed.features;

    if (features.length === 0) {
      logger.warn('No features found in SRS — generating empty issue list');
    }

    // 3. Convert features to issue entries
    const issues = features.map((feature, idx) => this.featureToIssue(feature, idx + 1));

    // 4. Build issue_list.json
    const issueList: LocalIssueListFile = {
      schemaVersion: '1.0.0',
      projectId,
      generatedAt: new Date().toISOString(),
      issues,
    };

    // 5. Write files
    const issueDir = join(this.scratchpadBasePath, 'issues', projectId);
    await mkdir(issueDir, { recursive: true });

    const issueListPath = join(issueDir, 'issue_list.json');
    await writeFile(issueListPath, JSON.stringify(issueList, null, 2), 'utf-8');
    logger.info(`Wrote ${issueListPath} with ${String(issues.length)} issues`);

    const issueFiles: string[] = [];
    for (const issue of issues) {
      const mdPath = join(issueDir, `${issue.id}.md`);
      await writeFile(mdPath, this.renderIssueMd(issue), 'utf-8');
      issueFiles.push(mdPath);
    }

    logger.info(`Wrote ${String(issueFiles.length)} individual issue markdown files`);

    return { issueListPath, issueFiles, issueCount: issues.length };
  }

  /**
   * Read SRS content from the scratchpad.
   * @param projectId
   */
  private async readSRS(projectId: string): Promise<string> {
    const srsPath = join(this.scratchpadBasePath, 'documents', projectId, 'srs.md');
    try {
      return await readFile(srsPath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`SRS file not found at ${srsPath}`, { cause: err });
      }
      throw err;
    }
  }

  /**
   * Convert a ParsedSRSFeature into a LocalIssueEntry.
   * @param feature
   * @param number
   */
  private featureToIssue(feature: ParsedSRSFeature, number: number): LocalIssueEntry {
    const id = `ISS-${String(number).padStart(3, '0')}`;
    const size = estimateSize(feature);
    const hours = EFFORT_HOURS[size];

    const acSection =
      feature.acceptanceCriteria.length > 0
        ? `\n\n## Acceptance Criteria\n${feature.acceptanceCriteria.map((ac) => `- [ ] ${ac}`).join('\n')}`
        : '';

    const traceSection = `\n\n## Traceability\n- SRS Feature: ${feature.id}${feature.sourceRequirements.length > 0 ? `\n- PRD Requirements: ${feature.sourceRequirements.join(', ')}` : ''}`;

    const body = `## Description\n${feature.description || feature.name}${acSection}${traceSection}`;

    return {
      id,
      number,
      url: `local://issues/${id}`,
      title: `[Feature] ${feature.name}`,
      body,
      state: 'open',
      labels: {
        raw: ['type/feature', `priority/${feature.priority.toLowerCase()}`],
        priority: feature.priority,
        type: 'feature',
        size,
      },
      milestone: null,
      assignees: [],
      dependencies: {
        blocked_by: [],
        blocks: [],
      },
      estimation: {
        size,
        hours,
      },
    };
  }

  /**
   * Render a human-readable markdown file for a single issue.
   * @param issue
   */
  private renderIssueMd(issue: LocalIssueEntry): string {
    const lines: string[] = [
      `# ${issue.title}`,
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| **ID** | ${issue.id} |`,
      `| **State** | ${issue.state} |`,
      `| **Priority** | ${issue.labels.priority} |`,
      `| **Size** | ${issue.labels.size} |`,
      `| **Estimated Hours** | ${String(issue.estimation.hours)} |`,
      `| **Labels** | ${issue.labels.raw.join(', ')} |`,
      '',
      issue.body,
      '',
    ];

    return lines.join('\n');
  }
}
