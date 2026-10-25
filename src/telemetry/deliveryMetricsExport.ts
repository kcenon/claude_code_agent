/**
 * Local export of delivery metrics records (#956).
 *
 * Records are appended as JSON lines to `<scratchpad>/metrics/<session>.jsonl`
 * (`.ad-sdlc/scratchpad/metrics/<session>.jsonl` for CLI runs), next to the
 * session file and inside the directory `ad-sdlc init` adds to `.gitignore`.
 * Nothing is sent anywhere. The export follows the telemetry consent record
 * (`ad-sdlc telemetry enable --yes`): records are written only when consent
 * was granted under a privacy policy that lists delivery metrics. See
 * docs/guides/delivery-metrics.md.
 *
 * @module telemetry/deliveryMetricsExport
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

import type { ConsentRecord } from './types.js';
import { DeliveryMetricsRecordSchema, type DeliveryMetricsRecord } from './deliveryMetrics.js';

/** Directory under the scratchpad that holds the exports. */
export const DELIVERY_METRICS_DIRECTORY = 'metrics';

/** First privacy policy version that lists delivery metrics. */
export const DELIVERY_METRICS_POLICY_VERSION = '1.1.0';

/**
 * Consent state of the delivery metrics export.
 *
 * - `granted`: consent was granted under a policy that lists delivery metrics.
 * - `outdated`: consent was granted under an older policy; run
 *   `ad-sdlc telemetry enable --yes` to accept the current one.
 * - `pending`: consent was never recorded.
 * - `denied`: consent was revoked (`ad-sdlc telemetry disable`).
 */
export type DeliveryMetricsConsentStatus = 'granted' | 'outdated' | 'pending' | 'denied';

/** Whether records are exported, and why. */
export interface DeliveryMetricsConsent {
  readonly status: DeliveryMetricsConsentStatus;
  readonly export: boolean;
}

/**
 * Compare dotted numeric versions.
 * @param a - Version
 * @param b - Version
 * @returns Negative, zero, or positive like a comparator
 */
function compareVersions(a: string, b: string): number {
  const left = a.split('.').map((part) => Number.parseInt(part, 10));
  const right = b.split('.').map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (Number.isNaN(difference)) return -1;
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Decide the export from the telemetry consent record.
 * @param record - Consent record (`Telemetry.getConsentRecord()`), null when never set
 * @returns Consent state and whether records are exported
 */
export function deliveryMetricsConsent(record: ConsentRecord | null): DeliveryMetricsConsent {
  if (record === null || record.status === 'pending') return { status: 'pending', export: false };
  if (record.status === 'denied') return { status: 'denied', export: false };
  return compareVersions(record.policyVersion, DELIVERY_METRICS_POLICY_VERSION) >= 0
    ? { status: 'granted', export: true }
    : { status: 'outdated', export: false };
}

/** Destination of delivery metrics records. */
export interface DeliveryMetricsSink {
  /**
   * Persist one record, in production order. A rejection is logged and counted;
   * it never fails the run.
   */
  write(record: DeliveryMetricsRecord): Promise<void>;
  /** Where records go (a project-relative path for the JSONL export). */
  readonly location?: string;
}

/** Export state reported on `PipelineResult.metrics`. */
export interface DeliveryMetricsExportStatus {
  /** A sink received the records. */
  readonly enabled: boolean;
  /** Sink location, when the sink reports one. */
  readonly location: string | null;
  /** Records the sink accepted. */
  readonly written: number;
  /** Records the sink rejected or that failed validation. */
  readonly failed: number;
  /** Telemetry consent that decided the export; null for programmatic runs. */
  readonly consent: DeliveryMetricsConsentStatus | null;
}

/** Records of one run and their export state (`PipelineResult.metrics`). */
export interface DeliveryMetricsSummary {
  /** Attempt, stage, and pipeline records of this run, in production order. */
  readonly records: readonly DeliveryMetricsRecord[];
  readonly export: DeliveryMetricsExportStatus;
}

/**
 * Export file of a session.
 * @param scratchpadDir - Absolute scratchpad directory of the session
 * @param sessionId - Pipeline session ID
 * @returns Absolute JSONL path
 */
export function deliveryMetricsFile(scratchpadDir: string, sessionId: string): string {
  return join(scratchpadDir, DELIVERY_METRICS_DIRECTORY, `${sessionId}.jsonl`);
}

/** Appends validated records to one JSONL file, one write at a time. */
export class JsonlDeliveryMetricsSink implements DeliveryMetricsSink {
  private queue: Promise<void> = Promise.resolve();

  /**
   * @param file - Absolute JSONL path
   * @param location - Reported location (defaults to the file)
   */
  constructor(
    readonly file: string,
    readonly location: string = file
  ) {}

  /**
   * Append one record after validating it against the schema.
   * @param record - Delivery metrics record
   * @returns Completion of this append
   */
  write(record: DeliveryMetricsRecord): Promise<void> {
    const line = `${JSON.stringify(DeliveryMetricsRecordSchema.parse(record))}\n`;
    // A failed append must not block later records.
    const next = this.queue
      .catch(() => undefined)
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        await appendFile(this.file, line, 'utf8');
      });
    this.queue = next;
    return next;
  }
}

/**
 * The JSONL export sink of a session, reporting a project-relative location.
 * @param session - Session identity and directories
 * @param session.sessionId - Pipeline session ID
 * @param session.scratchpadDir - Absolute scratchpad directory
 * @param session.projectDir - Absolute project root
 * @returns Sink appending to `<scratchpad>/metrics/<session>.jsonl`
 */
export function jsonlDeliveryMetricsSink(session: {
  readonly sessionId: string;
  readonly scratchpadDir: string;
  readonly projectDir: string;
}): JsonlDeliveryMetricsSink {
  const file = deliveryMetricsFile(session.scratchpadDir, session.sessionId);
  const location = relative(session.projectDir, file).split(sep).join('/');
  return new JsonlDeliveryMetricsSink(file, location);
}
