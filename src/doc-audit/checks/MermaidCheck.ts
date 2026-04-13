/**
 * MermaidCheck — validates that each fenced ```mermaid code block is
 * syntactically plausible.
 *
 * Full Mermaid parsing requires a browser environment, so this check uses a
 * lightweight structural validator that catches the most common mistakes:
 * empty blocks, blocks without a recognized diagram type, and unbalanced
 * brackets.
 */

import type { AuditCheck, AuditFinding, CheckResult, LoadedDocument } from '../types.js';

const DIAGRAM_KEYWORDS = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'gitGraph',
  'mindmap',
  'timeline',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
];

interface MermaidBlock {
  readonly startLine: number;
  readonly endLine: number;
  readonly body: string;
}

/**
 * Find all fenced ```mermaid blocks in the document.
 *
 * @param lines - Document lines.
 * @returns Discovered blocks with 1-based start/end line numbers.
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 * @param lines
 */
export function findMermaidBlocks(lines: readonly string[]): readonly MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  let inBlock = false;
  let start = 0;
  let bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!inBlock) {
      if (/^```mermaid\s*$/i.test(line)) {
        inBlock = true;
        start = i + 1;
        bodyLines = [];
      }
      continue;
    }
    if (/^```\s*$/.test(line)) {
      blocks.push({ startLine: start, endLine: i + 1, body: bodyLines.join('\n') });
      inBlock = false;
      bodyLines = [];
      continue;
    }
    bodyLines.push(line);
  }

  return blocks;
}

/**
 * Perform a minimal structural validation of a Mermaid block body.
 *
 * @param body - Raw block body.
 * @returns Error message if validation fails, else `null`.
 */
export function validateMermaidBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return 'Empty mermaid block.';
  }

  const firstToken = trimmed.split(/\s+/)[0] ?? '';
  const hasKeyword = DIAGRAM_KEYWORDS.some((kw) =>
    firstToken.toLowerCase().startsWith(kw.toLowerCase())
  );
  if (!hasKeyword) {
    return `Mermaid block does not start with a recognized diagram type (got "${firstToken}").`;
  }

  let square = 0;
  let paren = 0;
  let curly = 0;
  for (const ch of trimmed) {
    if (ch === '[') square++;
    else if (ch === ']') square--;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '{') curly++;
    else if (ch === '}') curly--;
    if (square < 0 || paren < 0 || curly < 0) {
      return 'Unbalanced brackets in mermaid block.';
    }
  }
  if (square !== 0 || paren !== 0 || curly !== 0) {
    return 'Unbalanced brackets in mermaid block.';
  }

  return null;
}

/**
 * Run the mermaid validation check across all documents.
 */
export class MermaidCheck implements AuditCheck {
  public readonly name = 'mermaid';

  /**
   *
   * @param documents
   */
  public run(documents: readonly LoadedDocument[]): CheckResult {
    const findings: AuditFinding[] = [];

    for (const doc of documents) {
      const blocks = findMermaidBlocks(doc.lines);
      for (const block of blocks) {
        const error = validateMermaidBody(block.body);
        if (error !== null) {
          findings.push({
            id: 'mermaid.invalid',
            severity: 'warning',
            check: this.name,
            document: doc.relativePath,
            line: block.startLine,
            message: `Mermaid diagram at line ${String(block.startLine)} failed structural validation: ${error}`,
            suggestion: 'Fix the mermaid block syntax or remove the fenced block.',
          });
        }
      }
    }

    return { findings };
  }
}
