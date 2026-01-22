/**
 * Centralized path configuration module
 *
 * Provides configurable paths through environment variables with sensible defaults.
 * This module eliminates hardcoded paths throughout the codebase and enables
 * deployment flexibility for Docker/Kubernetes environments.
 *
 * @module config/paths
 */

import * as path from 'node:path';
import { homedir } from 'node:os';

/**
 * Project paths interface defining all configurable paths
 */
export interface ProjectPaths {
  /** Project root directory */
  readonly root: string;
  /** Main .ad-sdlc configuration directory */
  readonly config: string;
  /** Log files directory */
  readonly logs: string;
  /** Agent state and inter-agent communication directory */
  readonly scratchpad: string;
  /** Document templates directory */
  readonly templates: string;
  /** Generated documentation directory */
  readonly docs: string;
  /** Metrics storage directory */
  readonly metrics: string;
  /** Alert storage directory */
  readonly alerts: string;
  /** Token budget persistence directory */
  readonly budget: string;
  /** Cache directory for latency optimization */
  readonly cache: string;
  /** Audit log directory */
  readonly auditLogs: string;
  /** SQLite database file path */
  readonly database: string;
  /** Telemetry base directory */
  readonly telemetry: string;
  /** Checkpoint storage directory */
  readonly checkpoints: string;
  /** CI fix results directory */
  readonly ciFix: string;
  /** Escalation reports directory */
  readonly escalations: string;
}

/**
 * Environment variable names for path configuration
 */
export const PATH_ENV_VARS = {
  ROOT: 'AD_SDLC_ROOT',
  CONFIG_DIR: 'AD_SDLC_CONFIG_DIR',
  LOG_DIR: 'AD_SDLC_LOG_DIR',
  SCRATCHPAD_DIR: 'AD_SDLC_SCRATCHPAD_DIR',
  TEMPLATES_DIR: 'AD_SDLC_TEMPLATES_DIR',
  DOCS_DIR: 'AD_SDLC_DOCS_DIR',
  METRICS_DIR: 'AD_SDLC_METRICS_DIR',
  ALERTS_DIR: 'AD_SDLC_ALERTS_DIR',
  BUDGET_DIR: 'AD_SDLC_BUDGET_DIR',
  CACHE_DIR: 'AD_SDLC_CACHE_DIR',
  AUDIT_LOG_DIR: 'AD_SDLC_AUDIT_LOG_DIR',
  DATABASE_PATH: 'AD_SDLC_DATABASE_PATH',
  TELEMETRY_DIR: 'AD_SDLC_TELEMETRY_DIR',
  CHECKPOINTS_DIR: 'AD_SDLC_CHECKPOINTS_DIR',
  CI_FIX_DIR: 'AD_SDLC_CI_FIX_DIR',
  ESCALATIONS_DIR: 'AD_SDLC_ESCALATIONS_DIR',
} as const;

/**
 * Default path values (relative to project root)
 */
export const DEFAULT_PATHS = {
  CONFIG: '.ad-sdlc',
  CONFIG_SUBDIR: '.ad-sdlc/config',
  LOGS: '.ad-sdlc/logs',
  SCRATCHPAD: '.ad-sdlc/scratchpad',
  TEMPLATES: '.ad-sdlc/templates',
  DOCS: 'docs',
  METRICS: '.ad-sdlc/metrics',
  ALERTS: '.ad-sdlc/alerts',
  BUDGET: '.ad-sdlc/budget',
  CACHE: '.ad-sdlc/cache',
  AUDIT_LOGS: '.ad-sdlc/logs/audit',
  DATABASE: '.ad-sdlc/scratchpad.db',
  CHECKPOINTS: '.ad-sdlc/scratchpad/checkpoints',
  CI_FIX: '.ad-sdlc/scratchpad/ci-fix',
  ESCALATIONS: '.ad-sdlc/scratchpad/escalations',
} as const;

/**
 * Get project paths with environment variable overrides
 *
 * @param baseDir - Optional base directory (defaults to env var or cwd)
 * @returns ProjectPaths object with all configured paths
 *
 * @example
 * ```typescript
 * const paths = getProjectPaths();
 * console.log(paths.logs); // '.ad-sdlc/logs' or env override
 *
 * const paths = getProjectPaths('/custom/root');
 * console.log(paths.root); // '/custom/root'
 * ```
 */
export function getProjectPaths(baseDir?: string): ProjectPaths {
  const root = baseDir ?? process.env[PATH_ENV_VARS.ROOT] ?? process.cwd();

  return {
    root,
    config: process.env[PATH_ENV_VARS.CONFIG_DIR] ?? path.join(root, DEFAULT_PATHS.CONFIG_SUBDIR),
    logs: process.env[PATH_ENV_VARS.LOG_DIR] ?? path.join(root, DEFAULT_PATHS.LOGS),
    scratchpad:
      process.env[PATH_ENV_VARS.SCRATCHPAD_DIR] ?? path.join(root, DEFAULT_PATHS.SCRATCHPAD),
    templates: process.env[PATH_ENV_VARS.TEMPLATES_DIR] ?? path.join(root, DEFAULT_PATHS.TEMPLATES),
    docs: process.env[PATH_ENV_VARS.DOCS_DIR] ?? path.join(root, DEFAULT_PATHS.DOCS),
    metrics: process.env[PATH_ENV_VARS.METRICS_DIR] ?? path.join(root, DEFAULT_PATHS.METRICS),
    alerts: process.env[PATH_ENV_VARS.ALERTS_DIR] ?? path.join(root, DEFAULT_PATHS.ALERTS),
    budget: process.env[PATH_ENV_VARS.BUDGET_DIR] ?? path.join(root, DEFAULT_PATHS.BUDGET),
    cache: process.env[PATH_ENV_VARS.CACHE_DIR] ?? path.join(root, DEFAULT_PATHS.CACHE),
    auditLogs:
      process.env[PATH_ENV_VARS.AUDIT_LOG_DIR] ?? path.join(root, DEFAULT_PATHS.AUDIT_LOGS),
    database: process.env[PATH_ENV_VARS.DATABASE_PATH] ?? path.join(root, DEFAULT_PATHS.DATABASE),
    telemetry: process.env[PATH_ENV_VARS.TELEMETRY_DIR] ?? path.join(homedir(), '.ad-sdlc'),
    checkpoints:
      process.env[PATH_ENV_VARS.CHECKPOINTS_DIR] ?? path.join(root, DEFAULT_PATHS.CHECKPOINTS),
    ciFix: process.env[PATH_ENV_VARS.CI_FIX_DIR] ?? path.join(root, DEFAULT_PATHS.CI_FIX),
    escalations:
      process.env[PATH_ENV_VARS.ESCALATIONS_DIR] ?? path.join(root, DEFAULT_PATHS.ESCALATIONS),
  };
}

/**
 * Cached paths singleton
 */
let cachedPaths: ProjectPaths | null = null;

/**
 * Get cached project paths (singleton pattern)
 *
 * Uses cached paths for performance. Call resetPaths() to refresh
 * if environment variables change during runtime.
 *
 * @returns ProjectPaths object with all configured paths
 *
 * @example
 * ```typescript
 * const paths = getPaths();
 * console.log(paths.scratchpad);
 * ```
 */
export function getPaths(): ProjectPaths {
  if (!cachedPaths) {
    cachedPaths = getProjectPaths();
  }
  return cachedPaths;
}

/**
 * Reset cached paths
 *
 * Call this after changing environment variables to force
 * recalculation of paths on next getPaths() call.
 *
 * @example
 * ```typescript
 * process.env.AD_SDLC_LOG_DIR = '/new/log/path';
 * resetPaths();
 * const paths = getPaths(); // Now uses new log path
 * ```
 */
export function resetPaths(): void {
  cachedPaths = null;
}

/**
 * Get a specific path by key
 *
 * @param key - Path key from ProjectPaths interface
 * @param baseDir - Optional base directory override
 * @returns The resolved path string
 *
 * @example
 * ```typescript
 * const logsPath = getPath('logs');
 * const customLogs = getPath('logs', '/custom/root');
 * ```
 */
export function getPath(key: keyof ProjectPaths, baseDir?: string): string {
  if (baseDir !== undefined && baseDir !== '') {
    return getProjectPaths(baseDir)[key];
  }
  return getPaths()[key];
}

/**
 * Resolve a relative path within a specific project path
 *
 * @param pathKey - Base path key from ProjectPaths
 * @param relativePath - Relative path segments to append
 * @returns Fully resolved path
 *
 * @example
 * ```typescript
 * // Get '.ad-sdlc/scratchpad/info/project-001/collected_info.yaml'
 * const infoPath = resolvePath('scratchpad', 'info', 'project-001', 'collected_info.yaml');
 * ```
 */
export function resolvePath(pathKey: keyof ProjectPaths, ...relativePath: string[]): string {
  return path.join(getPaths()[pathKey], ...relativePath);
}

/**
 * Get paths relative to a project root directory
 *
 * Useful when working with multiple projects or non-cwd contexts.
 *
 * @param projectRoot - The project root directory
 * @returns ProjectPaths relative to the specified root
 *
 * @example
 * ```typescript
 * const projectPaths = getPathsForProject('/path/to/project');
 * console.log(projectPaths.scratchpad); // '/path/to/project/.ad-sdlc/scratchpad'
 * ```
 */
export function getPathsForProject(projectRoot: string): ProjectPaths {
  return getProjectPaths(projectRoot);
}

/**
 * Get the .ad-sdlc base directory path
 *
 * @param projectRoot - Optional project root directory
 * @returns Path to .ad-sdlc directory
 */
export function getAdSdlcDir(projectRoot?: string): string {
  const root = projectRoot ?? getPaths().root;
  return path.join(root, DEFAULT_PATHS.CONFIG);
}

/**
 * Get scratchpad subdirectory paths
 *
 * @param projectRoot - Optional project root directory
 * @returns Object with all scratchpad subdirectory paths
 */
export function getScratchpadDirs(projectRoot?: string): {
  info: string;
  documents: string;
  issues: string;
  progress: string;
  checkpoints: string;
  ciFix: string;
  escalations: string;
} {
  const paths =
    projectRoot !== undefined && projectRoot !== '' ? getProjectPaths(projectRoot) : getPaths();
  return {
    info: path.join(paths.scratchpad, 'info'),
    documents: path.join(paths.scratchpad, 'documents'),
    issues: path.join(paths.scratchpad, 'issues'),
    progress: path.join(paths.scratchpad, 'progress'),
    checkpoints: paths.checkpoints,
    ciFix: paths.ciFix,
    escalations: paths.escalations,
  };
}

/**
 * Get template file path
 *
 * @param templateName - Template filename (e.g., 'prd-template.md')
 * @param projectRoot - Optional project root directory
 * @returns Full path to template file
 */
export function getTemplatePath(templateName: string, projectRoot?: string): string {
  const paths =
    projectRoot !== undefined && projectRoot !== '' ? getProjectPaths(projectRoot) : getPaths();
  return path.join(paths.templates, templateName);
}

/**
 * Get config file path
 *
 * @param configName - Config filename (e.g., 'workflow.yaml', 'agents.yaml')
 * @param projectRoot - Optional project root directory
 * @returns Full path to config file
 */
export function getConfigFilePath(configName: string, projectRoot?: string): string {
  const paths =
    projectRoot !== undefined && projectRoot !== '' ? getProjectPaths(projectRoot) : getPaths();
  return path.join(paths.config, configName);
}
