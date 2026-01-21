/**
 * Repository Detector module exports
 *
 * Provides functionality for detecting whether to use an existing
 * repository or create a new one.
 */

// Main classes and singletons
export {
  RepoDetector,
  getRepoDetector,
  resetRepoDetector,
  REPO_DETECTOR_AGENT_ID,
} from './RepoDetector.js';

// Type exports
export type {
  // Mode types
  RepositoryMode,
  DetectionStatus,
  RemoteType,
  RepositoryVisibility,
  // Status types
  GitStatus,
  RemoteStatus,
  GitHubStatus,
  DetectionRecommendation,
  // Result types
  RepoDetectionResult,
  RepoDetectionSession,
  DetectionStats,
  // Configuration types
  TimeoutConfig,
  GitHubConfig,
  DetectionConfig,
  RepoDetectorConfig,
} from './types.js';

// Constants
export {
  DEFAULT_REPO_DETECTOR_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,
  DEFAULT_GITHUB_CONFIG,
  DEFAULT_DETECTION_CONFIG,
} from './types.js';

// Error exports
export {
  RepoDetectorError,
  ProjectNotFoundError,
  NoActiveSessionError,
  InvalidSessionStateError,
  GitCommandError,
  GitCommandTimeoutError,
  GitHubAuthenticationError,
  GitHubCommandError,
  GitHubNotAccessibleError,
  OutputWriteError,
  DetectionTimeoutError,
} from './errors.js';
