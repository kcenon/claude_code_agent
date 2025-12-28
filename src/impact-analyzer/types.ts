/**
 * Impact Analyzer Agent module type definitions
 *
 * Defines types for change impact analysis, risk assessment,
 * dependency chain tracking, and regression prediction.
 */

/**
 * Types of changes that can be analyzed
 */
export type ChangeType =
  | 'feature_add'
  | 'feature_modify'
  | 'bug_fix'
  | 'refactor'
  | 'documentation'
  | 'infrastructure';

/**
 * Size estimation for changes
 */
export type ChangeSize = 'small' | 'medium' | 'large';

/**
 * Impact type classification
 */
export type ImpactType = 'direct' | 'indirect';

/**
 * Impact level classification
 */
export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Risk level classification
 */
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Recommendation type classification
 */
export type RecommendationType = 'blocker' | 'warning' | 'suggestion' | 'info';

/**
 * File change type classification
 */
export type FileChangeType = 'create' | 'modify' | 'delete';

/**
 * Requirement impact type classification
 */
export type RequirementImpact = 'add' | 'modify' | 'deprecate';

/**
 * Requirement type classification
 */
export type RequirementType = 'functional' | 'non_functional';

/**
 * Component source classification
 */
export type ComponentSource = 'code' | 'documentation' | 'both';

/**
 * Impact propagation level through dependencies
 */
export type ImpactPropagation = 'high' | 'medium' | 'low';

/**
 * Analysis session status
 */
export type AnalysisSessionStatus = 'loading' | 'analyzing' | 'completed' | 'failed';

/**
 * Change scope information
 */
export interface ChangeScope {
  /** Type of change being analyzed */
  readonly type: ChangeType;
  /** Estimated size of the change */
  readonly estimatedSize: ChangeSize;
  /** Confidence in the classification (0.0 - 1.0) */
  readonly confidence: number;
}

/**
 * Affected component information
 */
export interface AffectedComponent {
  /** Component identifier from SDS */
  readonly componentId: string;
  /** Human-readable component name */
  readonly componentName: string;
  /** Whether impact is direct or indirect */
  readonly type: ImpactType;
  /** Level of impact */
  readonly impactLevel: ImpactLevel;
  /** Reason for the impact */
  readonly reason: string;
  /** Source of the impact (code, documentation, or both) */
  readonly source: ComponentSource;
}

/**
 * Affected file information
 */
export interface AffectedFile {
  /** File path relative to project root */
  readonly path: string;
  /** Type of change expected */
  readonly changeType: FileChangeType;
  /** Confidence in the prediction (0.0 - 1.0) */
  readonly confidence: number;
  /** Reason for including this file */
  readonly reason: string;
}

/**
 * Affected requirement information
 */
export interface AffectedRequirement {
  /** Requirement identifier (FR-XXX, NFR-XXX, etc.) */
  readonly requirementId: string;
  /** Type of requirement */
  readonly type: RequirementType;
  /** How the requirement is impacted */
  readonly impact: RequirementImpact;
  /** Reason for the impact */
  readonly reason: string;
}

/**
 * Dependency chain entry
 */
export interface DependencyChainEntry {
  /** Source component in the chain */
  readonly fromComponent: string;
  /** Target component in the chain */
  readonly toComponent: string;
  /** Relationship between components */
  readonly relationship: string;
  /** How strongly the impact propagates */
  readonly impactPropagation: ImpactPropagation;
}

/**
 * Risk factor information
 */
export interface RiskFactor {
  /** Name of the risk factor */
  readonly name: string;
  /** Severity level */
  readonly level: RiskLevel;
  /** Description of the risk */
  readonly description: string;
  /** Suggested mitigation strategy */
  readonly mitigation: string;
}

/**
 * Overall risk assessment
 */
export interface RiskAssessment {
  /** Overall risk level */
  readonly overallRisk: RiskLevel;
  /** Confidence in the assessment (0.0 - 1.0) */
  readonly confidence: number;
  /** Individual risk factors */
  readonly factors: readonly RiskFactor[];
}

/**
 * Regression risk prediction
 */
export interface RegressionRisk {
  /** Area at risk for regression */
  readonly area: string;
  /** Probability of regression (0.0 - 1.0) */
  readonly probability: number;
  /** Severity if regression occurs */
  readonly severity: RiskLevel;
  /** Tests recommended to run */
  readonly testsToRun: readonly string[];
  /** Reason for the risk assessment */
  readonly reason: string;
}

/**
 * Recommendation for the change
 */
export interface Recommendation {
  /** Type of recommendation */
  readonly type: RecommendationType;
  /** Priority (1-5, 1 being highest) */
  readonly priority: number;
  /** Recommendation message */
  readonly message: string;
  /** Suggested action */
  readonly action: string;
}

/**
 * Analysis statistics
 */
export interface AnalysisStatistics {
  /** Total number of affected components */
  readonly totalAffectedComponents: number;
  /** Total number of affected files */
  readonly totalAffectedFiles: number;
  /** Total number of affected requirements */
  readonly totalAffectedRequirements: number;
  /** Number of direct impacts */
  readonly directImpacts: number;
  /** Number of indirect impacts */
  readonly indirectImpacts: number;
  /** Analysis processing time in milliseconds */
  readonly analysisDurationMs: number;
}

/**
 * Complete impact analysis report
 */
export interface ImpactAnalysis {
  /** Summary of the change request */
  readonly requestSummary: string;
  /** Analysis timestamp */
  readonly analysisDate: string;
  /** Analysis version */
  readonly analysisVersion: string;
  /** Change scope classification */
  readonly changeScope: ChangeScope;
  /** List of affected components */
  readonly affectedComponents: readonly AffectedComponent[];
  /** List of affected files */
  readonly affectedFiles: readonly AffectedFile[];
  /** List of affected requirements */
  readonly affectedRequirements: readonly AffectedRequirement[];
  /** Dependency chain showing impact propagation */
  readonly dependencyChain: readonly DependencyChainEntry[];
  /** Risk assessment */
  readonly riskAssessment: RiskAssessment;
  /** Predicted regression risks */
  readonly regressionRisks: readonly RegressionRisk[];
  /** Recommendations for implementation */
  readonly recommendations: readonly Recommendation[];
  /** Analysis statistics */
  readonly statistics: AnalysisStatistics;
}

/**
 * Change request input
 */
export interface ChangeRequest {
  /** Description of the requested change */
  readonly description: string;
  /** Additional context for the change */
  readonly context?: string;
  /** Specific files mentioned */
  readonly targetFiles?: readonly string[];
  /** Specific components mentioned */
  readonly targetComponents?: readonly string[];
  /** Priority of the change */
  readonly priority?: string;
}

/**
 * Current state from Document Reader
 */
export interface CurrentState {
  readonly project: {
    readonly name: string;
    readonly version: string;
    readonly lastUpdated?: string;
  };
  readonly requirements?: {
    readonly functional?: readonly {
      readonly id: string;
      readonly title: string;
      readonly description?: string;
      readonly priority?: string;
      readonly status?: string;
    }[];
    readonly nonFunctional?: readonly {
      readonly id: string;
      readonly title: string;
      readonly category?: string;
      readonly status?: string;
    }[];
  };
  readonly features?: readonly {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly sourceRequirements?: readonly string[];
  }[];
  readonly components?: readonly {
    readonly id: string;
    readonly name: string;
    readonly type?: string;
    readonly description?: string;
    readonly dependencies?: readonly string[];
    readonly sourceFeatures?: readonly string[];
  }[];
  readonly traceability?: {
    readonly prdToSrs?: readonly {
      readonly prdId: string;
      readonly srsIds: readonly string[];
    }[];
    readonly srsToSds?: readonly {
      readonly srsId: string;
      readonly sdsIds: readonly string[];
    }[];
  };
}

/**
 * Dependency graph node (from Codebase Analyzer)
 */
export interface DependencyNode {
  readonly id: string;
  readonly type: 'internal' | 'external';
  readonly path?: string;
  readonly language?: string;
  readonly exports?: readonly string[];
}

/**
 * Dependency graph edge (from Codebase Analyzer)
 */
export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly weight?: number;
}

/**
 * Dependency graph (from Codebase Analyzer)
 */
export interface DependencyGraph {
  readonly nodes: readonly DependencyNode[];
  readonly edges: readonly DependencyEdge[];
  readonly statistics?: {
    readonly totalNodes: number;
    readonly totalEdges: number;
    readonly circularDependencies?: readonly string[][];
  };
}

/**
 * Architecture overview (from Codebase Analyzer)
 */
export interface ArchitectureOverview {
  readonly type: string;
  readonly confidence: number;
  readonly patterns?: readonly {
    readonly name: string;
    readonly type: string;
    readonly locations?: readonly { readonly path: string; readonly description: string }[];
  }[];
  readonly structure?: {
    readonly sourceDirs?: readonly { readonly path: string; readonly purpose: string }[];
    readonly testDirs?: readonly { readonly path: string; readonly framework?: string }[];
  };
  readonly metrics?: {
    readonly totalFiles: number;
    readonly totalLines: number;
    readonly languages?: readonly { readonly name: string; readonly percentage: number }[];
  };
}

/**
 * Impact analysis session
 */
export interface ImpactAnalysisSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Session status */
  readonly status: AnalysisSessionStatus;
  /** Change request being analyzed */
  readonly changeRequest: ChangeRequest | null;
  /** Impact analysis result */
  readonly impactAnalysis: ImpactAnalysis | null;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Warnings during analysis */
  readonly warnings: readonly string[];
  /** Errors during analysis */
  readonly errors: readonly string[];
}

/**
 * Impact Analyzer Agent configuration
 */
export interface ImpactAnalyzerConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Maximum dependency chain depth to trace */
  readonly maxDependencyDepth?: number;
  /** Minimum confidence threshold for including impacts */
  readonly minConfidenceThreshold?: number;
  /** Whether to include file-level predictions */
  readonly includeFilePredictions?: boolean;
  /** Whether to include regression analysis */
  readonly includeRegressionAnalysis?: boolean;
  /** Risk factor weights for calculation */
  readonly riskWeights?: {
    readonly complexity: number;
    readonly coupling: number;
    readonly scope: number;
    readonly testCoverage: number;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_IMPACT_ANALYZER_CONFIG: Required<ImpactAnalyzerConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  maxDependencyDepth: 5,
  minConfidenceThreshold: 0.3,
  includeFilePredictions: true,
  includeRegressionAnalysis: true,
  riskWeights: {
    complexity: 0.3,
    coupling: 0.25,
    scope: 0.25,
    testCoverage: 0.2,
  },
} as const;

/**
 * Impact analysis result
 */
export interface ImpactAnalysisResult {
  /** Whether analysis was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to impact_report.yaml */
  readonly outputPath: string;
  /** Impact analysis report */
  readonly impactAnalysis: ImpactAnalysis;
  /** Warnings during analysis */
  readonly warnings: readonly string[];
}

/**
 * Input sources available for analysis
 */
export interface AvailableInputs {
  /** Whether current_state.yaml exists */
  readonly hasCurrentState: boolean;
  /** Whether architecture_overview.yaml exists */
  readonly hasArchitectureOverview: boolean;
  /** Whether dependency_graph.json exists */
  readonly hasDependencyGraph: boolean;
  /** Paths to available inputs */
  readonly paths: {
    readonly currentState: string | undefined;
    readonly architectureOverview: string | undefined;
    readonly dependencyGraph: string | undefined;
  };
}
