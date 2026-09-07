/** Pure canonical graph construction, shared by the CLI and scheduler. */
import {
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
  LOCAL_AGENT_SUBSTITUTIONS,
  type PipelineMode,
  type PipelineStageDefinition,
  type StageName,
} from './types.js';

/** Build the canonical preset, including local substitutions and dependency rewiring.
 * @param mode - Canonical preset
 * @param localMode - Disable GitHub stages
 * @returns Independent stage definitions
 */
export function buildCanonicalPlan(
  mode: PipelineMode,
  localMode = false
): PipelineStageDefinition[] {
  const presets = {
    greenfield: GREENFIELD_STAGES,
    enhancement: ENHANCEMENT_STAGES,
    import: IMPORT_STAGES,
  };
  return structuredClone(presets[mode])
    .filter((stage) => !localMode || stage.name !== 'github_repo_setup')
    .map((stage) => {
      if (!localMode) return stage;
      const dependsOn = stage.dependsOn.filter((name) => name !== 'github_repo_setup');
      if (stage.dependsOn.includes('github_repo_setup') && !dependsOn.includes('repo_detection')) {
        dependsOn.push('repo_detection');
      }
      return {
        ...stage,
        dependsOn,
        agentType: LOCAL_AGENT_SUBSTITUTIONS[stage.agentType] ?? stage.agentType,
      };
    });
}

/** Every supported stage identifier, independent of the selected preset. */
export const CANONICAL_STAGE_NAMES: readonly StageName[] = [
  ...new Set(
    [...GREENFIELD_STAGES, ...ENHANCEMENT_STAGES, ...IMPORT_STAGES].map((stage) => stage.name)
  ),
];

/** Phase budgets are seconds in YAML, total milliseconds per concrete stage at runtime. */
export const TIMEOUT_PHASE_STAGES = {
  document_generation: [
    'prd_generation',
    'srs_generation',
    'sdp_generation',
    'sds_generation',
    'ui_spec_generation',
    'threat_modeling',
    'tech_decisions',
    'svp_generation',
    'prd_update',
    'srs_update',
    'sds_update',
    'doc_indexing',
  ],
  issue_creation: ['issue_generation'],
  orchestration: ['orchestration'],
  implementation: ['implementation'],
  pr_review: ['review'],
} as const satisfies Record<string, readonly StageName[]>;
