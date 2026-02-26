import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMExtractor } from '../../src/collector/LLMExtractor.js';
import { InformationExtractor, InputParser } from '../../src/collector/index.js';
import type { AgentBridge, AgentRequest, AgentResponse } from '../../src/agents/AgentBridge.js';

/**
 * Create a mock AgentBridge that returns a configurable response.
 */
function createMockBridge(response: AgentResponse): AgentBridge {
  return {
    execute: vi.fn().mockResolvedValue(response),
    supports: vi.fn().mockReturnValue(true),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a valid LLM JSON response string.
 */
function validLLMResponse(): string {
  return JSON.stringify({
    projectName: 'TaskManager',
    projectDescription: 'A task management application',
    requirements: [
      {
        id: 'REQ-001',
        text: 'Users must be able to create tasks',
        type: 'functional',
        priority: 'P0',
        category: 'task-management',
        confidence: 0.9,
      },
      {
        id: 'REQ-002',
        text: 'Response time must be under 200ms',
        type: 'non_functional',
        priority: 'P1',
        category: 'performance',
        confidence: 0.85,
      },
      {
        id: 'REQ-003',
        text: 'Must use PostgreSQL database',
        type: 'constraint',
        priority: 'P1',
        category: 'technical',
        confidence: 0.95,
      },
    ],
    ambiguities: ['User authentication method is not specified'],
  });
}

describe('LLMExtractor', () => {
  let fallback: InformationExtractor;
  let parser: InputParser;

  beforeEach(() => {
    fallback = new InformationExtractor();
    parser = new InputParser();
  });

  describe('extract', () => {
    it('should return structured extraction from LLM response', async () => {
      const bridge = createMockBridge({
        output: validLLMResponse(),
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([
        parser.parseText('Build a task management app with user login'),
      ]);

      const result = await extractor.extract(input);

      expect(result.projectName).toBe('TaskManager');
      expect(result.projectDescription).toBe('A task management application');
      expect(result.functionalRequirements).toHaveLength(1);
      expect(result.functionalRequirements[0].id).toBe('FR-001');
      expect(result.functionalRequirements[0].confidence).toBe(0.9);
      expect(result.nonFunctionalRequirements).toHaveLength(1);
      expect(result.nonFunctionalRequirements[0].id).toBe('NFR-001');
      expect(result.nonFunctionalRequirements[0].nfrCategory).toBe('performance');
      expect(result.constraints).toHaveLength(1);
      expect(result.constraints[0].id).toBe('CON-001');
      expect(result.constraints[0].type).toBe('technical');
    });

    it('should convert ambiguities to clarification questions', async () => {
      const bridge = createMockBridge({
        output: validLLMResponse(),
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('Some text')]);

      const result = await extractor.extract(input);

      expect(result.clarificationQuestions).toHaveLength(1);
      expect(result.clarificationQuestions[0].id).toBe('Q-001');
      expect(result.clarificationQuestions[0].question).toBe(
        'User authentication method is not specified'
      );
    });

    it('should calculate overall confidence from requirements', async () => {
      const bridge = createMockBridge({
        output: validLLMResponse(),
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('Text')]);

      const result = await extractor.extract(input);

      // Average of 0.9, 0.85, 0.95 = 0.9
      expect(result.overallConfidence).toBe(0.9);
    });

    it('should pass project context to the prompt', async () => {
      const bridge = createMockBridge({
        output: validLLMResponse(),
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('Build a task app')]);

      await extractor.extract(input, 'Enterprise environment');

      const call = (bridge.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [AgentRequest];
      expect(call[0].input).toContain('Enterprise environment');
      expect(call[0].agentType).toBe('collector');
    });

    it('should set scratchpadDir and projectDir on bridge request', async () => {
      const bridge = createMockBridge({
        output: validLLMResponse(),
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback, '/scratch', '/project');
      const input = parser.combineInputs([parser.parseText('Text')]);

      await extractor.extract(input);

      const call = (bridge.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [AgentRequest];
      expect(call[0].scratchpadDir).toBe('/scratch');
      expect(call[0].projectDir).toBe('/project');
    });
  });

  describe('fallback behavior', () => {
    it('should fall back to keyword extractor when bridge returns failure', async () => {
      const bridge = createMockBridge({
        output: '',
        artifacts: [],
        success: false,
        error: 'API error',
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([
        parser.parseText('The system must support user authentication.'),
      ]);

      const result = await extractor.extract(input);

      // Should still return a valid ExtractionResult from the fallback
      expect(result).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should fall back to keyword extractor when bridge throws', async () => {
      const bridge: AgentBridge = {
        execute: vi.fn().mockRejectedValue(new Error('Network error')),
        supports: vi.fn().mockReturnValue(true),
        dispose: vi.fn().mockResolvedValue(undefined),
      };

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('The system must support login.')]);

      const result = await extractor.extract(input);

      expect(result).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
    });

    it('should fall back when LLM output is not valid JSON', async () => {
      const bridge = createMockBridge({
        output: 'This is not JSON at all',
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([
        parser.parseText('The system must handle user requests.'),
      ]);

      // Should not throw - falls back to keyword extraction
      const result = await extractor.extract(input);

      expect(result).toBeDefined();
    });

    it('should fall back when LLM output fails schema validation', async () => {
      const invalidJson = JSON.stringify({
        projectName: 'Test',
        // Missing projectDescription
        requirements: [{ id: 'R-1', text: 'Req', type: 'invalid_type' }],
      });

      const bridge = createMockBridge({
        output: invalidJson,
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('The system should process data.')]);

      const result = await extractor.extract(input);

      expect(result).toBeDefined();
    });
  });

  describe('JSON extraction from LLM output', () => {
    it('should extract JSON embedded in markdown code fences', async () => {
      const jsonContent = validLLMResponse();
      const wrappedOutput = `Here is the analysis:\n\n\`\`\`json\n${jsonContent}\n\`\`\`\n\nLet me know if you need more details.`;

      const bridge = createMockBridge({
        output: wrappedOutput,
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('Build a task app')]);

      const result = await extractor.extract(input);

      expect(result.projectName).toBe('TaskManager');
      expect(result.functionalRequirements).toHaveLength(1);
    });

    it('should extract JSON with surrounding prose text', async () => {
      const jsonContent = validLLMResponse();
      const wrappedOutput = `Based on my analysis:\n${jsonContent}\nEnd of analysis.`;

      const bridge = createMockBridge({
        output: wrappedOutput,
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('Build a task app')]);

      const result = await extractor.extract(input);

      expect(result.projectName).toBe('TaskManager');
    });
  });

  describe('category mapping', () => {
    it('should map security NFR category correctly', async () => {
      const response = JSON.stringify({
        projectName: 'SecureApp',
        projectDescription: 'A secure application',
        requirements: [
          {
            id: 'REQ-001',
            text: 'All data must be encrypted',
            type: 'non_functional',
            priority: 'P0',
            category: 'security',
            confidence: 0.9,
          },
        ],
      });

      const bridge = createMockBridge({ output: response, artifacts: [], success: true });
      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('Secure app')]);

      const result = await extractor.extract(input);

      expect(result.nonFunctionalRequirements[0].nfrCategory).toBe('security');
    });

    it('should map business constraint type correctly', async () => {
      const response = JSON.stringify({
        projectName: 'BudgetApp',
        projectDescription: 'Budget constrained app',
        requirements: [
          {
            id: 'REQ-001',
            text: 'Budget limited to $50k',
            type: 'constraint',
            priority: 'P1',
            category: 'budget',
            confidence: 0.8,
          },
        ],
      });

      const bridge = createMockBridge({ output: response, artifacts: [], success: true });
      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('Budget app')]);

      const result = await extractor.extract(input);

      expect(result.constraints[0].type).toBe('business');
    });

    it('should default to performance for unknown NFR category', async () => {
      const response = JSON.stringify({
        projectName: 'App',
        projectDescription: 'An app',
        requirements: [
          {
            id: 'REQ-001',
            text: 'Must be amazing',
            type: 'non_functional',
            priority: 'P2',
            category: 'unknown_category',
            confidence: 0.7,
          },
        ],
      });

      const bridge = createMockBridge({ output: response, artifacts: [], success: true });
      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('App')]);

      const result = await extractor.extract(input);

      expect(result.nonFunctionalRequirements[0].nfrCategory).toBe('performance');
    });

    it('should default to technical for unknown constraint type', async () => {
      const response = JSON.stringify({
        projectName: 'App',
        projectDescription: 'An app',
        requirements: [
          {
            id: 'REQ-001',
            text: 'Some constraint',
            type: 'constraint',
            priority: 'P2',
            category: 'something_unknown',
            confidence: 0.7,
          },
        ],
      });

      const bridge = createMockBridge({ output: response, artifacts: [], success: true });
      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('App')]);

      const result = await extractor.extract(input);

      expect(result.constraints[0].type).toBe('technical');
    });
  });

  describe('edge cases', () => {
    it('should handle empty requirements array', async () => {
      const response = JSON.stringify({
        projectName: 'EmptyApp',
        projectDescription: 'No requirements yet',
        requirements: [],
      });

      const bridge = createMockBridge({ output: response, artifacts: [], success: true });
      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('Empty')]);

      const result = await extractor.extract(input);

      expect(result.functionalRequirements).toHaveLength(0);
      expect(result.nonFunctionalRequirements).toHaveLength(0);
      expect(result.constraints).toHaveLength(0);
      expect(result.overallConfidence).toBe(0.5);
      expect(result.warnings).toContain(
        'No functional requirements detected - consider providing more specific feature descriptions'
      );
    });

    it('should truncate long requirement titles to 60 characters', async () => {
      const longText =
        'This is a very long requirement description that exceeds sixty characters and should be truncated';
      const response = JSON.stringify({
        projectName: 'App',
        projectDescription: 'Desc',
        requirements: [
          {
            id: 'REQ-001',
            text: longText,
            type: 'functional',
            priority: 'P2',
            category: 'general',
            confidence: 0.8,
          },
        ],
      });

      const bridge = createMockBridge({ output: response, artifacts: [], success: true });
      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('App')]);

      const result = await extractor.extract(input);

      expect(result.functionalRequirements[0].title.length).toBeLessThanOrEqual(60);
      expect(result.functionalRequirements[0].title.endsWith('...')).toBe(true);
      // Full text preserved in description
      expect(result.functionalRequirements[0].description).toBe(longText);
    });

    it('should return empty assumptions and dependencies arrays', async () => {
      const bridge = createMockBridge({
        output: validLLMResponse(),
        artifacts: [],
        success: true,
      });

      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('App')]);

      const result = await extractor.extract(input);

      expect(result.assumptions).toHaveLength(0);
      expect(result.dependencies).toHaveLength(0);
    });

    it('should handle response without ambiguities field', async () => {
      const response = JSON.stringify({
        projectName: 'ClearApp',
        projectDescription: 'Very clear requirements',
        requirements: [
          {
            id: 'REQ-001',
            text: 'Must support login',
            type: 'functional',
            priority: 'P0',
            category: 'auth',
            confidence: 0.95,
          },
        ],
      });

      const bridge = createMockBridge({ output: response, artifacts: [], success: true });
      const extractor = new LLMExtractor(bridge, fallback);
      const input = parser.combineInputs([parser.parseText('Clear app')]);

      const result = await extractor.extract(input);

      expect(result.clarificationQuestions).toHaveLength(0);
    });
  });
});
