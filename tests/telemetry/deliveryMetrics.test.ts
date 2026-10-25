/**
 * Delivery metrics schema, consent, and local export (#956).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DELIVERY_METRICS_SCHEMA_VERSION,
  DeliveryMetricsRecordSchema,
  parseDeliveryMetricsRecord,
} from '../../src/telemetry/deliveryMetrics.js';
import {
  DELIVERY_METRICS_POLICY_VERSION,
  JsonlDeliveryMetricsSink,
  deliveryMetricsConsent,
  deliveryMetricsFile,
  jsonlDeliveryMetricsSink,
} from '../../src/telemetry/deliveryMetricsExport.js';
import {
  PRIVACY_POLICY,
  PRIVACY_POLICY_VERSION,
  Telemetry,
} from '../../src/telemetry/Telemetry.js';
import { attemptRecord, pipelineRecord, stageRecord, usage } from './fixtures/deliveryRecords.js';

describe('delivery metrics schema', () => {
  it('accepts attempt, stage, and pipeline records of schema version 1', () => {
    for (const record of [attemptRecord(), stageRecord(), pipelineRecord()])
      expect(DeliveryMetricsRecordSchema.parse(record)).toEqual(record);
    expect(DELIVERY_METRICS_SCHEMA_VERSION).toBe(1);
  });

  it('keeps unknown usage (null) apart from a measured zero through JSON', () => {
    const unknown = attemptRecord({
      usage: usage('none', null, null, null, null),
      turnCount: null,
    });
    const zero = attemptRecord({ usage: usage('result', 0, 0, 0, 0), turnCount: 0 });
    const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
    const parsedUnknown = parseDeliveryMetricsRecord(roundTrip(unknown));
    const parsedZero = parseDeliveryMetricsRecord(roundTrip(zero));
    expect(
      parsedUnknown.ok && parsedUnknown.record.kind === 'attempt' && parsedUnknown.record.usage
    ).toEqual(usage('none', null, null, null, null));
    expect(
      parsedZero.ok && parsedZero.record.kind === 'attempt' && parsedZero.record.usage
    ).toEqual(usage('result', 0, 0, 0, 0));
  });

  it('rejects free-text fields, unknown enums, and other versions', () => {
    expect(
      parseDeliveryMetricsRecord({ ...attemptRecord(), prompt: 'Build a login page' })
    ).toEqual({
      ok: false,
      reason: expect.stringContaining('prompt'),
    });
    expect(parseDeliveryMetricsRecord({ ...attemptRecord(), outcome: 'aborted' }).ok).toBe(false);
    expect(parseDeliveryMetricsRecord({ ...attemptRecord(), schemaVersion: 2 }).ok).toBe(false);
    expect(
      parseDeliveryMetricsRecord({ ...attemptRecord(), toolUses: { 'name with spaces': 1 } }).ok
    ).toBe(false);
    expect(
      parseDeliveryMetricsRecord({
        ...stageRecord(),
        approval: {
          outcome: 'rejected',
          basis: 'prompt',
          boundaries: ['review'],
          effects: [],
          decidedBy: 'user',
          reused: false,
          reason: 'Wrong scope',
        },
      }).ok
    ).toBe(false);
    // Exhaustive counts: every outcome key is required.
    expect(
      parseDeliveryMetricsRecord({
        ...pipelineRecord(),
        attempts: { total: 1, retries: 0, byOutcome: { succeeded: 1 } },
      }).ok
    ).toBe(false);
  });
});

describe('delivery metrics consent', () => {
  it('exports only with consent granted under a policy that lists delivery metrics', () => {
    const record = (status: 'granted' | 'denied' | 'pending', policyVersion: string) => ({
      status,
      policyVersion,
      timestamp: '2026-10-26T00:00:00.000Z',
    });
    expect(deliveryMetricsConsent(null)).toEqual({ status: 'pending', export: false });
    expect(deliveryMetricsConsent(record('pending', PRIVACY_POLICY_VERSION))).toEqual({
      status: 'pending',
      export: false,
    });
    expect(deliveryMetricsConsent(record('denied', PRIVACY_POLICY_VERSION))).toEqual({
      status: 'denied',
      export: false,
    });
    expect(deliveryMetricsConsent(record('granted', '1.0.0'))).toEqual({
      status: 'outdated',
      export: false,
    });
    expect(deliveryMetricsConsent(record('granted', DELIVERY_METRICS_POLICY_VERSION))).toEqual({
      status: 'granted',
      export: true,
    });
    expect(deliveryMetricsConsent(record('granted', '1.10.0')).export).toBe(true);
  });

  it('the privacy policy lists the local delivery metrics export', () => {
    expect(PRIVACY_POLICY_VERSION).toBe(DELIVERY_METRICS_POLICY_VERSION);
    expect(PRIVACY_POLICY.dataCollected.join('\n')).toContain('.ad-sdlc/scratchpad/metrics/');
  });

  describe('Telemetry.getDeliveryMetricsConsent', () => {
    let baseDir: string;
    beforeEach(async () => {
      baseDir = await mkdtemp(join(tmpdir(), 'delivery-consent-'));
    });
    afterEach(async () => {
      await rm(baseDir, { recursive: true, force: true });
    });

    it('follows the consent record that ad-sdlc telemetry enable and disable write', async () => {
      const telemetry = new Telemetry({ baseDir, autoFlush: false });
      expect(telemetry.getDeliveryMetricsConsent()).toEqual({ status: 'pending', export: false });
      telemetry.setConsent(true);
      expect(new Telemetry({ baseDir }).getDeliveryMetricsConsent()).toEqual({
        status: 'granted',
        export: true,
      });
      telemetry.revokeConsent();
      expect(new Telemetry({ baseDir }).getDeliveryMetricsConsent().status).toBe('denied');

      // Consent recorded under policy 1.0.0 predates the export.
      await writeFile(
        join(baseDir, 'telemetry-consent.json'),
        JSON.stringify({
          status: 'granted',
          timestamp: '2025-01-13T00:00:00Z',
          policyVersion: '1.0.0',
        })
      );
      expect(new Telemetry({ baseDir }).getDeliveryMetricsConsent()).toEqual({
        status: 'outdated',
        export: false,
      });
    });
  });
});

describe('JSONL export', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'delivery-export-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('appends one validated record per line under <scratchpad>/metrics/<session>.jsonl', async () => {
    const session = {
      sessionId: 'abc-123',
      projectDir: dir,
      scratchpadDir: join(dir, '.ad-sdlc/scratchpad'),
    };
    const sink = jsonlDeliveryMetricsSink(session);
    expect(sink.location).toBe('.ad-sdlc/scratchpad/metrics/abc-123.jsonl');
    expect(sink.file).toBe(deliveryMetricsFile(session.scratchpadDir, 'abc-123'));
    await Promise.all([
      sink.write(attemptRecord()),
      sink.write(stageRecord()),
      sink.write(pipelineRecord()),
    ]);
    const lines = (await readFile(sink.file, 'utf8')).trimEnd().split('\n');
    expect(lines.map((line) => (JSON.parse(line) as { kind: string }).kind)).toEqual([
      'attempt',
      'stage',
      'pipeline',
    ]);
  });

  it('refuses an invalid record and keeps appending after a failed write', async () => {
    const blocked = join(dir, 'metrics');
    await writeFile(blocked, ''); // a file where the directory should be
    const sink = new JsonlDeliveryMetricsSink(join(blocked, 'session.jsonl'));
    await expect(sink.write(attemptRecord())).rejects.toThrow();
    expect(() => sink.write({ ...attemptRecord(), stage: 'has spaces' })).toThrow();

    await rm(blocked);
    await sink.write(stageRecord());
    const lines = (await readFile(sink.file, 'utf8')).split('\n').filter(Boolean);
    expect(lines.map((line) => (JSON.parse(line) as { kind: string }).kind)).toEqual(['stage']);
  });
});
