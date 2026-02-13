/**
 * ModelSelector - Selects optimal model based on task complexity and budget
 *
 * Features:
 * - Task complexity analysis
 * - Cost-aware model selection
 * - Performance vs cost tradeoff optimization
 * - Agent-specific model recommendations
 */

/**
 * Available model types
 */
export type ModelType = 'haiku' | 'sonnet' | 'opus';

/**
 * Task complexity level
 */
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'critical';

/**
 * Model characteristics
 */
export interface ModelProfile {
  /** Model name */
  readonly name: ModelType;
  /** Input cost per 1000 tokens */
  readonly inputCostPer1k: number;
  /** Output cost per 1000 tokens */
  readonly outputCostPer1k: number;
  /** Relative capability score (0-1) */
  readonly capabilityScore: number;
  /** Average latency in milliseconds */
  readonly avgLatencyMs: number;
  /** Maximum context window */
  readonly maxContextTokens: number;
  /** Best for task types */
  readonly bestFor: readonly string[];
}

/**
 * Model selection configuration
 */
export interface ModelSelectorConfig {
  /** Default model */
  readonly defaultModel?: ModelType;
  /** Cost sensitivity (0-1, higher = prefer cheaper models) */
  readonly costSensitivity?: number;
  /** Quality sensitivity (0-1, higher = prefer better models) */
  readonly qualitySensitivity?: number;
  /** Budget constraint in USD per session */
  readonly budgetConstraintUsd?: number;
  /** Agent-specific model overrides */
  readonly agentOverrides?: Record<string, ModelType>;
  /** Task-specific model overrides */
  readonly taskOverrides?: Record<string, ModelType>;
}

/**
 * Model selection result
 */
export interface ModelSelectionResult {
  /** Selected model */
  readonly model: ModelType;
  /** Reason for selection */
  readonly reason: string;
  /** Estimated cost for task */
  readonly estimatedCostUsd: number;
  /** Confidence in selection (0-1) */
  readonly confidence: number;
  /** Alternative models considered */
  readonly alternatives: readonly ModelAlternative[];
}

/**
 * Alternative model information
 */
export interface ModelAlternative {
  /** Model name */
  readonly model: ModelType;
  /** Cost difference from selected */
  readonly costDifferenceUsd: number;
  /** Why not selected */
  readonly reason: string;
}

/**
 * Task analysis for model selection
 */
export interface TaskAnalysis {
  /** Estimated input tokens */
  readonly estimatedInputTokens: number;
  /** Estimated output tokens */
  readonly estimatedOutputTokens: number;
  /** Task complexity */
  readonly complexity: TaskComplexity;
  /** Task type/category */
  readonly taskType?: string;
  /** Agent performing the task */
  readonly agent?: string;
  /** Whether accuracy is critical */
  readonly accuracyCritical?: boolean;
  /** Whether speed is critical */
  readonly speedCritical?: boolean;
}

/**
 * Model profiles with pricing and capabilities
 */
const MODEL_PROFILES: Record<ModelType, ModelProfile> = {
  haiku: {
    name: 'haiku',
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125,
    capabilityScore: 0.6,
    avgLatencyMs: 500,
    maxContextTokens: 200000,
    bestFor: ['validation', 'simple_extraction', 'formatting', 'classification'],
  },
  sonnet: {
    name: 'sonnet',
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    capabilityScore: 0.85,
    avgLatencyMs: 1000,
    maxContextTokens: 200000,
    bestFor: ['code_generation', 'analysis', 'documentation', 'general'],
  },
  opus: {
    name: 'opus',
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    capabilityScore: 1.0,
    avgLatencyMs: 2000,
    maxContextTokens: 200000,
    bestFor: ['complex_reasoning', 'architecture', 'critical_decisions', 'creative'],
  },
};

/**
 * Complexity to minimum model mapping
 */
const COMPLEXITY_MODEL_MAP: Record<TaskComplexity, ModelType> = {
  simple: 'haiku',
  moderate: 'sonnet',
  complex: 'sonnet',
  critical: 'opus',
};

/**
 * Default configuration values
 */
const DEFAULT_MODEL: ModelType = 'sonnet';
const DEFAULT_COST_SENSITIVITY = 0.5;
const DEFAULT_QUALITY_SENSITIVITY = 0.5;

/**
 * ModelSelector class for optimal model selection
 */
export class ModelSelector {
  private readonly config: Required<
    Pick<ModelSelectorConfig, 'defaultModel' | 'costSensitivity' | 'qualitySensitivity'>
  > &
    ModelSelectorConfig;

  constructor(config: ModelSelectorConfig = {}) {
    this.config = {
      ...config,
      defaultModel: config.defaultModel ?? DEFAULT_MODEL,
      costSensitivity: config.costSensitivity ?? DEFAULT_COST_SENSITIVITY,
      qualitySensitivity: config.qualitySensitivity ?? DEFAULT_QUALITY_SENSITIVITY,
    };
  }

  /**
   * Select optimal model for a task
   * @param task
   */
  public selectModel(task: TaskAnalysis): ModelSelectionResult {
    // Check for agent override
    if (task.agent !== undefined) {
      const agentModel = this.config.agentOverrides?.[task.agent];
      if (agentModel !== undefined) {
        return this.createResult(agentModel, 'Agent-specific override', task, 1.0);
      }
    }

    // Check for task type override
    if (task.taskType !== undefined) {
      const taskModel = this.config.taskOverrides?.[task.taskType];
      if (taskModel !== undefined) {
        return this.createResult(taskModel, 'Task-type override', task, 1.0);
      }
    }

    // Determine minimum model based on complexity
    const minModel = COMPLEXITY_MODEL_MAP[task.complexity];

    // Calculate scores for each model
    const scores = this.calculateModelScores(task, minModel);

    // Select best model
    const sortedModels = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const firstEntry = sortedModels[0];
    if (firstEntry === undefined) {
      return this.createResult(this.config.defaultModel, 'Default model (no scores)', task, 0.5);
    }
    const selectedModel = firstEntry[0] as ModelType;

    // Check budget constraint
    if (this.config.budgetConstraintUsd !== undefined) {
      const cost = this.estimateCost(selectedModel, task);
      if (cost > this.config.budgetConstraintUsd) {
        // Try to find a cheaper model that still meets requirements
        for (const entry of sortedModels) {
          const model = entry[0] as ModelType;
          const modelCost = this.estimateCost(model, task);
          if (modelCost <= this.config.budgetConstraintUsd) {
            return this.createResult(model, 'Budget-constrained selection', task, 0.8);
          }
        }
      }
    }

    const reason = this.getSelectionReason(selectedModel, task);
    const selectedScore = scores[selectedModel];
    return this.createResult(selectedModel, reason, task, selectedScore);
  }

  /**
   * Get model profile
   * @param model
   */
  public getModelProfile(model: ModelType): ModelProfile {
    return MODEL_PROFILES[model];
  }

  /**
   * Estimate cost for a task with a specific model
   * @param model
   * @param task
   */
  public estimateCost(model: ModelType, task: TaskAnalysis): number {
    const profile = MODEL_PROFILES[model];
    const inputCost = (task.estimatedInputTokens / 1000) * profile.inputCostPer1k;
    const outputCost = (task.estimatedOutputTokens / 1000) * profile.outputCostPer1k;
    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  /**
   * Analyze task complexity from content
   * @param content
   * @param options
   * @param options.hasCodeGeneration
   * @param options.hasReasoning
   * @param options.requiresAccuracy
   */
  public analyzeComplexity(
    content: string,
    options?: {
      hasCodeGeneration?: boolean;
      hasReasoning?: boolean;
      requiresAccuracy?: boolean;
    }
  ): TaskComplexity {
    let complexityScore = 0;

    // Length-based scoring
    const length = content.length;
    if (length > 10000) complexityScore += 2;
    else if (length > 5000) complexityScore += 1;

    // Content-based scoring
    const hasCode = /```[\s\S]*```/.test(content);
    const hasStructuredData = /\{[\s\S]*\}/.test(content) || /\[[\s\S]*\]/.test(content);
    const hasMultipleQuestions = (content.match(/\?/g) || []).length > 3;

    if (hasCode) complexityScore += 1;
    if (hasStructuredData) complexityScore += 1;
    if (hasMultipleQuestions) complexityScore += 1;

    // Option-based scoring
    if (options?.hasCodeGeneration === true) complexityScore += 2;
    if (options?.hasReasoning === true) complexityScore += 1;
    if (options?.requiresAccuracy === true) complexityScore += 2;

    // Map score to complexity
    if (complexityScore >= 6) return 'critical';
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'moderate';
    return 'simple';
  }

  /**
   * Get recommended model for an agent type
   * @param agentType
   */
  public getAgentRecommendation(agentType: string): ModelType {
    const recommendations: Record<string, ModelType> = {
      collector: 'sonnet',
      'prd-writer': 'sonnet',
      'srs-writer': 'sonnet',
      'sds-writer': 'opus',
      'issue-generator': 'sonnet',
      controller: 'sonnet',
      worker: 'sonnet',
      'pr-reviewer': 'sonnet',
      validator: 'haiku',
      formatter: 'haiku',
    };

    return recommendations[agentType] ?? this.config.defaultModel;
  }

  /**
   * Calculate model scores based on task requirements
   * @param task
   * @param minModel
   */
  private calculateModelScores(task: TaskAnalysis, minModel: ModelType): Record<ModelType, number> {
    const scores: Record<ModelType, number> = {
      haiku: 0,
      sonnet: 0,
      opus: 0,
    };

    const modelOrder: ModelType[] = ['haiku', 'sonnet', 'opus'];
    const minIndex = modelOrder.indexOf(minModel);

    for (const model of modelOrder) {
      const profile = MODEL_PROFILES[model];
      const modelIndex = modelOrder.indexOf(model);

      // Skip models below minimum
      if (modelIndex < minIndex) {
        scores[model] = -1;
        continue;
      }

      // Base score from capability
      let score = profile.capabilityScore * this.config.qualitySensitivity;

      // Cost factor (inverse - lower cost = higher score)
      const cost = this.estimateCost(model, task);
      const maxCost = this.estimateCost('opus', task);
      const costFactor = 1 - cost / maxCost;
      score += costFactor * this.config.costSensitivity;

      // Speed factor for speed-critical tasks
      if (task.speedCritical === true) {
        const speedFactor = 1 - profile.avgLatencyMs / 2000;
        score += speedFactor * 0.2;
      }

      // Accuracy factor for accuracy-critical tasks
      if (task.accuracyCritical === true) {
        score += profile.capabilityScore * 0.3;
      }

      // Check if model is best for task type
      if (task.taskType !== undefined && profile.bestFor.includes(task.taskType)) {
        score += 0.2;
      }

      scores[model] = score;
    }

    return scores;
  }

  /**
   * Get selection reason
   * @param model
   * @param task
   */
  private getSelectionReason(model: ModelType, task: TaskAnalysis): string {
    const profile = MODEL_PROFILES[model];

    if (task.accuracyCritical === true && model === 'opus') {
      return 'Accuracy-critical task requires highest capability model';
    }

    if (task.speedCritical === true && model === 'haiku') {
      return 'Speed-critical task benefits from fastest model';
    }

    if (task.complexity === 'simple' && model === 'haiku') {
      return 'Simple task can be handled by cost-effective model';
    }

    if (task.taskType !== undefined && profile.bestFor.includes(task.taskType)) {
      return `Model is optimized for ${task.taskType} tasks`;
    }

    return `Balanced selection based on complexity (${task.complexity}) and cost`;
  }

  /**
   * Create selection result
   * @param model
   * @param reason
   * @param task
   * @param confidence
   */
  private createResult(
    model: ModelType,
    reason: string,
    task: TaskAnalysis,
    confidence: number
  ): ModelSelectionResult {
    const alternatives: ModelAlternative[] = [];
    const selectedCost = this.estimateCost(model, task);

    for (const altModel of Object.keys(MODEL_PROFILES) as ModelType[]) {
      if (altModel !== model) {
        const altCost = this.estimateCost(altModel, task);
        alternatives.push({
          model: altModel,
          costDifferenceUsd: Math.round((altCost - selectedCost) * 10000) / 10000,
          reason: this.getAlternativeReason(altModel, model, task),
        });
      }
    }

    return {
      model,
      reason,
      estimatedCostUsd: selectedCost,
      confidence: Math.round(confidence * 100) / 100,
      alternatives,
    };
  }

  /**
   * Get reason why alternative was not selected
   * @param alt
   * @param selected
   * @param task
   */
  private getAlternativeReason(alt: ModelType, selected: ModelType, task: TaskAnalysis): string {
    const altProfile = MODEL_PROFILES[alt];
    const selectedProfile = MODEL_PROFILES[selected];

    if (altProfile.capabilityScore < selectedProfile.capabilityScore) {
      if (task.complexity === 'complex' || task.complexity === 'critical') {
        return 'Insufficient capability for task complexity';
      }
    }

    if (altProfile.inputCostPer1k > selectedProfile.inputCostPer1k) {
      return 'Higher cost without proportional benefit';
    }

    if (altProfile.avgLatencyMs > selectedProfile.avgLatencyMs && task.speedCritical === true) {
      return 'Too slow for speed-critical task';
    }

    return 'Not optimal for this task profile';
  }
}

/**
 * Singleton instance for global access
 */
let globalModelSelector: ModelSelector | null = null;

/**
 * Get or create the global ModelSelector instance
 * @param config
 */
export function getModelSelector(config?: ModelSelectorConfig): ModelSelector {
  if (globalModelSelector === null) {
    globalModelSelector = new ModelSelector(config);
  }
  return globalModelSelector;
}

/**
 * Reset the global ModelSelector instance
 */
export function resetModelSelector(): void {
  globalModelSelector = null;
}
