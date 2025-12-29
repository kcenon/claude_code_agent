/**
 * Mode Detector module type definitions
 *
 * Defines types for pipeline mode detection, evidence collection,
 * and confidence scoring.
 */

/**
 * Pipeline modes that can be detected
 */
export type PipelineMode = 'greenfield' | 'enhancement';

/**
 * Detection session status
 */
export type DetectionStatus = 'detecting' | 'completed' | 'failed';

/**
 * Confidence level for detection
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Evidence source types
 */
export type EvidenceSource = 'documents' | 'codebase' | 'keywords' | 'user_override';

/**
 * Document presence evidence
 */
export interface DocumentEvidence {
  /** Whether PRD document exists */
  readonly prd: boolean;
  /** Whether SRS document exists */
  readonly srs: boolean;
  /** Whether SDS document exists */
  readonly sds: boolean;
  /** Total document count */
  readonly totalCount: number;
}

/**
 * Codebase presence evidence
 */
export interface CodebaseEvidence {
  /** Whether codebase exists (has source files) */
  readonly exists: boolean;
  /** Number of source files found */
  readonly sourceFileCount: number;
  /** Total lines of code */
  readonly linesOfCode: number;
  /** Whether tests exist */
  readonly hasTests: boolean;
  /** Whether build system is detected */
  readonly hasBuildSystem: boolean;
}

/**
 * Keyword analysis evidence
 */
export interface KeywordEvidence {
  /** Keywords that indicate greenfield mode */
  readonly greenfieldKeywords: readonly string[];
  /** Keywords that indicate enhancement mode */
  readonly enhancementKeywords: readonly string[];
  /** Overall keyword signal strength (-1.0 to 1.0) */
  readonly signalStrength: number;
}

/**
 * User override information
 */
export interface UserOverride {
  /** Whether user explicitly specified mode */
  readonly specified: boolean;
  /** Mode specified by user (if any) */
  readonly mode?: PipelineMode | undefined;
}

/**
 * Combined detection evidence
 */
export interface DetectionEvidence {
  /** Document presence evidence */
  readonly documents: DocumentEvidence;
  /** Codebase presence evidence */
  readonly codebase: CodebaseEvidence;
  /** Keyword analysis evidence */
  readonly keywords: KeywordEvidence;
  /** User override information */
  readonly userOverride: UserOverride;
}

/**
 * Detection score breakdown
 */
export interface DetectionScores {
  /** Score from document analysis (0.0 to 1.0, 1.0 = enhancement) */
  readonly documentScore: number;
  /** Score from codebase analysis (0.0 to 1.0, 1.0 = enhancement) */
  readonly codebaseScore: number;
  /** Score from keyword analysis (0.0 to 1.0, 1.0 = enhancement) */
  readonly keywordScore: number;
  /** Final weighted score (0.0 to 1.0, 1.0 = enhancement) */
  readonly finalScore: number;
}

/**
 * Mode detection result
 */
export interface ModeDetectionResult {
  /** Selected pipeline mode */
  readonly selectedMode: PipelineMode;
  /** Detection confidence (0.0 to 1.0) */
  readonly confidence: number;
  /** Confidence level classification */
  readonly confidenceLevel: ConfidenceLevel;
  /** Detection evidence */
  readonly evidence: DetectionEvidence;
  /** Score breakdown */
  readonly scores: DetectionScores;
  /** Human-readable reasoning */
  readonly reasoning: string;
  /** Recommendations for the user */
  readonly recommendations: readonly string[];
}

/**
 * Mode detection session
 */
export interface ModeDetectionSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Session status */
  readonly status: DetectionStatus;
  /** Project root path */
  readonly rootPath: string;
  /** User input for keyword analysis */
  readonly userInput: string;
  /** Detection result (if completed) */
  readonly result: ModeDetectionResult | null;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Any errors during detection */
  readonly errors: readonly string[];
}

/**
 * Detection rule configuration
 */
export interface DetectionRule {
  /** Rule name */
  readonly name: string;
  /** Condition description */
  readonly condition: string;
  /** Resulting mode if condition matches */
  readonly mode: PipelineMode;
  /** Confidence when this rule matches */
  readonly confidence: number;
  /** Priority (higher = evaluated first) */
  readonly priority: number;
}

/**
 * Keyword configuration
 */
export interface KeywordConfig {
  /** Keywords indicating greenfield projects */
  readonly greenfieldKeywords: readonly string[];
  /** Keywords indicating enhancement projects */
  readonly enhancementKeywords: readonly string[];
}

/**
 * Score weight configuration
 */
export interface ScoreWeights {
  /** Weight for document score */
  readonly documents: number;
  /** Weight for codebase score */
  readonly codebase: number;
  /** Weight for keyword score */
  readonly keywords: number;
}

/**
 * Threshold configuration
 */
export interface DetectionThresholds {
  /** Score threshold for enhancement mode (>= this = enhancement) */
  readonly enhancementThreshold: number;
  /** Score threshold for greenfield mode (<= this = greenfield) */
  readonly greenfieldThreshold: number;
  /** Minimum source files to consider codebase as existing */
  readonly minSourceFiles: number;
  /** Minimum lines of code to consider codebase as substantial */
  readonly minLinesOfCode: number;
}

/**
 * Mode Detector configuration
 */
export interface ModeDetectorConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Documents base path (defaults to docs) */
  readonly docsBasePath?: string;
  /** Detection rules */
  readonly rules?: readonly DetectionRule[];
  /** Keyword configuration */
  readonly keywords?: KeywordConfig;
  /** Score weights */
  readonly weights?: ScoreWeights;
  /** Detection thresholds */
  readonly thresholds?: DetectionThresholds;
}

/**
 * Default greenfield keywords
 */
export const DEFAULT_GREENFIELD_KEYWORDS: readonly string[] = [
  'new project',
  'from scratch',
  'initial implementation',
  'create new',
  'start fresh',
  'greenfield',
  'brand new',
  'bootstrap',
  'scaffold',
  'initialize',
] as const;

/**
 * Default enhancement keywords
 */
export const DEFAULT_ENHANCEMENT_KEYWORDS: readonly string[] = [
  'add feature',
  'improve',
  'fix bug',
  'enhance',
  'modify',
  'update',
  'refactor',
  'extend',
  'upgrade',
  'optimize',
  'change',
  'migrate',
  'existing',
  'current',
] as const;

/**
 * Default detection rules
 */
export const DEFAULT_DETECTION_RULES: readonly DetectionRule[] = [
  {
    name: 'user_override',
    condition: 'User explicitly specifies mode',
    mode: 'enhancement', // Will be overridden by actual user choice
    confidence: 1.0,
    priority: 100,
  },
  {
    name: 'no_docs_no_code',
    condition: 'No existing PRD/SRS/SDS and no source code',
    mode: 'greenfield',
    confidence: 1.0,
    priority: 90,
  },
  {
    name: 'has_docs_and_code',
    condition: 'Has existing PRD/SRS/SDS and substantial source code',
    mode: 'enhancement',
    confidence: 0.95,
    priority: 80,
  },
  {
    name: 'has_docs_only',
    condition: 'Has existing PRD/SRS/SDS but minimal/no code',
    mode: 'enhancement',
    confidence: 0.85,
    priority: 70,
  },
  {
    name: 'has_code_only',
    condition: 'Has existing code but no PRD/SRS/SDS',
    mode: 'enhancement',
    confidence: 0.8,
    priority: 60,
  },
] as const;

/**
 * Default configuration values
 */
export const DEFAULT_MODE_DETECTOR_CONFIG: Required<ModeDetectorConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  docsBasePath: 'docs',
  rules: DEFAULT_DETECTION_RULES,
  keywords: {
    greenfieldKeywords: DEFAULT_GREENFIELD_KEYWORDS,
    enhancementKeywords: DEFAULT_ENHANCEMENT_KEYWORDS,
  },
  weights: {
    documents: 0.35,
    codebase: 0.45,
    keywords: 0.20,
  },
  thresholds: {
    enhancementThreshold: 0.5,
    greenfieldThreshold: 0.3,
    minSourceFiles: 5,
    minLinesOfCode: 100,
  },
} as const;

/**
 * Detection statistics
 */
export interface DetectionStats {
  /** Time spent on document check (ms) */
  readonly documentCheckTimeMs: number;
  /** Time spent on codebase check (ms) */
  readonly codebaseCheckTimeMs: number;
  /** Time spent on keyword analysis (ms) */
  readonly keywordAnalysisTimeMs: number;
  /** Total detection time (ms) */
  readonly totalTimeMs: number;
}
