/**
 * Frontmatter utilities for document generation
 *
 * Provides functions to generate and parse YAML frontmatter
 * for AD-SDLC pipeline documents (PRD, SRS, SDS).
 *
 * @module utilities/frontmatter
 */

import yaml from 'js-yaml';
import {
  DocumentFrontmatterSchema,
  type DocumentFrontmatter,
  type ChangeHistoryEntry,
} from '../schemas/document-frontmatter.js';

/**
 * Options for generating frontmatter
 */
export interface GenerateFrontmatterOptions {
  /** Document ID (e.g., PRD-my-project) */
  readonly docId: string;
  /** Document title */
  readonly title: string;
  /** Document version (semver) */
  readonly version: string;
  /** Document status */
  readonly status: 'Draft' | 'Review' | 'Approved';
  /** Agent or tool that generated the document */
  readonly generatedBy: string;
  /** ISO 8601 timestamp of generation */
  readonly generatedAt: string;
  /** Pipeline session ID */
  readonly pipelineSession?: string;
  /** Source document references */
  readonly sourceDocuments?: readonly string[];
  /** Change history entries */
  readonly changeHistory?: readonly ChangeHistoryEntry[];
}

/**
 * Result of parsing frontmatter from a document
 */
export interface ParsedFrontmatterResult {
  /** Parsed and validated frontmatter */
  readonly frontmatter: DocumentFrontmatter;
  /** Document body content (after frontmatter) */
  readonly body: string;
}

const FRONTMATTER_DELIMITER = '---';

/**
 * Generate YAML frontmatter string from options
 *
 * @param options - Frontmatter generation options
 * @returns YAML frontmatter block including delimiters
 */
export function generateFrontmatter(options: GenerateFrontmatterOptions): string {
  const frontmatterData: DocumentFrontmatter = {
    doc_id: options.docId,
    title: options.title,
    version: options.version,
    status: options.status,
    generated_by: options.generatedBy,
    generated_at: options.generatedAt,
    ...(options.pipelineSession !== undefined && {
      pipeline_session: options.pipelineSession,
    }),
    ...(options.sourceDocuments !== undefined &&
      options.sourceDocuments.length > 0 && {
        source_documents: [...options.sourceDocuments],
      }),
    ...(options.changeHistory !== undefined &&
      options.changeHistory.length > 0 && {
        change_history: [...options.changeHistory],
      }),
  };

  // Validate before serializing
  DocumentFrontmatterSchema.parse(frontmatterData);

  const yamlStr = yaml.dump(frontmatterData, {
    lineWidth: 100,
    noRefs: true,
    quotingType: "'",
    forceQuotes: false,
  });

  return `${FRONTMATTER_DELIMITER}\n${yamlStr}${FRONTMATTER_DELIMITER}\n`;
}

/**
 * Parse YAML frontmatter from a document string
 *
 * @param content - Full document content with frontmatter
 * @returns Parsed frontmatter and body, or null if no frontmatter found
 */
export function parseFrontmatter(content: string): ParsedFrontmatterResult | null {
  const trimmed = content.trimStart();

  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return null;
  }

  // Find the closing delimiter
  const afterFirst = trimmed.indexOf('\n');
  if (afterFirst === -1) {
    return null;
  }

  const closingIndex = trimmed.indexOf(`\n${FRONTMATTER_DELIMITER}`, afterFirst);
  if (closingIndex === -1) {
    return null;
  }

  const yamlContent = trimmed.slice(afterFirst + 1, closingIndex);
  const body = trimmed.slice(closingIndex + 1 + FRONTMATTER_DELIMITER.length);

  const parsed = yaml.load(yamlContent);
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const validated = DocumentFrontmatterSchema.parse(parsed);

  return {
    frontmatter: validated,
    body: body.startsWith('\n') ? body.slice(1) : body,
  };
}

/**
 * Prepend frontmatter to document content
 *
 * If the content already has frontmatter, it is replaced.
 *
 * @param content - Document markdown content
 * @param options - Frontmatter generation options
 * @returns Content with frontmatter prepended
 */
export function prependFrontmatter(content: string, options: GenerateFrontmatterOptions): string {
  const existing = parseFrontmatter(content);
  const body = existing !== null ? existing.body : content;
  const frontmatter = generateFrontmatter(options);

  return `${frontmatter}\n${body}`;
}

/**
 * Append a change history entry to existing frontmatter in a document.
 *
 * If the document has no frontmatter or no change_history field,
 * the content is returned unchanged.
 *
 * @param content - Full document content with frontmatter
 * @param entry - Change history entry to append
 * @returns Updated content with the new change history entry
 */
export function appendChangeHistory(content: string, entry: ChangeHistoryEntry): string {
  const parsed = parseFrontmatter(content);
  if (parsed === null) {
    return content;
  }

  const { frontmatter, body } = parsed;
  const existingHistory = frontmatter.change_history ?? [];

  const updatedFrontmatter: DocumentFrontmatter = {
    ...frontmatter,
    change_history: [...existingHistory, entry],
  };

  const yamlStr = yaml.dump(updatedFrontmatter, {
    lineWidth: 100,
    noRefs: true,
    quotingType: "'",
    forceQuotes: false,
  });

  return `${FRONTMATTER_DELIMITER}\n${yamlStr}${FRONTMATTER_DELIMITER}\n\n${body}`;
}
