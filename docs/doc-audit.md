# Document Audit CLI

> **Script**: `scripts/audit-docs.ts`
> **Module**: `src/doc-audit/`
> **Purpose**: Validate pipeline-generated AD-SDLC documents for integrity, completeness, and cross-reference consistency.

## Overview

The document audit CLI inspects the markdown artifacts produced by the AD-SDLC
pipeline (PRD, SRS, SDS, SDP, TM, SVP, TD, DBS) and reports any issues that
would block downstream consumers. It is designed to run both as a local
developer check and as a CI gate — see `.github/workflows/docs-check.yml` for
the `audit-docs` job.

The auditor produces two report files:

| File                | Format                   | Purpose                                  |
| ------------------- | ------------------------ | ---------------------------------------- |
| `audit-report.json` | Stable JSON              | CI processing, downstream tooling        |
| `audit-report.md`   | GitHub-flavored Markdown | Human review, PR comments, job summaries |

## Usage

### Running via npm

```bash
npm run audit:docs -- --project-dir <path> [--output <dir>] [--quiet]
```

### Running directly with tsx

```bash
npx tsx scripts/audit-docs.ts --project-dir <path> [--output <dir>] [--quiet]
```

### Options

| Flag                       | Default          | Description                                                                |
| -------------------------- | ---------------- | -------------------------------------------------------------------------- |
| `-p, --project-dir <path>` | _(required)_     | Project root that contains the generated documents                         |
| `-o, --output <path>`      | `.ad-sdlc/audit` | Directory where reports are written (resolved relative to `--project-dir`) |
| `-q, --quiet`              | off              | Suppress non-essential stdout output                                       |

### Exit Codes

| Code | Meaning                                                                 |
| ---- | ----------------------------------------------------------------------- |
| `0`  | Audit passed — zero error-severity findings                             |
| `1`  | Audit failed, project directory missing, or unexpected internal failure |

## Document Discovery

The auditor looks for documents in two layouts and merges the results:

1. **Flat layout** — files in the project root:
   `prd.md`, `srs.md`, `sds.md`, `sdp.md`, `tm.md`, `svp.md`, `td.md`, `dbs.md`.
2. **Scratchpad layout** — files inside numeric subdirectories of
   `.ad-sdlc/scratchpad/documents/`, matching the output of the pipeline.

The first match for each document kind wins. Missing documents are listed in
the report but do not cause the audit to fail on their own — they simply
propagate through later checks (e.g. traceability) which will flag the
problem at the appropriate severity.

## Checks

The auditor runs a fixed set of checks in order. Each check emits findings
tagged with an ID, severity, document path, line number, message, and an
optional fix suggestion.

| Check             | Errors | Warnings | What it validates                                                            |
| ----------------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `frontmatter`     | yes    | —        | YAML frontmatter exists, parses, and conforms to `DocumentFrontmatterSchema` |
| `section`         | yes    | —        | Required top-level headings are present for each document kind               |
| `cross-reference` | yes    | —        | IDs referenced across documents (FR/SF/CMP/NFR/UC/TC) resolve                |
| `traceability`    | —      | yes      | Forward PRD→SRS→SDS coverage and backward SDS→SRS coverage                   |
| `orphan`          | —      | yes      | SRS features that are never realized by an SDS component                     |
| `mermaid`         | —      | yes      | Mermaid code blocks are well-formed (matched brackets, non-empty)            |
| `link`            | —      | yes      | Relative markdown links resolve on disk                                      |

Error-severity findings fail the audit. Warning-severity findings are
reported for review but do not block merges.

## Reports

### JSON Report

The JSON report contains the full `AuditReport` structure as defined in
`src/doc-audit/types.ts`:

```jsonc
{
  "generatedAt": "2026-04-13T05:27:11.582Z",
  "projectDir": "/path/to/project",
  "documents": [
    { "kind": "PRD", "path": "prd.md", "present": true },
    { "kind": "SRS", "path": "srs.md", "present": true },
    { "kind": "SDS", "path": "sds.md", "present": true },
    { "kind": "SDP", "path": "sdp.md", "present": false },
  ],
  "findings": [
    {
      "id": "traceability.forward.prd-srs",
      "severity": "error",
      "check": "traceability",
      "document": "prd.md",
      "message": "PRD requirement \"FR-999\" is not referenced by any SRS feature.",
      "suggestion": "Add \"Source: FR-999\" or inline reference in the SRS feature that realizes this requirement.",
    },
  ],
  "counts": { "error": 1, "warning": 0, "info": 0, "total": 1 },
  "coverage": {
    "prdToSrs": { "covered": 1, "total": 2, "percent": 50 },
    "srsToSds": { "covered": 2, "total": 2, "percent": 100 },
    "sdsToSrs": { "covered": 2, "total": 2, "percent": 100 },
    "overallPercent": 83,
  },
  "pass": false,
}
```

### Markdown Report

The Markdown report opens with a PASS/FAIL banner and then contains:

- **Findings Summary** — counts by severity
- **Documents** — every expected document kind with its presence flag
- **Traceability Coverage** — forward and backward coverage percentages
- **Findings** — findings grouped by severity with fix suggestions

When there are zero findings, the Findings section collapses to
`No findings. All checks passed.`

## CI Integration

The `audit-docs` job in `.github/workflows/docs-check.yml` runs the CLI on
every pull request and push to `main` that touches the `docs/` tree or
`doc-sync-points.yaml`. It:

1. Installs dependencies via `npm ci`.
2. Runs `npx tsx scripts/audit-docs.ts --project-dir . --output .ad-sdlc/audit`.
3. Uploads the `.ad-sdlc/audit/` directory as a `doc-audit-report` artifact.
4. Publishes the Markdown report to the GitHub job summary.
5. Fails the job if the CLI exits with a non-zero status.

## Programmatic Use

The `DocAuditor` class and report formatters are exported from
`src/doc-audit/index.ts` and can be consumed directly from other scripts or
tools:

```typescript
import { DocAuditor, formatJson, formatMarkdown } from './src/doc-audit/index.js';

const auditor = new DocAuditor({ projectDir: './my-project' });
const report = auditor.run();

if (!report.pass) {
  console.error(formatMarkdown(report));
  process.exit(1);
}
```

A custom set of checks can be supplied via `DocAuditorConfig.checks` for
testing or to opt into a subset of the default pipeline.
