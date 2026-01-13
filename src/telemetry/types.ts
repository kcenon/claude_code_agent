/**
 * TypeScript type definitions for telemetry module
 *
 * @module telemetry/types
 */

// ============================================================
// Consent Types
// ============================================================

/**
 * Consent status for telemetry collection
 */
export type ConsentStatus = 'granted' | 'denied' | 'pending';

/**
 * Consent record with timestamp
 */
export interface ConsentRecord {
  /** Current consent status */
  readonly status: ConsentStatus;
  /** Timestamp when consent was given/denied */
  readonly timestamp: string;
  /** Version of privacy policy when consent was given */
  readonly policyVersion: string;
}

// ============================================================
// Event Types
// ============================================================

/**
 * Types of telemetry events
 */
export type TelemetryEventType =
  | 'command_executed'
  | 'pipeline_started'
  | 'pipeline_completed'
  | 'pipeline_failed'
  | 'agent_invoked'
  | 'error_occurred'
  | 'feature_used';

/**
 * Base telemetry event
 */
export interface TelemetryEvent {
  /** Unique event ID */
  readonly eventId: string;
  /** Event type */
  readonly type: TelemetryEventType;
  /** Event timestamp (ISO 8601) */
  readonly timestamp: string;
  /** Session ID (anonymous) */
  readonly sessionId: string;
  /** Event properties (anonymous) */
  readonly properties: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Command execution event
 */
export interface CommandExecutedEvent extends TelemetryEvent {
  readonly type: 'command_executed';
  readonly properties: {
    /** Command name (e.g., 'init', 'analyze') */
    readonly command: string;
    /** Whether command succeeded */
    readonly success: boolean;
    /** Duration in milliseconds */
    readonly durationMs: number;
  };
}

/**
 * Pipeline execution event
 */
export interface PipelineEvent extends TelemetryEvent {
  readonly type: 'pipeline_started' | 'pipeline_completed' | 'pipeline_failed';
  readonly properties: {
    /** Pipeline scope */
    readonly scope: string;
    /** Number of stages */
    readonly stageCount: number;
    /** Duration in milliseconds (for completed/failed) */
    readonly durationMs?: number;
    /** Error type (for failed) */
    readonly errorType?: string;
  };
}

/**
 * Agent invocation event
 */
export interface AgentInvokedEvent extends TelemetryEvent {
  readonly type: 'agent_invoked';
  readonly properties: {
    /** Agent type */
    readonly agentType: string;
    /** Whether invocation succeeded */
    readonly success: boolean;
    /** Duration in milliseconds */
    readonly durationMs: number;
  };
}

/**
 * Feature usage event
 */
export interface FeatureUsedEvent extends TelemetryEvent {
  readonly type: 'feature_used';
  readonly properties: {
    /** Feature name */
    readonly feature: string;
    /** Feature category */
    readonly category: string;
  };
}

// ============================================================
// Configuration Types
// ============================================================

/**
 * Telemetry configuration options
 */
export interface TelemetryConfig {
  /** Whether telemetry is enabled (requires opt-in) */
  readonly enabled: boolean;
  /** Endpoint for telemetry data (optional, for future use) */
  readonly endpoint?: string;
  /** Flush interval in milliseconds */
  readonly flushIntervalMs: number;
  /** Maximum events to buffer before flush */
  readonly maxBufferSize: number;
  /** Whether to include debug events */
  readonly includeDebugEvents: boolean;
}

/**
 * Options for initializing telemetry
 */
export interface TelemetryOptions {
  /** Base directory for storing consent and session data */
  readonly baseDir?: string;
  /** Custom configuration */
  readonly config?: Partial<TelemetryConfig>;
  /** Whether to auto-flush events */
  readonly autoFlush?: boolean;
}

// ============================================================
// Privacy Policy Types
// ============================================================

/**
 * Privacy policy information
 */
export interface PrivacyPolicy {
  /** Policy version */
  readonly version: string;
  /** Last updated date (ISO 8601) */
  readonly lastUpdated: string;
  /** Summary of data collected */
  readonly dataCollected: readonly string[];
  /** Summary of data not collected */
  readonly dataNotCollected: readonly string[];
  /** Data retention period */
  readonly retentionPeriod: string;
  /** URL for full privacy policy (optional) */
  readonly fullPolicyUrl?: string;
}

// ============================================================
// Session Types
// ============================================================

/**
 * Telemetry session information
 */
export interface TelemetrySession {
  /** Anonymous session ID */
  readonly sessionId: string;
  /** Session start timestamp */
  readonly startedAt: string;
  /** CLI version */
  readonly cliVersion: string;
  /** Platform (e.g., 'darwin', 'linux', 'win32') */
  readonly platform: string;
  /** Node.js version */
  readonly nodeVersion: string;
}

// ============================================================
// Statistics Types
// ============================================================

/**
 * Telemetry statistics
 */
export interface TelemetryStats {
  /** Total events recorded in session */
  readonly eventsRecorded: number;
  /** Events pending flush */
  readonly eventsPending: number;
  /** Last flush timestamp */
  readonly lastFlushAt: string | null;
  /** Session duration in milliseconds */
  readonly sessionDurationMs: number;
}
