/**
 * Internal configuration builders for project initialization.
 *
 * @packageDocumentation
 */

import { loadAssetBundle, type AssetBundle } from './AgentAssets.js';
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
 * @param bundle - Validated canonical inventory
 */
export function generateAgentsConfig(bundle: AssetBundle = loadAssetBundle()): AgentsConfig {
  return {
    version: '1.0.0',
    agents: Object.fromEntries(
      bundle.assets.flatMap((asset) => {
        const metadata = asset.frontmatter;
        if (metadata === undefined) return [];
        return [
          [
            metadata.name,
            {
              id: metadata.name,
              name:
                metadata.name
                  .split('-')
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(' ') + ' Agent',
              description: metadata.description,
              model: metadata.model,
              model_preference: metadata.model,
              tools: metadata.tools,
              definition_file: asset.path,
              // Compatibility with readers of the pre-#946 generated registry.
              definition: asset.path,
            },
          ],
        ];
      })
    ),
  };
}
