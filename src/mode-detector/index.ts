/**
 * Mode Detector module exports
 *
 * Provides functionality for detecting whether to use Greenfield or Enhancement
 * pipeline based on project state.
 */

// Main classes and singletons
export { ModeDetector, getModeDetector, resetModeDetector } from './ModeDetector.js';

// ModeDetectorAgentAdapter
export {
  ModeDetectorAgentAdapter,
  MODE_DETECTOR_AGENT_ID,
} from './ModeDetectorAgentAdapter.js';

// Type exports
export type {
  // Mode types
  PipelineMode,
  ConfidenceLevel,
  DetectionStatus,
  EvidenceSource,
  // Evidence types
  DetectionEvidence,
  DocumentEvidence,
  CodebaseEvidence,
  KeywordEvidence,
  UserOverride,
  // Score types
  DetectionScores,
  // Result types
  ModeDetectionResult,
  ModeDetectionSession,
  DetectionStats,
  // Rule types
  DetectionRule,
  KeywordConfig,
  ScoreWeights,
  DetectionThresholds,
  // Configuration types
  ModeDetectorConfig,
} from './types.js';

// Constants
export {
  DEFAULT_MODE_DETECTOR_CONFIG,
  DEFAULT_GREENFIELD_KEYWORDS,
  DEFAULT_ENHANCEMENT_KEYWORDS,
  DEFAULT_DETECTION_RULES,
} from './types.js';

// Error exports
export {
  ModeDetectorError,
  ProjectNotFoundError,
  NoActiveSessionError,
  InvalidSessionStateError,
  DocumentAnalysisError,
  CodebaseAnalysisError,
  InvalidConfigurationError,
  OutputWriteError,
  DetectionTimeoutError,
} from './errors.js';
