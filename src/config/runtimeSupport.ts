/** Audit raw workflow input before defaults and unknown-key stripping. */
import { z } from 'zod';
import { WorkflowConfigSchema } from './schemas.js';
import { CANONICAL_STAGE_NAMES, TIMEOUT_PHASE_STAGES } from '../ad-sdlc-orchestrator/plan.js';
import type { RuntimeDiagnostic } from './runtimeTypes.js';

const integer = (min: number, max = 2147483647): z.ZodNumber => z.number().int().min(min).max(max);

/** External runtime settings. Absence remains absence at every layer. */
export const RUNTIME_SETTINGS = {
  'pipeline.default_mode': z.enum(['greenfield', 'enhancement', 'import']),
  'global.approval_mode': z.enum(['auto', 'manual', 'critical']),
  'execution.local_mode': z.boolean(),
  'execution.max_parallel_stages': integer(1, 100),
  'global.retry_policy.max_attempts': integer(1, 100),
  'global.retry_policy.backoff': z.enum(['fixed', 'linear', 'exponential', 'fibonacci']),
  'global.retry_policy.base_delay_seconds': integer(0, 2147483),
  'global.retry_policy.max_delay_seconds': integer(0, 2147483),
  'execution.retry_attempts': integer(0, 99),
  'execution.retry_delay_ms': integer(0),
  'execution.stage_timeout_ms': integer(1),
  'global.vnv.rigor': z.enum(['minimal', 'standard', 'strict']),
  'global.vnv.halt_on_verification_failure': z.boolean(),
} satisfies Record<string, z.ZodType>;

/** Explicit direct environment mapping; other workflow properties have no implicit override. */
export const RUNTIME_ENV_MAPPING = {
  AD_SDLC_MODE: 'pipeline.default_mode',
  AD_SDLC_APPROVAL_MODE: 'global.approval_mode',
  AD_SDLC_LOCAL: 'execution.local_mode',
  AD_SDLC_MAX_PARALLEL_STAGES: 'execution.max_parallel_stages',
  AD_SDLC_MAX_ATTEMPTS: 'global.retry_policy.max_attempts',
  AD_SDLC_RETRY_BACKOFF: 'global.retry_policy.backoff',
  AD_SDLC_RETRY_BASE_DELAY_SECONDS: 'global.retry_policy.base_delay_seconds',
  AD_SDLC_RETRY_MAX_DELAY_SECONDS: 'global.retry_policy.max_delay_seconds',
  AD_SDLC_STAGE_TIMEOUT_MS: 'execution.stage_timeout_ms',
  AD_SDLC_VNV_RIGOR: 'global.vnv.rigor',
  AD_SDLC_HALT_ON_VERIFICATION_FAILURE: 'global.vnv.halt_on_verification_failure',
} as const;

/** Is a raw YAML value a mapping?
 * @param value - Input value
 * @returns Whether entries can be inspected
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read an unmodified dotted property.
 * @param value - Layer
 * @param path - Full property path
 * @returns Raw value or undefined
 */
export function getRuntimeValue(value: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

/** Supported property validator, including concrete stage identifiers.
 * @param path - Property path
 * @returns Schema when supported
 */
export function runtimeSettingSchema(path: string): z.ZodType | undefined {
  if (path in RUNTIME_SETTINGS) return RUNTIME_SETTINGS[path as keyof typeof RUNTIME_SETTINGS];
  if (Object.keys(TIMEOUT_PHASE_STAGES).some((phase) => path === `global.timeouts.${phase}`))
    return integer(1, 2147483);
  if (CANONICAL_STAGE_NAMES.some((stage) => path === `execution.stage_timeouts_ms.${stage}`))
    return integer(1);
  return undefined;
}

/** Find unknown fields inside a disabled integration without inserting schema defaults.
 * @param schema - Existing consumer schema
 * @param value - Raw inactive integration
 * @param path - Full source path
 * @returns Unknown property paths
 */
function unknownIntegrationKeys(schema: z.ZodType, value: unknown, path: string): string[] {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault)
    return unknownIntegrationKeys(schema.unwrap() as z.ZodType, value, path);
  if (schema instanceof z.ZodObject && isRecord(value))
    return Object.entries(value).flatMap(([key, child]) => {
      const field = schema.shape[key] as z.ZodType | undefined;
      return field === undefined
        ? [`${path}.${key}`]
        : unknownIntegrationKeys(field, child, `${path}.${key}`);
    });
  if (schema instanceof z.ZodArray && Array.isArray(value))
    return value.flatMap((child: unknown, index) =>
      unknownIntegrationKeys(schema.element as z.ZodType, child, `${path}.${String(index)}`)
    );
  if (schema instanceof z.ZodRecord && isRecord(value))
    return Object.entries(value).flatMap(([key, child]) =>
      unknownIntegrationKeys(schema.valueType as z.ZodType, child, `${path}.${key}`)
    );
  return [];
}

const metadata = new Set(['version', 'name', 'description', 'extensions', 'pipeline.description']);
const containers = new Set([
  '',
  'global',
  'pipeline',
  'execution',
  'global.retry_policy',
  'global.timeouts',
  'global.vnv',
  'execution.stage_timeouts_ms',
]);
const retiredBlocks = [
  'agents',
  'quality_gates',
  'notifications',
  'github',
  'logging',
  'monitoring',
  'scratchpad',
  'telemetry',
  'token_budgets',
  'global.investigation',
  'global.approval_gates',
];
const retiredGlobals = [
  'global.project_root',
  'global.scratchpad_dir',
  'global.output_docs_dir',
  'global.log_level',
];
const retiredVnv = [
  'generate_vnv_plan',
  'generate_vnv_report',
  'generate_rtm',
  'cross_document_consistency',
  'acceptance_criteria_validation',
].map((key) => `global.vnv.${key}`);

/** Diagnose all runtime-facing raw keys, including unsupported active settings.
 * @param value - Raw source mapping
 * @param source - File or external boundary
 * @returns Structured findings without input values or credentials
 */
export function auditRuntimeLayer(value: unknown, source: string): RuntimeDiagnostic[] {
  const diagnostics: RuntimeDiagnostic[] = [];
  const add = (
    path: string,
    code: RuntimeDiagnostic['code'],
    reason: string,
    action: string,
    severity: RuntimeDiagnostic['severity'] = 'error'
  ): void => {
    diagnostics.push({ source, path: path || '(root)', code, reason, action, severity });
  };
  const visit = (node: unknown, path: string): void => {
    if (metadata.has(path)) return;
    const schema = runtimeSettingSchema(path);
    if (schema !== undefined) {
      const result = schema.safeParse(node);
      if (!result.success)
        add(
          path,
          'invalid',
          result.error.issues.map((issue) => issue.message).join('; '),
          path === 'global.approval_mode'
            ? 'Use auto, manual, or critical; custom requires a programmatic approval strategy.'
            : 'Use the documented integer range, enum, or a YAML boolean.'
        );
      return;
    }
    if (path === 'pipeline.stages' || path === 'pipeline.modes') {
      add(
        path,
        'unsupported',
        'Custom topology is not executed by the SDK CLI.',
        'Remove stage lists; select pipeline.default_mode and use execution.stage_timeouts_ms with canonical names. Do not alias implement: controller orchestration and worker implementation are separate.'
      );
      const inspectWorkers = (item: unknown, itemPath: string): void => {
        if (Array.isArray(item))
          item.forEach((child: unknown, index) => {
            inspectWorkers(child, `${itemPath}.${String(index)}`);
          });
        else if (isRecord(item))
          for (const [key, child] of Object.entries(item)) {
            if (key === 'max_parallel') visit(child, `${itemPath}.${key}`);
            else inspectWorkers(child, `${itemPath}.${key}`);
          }
      };
      inspectWorkers(node, path);
      return;
    }
    if (
      path === 'execution.max_parallel_workers' ||
      /^agents\.[^.]+\.scheduling\.max_workers$/u.test(path) ||
      path.endsWith('.max_parallel')
    ) {
      add(
        path,
        'unsupported',
        'The SDK CLI does not invoke WorkerPoolManager or enforce worker-pool concurrency.',
        'Remove this setting. execution.max_parallel_stages controls runnable DAG stages only; it is not a worker limit.'
      );
      return;
    }
    if (retiredVnv.includes(path)) {
      add(
        path,
        'unsupported',
        'This toggle does not control the reachable verifier or canonical graph, including when false.',
        'Remove it; only global.vnv.rigor and halt_on_verification_failure are supported.'
      );
      return;
    }
    const retired =
      retiredGlobals.includes(path) ||
      retiredBlocks.some((block) => path === block || path.startsWith(`${block}.`));
    if (retired) {
      // Disabled integrations have no active policy. Their inert options are not copied to the snapshot.
      if (
        isRecord(node) &&
        node['enabled'] === false &&
        ['notifications', 'monitoring', 'telemetry'].includes(path)
      ) {
        const integrationSchema =
          WorkflowConfigSchema.shape[path as 'notifications' | 'monitoring' | 'telemetry'];
        for (const unknownPath of unknownIntegrationKeys(integrationSchema, node, path))
          add(
            unknownPath,
            'unknown',
            'Unknown property in an explicitly disabled integration.',
            'Remove the unknown property or move descriptive data to extensions.'
          );
        add(
          path,
          'inactive',
          'Explicitly disabled; no runtime integration is requested.',
          'Remove this block if it is no longer needed.',
          'info'
        );
      } else if (isRecord(node)) {
        const knownEmpty =
          retiredBlocks.includes(path) ||
          path === 'global.approval_gates' ||
          /^quality_gates\.(document_quality(?:\.(?:prd|srs|sds))?|code_quality|security)$/u.test(
            path
          ) ||
          /^agents\.[^.]+(?:\.(?:github|scheduling|coding|verification|review))?$/u.test(path);
        if (Object.keys(node).length === 0 && !knownEmpty)
          add(
            path,
            'unknown',
            'Unknown runtime property.',
            'Remove it or put descriptive data under extensions.'
          );
        for (const [key, child] of Object.entries(node)) visit(child, `${path}.${key}`);
      } else if (
        (node === false &&
          /^quality_gates\.(requireTests|requireReview|code_quality\.(?:no_todos_in_code|no_console_logs)|security\.(?:no_hardcoded_secrets|require_input_validation|require_authentication))$/u.test(
            path
          )) ||
        (node === 0 &&
          ['quality_gates.coverage', 'quality_gates.code_quality.coverage_threshold'].includes(
            path
          )) ||
        (Array.isArray(node) &&
          node.length === 0 &&
          /^quality_gates\.document_quality\.(?:prd|srs|sds)\.required_sections$/u.test(path))
      ) {
        add(
          path,
          'inactive',
          'Explicitly inactive quality gate; no enforcement requested.',
          'Remove this inactive setting when migrating.',
          'info'
        );
      } else {
        add(
          path,
          'unsupported',
          'This workflow setting has no enforcement owner on the SDK CLI run path.',
          'Remove it from workflow.yaml. Configure the separate consuming API directly where applicable; prompt text is not enforcement.'
        );
      }
      return;
    }
    if (containers.has(path)) {
      if (!isRecord(node))
        add(
          path,
          'invalid',
          'Expected a YAML mapping.',
          'Replace this value with a mapping of documented settings.'
        );
      else
        for (const [key, child] of Object.entries(node))
          visit(child, path === '' ? key : `${path}.${key}`);
      return;
    }
    add(
      path,
      'unknown',
      'Unknown runtime property or noncanonical stage identifier.',
      'Remove it or use a setting listed in docs/configuration/RUNTIME_WORKFLOW.md. Put descriptive extension data under extensions.'
    );
  };
  visit(value, '');
  for (const [legacy, canonical] of [
    ['execution.retry_attempts', 'global.retry_policy.max_attempts'],
    ['execution.retry_delay_ms', 'global.retry_policy.base_delay_seconds'],
  ] as const) {
    if (getRuntimeValue(value, legacy) === undefined) continue;
    if (getRuntimeValue(value, canonical) !== undefined)
      add(
        legacy,
        'conflict',
        `Both ${legacy} and ${canonical} occur in this source.`,
        `Keep only ${canonical}; retry_attempts denotes retries, so add one for max_attempts.`
      );
    else
      add(
        legacy,
        'deprecated',
        'Validated legacy retry alias.',
        `Migrate to ${canonical}; retry_attempts denotes retries (add one), and retry_delay_ms is milliseconds (divide by 1000).`,
        'warning'
      );
  }
  return diagnostics;
}
