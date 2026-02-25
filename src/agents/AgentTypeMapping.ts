/**
 * AgentTypeMapping - Maps pipeline agentType strings to registry metadata
 *
 * Bridges the gap between pipeline stage definitions (which use short
 * agentType strings like 'collector') and the AgentRegistry (which uses
 * agentId strings like 'collector-agent').
 *
 * Each entry describes:
 * - The registry key (agentId) for the agent
 * - Human-readable name
 * - Lifecycle strategy (singleton or transient)
 * - Whether the class requires an IAgent wrapper (non-IAgent classes)
 * - Module import path for lazy loading
 *
 * @packageDocumentation
 */

/**
 * Metadata entry for a pipeline agent type
 */
export interface AgentTypeEntry {
  /** Registry key used in AgentRegistry */
  readonly agentId: string;
  /** Human-readable agent name */
  readonly name: string;
  /** Instance lifecycle: singleton (shared) or transient (per-request) */
  readonly lifecycle: 'singleton' | 'transient';
  /** True if the class does not implement IAgent and needs a wrapper */
  readonly requiresWrapper: boolean;
  /** Module path for dynamic import (relative to this file) */
  readonly importPath: string;
}

/**
 * Mapping from pipeline agentType strings to agent metadata.
 *
 * Covers all three pipeline modes:
 * - Greenfield: project-initializer through pr-reviewer
 * - Enhancement: document-reader through regression-tester
 * - Import: issue-reader through pr-reviewer
 *
 * Agents shared across pipelines (controller, worker, pr-reviewer,
 * issue-generator) appear once in the map.
 */
export const AGENT_TYPE_MAP: Readonly<Record<string, AgentTypeEntry>> = {
  // ── Greenfield pipeline agents ──────────────────────────────────────

  'project-initializer': {
    agentId: 'project-initializer',
    name: 'Project Initializer',
    lifecycle: 'singleton',
    requiresWrapper: true,
    importPath: '../project-initializer/index.js',
  },

  'mode-detector': {
    agentId: 'mode-detector',
    name: 'Mode Detector',
    lifecycle: 'singleton',
    requiresWrapper: true,
    importPath: '../mode-detector/index.js',
  },

  'collector': {
    agentId: 'collector-agent',
    name: 'Collector Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../collector/index.js',
  },

  'prd-writer': {
    agentId: 'prd-writer-agent',
    name: 'PRD Writer Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../prd-writer/index.js',
  },

  'srs-writer': {
    agentId: 'srs-writer-agent',
    name: 'SRS Writer Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../srs-writer/index.js',
  },

  'repo-detector': {
    agentId: 'repo-detector-agent',
    name: 'Repo Detector',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../repo-detector/index.js',
  },

  'github-repo-setup': {
    agentId: 'github-repo-setup-agent',
    name: 'GitHub Repo Setup Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../github-repo-setup/index.js',
  },

  'sds-writer': {
    agentId: 'sds-writer-agent',
    name: 'SDS Writer Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../sds-writer/index.js',
  },

  'issue-generator': {
    agentId: 'issue-generator',
    name: 'Issue Generator',
    lifecycle: 'singleton',
    requiresWrapper: true,
    importPath: '../issue-generator/index.js',
  },

  'controller': {
    agentId: 'controller',
    name: 'Controller',
    lifecycle: 'singleton',
    requiresWrapper: true,
    importPath: '../controller/index.js',
  },

  'worker': {
    agentId: 'worker-agent',
    name: 'Worker Agent',
    lifecycle: 'transient',
    requiresWrapper: false,
    importPath: '../worker/index.js',
  },

  'pr-reviewer': {
    agentId: 'pr-reviewer-agent',
    name: 'PR Reviewer Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../pr-reviewer/index.js',
  },

  // ── Enhancement pipeline agents ─────────────────────────────────────

  'document-reader': {
    agentId: 'document-reader-agent',
    name: 'Document Reader Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../document-reader/index.js',
  },

  'codebase-analyzer': {
    agentId: 'codebase-analyzer-agent',
    name: 'Codebase Analyzer Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../codebase-analyzer/index.js',
  },

  'code-reader': {
    agentId: 'code-reader',
    name: 'Code Reader',
    lifecycle: 'singleton',
    requiresWrapper: true,
    importPath: '../code-reader/index.js',
  },

  'doc-code-comparator': {
    agentId: 'doc-code-comparator-agent',
    name: 'Doc-Code Comparator Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../doc-code-comparator/index.js',
  },

  'impact-analyzer': {
    agentId: 'impact-analyzer-agent',
    name: 'Impact Analyzer Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../impact-analyzer/index.js',
  },

  'prd-updater': {
    agentId: 'prd-updater-agent',
    name: 'PRD Updater Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../prd-updater/index.js',
  },

  'srs-updater': {
    agentId: 'srs-updater-agent',
    name: 'SRS Updater Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../srs-updater/index.js',
  },

  'sds-updater': {
    agentId: 'sds-updater-agent',
    name: 'SDS Updater Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../sds-updater/index.js',
  },

  'regression-tester': {
    agentId: 'regression-tester-agent',
    name: 'Regression Tester Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../regression-tester/index.js',
  },

  // ── Import pipeline agents ──────────────────────────────────────────

  'issue-reader': {
    agentId: 'issue-reader-agent',
    name: 'Issue Reader Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../issue-reader/index.js',
  },

  // ── Cross-pipeline agents ───────────────────────────────────────────

  'ci-fixer': {
    agentId: 'ci-fix-agent',
    name: 'CI Fix Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../ci-fixer/index.js',
  },

  'analysis-orchestrator': {
    agentId: 'analysis-orchestrator-agent',
    name: 'Analysis Orchestrator Agent',
    lifecycle: 'singleton',
    requiresWrapper: false,
    importPath: '../analysis-orchestrator/index.js',
  },
} as const;

/**
 * Get all pipeline agentType keys from the mapping
 */
export function getAgentTypes(): string[] {
  return Object.keys(AGENT_TYPE_MAP);
}

/**
 * Look up an AgentTypeEntry by pipeline agentType string
 *
 * @param agentType - Pipeline agentType value (e.g., 'collector')
 * @returns The entry, or undefined if not mapped
 */
export function getAgentTypeEntry(agentType: string): AgentTypeEntry | undefined {
  return AGENT_TYPE_MAP[agentType];
}

/**
 * Get all unique agentId values from the mapping
 */
export function getRegisteredAgentIds(): string[] {
  return [...new Set(Object.values(AGENT_TYPE_MAP).map((entry) => entry.agentId))];
}
