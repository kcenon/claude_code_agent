/**
 * LLMExtractor - LLM-backed information extraction with keyword fallback
 *
 * Replaces the keyword-based InformationExtractor with LLM analysis
 * via ExecutionAdapter. Falls back to the keyword-based extractor on failure.
 *
 * The adapter is expected to drive an SDK that writes the JSON extraction
 * result either as the first artifact's `description` (preferred for tests
 * and stub adapters) or to disk at the artifact `path`. The extractor reads
 * the result and parses it through the same Zod schema used by the legacy
 * bridge code path.
 *
 * @packageDocumentation
 */

import { promises as fs } from 'node:fs';
import { z } from 'zod';
import type { ExecutionAdapter, StageExecutionResult } from '../execution/index.js';
import type { InformationExtractor } from './InformationExtractor.js';
import type { ParsedInput, ExtractionResult } from './types.js';
import { getLogger } from '../logging/index.js';

/**
 * Zod schema for validating LLM extraction output.
 */
const LLMRequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['functional', 'non_functional', 'constraint']),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  category: z.string(),
  confidence: z.number().min(0).max(1),
});

const LLMExtractionResultSchema = z.object({
  projectName: z.string(),
  projectDescription: z.string(),
  requirements: z.array(LLMRequirementSchema),
  ambiguities: z.array(z.string()).optional(),
});

/**
 * Inferred type from the LLM extraction schema
 */
type LLMExtractionResult = z.infer<typeof LLMExtractionResultSchema>;

/**
 * LLMExtractor delegates information extraction to an LLM via
 * {@link ExecutionAdapter}, with graceful fallback to keyword-based
 * {@link InformationExtractor}.
 */
export class LLMExtractor {
  constructor(
    private readonly adapter: ExecutionAdapter,
    private readonly fallback: InformationExtractor,
    private readonly scratchpadDir: string = '',
    private readonly projectDir: string = ''
  ) {}

  /**
   * Extract structured information from parsed input using LLM analysis.
   * Falls back to keyword-based extraction on any failure.
   *
   * @param input - Parsed input to analyze
   * @param projectContext - Optional additional context about the project
   * @returns ExtractionResult compatible with the collector pipeline
   */
  async extract(input: ParsedInput, projectContext?: string): Promise<ExtractionResult> {
    try {
      const result = await this.adapter.execute({
        agentType: 'collector',
        workOrder: this.buildExtractionPrompt(input.combinedContent, projectContext),
        priorOutputs: this.buildPriorOutputs(projectContext),
      });

      if (result.status !== 'success') {
        return this.fallback.extract(input);
      }

      const extractionJson = await this.readExtractionPayload(result);
      if (extractionJson === null) {
        return this.fallback.extract(input);
      }

      return this.parseExtraction(extractionJson);
    } catch (error) {
      getLogger().warn('LLM extraction failed, falling back to keyword extractor', {
        agent: 'LLMExtractor',
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallback.extract(input);
    }
  }

  /**
   * Resolve the JSON extraction payload from the adapter result.
   *
   * The adapter contract does not return free-form text. Implementations
   * (production SDK, mocks) communicate the extraction JSON via artifacts:
   *
   * 1. Preferred for tests and stubs: the first artifact's `description`
   *    contains the JSON document inline.
   * 2. Production SDK: the artifact `path` points to a JSON file written by
   *    the model via Edit/Write tools — read that file from disk.
   *
   * Returns null when neither channel produced a payload.
   * @param result
   */
  private async readExtractionPayload(result: StageExecutionResult): Promise<string | null> {
    const first = result.artifacts[0];
    if (first === undefined) {
      return null;
    }
    if (first.description !== undefined && first.description.length > 0) {
      return first.description;
    }
    try {
      return await fs.readFile(first.path, 'utf8');
    } catch (error) {
      getLogger().warn('Failed to read extraction artifact from disk', {
        agent: 'LLMExtractor',
        path: first.path,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Build the `priorOutputs` map forwarded to the adapter so downstream
   * configuration (scratchpad / project paths, project context) is visible
   * to the SDK without changing the request shape.
   * @param projectContext
   */
  private buildPriorOutputs(projectContext?: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.scratchpadDir.length > 0) {
      out['scratchpadDir'] = this.scratchpadDir;
    }
    if (this.projectDir.length > 0) {
      out['projectDir'] = this.projectDir;
    }
    if (projectContext !== undefined && projectContext.length > 0) {
      out['projectContext'] = projectContext;
    }
    return out;
  }

  /**
   * Build the prompt sent to the LLM for extraction.
   * @param text
   * @param context
   */
  private buildExtractionPrompt(text: string, context?: string): string {
    const contextBlock =
      context !== undefined && context.length > 0
        ? `\n\nAdditional project context:\n${context}`
        : '';

    return `Analyze the following text and extract structured project information.

Return a JSON object with exactly this shape:
{
  "projectName": "string - the project name",
  "projectDescription": "string - brief project description",
  "requirements": [
    {
      "id": "string - unique ID like REQ-001",
      "text": "string - requirement description",
      "type": "functional | non_functional | constraint",
      "priority": "P0 | P1 | P2 | P3",
      "category": "string - e.g. authentication, performance, security",
      "confidence": 0.0 to 1.0
    }
  ],
  "ambiguities": ["string - unclear aspects that need clarification"]
}

Rules:
- P0 = critical/must-have, P1 = important, P2 = nice-to-have, P3 = future/low
- confidence reflects how clearly the requirement is stated
- Include all functional, non-functional, and constraint requirements
- List any ambiguities or missing information

Text to analyze:
${text}${contextBlock}`;
  }

  /**
   * Parse and validate LLM output, converting it to ExtractionResult format.
   * @param output
   */
  private parseExtraction(output: string): ExtractionResult {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch === null) {
      throw new Error('No JSON object found in LLM output');
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    const validated: LLMExtractionResult = LLMExtractionResultSchema.parse(parsed);

    return this.toExtractionResult(validated);
  }

  /**
   * Convert validated LLM output to the ExtractionResult format used by the collector pipeline.
   * @param llmResult
   */
  private toExtractionResult(llmResult: LLMExtractionResult): ExtractionResult {
    let frIndex = 0;
    let nfrIndex = 0;
    let conIndex = 0;

    const functionalRequirements = llmResult.requirements
      .filter((r) => r.type === 'functional')
      .map((r) => {
        frIndex++;
        return {
          id: `FR-${String(frIndex).padStart(3, '0')}`,
          title: r.text.length > 60 ? r.text.slice(0, 57) + '...' : r.text,
          description: r.text,
          priority: r.priority,
          source: 'llm-extraction',
          confidence: r.confidence,
          isFunctional: true as const,
        };
      });

    const nonFunctionalRequirements = llmResult.requirements
      .filter((r) => r.type === 'non_functional')
      .map((r) => {
        nfrIndex++;
        const nfrCategory = this.mapCategory(r.category);
        return {
          id: `NFR-${String(nfrIndex).padStart(3, '0')}`,
          title: r.text.length > 60 ? r.text.slice(0, 57) + '...' : r.text,
          description: r.text,
          priority: r.priority,
          source: 'llm-extraction',
          confidence: r.confidence,
          isFunctional: false as const,
          nfrCategory,
        };
      });

    const constraints = llmResult.requirements
      .filter((r) => r.type === 'constraint')
      .map((r) => {
        conIndex++;
        return {
          id: `CON-${String(conIndex).padStart(3, '0')}`,
          description: r.text,
          type: this.mapConstraintType(r.category),
          source: 'llm-extraction',
          confidence: r.confidence,
        };
      });

    const clarificationQuestions = (llmResult.ambiguities ?? []).map((ambiguity, i) => ({
      id: `Q-${String(i + 1).padStart(3, '0')}`,
      category: 'requirement' as const,
      question: ambiguity,
      context: 'Identified as ambiguous by LLM analysis.',
      required: false,
    }));

    const allConfidences = llmResult.requirements.map((r) => r.confidence);
    const overallConfidence =
      allConfidences.length > 0
        ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
        : 0.5;

    const warnings: string[] = [];
    if (functionalRequirements.length === 0) {
      warnings.push(
        'No functional requirements detected - consider providing more specific feature descriptions'
      );
    }

    return {
      projectName: llmResult.projectName,
      projectDescription: llmResult.projectDescription,
      functionalRequirements,
      nonFunctionalRequirements,
      constraints,
      assumptions: [],
      dependencies: [],
      clarificationQuestions,
      overallConfidence,
      warnings,
    };
  }

  /**
   * Map a free-form category string to a known NFR category.
   * @param category
   */
  private mapCategory(
    category: string
  ): 'performance' | 'security' | 'scalability' | 'usability' | 'reliability' | 'maintainability' {
    const lower = category.toLowerCase();
    const mapping: Record<
      string,
      'performance' | 'security' | 'scalability' | 'usability' | 'reliability' | 'maintainability'
    > = {
      performance: 'performance',
      speed: 'performance',
      latency: 'performance',
      security: 'security',
      auth: 'security',
      authentication: 'security',
      scalability: 'scalability',
      scale: 'scalability',
      usability: 'usability',
      ux: 'usability',
      reliability: 'reliability',
      availability: 'reliability',
      maintainability: 'maintainability',
      testability: 'maintainability',
    };
    return mapping[lower] ?? 'performance';
  }

  /**
   * Map a free-form category string to a known constraint type.
   * @param category
   */
  private mapConstraintType(
    category: string
  ): 'technical' | 'business' | 'regulatory' | 'resource' {
    const lower = category.toLowerCase();
    const mapping: Record<string, 'technical' | 'business' | 'regulatory' | 'resource'> = {
      technical: 'technical',
      technology: 'technical',
      platform: 'technical',
      business: 'business',
      budget: 'business',
      timeline: 'business',
      regulatory: 'regulatory',
      compliance: 'regulatory',
      legal: 'regulatory',
      resource: 'resource',
    };
    return mapping[lower] ?? 'technical';
  }
}
