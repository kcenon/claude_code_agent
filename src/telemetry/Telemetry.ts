/**
 * Telemetry service with opt-in consent mechanism
 *
 * Provides anonymous usage analytics collection with explicit user consent.
 * No personal data is collected. All data collection requires explicit opt-in.
 *
 * @module telemetry/Telemetry
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

import type {
  ConsentRecord,
  ConsentStatus,
  PrivacyPolicy,
  TelemetryConfig,
  TelemetryEvent,
  TelemetryEventType,
  TelemetryOptions,
  TelemetrySession,
  TelemetryStats,
} from './types.js';
import { ConsentRequiredError, ConsentStorageError, InvalidEventError } from './errors.js';

// ============================================================
// Constants
// ============================================================

/** Current privacy policy version */
export const PRIVACY_POLICY_VERSION = '1.0.0';

/** Valid consent status values for runtime validation */
const VALID_CONSENT_STATUSES: readonly ConsentStatus[] = ['granted', 'denied', 'pending'];

/** Default telemetry configuration */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: false, // Disabled by default - requires opt-in
  flushIntervalMs: 60000, // 1 minute
  maxBufferSize: 100,
  includeDebugEvents: false,
};

/** Privacy policy details */
export const PRIVACY_POLICY: PrivacyPolicy = {
  version: PRIVACY_POLICY_VERSION,
  lastUpdated: '2025-01-13',
  dataCollected: [
    'Command usage (which CLI commands are run)',
    'Pipeline execution metrics (duration, stage count)',
    'Feature usage patterns',
    'Error types (not error messages or stack traces)',
    'Platform information (OS type, Node.js version)',
  ],
  dataNotCollected: [
    'Personal identifying information (name, email, IP address)',
    'Project names or paths',
    'File contents or code',
    'API keys or credentials',
    'Error messages or stack traces',
    'Git repository information',
    'User-generated content',
  ],
  retentionPeriod: '90 days',
};

// ============================================================
// Telemetry Class
// ============================================================

/**
 * Telemetry service with opt-in consent management
 *
 * @example
 * ```typescript
 * const telemetry = new Telemetry();
 *
 * // Check consent status
 * if (telemetry.getConsentStatus() === 'pending') {
 *   // Show privacy policy
 *   console.log(telemetry.getPrivacyPolicy());
 *
 *   // Request consent
 *   await telemetry.setConsent(true);
 * }
 *
 * // Record event (only if consent granted)
 * telemetry.recordEvent('command_executed', {
 *   command: 'init',
 *   success: true,
 *   durationMs: 1234,
 * });
 * ```
 */
export class Telemetry {
  private readonly config: TelemetryConfig;
  private readonly baseDir: string;
  private readonly consentFilePath: string;
  private readonly autoFlush: boolean;

  private session: TelemetrySession | null = null;
  private eventBuffer: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private consentRecord: ConsentRecord | null = null;
  private totalEventsRecorded = 0;
  private lastFlushAt: string | null = null;

  /**
   * Creates a new Telemetry instance
   *
   * @param options - Telemetry options
   */
  constructor(options: TelemetryOptions = {}) {
    this.baseDir = options.baseDir ?? join(homedir(), '.ad-sdlc');
    this.consentFilePath = join(this.baseDir, 'telemetry-consent.json');
    this.autoFlush = options.autoFlush ?? true;

    this.config = {
      ...DEFAULT_TELEMETRY_CONFIG,
      ...options.config,
    };

    // Load existing consent
    this.loadConsent();

    // Initialize session if consent granted
    if (this.isConsentGranted()) {
      this.initializeSession();
    }
  }

  // ============================================================
  // Consent Management
  // ============================================================

  /**
   * Gets the current consent status
   *
   * @returns Current consent status
   */
  getConsentStatus(): ConsentStatus {
    return this.consentRecord?.status ?? 'pending';
  }

  /**
   * Gets the full consent record
   *
   * @returns Consent record or null if not set
   */
  getConsentRecord(): ConsentRecord | null {
    return this.consentRecord;
  }

  /**
   * Checks if consent has been granted
   *
   * @returns True if consent is granted
   */
  isConsentGranted(): boolean {
    return this.consentRecord?.status === 'granted';
  }

  /**
   * Checks if telemetry is enabled (consent granted and config enabled)
   *
   * @returns True if telemetry is active
   */
  isEnabled(): boolean {
    return this.config.enabled && this.isConsentGranted();
  }

  /**
   * Sets user consent for telemetry collection
   *
   * @param granted - Whether consent is granted
   * @returns Updated consent record
   * @throws ConsentStorageError if consent cannot be saved
   */
  setConsent(granted: boolean): ConsentRecord {
    const record: ConsentRecord = {
      status: granted ? 'granted' : 'denied',
      timestamp: new Date().toISOString(),
      policyVersion: PRIVACY_POLICY_VERSION,
    };

    this.saveConsent(record);
    this.consentRecord = record;

    // Initialize or cleanup based on consent
    if (granted && this.config.enabled) {
      this.initializeSession();
      this.startAutoFlush();
    } else {
      this.stopAutoFlush();
      this.eventBuffer = [];
      this.session = null;
    }

    return record;
  }

  /**
   * Revokes telemetry consent and clears all buffered data
   *
   * @returns Updated consent record
   */
  revokeConsent(): ConsentRecord {
    return this.setConsent(false);
  }

  /**
   * Gets the privacy policy information
   *
   * @returns Privacy policy details
   */
  getPrivacyPolicy(): PrivacyPolicy {
    return PRIVACY_POLICY;
  }

  // ============================================================
  // Event Recording
  // ============================================================

  /**
   * Records a telemetry event
   *
   * Events are only recorded if:
   * 1. User has granted consent
   * 2. Telemetry is enabled in configuration
   *
   * @param type - Event type
   * @param properties - Event properties (anonymous data only)
   * @returns The recorded event or null if telemetry is disabled
   * @throws InvalidEventError if event type is invalid
   */
  recordEvent(
    type: TelemetryEventType,
    properties: Record<string, string | number | boolean>
  ): TelemetryEvent | null {
    // Silently skip if not enabled (no error - this is expected behavior)
    if (!this.isEnabled()) {
      return null;
    }

    if (this.session === null) {
      this.initializeSession();
    }

    // Validate event type
    const validTypes: TelemetryEventType[] = [
      'command_executed',
      'pipeline_started',
      'pipeline_completed',
      'pipeline_failed',
      'agent_invoked',
      'error_occurred',
      'feature_used',
    ];

    if (!validTypes.includes(type)) {
      throw new InvalidEventError(`Invalid event type: ${type}`, type);
    }

    const event: TelemetryEvent = {
      eventId: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      sessionId: this.session?.sessionId ?? randomUUID(),
      properties: { ...properties },
    };

    this.eventBuffer.push(event);
    this.totalEventsRecorded++;

    // Check if buffer needs flushing
    if (this.eventBuffer.length >= this.config.maxBufferSize) {
      this.flush();
    }

    return event;
  }

  /**
   * Records a command execution event
   *
   * @param command - Command name
   * @param success - Whether command succeeded
   * @param durationMs - Duration in milliseconds
   * @returns The recorded event or null
   */
  recordCommandExecution(
    command: string,
    success: boolean,
    durationMs: number
  ): TelemetryEvent | null {
    return this.recordEvent('command_executed', {
      command,
      success,
      durationMs,
    });
  }

  /**
   * Records a pipeline event
   *
   * @param stage - Pipeline stage (started, completed, failed)
   * @param scope - Pipeline scope
   * @param stageCount - Number of stages
   * @param durationMs - Duration in milliseconds (optional)
   * @param errorType - Error type for failed pipelines (optional)
   * @returns The recorded event or null
   */
  recordPipelineEvent(
    stage: 'started' | 'completed' | 'failed',
    scope: string,
    stageCount: number,
    durationMs?: number,
    errorType?: string
  ): TelemetryEvent | null {
    const type = `pipeline_${stage}` as TelemetryEventType;
    const properties: Record<string, string | number | boolean> = {
      scope,
      stageCount,
    };

    if (durationMs !== undefined) {
      properties['durationMs'] = durationMs;
    }

    if (errorType !== undefined) {
      properties['errorType'] = errorType;
    }

    return this.recordEvent(type, properties);
  }

  /**
   * Records a feature usage event
   *
   * @param feature - Feature name
   * @param category - Feature category
   * @returns The recorded event or null
   */
  recordFeatureUsage(feature: string, category: string): TelemetryEvent | null {
    return this.recordEvent('feature_used', {
      feature,
      category,
    });
  }

  // ============================================================
  // Buffer Management
  // ============================================================

  /**
   * Flushes the event buffer
   *
   * Currently stores events locally. Future versions may send to endpoint.
   *
   * @returns Number of events flushed
   */
  flush(): number {
    if (this.eventBuffer.length === 0) {
      return 0;
    }

    const flushedCount = this.eventBuffer.length;

    // For now, just clear the buffer
    // Future: Send to telemetry endpoint
    this.eventBuffer = [];
    this.lastFlushAt = new Date().toISOString();

    return flushedCount;
  }

  /**
   * Gets the number of pending events in the buffer
   *
   * @returns Number of pending events
   */
  getPendingEventCount(): number {
    return this.eventBuffer.length;
  }

  // ============================================================
  // Statistics
  // ============================================================

  /**
   * Gets telemetry statistics
   *
   * @returns Telemetry statistics
   */
  getStats(): TelemetryStats {
    const sessionStart = this.session?.startedAt ?? new Date().toISOString();
    const sessionDurationMs = Date.now() - new Date(sessionStart).getTime();

    return {
      eventsRecorded: this.totalEventsRecorded,
      eventsPending: this.eventBuffer.length,
      lastFlushAt: this.lastFlushAt,
      sessionDurationMs,
    };
  }

  /**
   * Gets current session information
   *
   * @returns Session information or null
   */
  getSession(): TelemetrySession | null {
    return this.session;
  }

  /**
   * Gets the current configuration
   *
   * @returns Telemetry configuration
   */
  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Enables telemetry collection
   *
   * @throws ConsentRequiredError if consent has not been granted
   */
  enable(): void {
    if (!this.isConsentGranted()) {
      throw new ConsentRequiredError();
    }

    (this.config as { enabled: boolean }).enabled = true;
    this.initializeSession();
    this.startAutoFlush();
  }

  /**
   * Disables telemetry collection
   */
  disable(): void {
    (this.config as { enabled: boolean }).enabled = false;
    this.stopAutoFlush();
  }

  /**
   * Shuts down telemetry, flushing any pending events
   *
   * @returns Number of events flushed
   */
  shutdown(): number {
    this.stopAutoFlush();
    const flushed = this.flush();
    this.session = null;
    return flushed;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private loadConsent(): void {
    try {
      if (existsSync(this.consentFilePath)) {
        const content = readFileSync(this.consentFilePath, 'utf-8');
        const parsed = JSON.parse(content) as unknown;

        // Validate parsed data structure and consent status
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          'status' in parsed &&
          typeof (parsed as { status: unknown }).status === 'string' &&
          VALID_CONSENT_STATUSES.includes((parsed as { status: string }).status as ConsentStatus)
        ) {
          this.consentRecord = parsed as ConsentRecord;
        }
      }
    } catch {
      // Ignore errors loading consent - will be treated as pending
      this.consentRecord = null;
    }
  }

  private saveConsent(record: ConsentRecord): void {
    try {
      const dir = dirname(this.consentFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(this.consentFilePath, JSON.stringify(record, null, 2), 'utf-8');
    } catch (error) {
      throw new ConsentStorageError(
        'Failed to save consent record',
        error instanceof Error ? error : undefined
      );
    }
  }

  private initializeSession(): void {
    if (this.session !== null) {
      return;
    }

    this.session = {
      sessionId: randomUUID(),
      startedAt: new Date().toISOString(),
      cliVersion: '0.0.1', // Would come from package.json
      platform: process.platform,
      nodeVersion: process.version,
    };
  }

  private startAutoFlush(): void {
    if (!this.autoFlush || this.flushTimer !== null) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);

    // Ensure timer doesn't prevent process exit
    this.flushTimer.unref();
  }

  private stopAutoFlush(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// ============================================================
// Singleton Access
// ============================================================

let telemetryInstance: Telemetry | null = null;

/**
 * Gets the singleton Telemetry instance
 *
 * @param options - Options for creating a new instance (ignored if instance exists)
 * @returns Telemetry instance
 */
export function getTelemetry(options?: TelemetryOptions): Telemetry {
  if (telemetryInstance === null) {
    telemetryInstance = new Telemetry(options);
  }
  return telemetryInstance;
}

/**
 * Resets the singleton Telemetry instance
 *
 * Useful for testing or reconfiguration
 *
 * @returns Number of events flushed during shutdown
 */
export function resetTelemetry(): number {
  if (telemetryInstance === null) {
    return 0;
  }
  const flushed = telemetryInstance.shutdown();
  telemetryInstance = null;
  return flushed;
}

/**
 * Checks if the Telemetry singleton has been initialized
 *
 * @returns True if instance exists
 */
export function isTelemetryInitialized(): boolean {
  return telemetryInstance !== null;
}
