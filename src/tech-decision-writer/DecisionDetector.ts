/**
 * Decision Detector
 *
 * Parses an SDS markdown document and identifies the set of technology
 * decisions that deserve a comparison document. A decision corresponds to
 * one row of the SDS `### 2.3 Technology Stack` table: each layer (Runtime,
 * Language, Framework, Database, Testing, ...) is a distinct decision.
 *
 * The detector is intentionally conservative — it only reports decisions
 * that are explicitly declared in the SDS. Callers can layer additional
 * heuristics on top if the SDS grows an ADR section in the future.
 */

import type { ParsedSDSComponentRef, ParsedSDSForDecisions, ParsedTechStackRow } from './types.js';

/**
 * Convert a topic or technology name into a URL-safe slug.
 *
 * Lowercases, replaces non-alphanumerics with a single dash, and trims
 * leading/trailing dashes. Returns `decision` if the input is empty.
 * @param topic - Human-readable topic string
 */
export function slugifyTopic(topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'decision';
}

/**
 * Parse the `### 2.3 Technology Stack` table from SDS markdown content.
 *
 * Accepts a leading `### 2.3 Technology Stack` heading (with or without the
 * section number) and reads the following markdown table whose header row
 * matches the SDS writer's layout:
 *
 *     | Layer | Technology | Version | Rationale |
 *     |-------|------------|---------|-----------|
 *     | Runtime | Node.js | 20.x | LTS version |
 *
 * @param content - Raw SDS markdown
 */
export function parseTechnologyStack(content: string): readonly ParsedTechStackRow[] {
  const rows: ParsedTechStackRow[] = [];

  // Locate the Technology Stack heading (tolerate numbering and case).
  const headingMatch = /^#{2,4}\s+[\d.]*\s*Technology\s+Stack\s*$/im.exec(content);
  if (headingMatch === null) {
    return rows;
  }

  const afterHeading = content.slice(headingMatch.index + headingMatch[0].length);
  // Stop at the next heading of equal-or-higher level to avoid leaking
  // into the next section.
  const endMatch = /\n#{1,4}\s/.exec(afterHeading);
  const block = endMatch !== null ? afterHeading.slice(0, endMatch.index) : afterHeading;

  // Match rows of the form `| col1 | col2 | col3 | col4 |` excluding the
  // header and separator rows. The regex requires exactly four pipes
  // beyond the leading one.
  const rowRegex =
    /^\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*$/gm;

  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(block)) !== null) {
    const layer = match[1]?.trim() ?? '';
    const technology = match[2]?.trim() ?? '';
    const version = match[3]?.trim() ?? '';
    const rationale = match[4]?.trim() ?? '';

    // Skip the header row and the separator row.
    if (layer.toLowerCase() === 'layer' && technology.toLowerCase() === 'technology') {
      continue;
    }
    if (/^-+$/.test(layer)) {
      continue;
    }

    if (layer.length === 0 || technology.length === 0) {
      continue;
    }

    rows.push({ layer, technology, version, rationale });
  }

  return rows;
}

/**
 * Extract component references (CMP-xxx) from the SDS for cross-linking.
 *
 * Matches both `### CMP-001: Name` and `### CMP-001` headings so the
 * detector stays compatible with both SDS templates.
 * @param content - Raw SDS markdown
 */
export function parseSDSComponents(content: string): readonly ParsedSDSComponentRef[] {
  const components: ParsedSDSComponentRef[] = [];
  const headingRegex = /^###\s+(CMP-\d+)(?::\s*(.+))?$/gm;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const id = match[1];
    if (id === undefined) continue;
    const name = match[2]?.trim() ?? id;
    components.push({ id, name });
  }

  return components;
}

/**
 * Extract NFR identifiers mentioned anywhere in the SDS.
 *
 * Deduplicates while preserving the order of first appearance.
 * @param content - Raw SDS markdown
 */
export function parseNfrReferences(content: string): readonly string[] {
  const seen = new Set<string>();
  const nfrRegex = /\bNFR-\d+\b/g;

  let match: RegExpExecArray | null;
  while ((match = nfrRegex.exec(content)) !== null) {
    seen.add(match[0]);
  }

  return [...seen];
}

/**
 * Extract the SDS document ID and product title from the frontmatter or
 * the first H1 heading. Falls back to the project ID when unavailable.
 * @param content - Raw SDS markdown
 * @param projectId - Fallback project identifier
 */
function parseSDSHeader(
  content: string,
  projectId: string
): { documentId: string; productName: string } {
  const docIdMatch =
    content.match(/^doc_id:\s*['"]?([^'"\n]+)['"]?/m) ??
    content.match(/\|\s*\*\*Document ID\*\*\s*\|\s*([^|]+)\s*\|/);
  const documentId = docIdMatch?.[1]?.trim() ?? `SDS-${projectId}`;

  const titleMatch =
    content.match(/^#\s+(?:Software Design Specification:\s*)?(.+)$/m) ??
    content.match(/^title:\s*['"]?([^'"\n]+)['"]?/m);
  const productName = titleMatch?.[1]?.trim() ?? projectId;

  return { documentId, productName };
}

/**
 * Detect technology decisions from an SDS markdown document.
 *
 * Returns a parsed extract containing everything the ComparisonGenerator
 * needs to produce one decision document per technology stack row.
 * @param content - Raw SDS markdown
 * @param projectId - Project identifier (used for fallback IDs)
 */
export function detectDecisions(content: string, projectId: string): ParsedSDSForDecisions {
  const { documentId, productName } = parseSDSHeader(content, projectId);
  const technologyStack = parseTechnologyStack(content);
  const components = parseSDSComponents(content);
  const nfrIds = parseNfrReferences(content);

  return {
    documentId,
    productName,
    technologyStack,
    components,
    nfrIds,
  };
}
