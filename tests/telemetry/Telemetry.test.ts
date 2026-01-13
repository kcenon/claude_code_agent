import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  Telemetry,
  getTelemetry,
  resetTelemetry,
  isTelemetryInitialized,
  PRIVACY_POLICY,
  PRIVACY_POLICY_VERSION,
} from '../../src/telemetry/index.js';

describe('Telemetry', () => {
  let telemetry: Telemetry;
  let tempDir: string;

  beforeEach(() => {
    resetTelemetry();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-test-'));
    telemetry = new Telemetry({
      baseDir: tempDir,
      config: {
        enabled: true,
      },
      autoFlush: false,
    });
  });

  afterEach(() => {
    resetTelemetry();
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('consent management', () => {
    it('should start with pending consent status', () => {
      expect(telemetry.getConsentStatus()).toBe('pending');
    });

    it('should not record events without consent', () => {
      const event = telemetry.recordEvent('command_executed', {
        command: 'test',
        success: true,
        durationMs: 100,
      });

      expect(event).toBeNull();
      expect(telemetry.getPendingEventCount()).toBe(0);
    });

    it('should grant consent when setConsent(true) is called', () => {
      const record = telemetry.setConsent(true);

      expect(record.status).toBe('granted');
      expect(record.policyVersion).toBe(PRIVACY_POLICY_VERSION);
      expect(telemetry.isConsentGranted()).toBe(true);
    });

    it('should deny consent when setConsent(false) is called', () => {
      const record = telemetry.setConsent(false);

      expect(record.status).toBe('denied');
      expect(telemetry.isConsentGranted()).toBe(false);
    });

    it('should revoke consent and clear buffered data', () => {
      telemetry.setConsent(true);
      telemetry.recordEvent('command_executed', {
        command: 'test',
        success: true,
        durationMs: 100,
      });

      expect(telemetry.getPendingEventCount()).toBe(1);

      telemetry.revokeConsent();

      expect(telemetry.isConsentGranted()).toBe(false);
      expect(telemetry.getPendingEventCount()).toBe(0);
    });

    it('should persist consent to file', () => {
      telemetry.setConsent(true);

      const consentFile = path.join(tempDir, 'telemetry-consent.json');
      expect(fs.existsSync(consentFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(consentFile, 'utf-8'));
      expect(content.status).toBe('granted');
    });

    it('should load persisted consent on initialization', () => {
      telemetry.setConsent(true);

      // Create new instance with same baseDir
      const telemetry2 = new Telemetry({
        baseDir: tempDir,
        config: { enabled: true },
      });

      expect(telemetry2.isConsentGranted()).toBe(true);
    });
  });

  describe('event recording', () => {
    beforeEach(() => {
      telemetry.setConsent(true);
    });

    it('should record events when consent is granted', () => {
      const event = telemetry.recordEvent('command_executed', {
        command: 'init',
        success: true,
        durationMs: 150,
      });

      expect(event).not.toBeNull();
      expect(event?.type).toBe('command_executed');
      expect(event?.properties.command).toBe('init');
      expect(telemetry.getPendingEventCount()).toBe(1);
    });

    it('should generate unique event IDs', () => {
      const event1 = telemetry.recordEvent('command_executed', {
        command: 'test1',
        success: true,
        durationMs: 100,
      });
      const event2 = telemetry.recordEvent('command_executed', {
        command: 'test2',
        success: true,
        durationMs: 100,
      });

      expect(event1?.eventId).not.toBe(event2?.eventId);
    });

    it('should use consistent session ID', () => {
      const event1 = telemetry.recordEvent('command_executed', {
        command: 'test1',
        success: true,
        durationMs: 100,
      });
      const event2 = telemetry.recordEvent('command_executed', {
        command: 'test2',
        success: true,
        durationMs: 100,
      });

      expect(event1?.sessionId).toBe(event2?.sessionId);
    });

    it('should record command execution events', () => {
      const event = telemetry.recordCommandExecution('analyze', true, 5000);

      expect(event?.type).toBe('command_executed');
      expect(event?.properties.command).toBe('analyze');
      expect(event?.properties.success).toBe(true);
      expect(event?.properties.durationMs).toBe(5000);
    });

    it('should record pipeline events', () => {
      const event = telemetry.recordPipelineEvent('started', 'full', 5);

      expect(event?.type).toBe('pipeline_started');
      expect(event?.properties.scope).toBe('full');
      expect(event?.properties.stageCount).toBe(5);
    });

    it('should record feature usage events', () => {
      const event = telemetry.recordFeatureUsage('interactive_wizard', 'init');

      expect(event?.type).toBe('feature_used');
      expect(event?.properties.feature).toBe('interactive_wizard');
      expect(event?.properties.category).toBe('init');
    });

    it('should throw on invalid event type', () => {
      expect(() => {
        telemetry.recordEvent('invalid_type' as 'command_executed', {});
      }).toThrow();
    });
  });

  describe('buffer management', () => {
    beforeEach(() => {
      telemetry.setConsent(true);
    });

    it('should flush events from buffer', () => {
      telemetry.recordEvent('command_executed', {
        command: 'test',
        success: true,
        durationMs: 100,
      });
      telemetry.recordEvent('command_executed', {
        command: 'test2',
        success: true,
        durationMs: 100,
      });

      expect(telemetry.getPendingEventCount()).toBe(2);

      const flushed = telemetry.flush();

      expect(flushed).toBe(2);
      expect(telemetry.getPendingEventCount()).toBe(0);
    });

    it('should auto-flush when buffer reaches max size', () => {
      const smallBufferTelemetry = new Telemetry({
        baseDir: tempDir,
        config: {
          enabled: true,
          maxBufferSize: 3,
        },
        autoFlush: false,
      });
      smallBufferTelemetry.setConsent(true);

      smallBufferTelemetry.recordEvent('command_executed', {
        command: 't1',
        success: true,
        durationMs: 1,
      });
      smallBufferTelemetry.recordEvent('command_executed', {
        command: 't2',
        success: true,
        durationMs: 2,
      });

      expect(smallBufferTelemetry.getPendingEventCount()).toBe(2);

      // Third event triggers flush
      smallBufferTelemetry.recordEvent('command_executed', {
        command: 't3',
        success: true,
        durationMs: 3,
      });

      expect(smallBufferTelemetry.getPendingEventCount()).toBe(0);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      telemetry.setConsent(true);
    });

    it('should track total events recorded', () => {
      telemetry.recordEvent('command_executed', {
        command: 't1',
        success: true,
        durationMs: 1,
      });
      telemetry.recordEvent('command_executed', {
        command: 't2',
        success: true,
        durationMs: 2,
      });

      const stats = telemetry.getStats();
      expect(stats.eventsRecorded).toBe(2);
    });

    it('should track pending events', () => {
      telemetry.recordEvent('command_executed', {
        command: 't1',
        success: true,
        durationMs: 1,
      });

      const stats = telemetry.getStats();
      expect(stats.eventsPending).toBe(1);
    });

    it('should track last flush time', () => {
      telemetry.recordEvent('command_executed', {
        command: 't1',
        success: true,
        durationMs: 1,
      });

      expect(telemetry.getStats().lastFlushAt).toBeNull();

      telemetry.flush();

      expect(telemetry.getStats().lastFlushAt).not.toBeNull();
    });
  });

  describe('session management', () => {
    it('should initialize session when consent granted', () => {
      expect(telemetry.getSession()).toBeNull();

      telemetry.setConsent(true);

      const session = telemetry.getSession();
      expect(session).not.toBeNull();
      expect(session?.platform).toBe(process.platform);
      expect(session?.nodeVersion).toBe(process.version);
    });

    it('should clear session on consent revocation', () => {
      telemetry.setConsent(true);
      expect(telemetry.getSession()).not.toBeNull();

      telemetry.revokeConsent();
      expect(telemetry.getSession()).toBeNull();
    });
  });

  describe('enable/disable', () => {
    it('should throw when enabling without consent', () => {
      telemetry.disable();
      expect(() => telemetry.enable()).toThrow();
    });

    it('should allow enabling after consent granted', () => {
      telemetry.setConsent(true);
      telemetry.disable();

      expect(telemetry.isEnabled()).toBe(false);

      telemetry.enable();

      expect(telemetry.isEnabled()).toBe(true);
    });
  });

  describe('shutdown', () => {
    beforeEach(() => {
      telemetry.setConsent(true);
    });

    it('should flush pending events on shutdown', () => {
      telemetry.recordEvent('command_executed', {
        command: 't1',
        success: true,
        durationMs: 1,
      });
      telemetry.recordEvent('command_executed', {
        command: 't2',
        success: true,
        durationMs: 2,
      });

      const flushed = telemetry.shutdown();

      expect(flushed).toBe(2);
      expect(telemetry.getPendingEventCount()).toBe(0);
    });
  });

  describe('singleton access', () => {
    it('should return same instance from getTelemetry', () => {
      const instance1 = getTelemetry({ baseDir: tempDir });
      const instance2 = getTelemetry({ baseDir: tempDir });

      expect(instance1).toBe(instance2);
    });

    it('should report initialization status', () => {
      resetTelemetry();
      expect(isTelemetryInitialized()).toBe(false);

      getTelemetry({ baseDir: tempDir });
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('should reset singleton on resetTelemetry', () => {
      // Reset first to ensure clean state
      resetTelemetry();

      const instance1 = getTelemetry({
        baseDir: tempDir,
        config: { enabled: true },
      });
      instance1.setConsent(true);
      instance1.recordEvent('command_executed', {
        command: 't1',
        success: true,
        durationMs: 1,
      });

      expect(instance1.getPendingEventCount()).toBe(1);

      const flushed = resetTelemetry();
      expect(flushed).toBe(1);
      expect(isTelemetryInitialized()).toBe(false);
    });
  });

  describe('privacy policy', () => {
    it('should have correct version', () => {
      expect(PRIVACY_POLICY.version).toBe(PRIVACY_POLICY_VERSION);
    });

    it('should list data collected', () => {
      expect(PRIVACY_POLICY.dataCollected.length).toBeGreaterThan(0);
    });

    it('should list data not collected', () => {
      expect(PRIVACY_POLICY.dataNotCollected.length).toBeGreaterThan(0);
    });

    it('should have retention period', () => {
      expect(PRIVACY_POLICY.retentionPeriod).toBe('90 days');
    });

    it('should return policy from getTelemetry instance', () => {
      const policy = telemetry.getPrivacyPolicy();
      expect(policy.version).toBe(PRIVACY_POLICY_VERSION);
    });
  });
});
