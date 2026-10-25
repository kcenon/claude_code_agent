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

// Delivery metrics (#956): event schema, local export, and report
export {
  ATTEMPT_EXECUTIONS,
  ATTEMPT_OUTCOMES,
  AttemptMetricsRecordSchema,
  DELIVERY_METRICS_SCHEMA_VERSION,
  DeliveryMetricsRecordSchema,
  PIPELINE_STATUSES,
  PipelineMetricsRecordSchema,
  RESUME_SOURCES,
  STAGE_STATUSES,
  StageMetricsRecordSchema,
  USAGE_SOURCES,
  UsageMetricsSchema,
  parseDeliveryMetricsRecord,
} from './deliveryMetrics.js';
export type {
  AttemptExecution,
  AttemptMetricsRecord,
  AttemptOutcome,
  DeliveryMetricsRecord,
  PipelineApprovalProjection,
  PipelineMetricsRecord,
  PipelineVerificationProjection,
  ResumeSource,
  StageApprovalProjection,
  StageMetricsRecord,
  StageVerificationProjection,
} from './deliveryMetrics.js';
export {
  DELIVERY_METRICS_DIRECTORY,
  DELIVERY_METRICS_POLICY_VERSION,
  JsonlDeliveryMetricsSink,
  deliveryMetricsConsent,
  deliveryMetricsFile,
  jsonlDeliveryMetricsSink,
} from './deliveryMetricsExport.js';
export type {
  DeliveryMetricsConsent,
  DeliveryMetricsConsentStatus,
  DeliveryMetricsExportStatus,
  DeliveryMetricsSink,
  DeliveryMetricsSummary,
} from './deliveryMetricsExport.js';
