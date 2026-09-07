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
 * @param _templateConfig - Template metadata (runtime presets use canonical defaults)
 * @param _qualityGates - Deprecated compatibility parameter; never emitted
 * @returns Generated workflow configuration object
 */
export function generateWorkflowConfig(
  _templateConfig: TemplateConfig,
  _qualityGates: QualityGateConfig
): WorkflowConfig {
  // Template quality/worker presets are retained in the public input types only.
  // They never governed SDK execution and must not become active runtime requests.
  return {
    version: '1.0.0',
    pipeline: { default_mode: 'greenfield' },
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
