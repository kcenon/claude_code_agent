/**
 * `ad-sdlc telemetry report`: the delivery metrics evaluation report (#956).
 * Reads the JSONL exports of a project (or the given files) and an optional
 * review file a person supplies. See docs/guides/delivery-metrics.md.
 */
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Command } from 'commander';

import { DEFAULT_ORCHESTRATOR_CONFIG } from '../ad-sdlc-orchestrator/types.js';
import {
  DELIVERY_METRICS_DIRECTORY,
  deliveryMetricsFile,
} from '../telemetry/deliveryMetricsExport.js';
import {
  buildDeliveryMetricsReport,
  DeliveryReportInputError,
  formatDeliveryMetricsReport,
  readDeliveryMetricsFiles,
  readDeliveryReviewInput,
} from '../telemetry/deliveryMetricsReport.js';

/** Output formats of the report command. */
export const METRICS_REPORT_FORMATS = ['text', 'json'] as const;

/**
 * Declare the report command's argument and options.
 * @param command - Command to configure
 * @returns Configured command
 */
export function configureMetricsReportCommand(command: Command): Command {
  return command
    .description(
      'Report delivery metrics: run, stage, and attempt outcomes, SDK usage, resume success, and supplied review data'
    )
    .argument('[files...]', 'Delivery metrics JSONL files (default: the exports of --project-dir)')
    .option(
      '--project-dir <dir>',
      'Project whose exports are read when no file is given',
      process.cwd()
    )
    .option('--session <id>', 'Use only the records of this session')
    .option(
      '--supplied <file>',
      'Review data a person supplied: accepted pull requests, rework time, requirement evidence'
    )
    .option('--format <format>', 'Output format: text | json', 'text');
}

/** Line sink of the report command. */
export interface MetricsReportOutput {
  info(message: string): void;
  error(message: string): void;
}

/**
 * Export files of a project, or of one session.
 * @param projectDir - Project root
 * @param session - Session filter
 * @returns Absolute JSONL paths, sorted
 */
async function projectExports(projectDir: string, session: string | undefined): Promise<string[]> {
  const scratchpad = resolve(projectDir, DEFAULT_ORCHESTRATOR_CONFIG.scratchpadDir);
  const directory = join(scratchpad, DELIVERY_METRICS_DIRECTORY);
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return [];
  }
  if (session !== undefined) {
    const file = deliveryMetricsFile(scratchpad, session);
    return names.includes(`${session}.jsonl`) ? [file] : [];
  }
  return names
    .filter((name) => name.endsWith('.jsonl'))
    .sort()
    .map((name) => join(directory, name));
}

/**
 * Body of `ad-sdlc telemetry report`.
 * @param files - JSONL files given on the command line
 * @param options - Commander options
 * @param output - Line sink
 * @param now - Report timestamp (tests)
 * @returns Exit status: 0 for a report, 1 for missing or unreadable input
 */
export async function executeMetricsReportCommand(
  files: readonly string[],
  options: Readonly<Record<string, unknown>>,
  output: MetricsReportOutput,
  now?: Date
): Promise<number> {
  const format = options['format'] ?? 'text';
  if (format !== 'text' && format !== 'json') {
    output.error('Invalid output format. Use text or json.');
    return 1;
  }
  const session = typeof options['session'] === 'string' ? options['session'] : undefined;
  const projectDir = resolve(
    typeof options['projectDir'] === 'string' ? options['projectDir'] : process.cwd()
  );
  try {
    const paths = files.length > 0 ? [...files] : await projectExports(projectDir, session);
    if (paths.length === 0) {
      output.error(
        `No delivery metrics found${session === undefined ? '' : ` for session ${session}`} in ${join(projectDir, DEFAULT_ORCHESTRATOR_CONFIG.scratchpadDir, DELIVERY_METRICS_DIRECTORY)}. 'ad-sdlc run' exports them when telemetry consent is granted ('ad-sdlc telemetry enable --yes').`
      );
      return 1;
    }
    const input = await readDeliveryMetricsFiles(paths);
    const suppliedPath = typeof options['supplied'] === 'string' ? options['supplied'] : undefined;
    const supplied =
      suppliedPath === undefined
        ? undefined
        : { path: suppliedPath, data: await readDeliveryReviewInput(suppliedPath) };
    const report = buildDeliveryMetricsReport(input, {
      ...(supplied !== undefined ? { supplied } : {}),
      ...(session !== undefined ? { session } : {}),
      ...(now !== undefined ? { generatedAt: now } : {}),
    });
    output.info(
      format === 'json' ? JSON.stringify(report, null, 2) : formatDeliveryMetricsReport(report)
    );
    return 0;
  } catch (error) {
    if (error instanceof DeliveryReportInputError) {
      output.error(error.message);
      return 1;
    }
    throw error;
  }
}
