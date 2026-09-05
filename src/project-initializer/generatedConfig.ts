/**
 * Internal configuration builders for project initialization.
 *
 * @packageDocumentation
 */

import type { AgentsConfig } from '../config/types.js';
import type { QualityGateConfig, TemplateConfig, WorkflowConfig } from './types.js';

/**
 * Generate workflow configuration
 * @param templateConfig - The template configuration to use
 * @param qualityGates - The quality gate configuration to apply
 * @returns Generated workflow configuration object
 */
export function generateWorkflowConfig(
  templateConfig: TemplateConfig,
  qualityGates: QualityGateConfig
): WorkflowConfig {
  return {
    version: '1.0.0',
    pipeline: {
      stages: [
        { name: 'collect', agent: 'collector', timeout_ms: 300000 },
        { name: 'prd', agent: 'prd-writer', timeout_ms: 300000 },
        { name: 'srs', agent: 'srs-writer', timeout_ms: 300000 },
        { name: 'sds', agent: 'sds-writer', timeout_ms: 300000 },
        { name: 'issues', agent: 'issue-generator', timeout_ms: 300000 },
        { name: 'implement', agent: 'controller', timeout_ms: 600000 },
        { name: 'review', agent: 'pr-reviewer', timeout_ms: 300000 },
      ],
    },
    quality_gates: qualityGates,
    execution: {
      max_parallel_workers: templateConfig.parallelWorkers,
      retry_attempts: 3,
      retry_delay_ms: 5000,
    },
  };
}

/**
 * Generate agents configuration
 * @returns Agent configuration object with definitions
 */
export function generateAgentsConfig(): AgentsConfig {
  return {
    version: '1.0.0',
    agents: {
      collector: {
        id: 'collector',
        name: 'Collector Agent',
        description: 'Collects and organizes project requirements',
        model: 'sonnet',
        definition: '.claude/agents/collector.md',
      },
      'prd-writer': {
        id: 'prd-writer',
        name: 'PRD Writer Agent',
        description: 'Generates Product Requirements Document',
        model: 'sonnet',
        definition: '.claude/agents/prd-writer.md',
      },
      'srs-writer': {
        id: 'srs-writer',
        name: 'SRS Writer Agent',
        description: 'Generates Software Requirements Specification',
        model: 'sonnet',
        definition: '.claude/agents/srs-writer.md',
      },
      'sds-writer': {
        id: 'sds-writer',
        name: 'SDS Writer Agent',
        description: 'Generates Software Design Specification',
        model: 'sonnet',
        definition: '.claude/agents/sds-writer.md',
      },
      'issue-generator': {
        id: 'issue-generator',
        name: 'Issue Generator Agent',
        description: 'Generates GitHub issues from SDS',
        model: 'sonnet',
        definition: '.claude/agents/issue-generator.md',
      },
      controller: {
        id: 'controller',
        name: 'Controller Agent',
        description: 'Orchestrates parallel implementation',
        model: 'sonnet',
        definition: '.claude/agents/controller.md',
      },
      worker: {
        id: 'worker',
        name: 'Worker Agent',
        description: 'Implements individual issues',
        model: 'sonnet',
        definition: '.claude/agents/worker.md',
      },
      'pr-reviewer': {
        id: 'pr-reviewer',
        name: 'PR Reviewer Agent',
        description: 'Reviews pull requests',
        model: 'sonnet',
        definition: '.claude/agents/pr-reviewer.md',
      },
    },
  };
}
