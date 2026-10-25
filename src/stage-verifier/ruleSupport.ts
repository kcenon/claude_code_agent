/**
 * Shared helpers for stage verification rules.
 *
 * Rules receive the stage's artifact locations (manifest-derived,
 * project-relative paths) and the project root. These helpers locate a
 * stage's real output files, read and parse them, and build check results.
 *
 * @module stage-verifier/ruleSupport
 */

import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import * as yaml from 'js-yaml';

import type { VerificationCheck, VerificationRule } from './types.js';

/** Rule identity fields copied into every check result. */
export type RuleIdentity = Pick<VerificationRule, 'checkId' | 'name' | 'category' | 'severity'>;

/**
 * Resolve an artifact location against the project root.
 *
 * Manifest locations are project-relative; absolute locations are kept.
 *
 * @param artifact - Artifact location from the stage result
 * @param projectDir - Absolute project root (optional for legacy callers)
 * @returns Path that can be opened from any working directory
 */
export function resolveArtifactPath(artifact: string, projectDir?: string): string {
  if (projectDir === undefined || projectDir === '' || isAbsolute(artifact)) return artifact;
  return resolve(projectDir, artifact);
}

/**
 * Safely read file contents as a UTF-8 string.
 *
 * @param filePath - Absolute or project-relative file path
 * @param projectDir - Project root used for relative paths
 * @returns File contents or null if the file does not exist or cannot be read
 */
export async function safeReadFile(filePath: string, projectDir?: string): Promise<string | null> {
  try {
    return await readFile(resolveArtifactPath(filePath, projectDir), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Normalize an artifact location for pattern matching (Windows separators to `/`).
 * @param artifact - Artifact location
 * @returns Location with forward slashes
 */
export function normalizeArtifact(artifact: string): string {
  return artifact.replaceAll('\\', '/');
}

/**
 * Find an artifact matching a given substring in its path.
 *
 * @param artifacts - List of artifact file paths
 * @param pattern - Substring to match against file paths
 * @returns First matching artifact path or undefined
 */
export function findArtifact(artifacts: readonly string[], pattern: string): string | undefined {
  return artifacts.find((a) => a.includes(pattern));
}

/**
 * Find every artifact whose normalized location matches one of the patterns.
 *
 * @param artifacts - Stage artifact locations
 * @param patterns - Anchored location patterns
 * @returns Matching artifact locations in their original form, in input order
 */
export function findArtifacts(artifacts: readonly string[], patterns: readonly RegExp[]): string[] {
  return artifacts.filter((artifact) => {
    const location = normalizeArtifact(artifact);
    return patterns.some((pattern) => pattern.test(location));
  });
}

/**
 * Parse YAML content safely.
 *
 * @param content - YAML string
 * @returns Parsed object or null on parse failure
 */
export function safeParseYaml(content: string): Record<string, unknown> | null {
  try {
    const parsed = yaml.load(content);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse JSON content safely.
 *
 * @param content - JSON string
 * @returns Parsed value or null on parse failure
 */
export function safeParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Parse a structured data artifact, trying JSON first and then YAML.
 *
 * @param content - File contents
 * @returns Parsed object or array, or null when neither format yields one
 */
export function parseStructured(content: string): Record<string, unknown> | unknown[] | null {
  const json = safeParseJson(content);
  if (json !== null && typeof json === 'object') return json as Record<string, unknown>;
  return safeParseYaml(content);
}

/**
 * Narrow an unknown value to a plain object.
 * @param value - Candidate value
 * @returns Whether the value is a non-array object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Return the object under a documented root key, or the value itself.
 *
 * Agent output schemas wrap their payload (for example
 * `implementation_result:`), while older formats are flat.
 *
 * @param value - Parsed document
 * @param rootKey - Documented root key
 * @returns The wrapped object, the flat object, or null
 */
export function unwrapRoot(value: unknown, rootKey: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const inner = value[rootKey];
  return isRecord(inner) ? inner : value;
}

/**
 * Read the first defined value along alternative dotted paths.
 *
 * @param value - Parsed object
 * @param paths - Dotted paths in priority order
 * @returns The first value that is not undefined
 */
export function readPath(value: Record<string, unknown>, paths: readonly string[]): unknown {
  for (const path of paths) {
    let current: unknown = value;
    for (const key of path.split('.')) {
      current = isRecord(current) ? current[key] : undefined;
    }
    if (current !== undefined) return current;
  }
  return undefined;
}

/**
 * Extract markdown headings from content.
 *
 * @param content - Markdown text
 * @returns Array of heading strings (without the `#` prefix)
 */
export function extractMarkdownHeadings(content: string): string[] {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const heading = match[1];
    if (heading !== undefined) {
      headings.push(heading.trim());
    }
  }
  return headings;
}

/**
 * Extract IDs matching a pattern from text content.
 *
 * @param content - Text to search
 * @param pattern - Regex pattern with at least one capture group
 * @returns Array of matched ID strings
 */
export function extractIds(content: string, pattern: RegExp): string[] {
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  const globalPattern = new RegExp(pattern.source, 'g');
  while ((match = globalPattern.exec(content)) !== null) {
    ids.push(match[0]);
  }
  return [...new Set(ids)];
}

/**
 * Build a check result from a rule identity.
 * @param rule - Rule identity
 * @param passed - Whether the condition held
 * @param message - Descriptive message
 * @param details - Optional structured details
 * @returns Check result
 */
function buildCheck(
  rule: RuleIdentity,
  passed: boolean,
  message: string,
  details?: Record<string, unknown>
): VerificationCheck {
  const result: VerificationCheck = {
    checkId: rule.checkId,
    name: rule.name,
    category: rule.category,
    passed,
    severity: rule.severity,
    message,
  };
  return details === undefined ? result : { ...result, details };
}

/**
 * Create a passing VerificationCheck.
 * @param rule - Rule identity
 * @param message - Descriptive message
 * @param details - Optional structured details
 * @returns Passing check
 */
export function passCheck(
  rule: RuleIdentity,
  message: string,
  details?: Record<string, unknown>
): VerificationCheck {
  return buildCheck(rule, true, message, details);
}

/**
 * Create a failing VerificationCheck.
 * @param rule - Rule identity
 * @param message - Descriptive message
 * @param details - Optional structured details
 * @returns Failing check
 */
export function failCheck(
  rule: RuleIdentity,
  message: string,
  details?: Record<string, unknown>
): VerificationCheck {
  return buildCheck(rule, false, message, details);
}

/**
 * Create a check that did not evaluate its condition.
 *
 * `passed` stays true so the legacy `StageVerificationResult.passed`
 * semantics are unchanged, but `skipReason` keeps the policy layer from
 * counting it as a verified pass.
 *
 * @param rule - Rule identity
 * @param message - Descriptive message
 * @param skipReason - Why the condition could not be evaluated
 * @param details - Optional structured details
 * @returns Skipped check
 */
export function skipCheck(
  rule: RuleIdentity,
  message: string,
  skipReason: string,
  details?: Record<string, unknown>
): VerificationCheck {
  return { ...buildCheck(rule, true, message, details), skipReason };
}
