/**
 * GitHub Repo Setup Agent module exports
 *
 * Provides functionality for creating and initializing GitHub repositories
 * for new projects. Used in the Greenfield pipeline between
 * repo-detector and sds-writer.
 * Implements SDS-001 CMP-027 (Section 3.27).
 */

// Main classes and singletons
export {
  GitHubRepoSetupAgent,
  getGitHubRepoSetupAgent,
  resetGitHubRepoSetupAgent,
  GITHUB_REPO_SETUP_AGENT_ID,
} from './GitHubRepoSetupAgent.js';

// Type exports
export type {
  // Visibility and status types
  RepoVisibility,
  SetupStatus,
  // Options and result types
  RepoSetupOptions,
  RepoSetupResult,
  // Session types
  RepoSetupSession,
  // Configuration types
  RepoSetupConfig,
} from './types.js';

// Constants
export { DEFAULT_REPO_SETUP_CONFIG, SUPPORTED_LICENSES, GITIGNORE_TEMPLATES } from './types.js';

// Error exports
export {
  RepoSetupError,
  NoActiveSetupSessionError,
  InvalidSetupStateError,
  RepoCreationError,
  RepoAlreadyExistsError,
  GhAuthenticationError,
  GitInitError,
  SetupOutputWriteError,
} from './errors.js';
