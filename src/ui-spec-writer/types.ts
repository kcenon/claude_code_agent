/**
 * UI Specification Writer Agent module type definitions
 *
 * Defines types for UI screen specification and user flow document
 * generation from SRS use cases.
 */

/**
 * UI spec generation status
 */
export type UISpecGenerationStatus = 'pending' | 'parsing' | 'generating' | 'completed' | 'failed';

/**
 * Document status
 */
export type UISpecDocumentStatus = 'Draft' | 'Review' | 'Approved';

/**
 * Project type classification for auto-skip logic
 */
export type ProjectType = 'web' | 'mobile' | 'desktop' | 'cli' | 'api' | 'library' | 'unknown';

// ============================================================================
// Parsed Input Types (lightweight extracts from SRS markdown)
// ============================================================================

/**
 * A single use case extracted from the SRS
 */
export interface ParsedUseCase {
  /** Use case identifier, e.g., "UC-001" */
  readonly id: string;
  /** Use case title */
  readonly title: string;
  /** Use case description */
  readonly description: string;
  /** Actor(s) involved */
  readonly actors: readonly string[];
  /** Steps in the use case flow */
  readonly steps: readonly string[];
  /** Preconditions */
  readonly preconditions: readonly string[];
  /** Postconditions */
  readonly postconditions: readonly string[];
}

/**
 * A software feature extracted from the SRS
 */
export interface ParsedFeature {
  /** Feature identifier, e.g., "SF-001" */
  readonly id: string;
  /** Feature title */
  readonly title: string;
  /** Feature description */
  readonly description: string;
}

/**
 * Lightweight SRS extract used by the UI Spec Writer
 */
export interface ParsedSRSForUI {
  /** SRS document ID, e.g., "SRS-my-project" */
  readonly documentId: string;
  /** Product name */
  readonly productName: string;
  /** Use cases extracted from the SRS */
  readonly useCases: readonly ParsedUseCase[];
  /** Features extracted from the SRS */
  readonly features: readonly ParsedFeature[];
  /** Detected project type */
  readonly projectType: ProjectType;
}

// ============================================================================
// Screen Specification Types
// ============================================================================

/**
 * A UI element within a screen
 */
export interface UIElement {
  /** Element identifier within the screen */
  readonly id: string;
  /** Element type (button, input, label, list, table, etc.) */
  readonly type: string;
  /** Element label or display text */
  readonly label: string;
  /** Data source for this element (e.g., "User input", "API response", "System state") */
  readonly dataSource: string;
  /** Interaction behavior description */
  readonly behavior: string;
}

/**
 * A single screen specification
 */
export interface ScreenSpec {
  /** Screen identifier, e.g., "SCR-001" */
  readonly id: string;
  /** Screen name slug, e.g., "login" */
  readonly nameSlug: string;
  /** Screen title */
  readonly title: string;
  /** Screen purpose description */
  readonly purpose: string;
  /** Related use case IDs */
  readonly relatedUseCases: readonly string[];
  /** Related feature IDs */
  readonly relatedFeatures: readonly string[];
  /** UI elements on the screen */
  readonly elements: readonly UIElement[];
  /** Navigation targets (screen IDs reachable from this screen) */
  readonly navigationTargets: readonly string[];
}

// ============================================================================
// Flow Specification Types
// ============================================================================

/**
 * A single step in a user flow
 */
export interface FlowStep {
  /** Step number (1-based) */
  readonly stepNumber: number;
  /** Source screen ID */
  readonly fromScreen: string;
  /** Target screen ID */
  readonly toScreen: string;
  /** Action that triggers the transition */
  readonly action: string;
  /** Condition for the transition (empty if unconditional) */
  readonly condition: string;
}

/**
 * A user flow specification
 */
export interface FlowSpec {
  /** Flow identifier, e.g., "FLW-001" */
  readonly id: string;
  /** Flow name slug, e.g., "user-login" */
  readonly nameSlug: string;
  /** Flow title */
  readonly title: string;
  /** Flow description */
  readonly description: string;
  /** Related use case IDs */
  readonly relatedUseCases: readonly string[];
  /** Ordered steps in the flow */
  readonly steps: readonly FlowStep[];
  /** Preconditions for the flow */
  readonly preconditions: readonly string[];
  /** Expected outcomes */
  readonly outcomes: readonly string[];
}

// ============================================================================
// Design System Types
// ============================================================================

/**
 * A design token entry
 */
export interface DesignToken {
  /** Token category (color, spacing, typography, etc.) */
  readonly category: string;
  /** Token name */
  readonly name: string;
  /** Token value */
  readonly value: string;
  /** Token description */
  readonly description: string;
}

/**
 * A component in the design system
 */
export interface DesignComponent {
  /** Component name */
  readonly name: string;
  /** Component description */
  readonly description: string;
  /** Component variants */
  readonly variants: readonly string[];
}

/**
 * Design system specification
 */
export interface DesignSystem {
  /** Design tokens */
  readonly tokens: readonly DesignToken[];
  /** Reusable components */
  readonly components: readonly DesignComponent[];
  /** Technology stack reference */
  readonly technologyStack: string;
}

// ============================================================================
// Agent Configuration and Session Types
// ============================================================================

/**
 * UI Spec Writer Agent configuration options
 */
export interface UISpecWriterAgentConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Output directory for public UI docs (defaults to docs/ui) */
  readonly publicDocsPath?: string;
}

/**
 * UI spec generation session
 */
export interface UISpecGenerationSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Current generation status */
  readonly status: UISpecGenerationStatus;
  /** Parsed SRS extract */
  readonly parsedSRS: ParsedSRSForUI;
  /** Whether this stage was auto-skipped */
  readonly skipped: boolean;
  /** Skip reason (when skipped is true) */
  readonly skipReason?: string;
  /** Generated screens (when completed) */
  readonly screens?: readonly ScreenSpec[];
  /** Generated flows (when completed) */
  readonly flows?: readonly FlowSpec[];
  /** Generated design system (when completed) */
  readonly designSystem?: DesignSystem;
  /** Session start time (ISO timestamp) */
  readonly startedAt: string;
  /** Session last update time (ISO timestamp) */
  readonly updatedAt: string;
  /** Error message if failed */
  readonly errorMessage?: string;
  /** Non-fatal warnings accumulated during generation */
  readonly warnings?: readonly string[];
}

/**
 * UI spec generation result
 */
export interface UISpecGenerationResult {
  /** Whether generation was successful */
  readonly success: boolean;
  /** Whether the stage was skipped */
  readonly skipped: boolean;
  /** Skip reason (when skipped is true) */
  readonly skipReason?: string;
  /** Project identifier */
  readonly projectId: string;
  /** Paths to generated screen spec files */
  readonly screenPaths: readonly string[];
  /** Paths to generated flow spec files */
  readonly flowPaths: readonly string[];
  /** Path to the design system document */
  readonly designSystemPath: string;
  /** Path to the UI README index */
  readonly readmePath: string;
  /** Generation statistics */
  readonly stats: UISpecGenerationStats;
  /** Non-fatal warnings from generation */
  readonly warnings?: readonly string[];
}

/**
 * Statistics about the UI spec generation process
 */
export interface UISpecGenerationStats {
  /** Number of use cases processed */
  readonly useCasesProcessed: number;
  /** Number of screens generated */
  readonly screensGenerated: number;
  /** Number of flows generated */
  readonly flowsGenerated: number;
  /** Number of design tokens generated */
  readonly designTokensGenerated: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}
