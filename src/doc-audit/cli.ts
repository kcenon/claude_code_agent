import { Command } from 'commander';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DocAuditor } from './DocAuditor.js';
import { AuditReportWriteError, DocAuditError } from './errors.js';
import { formatJson, formatMarkdown } from './reportFormat.js';

interface CliOptions {
  projectDir: string;
  output: string;
  quiet?: boolean;
}

/** * Parse CLI arguments into a typed options object.
 * @param argv - Command arguments without the executable
 * @returns Resolved audit options
 */
function parseArgs(argv: readonly string[]): CliOptions {
  const program = configureAuditDocsCommand(new Command());

  program.parse([...argv], { from: 'user' });
  const opts = program.opts<{ projectDir: string; output: string; quiet?: boolean }>();
  return {
    projectDir: resolve(opts.projectDir),
    output: resolve(opts.projectDir, opts.output),
    ...(opts.quiet !== undefined ? { quiet: opts.quiet } : {}),
  };
}

/** * Write a report file to disk, wrapping I/O errors in AuditReportWriteError.
 * @param outputPath - Report destination
 * @param content - Formatted report content
 */
function writeReport(outputPath: string, content: string): void {
  try {
    writeFileSync(outputPath, content, 'utf-8');
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new AuditReportWriteError(outputPath, cause);
  }
}

/** * Execute the audit workflow and exit with the appropriate status code.
 * @param argv - Command arguments without the executable
 * @returns Zero for a passing audit, one for failure
 */
export function runAuditDocs(argv: readonly string[]): number {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`audit-docs: ${message}\n`);
    return 1;
  }

  const auditor = new DocAuditor({ projectDir: options.projectDir });

  let report;
  try {
    report = auditor.run();
  } catch (err) {
    if (err instanceof DocAuditError) {
      process.stderr.write(`audit-docs: ${err.message}\n`);
      return 1;
    }
    throw err;
  }

  try {
    mkdirSync(options.output, { recursive: true });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `audit-docs: failed to create output directory ${options.output}: ${cause}\n`
    );
    return 1;
  }

  const jsonPath = join(options.output, 'audit-report.json');
  const mdPath = join(options.output, 'audit-report.md');

  try {
    writeReport(jsonPath, formatJson(report));
    writeReport(mdPath, formatMarkdown(report));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`audit-docs: ${message}\n`);
    return 1;
  }

  if (options.quiet !== true) {
    const status = report.pass ? 'PASS' : 'FAIL';
    process.stdout.write(
      `Audit ${status}: ${String(report.counts.error)} error(s), ${String(report.counts.warning)} warning(s), ${String(report.counts.info)} info\n`
    );
    process.stdout.write(`  JSON: ${jsonPath}\n`);
    process.stdout.write(`  Markdown: ${mdPath}\n`);
  }

  return report.pass ? 0 : 1;
}

/** Shared options for the packaged CLI and source script.
 * @param program - Commander command to configure
 * @returns Configured command
 */
export function configureAuditDocsCommand(program: Command): Command {
  program
    .name('audit-docs')
    .description('Audit generated AD-SDLC documents for integrity and traceability.')
    .requiredOption(
      '-p, --project-dir <path>',
      'Project directory that contains the generated documents'
    )
    .option('-o, --output <path>', 'Output directory for audit reports', '.ad-sdlc/audit')
    .option('-q, --quiet', 'Suppress non-essential stdout output');

  return program;
}
