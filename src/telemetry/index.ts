/**
 * Telemetry module - Provides opt-in usage analytics
 *
 * This module implements an opt-in telemetry system for collecting
 * anonymous usage analytics. Key features:
 *
 * - **Explicit Opt-In**: No data is collected without user consent
 * - **Privacy First**: No personal data is collected (see privacy policy)
 * - **Easy Control**: Simple enable/disable toggle
 * - **Transparency**: Clear documentation of what is/isn't collected
 *
 * @example
 * ```typescript
 * import { getTelemetry, PRIVACY_POLICY } from './telemetry';
 *
 * const telemetry = getTelemetry();
 *
 * // Show privacy policy and request consent
 * console.log('We collect anonymous usage data.');
 * console.log('Data collected:', PRIVACY_POLICY.dataCollected);
 * console.log('Data NOT collected:', PRIVACY_POLICY.dataNotCollected);
 *
 * // Set consent based on user choice
 * telemetry.setConsent(userAgreed);
 * ```
 *
 * @packageDocumentation
 */

// ============================================================
// Re-exports
// ============================================================

// Types
export type {
  ConsentStatus,
  ConsentRecord,
  TelemetryEventType,
  TelemetryEvent,
  CommandExecutedEvent,
  PipelineEvent,
  AgentInvokedEvent,
  FeatureUsedEvent,
  TelemetryConfig,
  TelemetryOptions,
  PrivacyPolicy,
  TelemetrySession,
  TelemetryStats,
} from './types.js';

// Errors
export {
  TelemetryError,
  ConsentRequiredError,
  ConsentStorageError,
  InvalidEventError,
  FlushError,
  TelemetryDisabledError,
} from './errors.js';

// Telemetry
export {
  Telemetry,
  getTelemetry,
  resetTelemetry,
  isTelemetryInitialized,
  PRIVACY_POLICY,
  PRIVACY_POLICY_VERSION,
  DEFAULT_TELEMETRY_CONFIG,
} from './Telemetry.js';
