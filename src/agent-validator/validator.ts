/**
 * Agent definition file validator
 *
 * Validates agent definition files (.claude/agents/*.md) against
 * the expected schema and checks consistency with agents.yaml.
 *
 * @module agent-validator/validator
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ZodError } from 'zod';
import { AgentFrontmatterSchema, RECOMMENDED_SECTIONS, AGENT_SCHEMA_VERSION } from './schemas.js';
import { FrontmatterParseError, FrontmatterValidationError } from './errors.js';
import { tryGetProjectRoot } from '../utils/index.js';
import { DEFAULT_PATHS } from '../config/paths.js';
import type {
  AgentFrontmatter,
  AgentValidationError,
  AgentValidationResult,
  AgentValidationReport,
  ValidateAgentOptions,
} from './types.js';

// ============================================================
// Constants
// ============================================================

const DEFAULT_AGENTS_DIR = '.claude/agents';
const DEFAULT_REGISTRY_PATH = `${DEFAULT_PATHS.CONFIG_SUBDIR}/agents.yaml`;
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

// ============================================================
// Parsing Functions
// ============================================================

/**
 * Parse frontmatter from markdown content
 * @param content
 * @param filePath
 */
function parseFrontmatter(
  content: string,
  filePath: string
): { frontmatter: unknown; body: string } {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new FrontmatterParseError(
      filePath,
      'No valid frontmatter found. Expected ---\\n...\\n---'
    );
  }

  const frontmatterYaml = match[1] ?? '';
  const body = match[2] ?? '';
  try {
    const frontmatter = yaml.load(frontmatterYaml);
    return { frontmatter, body };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown YAML parse error';
    throw new FrontmatterParseError(filePath, message);
  }
}

/**
 * Format Zod errors into validation errors
 * @param error
 * @param filePath
 */
function formatZodErrors(error: ZodError, filePath: string): AgentValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
    filePath,
  }));
}

// ============================================================
// Validation Functions
// ============================================================

/**
 * Validate frontmatter against schema
 * @param data
 * @param filePath
 */
function validateFrontmatter(data: unknown, filePath: string): AgentFrontmatter {
  const result = AgentFrontmatterSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const errors = formatZodErrors(result.error, filePath);
  throw new FrontmatterValidationError(filePath, errors);
}

/**
 * Check for recommended sections in markdown content
 * @param content
 * @param filePath
 */
function checkRecommendedSections(content: string, filePath: string): AgentValidationError[] {
  const warnings: AgentValidationError[] = [];

  for (const section of RECOMMENDED_SECTIONS) {
    if (!content.includes(section)) {
      warnings.push({
        field: 'content',
        message: `Missing recommended section: "${section}"`,
        filePath,
      });
    }
  }

  return warnings;
}

/**
 * Load and validate agent registry (agents.yaml)
 * @param registryPath
 */
function loadAgentRegistry(registryPath: string): Map<string, string> {
  const registry = new Map<string, string>();

  if (!fs.existsSync(registryPath)) {
    return registry;
  }

  const content = fs.readFileSync(registryPath, 'utf-8');
  const data = yaml.load(content) as Record<string, unknown> | null | undefined;

  const agents = data?.agents as Record<string, { definition_file?: string }> | undefined;
  if (agents !== undefined) {
    for (const [id, agent] of Object.entries(agents)) {
      const definitionFile = agent.definition_file;
      if (definitionFile !== undefined && definitionFile !== '') {
        registry.set(id, definitionFile);
      }
    }
  }

  return registry;
}

/**
 * Check if agent is registered in agents.yaml
 * @param agentName
 * @param filePath
 * @param registry
 */
function checkRegistryConsistency(
  agentName: string,
  filePath: string,
  registry: Map<string, string>
): AgentValidationError[] {
  const errors: AgentValidationError[] = [];

  if (!registry.has(agentName)) {
    errors.push({
      field: 'name',
      message: `Agent "${agentName}" is not registered in agents.yaml`,
      filePath,
    });
    return errors;
  }

  const registeredPath = registry.get(agentName);
  if (registeredPath === undefined) {
    return errors;
  }

  const normalizedFilePath = filePath.replace(/\\/g, '/');
  const normalizedRegisteredPath = registeredPath.replace(/\\/g, '/');

  if (!normalizedFilePath.endsWith(normalizedRegisteredPath)) {
    errors.push({
      field: 'definition_file',
      message: `File path mismatch: registered as "${registeredPath}" but found at "${filePath}"`,
      filePath,
    });
  }

  return errors;
}

// ============================================================
// Main Validation Functions
// ============================================================

/**
 * Validate a single agent definition file
 * @param filePath
 * @param options
 */
export function validateAgentFile(
  filePath: string,
  options: ValidateAgentOptions = {}
): AgentValidationResult {
  const result: AgentValidationResult = {
    filePath,
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check file exists
  if (!fs.existsSync(filePath)) {
    result.valid = false;
    result.errors.push({
      field: 'file',
      message: 'Agent definition file not found',
      filePath,
    });
    return result;
  }

  // Read file content
  const content = fs.readFileSync(filePath, 'utf-8');

  try {
    // Parse frontmatter
    const { frontmatter, body } = parseFrontmatter(content, filePath);

    // Validate frontmatter
    const validatedFrontmatter = validateFrontmatter(frontmatter, filePath);

    // Check recommended sections
    if (options.includeWarnings !== false) {
      result.warnings = checkRecommendedSections(body, filePath);
    }

    // Check registry consistency
    if (options.checkRegistry !== false) {
      const registryPath =
        options.registryPath !== undefined && options.registryPath !== ''
          ? path.resolve(options.registryPath)
          : path.resolve(tryGetProjectRoot() ?? process.cwd(), DEFAULT_REGISTRY_PATH);

      const registry = loadAgentRegistry(registryPath);
      const registryErrors = checkRegistryConsistency(
        validatedFrontmatter.name,
        filePath,
        registry
      );
      result.errors.push(...registryErrors);
    }

    // Set agent definition if valid
    if (result.errors.length === 0) {
      result.agent = {
        frontmatter: validatedFrontmatter,
        content: body,
        filePath,
      };
    } else {
      result.valid = false;
    }
  } catch (error) {
    result.valid = false;

    if (error instanceof FrontmatterParseError) {
      result.errors.push({
        field: 'frontmatter',
        message: error.parseError,
        filePath,
      });
    } else if (error instanceof FrontmatterValidationError) {
      result.errors.push(...error.errors);
    } else {
      result.errors.push({
        field: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        filePath,
      });
    }
  }

  return result;
}

/**
 * Validate all agent definition files in a directory
 * @param options
 */
export function validateAllAgents(options: ValidateAgentOptions = {}): AgentValidationReport {
  const agentsDir =
    options.agentsDir !== undefined && options.agentsDir !== ''
      ? path.resolve(options.agentsDir)
      : path.resolve(tryGetProjectRoot() ?? process.cwd(), DEFAULT_AGENTS_DIR);

  const results: AgentValidationResult[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let warningCount = 0;

  // Check if agents directory exists
  if (!fs.existsSync(agentsDir)) {
    return {
      timestamp: new Date().toISOString(),
      totalFiles: 0,
      validCount: 0,
      invalidCount: 0,
      warningCount: 0,
      results: [],
    };
  }

  // Get all .md files (excluding .kr.md files)
  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md') && !f.endsWith('.kr.md'));

  for (const file of files) {
    const filePath = path.join(agentsDir, file);
    const result = validateAgentFile(filePath, options);

    results.push(result);

    if (result.valid) {
      validCount++;
    } else {
      invalidCount++;
    }

    warningCount += result.warnings.length;
  }

  return {
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    validCount,
    invalidCount,
    warningCount,
    results,
  };
}

/**
 * Format validation report as string
 * @param report
 */
export function formatValidationReport(report: AgentValidationReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('Agent Definition Validation Report');
  lines.push('='.repeat(60));
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push(`Schema Version: ${AGENT_SCHEMA_VERSION}`);
  lines.push('');
  lines.push(`Total Files: ${String(report.totalFiles)}`);
  lines.push(`Valid: ${String(report.validCount)}`);
  lines.push(`Invalid: ${String(report.invalidCount)}`);
  lines.push(`Warnings: ${String(report.warningCount)}`);
  lines.push('');

  for (const result of report.results) {
    const status = result.valid ? '✓' : '✗';
    const fileName = path.basename(result.filePath);
    lines.push(`${status} ${fileName}`);

    for (const error of result.errors) {
      lines.push(`    ERROR [${error.field}]: ${error.message}`);
    }

    for (const warning of result.warnings) {
      lines.push(`    WARN  [${warning.field}]: ${warning.message}`);
    }

    if (result.errors.length > 0 || result.warnings.length > 0) {
      lines.push('');
    }
  }

  lines.push('='.repeat(60));
  const summaryStatus = report.invalidCount === 0 ? 'PASSED' : 'FAILED';
  lines.push(`Result: ${summaryStatus}`);
  lines.push('='.repeat(60));

  return lines.join('\n');
}
