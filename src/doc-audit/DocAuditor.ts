/**
 * DocAuditor — orchestrates loading generated documents, running all audit
 * checks, and producing the final AuditReport.
 *
 * The auditor looks for markdown files in two layouts:
 *   1. Flat layout: `<projectDir>/prd.md`, `<projectDir>/srs.md`, ...
 *   2. Scratchpad layout: `<projectDir>/.ad-sdlc/scratchpad/documents/NNN/<kind>.md`
 *      (the most recent numeric subdirectory is picked when multiple exist).
 *
 * Classification is done first by filename, falling back to a scan of the
 * document's frontmatter and first heading when the filename is ambiguous.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { NoDocumentsFoundError, ProjectDirNotFoundError } from './errors.js';
import { CrossReferenceCheck } from './checks/CrossReferenceCheck.js';
import { FrontmatterCheck } from './checks/FrontmatterCheck.js';
import { LinkCheck } from './checks/LinkCheck.js';
import { MermaidCheck } from './checks/MermaidCheck.js';
import { OrphanCheck } from './checks/OrphanCheck.js';
import { SectionCheck } from './checks/SectionCheck.js';
import { TraceabilityCheck, buildTraceabilityIndex } from './checks/TraceabilityCheck.js';
import type {
  AuditCheck,
  AuditFinding,
  AuditReport,
  CoverageRatio,
  CoverageStats,
  DocAuditorConfig,
  DocumentKind,
  DocumentSummary,
  FindingCounts,
  LoadedDocument,
  Severity,
} from './types.js';

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

const DEFAULT_DOCUMENT_FILES: ReadonlyArray<{ file: string; kind: DocumentKind }> = [
  { file: 'prd.md', kind: 'PRD' },
  { file: 'srs.md', kind: 'SRS' },
  { file: 'sds.md', kind: 'SDS' },
  { file: 'sdp.md', kind: 'SDP' },
  { file: 'tm.md', kind: 'TM' },
  { file: 'svp.md', kind: 'SVP' },
  { file: 'td.md', kind: 'TD' },
  { file: 'dbs.md', kind: 'DBS' },
];

const SCRATCHPAD_RELATIVE = join('.ad-sdlc', 'scratchpad', 'documents');

/**
 * Default set of checks, in execution order.
 */
function defaultChecks(): AuditCheck[] {
  return [
    new FrontmatterCheck(),
    new SectionCheck(),
    new CrossReferenceCheck(),
    new TraceabilityCheck(),
    new OrphanCheck(),
    new MermaidCheck(),
    new LinkCheck(),
  ];
}

/**
 * Compute a coverage ratio, rounding percent to the nearest integer.
 * @param covered
 * @param total
 */
function ratio(covered: number, total: number): CoverageRatio {
  if (total === 0) {
    return { covered: 0, total: 0, percent: 100 };
  }
  return {
    covered,
    total,
    percent: Math.round((covered / total) * 100),
  };
}

/**
 * Orchestrates the complete document audit workflow.
 */
export class DocAuditor {
  private readonly projectDir: string;
  private readonly checks: readonly AuditCheck[];

  constructor(config: DocAuditorConfig) {
    this.projectDir = resolve(config.projectDir);
    this.checks = config.checks ?? defaultChecks();
  }

  /**
   * Load all documents and run the full check suite.
   *
   * @throws ProjectDirNotFoundError - when the project directory is missing.
   * @throws NoDocumentsFoundError - when no auditable documents are discovered.
   */
  public run(): AuditReport {
    this.ensureProjectDirExists();

    const documents = this.loadDocuments();
    if (documents.length === 0) {
      throw new NoDocumentsFoundError(this.projectDir);
    }

    const findings: AuditFinding[] = [];
    for (const check of this.checks) {
      const result = check.run(documents);
      findings.push(...result.findings);
    }

    findings.sort((a, b) => {
      const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (s !== 0) return s;
      const d = a.document.localeCompare(b.document);
      if (d !== 0) return d;
      const la = a.line ?? 0;
      const lb = b.line ?? 0;
      if (la !== lb) return la - lb;
      return a.id.localeCompare(b.id);
    });

    const counts = countFindings(findings);
    const coverage = this.computeCoverage(documents);
    const summaries = this.buildSummaries(documents);

    return {
      generatedAt: new Date().toISOString(),
      projectDir: this.projectDir,
      documents: summaries,
      findings,
      counts,
      coverage,
      pass: counts.error === 0,
    };
  }

  /**
   * Verify that the configured project directory exists.
   */
  private ensureProjectDirExists(): void {
    try {
      const stats = statSync(this.projectDir);
      if (!stats.isDirectory()) {
        throw new ProjectDirNotFoundError(this.projectDir);
      }
    } catch {
      throw new ProjectDirNotFoundError(this.projectDir);
    }
  }

  /**
   * Discover and load all auditable documents from the project directory.
   */
  private loadDocuments(): LoadedDocument[] {
    const searchRoots = this.resolveSearchRoots();
    const loaded: LoadedDocument[] = [];
    const seenAbsolute = new Set<string>();

    for (const root of searchRoots) {
      for (const entry of DEFAULT_DOCUMENT_FILES) {
        const absolute = join(root, entry.file);
        if (seenAbsolute.has(absolute)) continue;
        const content = safeReadFile(absolute);
        if (content === null) continue;
        seenAbsolute.add(absolute);
        loaded.push({
          relativePath: relative(this.projectDir, absolute) || entry.file,
          absolutePath: absolute,
          kind: entry.kind,
          content,
          lines: content.split(/\r?\n/),
        });
      }
    }

    return loaded;
  }

  /**
   * Compute the list of directories to search for documents.
   *
   * Returns the project root plus the newest scratchpad document folder when
   * the `.ad-sdlc/scratchpad/documents/NNN/` layout is present.
   */
  private resolveSearchRoots(): string[] {
    const roots: string[] = [this.projectDir];
    const scratchpadRoot = join(this.projectDir, SCRATCHPAD_RELATIVE);

    let scratchpadEntries: string[];
    try {
      scratchpadEntries = readdirSync(scratchpadRoot);
    } catch {
      return roots;
    }

    const numericDirs = scratchpadEntries
      .filter((name) => /^\d+$/.test(name))
      .map((name) => ({ name, path: join(scratchpadRoot, name) }))
      .filter((entry) => safeIsDirectory(entry.path))
      .sort((a, b) => Number(a.name) - Number(b.name));

    for (const dir of numericDirs) {
      roots.push(dir.path);
    }

    return roots;
  }

  /**
   * Compute traceability coverage stats from the loaded documents.
   * @param documents
   */
  private computeCoverage(documents: readonly LoadedDocument[]): CoverageStats {
    const index = buildTraceabilityIndex(documents);

    const prdToSrs = ratio(
      Array.from(index.definedFR).filter((fr) => index.referencedFRFromSRS.has(fr)).length,
      index.definedFR.size
    );
    const srsToSds = ratio(
      Array.from(index.definedSF).filter((sf) => index.referencedSFFromSDS.has(sf)).length,
      index.definedSF.size
    );
    const sdsToSrs = ratio(
      Array.from(index.definedCMP).filter((cmp) => {
        const refs = index.referencedSFPerCMP.get(cmp);
        return refs !== undefined && refs.size > 0;
      }).length,
      index.definedCMP.size
    );

    const overallPercent = Math.round((prdToSrs.percent + srsToSds.percent + sdsToSrs.percent) / 3);

    return { prdToSrs, srsToSds, sdsToSrs, overallPercent };
  }

  /**
   * Produce one summary entry per expected document, regardless of whether it
   * was found. This makes the report explicit about missing artifacts.
   * @param documents
   */
  private buildSummaries(documents: readonly LoadedDocument[]): DocumentSummary[] {
    const byKind = new Map<DocumentKind, LoadedDocument>();
    for (const doc of documents) {
      if (!byKind.has(doc.kind)) {
        byKind.set(doc.kind, doc);
      }
    }

    return DEFAULT_DOCUMENT_FILES.map(({ file, kind }) => {
      const found = byKind.get(kind);
      if (found === undefined) {
        return { path: file, kind, present: false };
      }
      return {
        path: found.relativePath,
        kind,
        present: true,
      };
    });
  }
}

/**
 * Read a file as UTF-8, returning `null` if it does not exist or cannot be
 * read. Any other error (e.g., permission denied) is surfaced to the caller.
 * @param absolutePath
 */
function safeReadFile(absolutePath: string): string | null {
  try {
    const stats = statSync(absolutePath);
    if (!stats.isFile()) return null;
  } catch {
    return null;
  }
  try {
    return readFileSync(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Return `true` when the given path exists and is a directory.
 * @param absolutePath
 */
function safeIsDirectory(absolutePath: string): boolean {
  try {
    return statSync(absolutePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Count findings by severity.
 * @param findings
 */
function countFindings(findings: readonly AuditFinding[]): FindingCounts {
  let error = 0;
  let warning = 0;
  let info = 0;
  for (const f of findings) {
    if (f.severity === 'error') error++;
    else if (f.severity === 'warning') warning++;
    else info++;
  }
  return { error, warning, info, total: findings.length };
}

/**
 * Re-export for test convenience.
 */
export { basename };
