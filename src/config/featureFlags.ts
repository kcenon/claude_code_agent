/**
 * Feature flags resolver
 *
 * Issue #795: Promote the AD-09 worker-pilot environment flag from a raw
 * `process.env` lookup to a first-class configuration surface.
 *
 * The resolver consults three input paths and picks the first defined value
 * in the following priority order:
 *
 *   1. Environment variable (e.g. `AD_SDLC_USE_SDK_FOR_WORKER`)
 *   2. CLI option (e.g. `--use-sdk-for-worker`)
 *   3. YAML config file (`.ad-sdlc/config/feature-flags.yaml`)
 *   4. Built-in default (always `false` for the worker pilot in this PR)
 *
 * The YAML file is strictly opt-in. AD-SDLC never auto-creates it; absence is
 * treated as "not configured" and falls through to lower-priority sources.
 *
 * @module config/featureFlags
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';

import { tryGetProjectRoot } from '../utils/index.js';
import { DEFAULT_PATHS } from './paths.js';

// ============================================================
// Public constants
// ============================================================

/**
 * Environment variable controlling the worker-pilot SDK adapter path.
 *
 * Mirrors `WORKER_PILOT_ENV_FLAG` in the orchestrator. Kept here as the
 * canonical name so the resolver and the orchestrator agree.
 */
export const ENV_USE_SDK_FOR_WORKER = 'AD_SDLC_USE_SDK_FOR_WORKER';

/**
 * Default file name (relative to the config directory) for the feature
 * flags YAML.
 */
export const FEATURE_FLAGS_FILE_NAME = 'feature-flags.yaml';

/**
 * Built-in defaults used when no source provides a value.
 *
 * The worker-pilot flag is intentionally `false` in this PR — flipping the
 * default is P3 territory (see issue #798), not part of #795.
 */
export const DEFAULT_FEATURE_FLAGS = Object.freeze({
  useSdkForWorker: false,
} as const);

// ============================================================
// Schemas (Zod)
// ============================================================

/**
 * Zod schema for the `flags` block of `feature-flags.yaml`.
 *
 * The schema is `strict()` so unknown keys produce a readable validation
 * error rather than being silently ignored. Every recognized flag is
 * optional — missing flags fall through to lower-priority sources.
 */
export const FeatureFlagsBlockSchema = z
  .object({
    useSdkForWorker: z.boolean().optional(),
  })
  .strict();

/**
 * Zod schema for the full `feature-flags.yaml` document.
 */
export const FeatureFlagsFileSchema = z
  .object({
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/u, 'version must be semver (e.g. "1.0.0")')
      .optional(),
    flags: FeatureFlagsBlockSchema.optional(),
  })
  .strict();

/** Parsed and validated feature-flags file. */
export type FeatureFlagsFile = z.infer<typeof FeatureFlagsFileSchema>;

/** Subset of flags the resolver currently understands. */
export interface FeatureFlagsConfig {
  readonly useSdkForWorker?: boolean;
}

// ============================================================
// CLI input shape
// ============================================================

/**
 * CLI-supplied feature flag values. Each property is optional; `undefined`
 * means the user did not pass the flag, so the resolver should fall through.
 */
export interface CliFeatureFlags {
  readonly useSdkForWorker?: boolean;
}

// ============================================================
// Env parsing
// ============================================================

const TRUTHY_TOKENS = new Set(['1', 'true', 'yes', 'on']);
const FALSY_TOKENS = new Set(['0', 'false', 'no', 'off', '']);

/**
 * Parse an environment-variable string into a tri-state boolean.
 *
 * @param value - Raw environment-variable value (or `undefined` when unset).
 * @returns
 *   - `true` for truthy tokens (`1`, `true`, `yes`, `on`; case-insensitive)
 *   - `false` for falsy tokens (`0`, `false`, `no`, `off`, empty string)
 *   - `undefined` when the variable is unset (caller falls through)
 * @throws Error when the value is set but not recognized.
 */
export function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (TRUTHY_TOKENS.has(normalized)) {
    return true;
  }
  if (FALSY_TOKENS.has(normalized)) {
    return false;
  }
  throw new Error(
    `Invalid boolean value "${value}". Use one of: 1, true, yes, on (truthy) / 0, false, no, off (falsy).`
  );
}

// ============================================================
// File loading
// ============================================================

/**
 * Resolve the absolute path of `feature-flags.yaml`.
 *
 * @param baseDir - Optional project root override (defaults to the detected
 *   project root or `process.cwd()`).
 * @returns Absolute path to the feature-flags YAML file.
 */
export function getFeatureFlagsFilePath(baseDir?: string): string {
  const root = baseDir ?? tryGetProjectRoot() ?? process.cwd();
  return resolve(root, DEFAULT_PATHS.CONFIG_SUBDIR, FEATURE_FLAGS_FILE_NAME);
}

/**
 * Load and validate `feature-flags.yaml`.
 *
 * @param filePath - Absolute path to the YAML file.
 * @returns Parsed file contents, or `null` if the file does not exist.
 * @throws Error with a readable message when the YAML is malformed or fails
 *   schema validation.
 */
export function loadFeatureFlagsFile(filePath: string): FeatureFlagsFile | null {
  if (!existsSync(filePath)) {
    return null;
  }
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to read feature-flags file "${filePath}": ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse YAML in "${filePath}": ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }

  if (parsed === undefined || parsed === null) {
    // Empty file — treat as "no flags configured".
    return {};
  }

  const result = FeatureFlagsFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid feature-flags file "${filePath}":\n${issues}`);
  }
  return result.data;
}

// ============================================================
// Resolver
// ============================================================

/**
 * Options accepted by the {@link FeatureFlagsResolver} constructor.
 */
export interface FeatureFlagsResolverOptions {
  /** CLI-supplied flag values (highest priority after env). */
  readonly cli?: CliFeatureFlags;
  /**
   * Override the YAML config block (skips file IO). When provided, the
   * resolver uses this block instead of reading `feature-flags.yaml`.
   */
  readonly config?: FeatureFlagsConfig;
  /** Base directory for resolving the YAML file path. */
  readonly baseDir?: string;
  /**
   * Inject an environment object (defaults to `process.env`). Tests use
   * this to drive the env layer without mutating the live environment.
   */
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Resolves feature flag values from the priority chain
 * `env > CLI > config > default`.
 *
 * The resolver is constructed once at orchestrator startup with the active
 * CLI options and reused across stage invocations so YAML / env reads do
 * not happen on every dispatch. See {@link FeatureFlagsResolver.useSdkForWorker}.
 */
export class FeatureFlagsResolver {
  private readonly cli: CliFeatureFlags;
  private readonly config: FeatureFlagsConfig;
  private readonly env: NodeJS.ProcessEnv;

  /**
   * Build a resolver from explicit inputs.
   *
   * @param options - CLI/config/env overrides. Any source that is omitted
   *   falls through to the next priority layer at lookup time.
   */
  constructor(options: FeatureFlagsResolverOptions = {}) {
    this.cli = options.cli ?? {};
    this.config = options.config ?? {};
    this.env = options.env ?? process.env;
  }

  /**
   * Build a resolver and load the YAML file (if present).
   *
   * @param options - Same as the constructor, but `config` is populated by
   *   reading `feature-flags.yaml` from disk when not provided.
   * @returns A ready-to-use resolver.
   */
  static fromSources(options: FeatureFlagsResolverOptions = {}): FeatureFlagsResolver {
    if (options.config !== undefined) {
      return new FeatureFlagsResolver(options);
    }
    const filePath = getFeatureFlagsFilePath(options.baseDir);
    const fileContents = loadFeatureFlagsFile(filePath);
    const flags = fileContents?.flags;
    const resolved: FeatureFlagsConfig = {};
    if (flags?.useSdkForWorker !== undefined) {
      (resolved as { useSdkForWorker?: boolean }).useSdkForWorker = flags.useSdkForWorker;
    }
    return new FeatureFlagsResolver({ ...options, config: resolved });
  }

  /**
   * Resolve the worker-pilot flag.
   *
   * Priority: env (`AD_SDLC_USE_SDK_FOR_WORKER`) > CLI (`--use-sdk-for-worker`)
   * > YAML (`flags.useSdkForWorker`) > default (`false`).
   *
   * @returns `true` when the worker stage should route through the SDK
   *   ExecutionAdapter, otherwise `false`.
   * @throws Error when the env variable is set to an unrecognized value.
   */
  useSdkForWorker(): boolean {
    const envValue = parseBooleanEnv(this.env[ENV_USE_SDK_FOR_WORKER]);
    if (envValue !== undefined) {
      return envValue;
    }
    if (this.cli.useSdkForWorker !== undefined) {
      return this.cli.useSdkForWorker;
    }
    if (this.config.useSdkForWorker !== undefined) {
      return this.config.useSdkForWorker;
    }
    return DEFAULT_FEATURE_FLAGS.useSdkForWorker;
  }
}
