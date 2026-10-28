/**
 * Cross-document consistency through sync points.
 *
 * `doc-sync-points.yaml` at the project root lists values that must appear in
 * every listed document (PRD, SRS, SDS). A sync point whose value appears in
 * some available documents but not in others is a violation. See
 * docs/DOCUMENT_UPDATE_PROTOCOL.md for the file format.
 *
 * @module stage-verifier/consistency
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

import type { DocumentType } from '../vnv/types.js';
import type { ConsistencyCheckResult, ConsistencyViolation } from './types.js';
import { resolveArtifactPath } from './ruleSupport.js';
import { StageVerificationError } from './errors.js';
import { VnvErrorCodes } from '../errors/codes.js';
import { ErrorSeverity } from '../errors/types.js';

/** Sync point definitions, relative to the project root. */
export const DOC_SYNC_POINTS_FILE = 'doc-sync-points.yaml';

/** Document locations used when the caller supplies none. */
export const DEFAULT_DOCUMENT_LOCATIONS: Readonly<Record<DocumentType, string>> = {
  prd: join('docs', 'PRD.md'),
  srs: join('docs', 'SRS.md'),
  sds: join('docs', 'SDS.md'),
};

/**
 * Read the documents that exist.
 * @param projectDir - Project root
 * @param documents - Document locations
 * @returns Contents per available document type
 */
async function readDocuments(
  projectDir: string,
  documents: Readonly<Partial<Record<DocumentType, string>>>
): Promise<Partial<Record<DocumentType, string>>> {
  const contents: Partial<Record<DocumentType, string>> = {};
  for (const [docType, location] of Object.entries(documents) as [DocumentType, string][]) {
    const docPath = resolveArtifactPath(location, projectDir);
    if (!existsSync(docPath)) continue;
    try {
      contents[docType] = await readFile(docPath, 'utf-8');
    } catch {
      // An unreadable document is unavailable, like a missing one
    }
  }
  return contents;
}

/**
 * Check sync points across the available documents.
 *
 * `syncPointsChecked` counts well-formed sync points that list two or more
 * documents; `syncPointsEvaluated` counts those whose value could be compared
 * because at least two of their documents are available.
 *
 * @param projectDir - Absolute project root
 * @param documents - Document locations (absolute or project-relative)
 * @returns Consistency result with any violations found
 * @throws StageVerificationError when the sync point file cannot be read or parsed
 */
export async function checkCrossDocumentConsistency(
  projectDir: string,
  documents: Readonly<Partial<Record<DocumentType, string>>> = DEFAULT_DOCUMENT_LOCATIONS
): Promise<ConsistencyCheckResult> {
  const syncPointsPath = join(projectDir, DOC_SYNC_POINTS_FILE);
  const none: ConsistencyCheckResult = {
    passed: true,
    syncPointsChecked: 0,
    syncPointsEvaluated: 0,
    violations: [],
  };
  if (!existsSync(syncPointsPath)) return none;

  let syncPointsContent: string;
  try {
    syncPointsContent = await readFile(syncPointsPath, 'utf-8');
  } catch (err) {
    throw new StageVerificationError(
      VnvErrorCodes.VNV_CONSISTENCY_VIOLATION,
      `Failed to read doc-sync-points.yaml: ${err instanceof Error ? err.message : String(err)}`,
      {
        severity: ErrorSeverity.MEDIUM,
        category: 'recoverable',
        context: { projectDir, syncPointsPath },
      }
    );
  }

  let syncPointsData: Record<string, unknown>;
  try {
    const parsed = yaml.load(syncPointsContent);
    if (parsed === null || typeof parsed !== 'object') {
      throw new Error('Parsed content is not an object');
    }
    syncPointsData = parsed as Record<string, unknown>;
  } catch (err) {
    throw new StageVerificationError(
      VnvErrorCodes.VNV_CONSISTENCY_VIOLATION,
      `Failed to parse doc-sync-points.yaml: ${err instanceof Error ? err.message : String(err)}`,
      {
        severity: ErrorSeverity.MEDIUM,
        category: 'recoverable',
        context: { projectDir },
      }
    );
  }

  const syncPoints = syncPointsData['syncPoints'] ?? syncPointsData['sync_points'];
  if (!Array.isArray(syncPoints)) return none;

  const docContents = await readDocuments(projectDir, documents);
  const violations: ConsistencyViolation[] = [];
  let syncPointsChecked = 0;
  let syncPointsEvaluated = 0;

  for (const syncPoint of syncPoints) {
    if (typeof syncPoint !== 'object' || syncPoint === null) {
      continue;
    }

    const sp = syncPoint as Record<string, unknown>;
    const rawName = sp['name'] ?? sp['id'];
    const name =
      typeof rawName === 'string'
        ? rawName
        : typeof rawName === 'number'
          ? String(rawName)
          : 'unknown';
    const sourceDocs = sp['documents'] ?? sp['docs'];

    if (!Array.isArray(sourceDocs) || sourceDocs.length < 2) {
      continue;
    }

    syncPointsChecked++;

    // Check if the value/pattern exists in all referenced documents
    const pattern = sp['pattern'] ?? sp['value'];
    if (typeof pattern !== 'string') {
      continue;
    }

    const docsWithPattern: string[] = [];
    const docsWithoutPattern: string[] = [];

    for (const docRef of sourceDocs) {
      const docType = String(docRef).toLowerCase() as DocumentType;
      const content = docContents[docType];
      if (content === undefined) {
        // Document not available; skip
        continue;
      }

      if (content.includes(pattern)) {
        docsWithPattern.push(docType);
      } else {
        docsWithoutPattern.push(docType);
      }
    }

    if (docsWithPattern.length + docsWithoutPattern.length >= 2) syncPointsEvaluated++;

    // If pattern found in some but not all available docs, report violation
    if (docsWithPattern.length > 0 && docsWithoutPattern.length > 0) {
      const severity = sp['severity'] as 'critical' | 'high' | 'medium' | undefined;
      const sourceDoc = docsWithPattern[0] ?? 'unknown';
      const targetDoc = docsWithoutPattern[0] ?? 'unknown';
      violations.push({
        syncPointName: name,
        severity: severity ?? 'medium',
        sourceDoc,
        targetDoc,
        description: `Sync point '${name}' pattern '${pattern}' found in ${docsWithPattern.join(', ')} but missing from ${docsWithoutPattern.join(', ')}`,
      });
    }
  }

  return {
    passed: violations.length === 0,
    syncPointsChecked,
    syncPointsEvaluated,
    violations,
  };
}
