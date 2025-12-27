/**
 * Tests for agent definition validator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  validateAgentFile,
  validateAllAgents,
  formatValidationReport,
  AGENT_SCHEMA_VERSION,
} from '../../src/agent-validator/index.js';

describe('Agent Validator', () => {
  let tempDir: string;
  let agentsDir: string;
  let configDir: string;

  beforeEach(() => {
    // Create temp directory structure
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-validator-test-'));
    agentsDir = path.join(tempDir, '.claude', 'agents');
    configDir = path.join(tempDir, '.ad-sdlc', 'config');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('validateAgentFile', () => {
    it('should validate a valid agent definition', () => {
      const validAgent = `---
name: test-agent
description: A test agent for validation purposes
tools:
  - Read
  - Write
model: sonnet
---

# Test Agent

## Role
This is a test agent for validation.

## Primary Responsibilities
- Test validation logic

## Workflow
1. Step 1
2. Step 2

## File Locations
- Input: /test/input
- Output: /test/output
`;

      const filePath = path.join(agentsDir, 'test-agent.md');
      fs.writeFileSync(filePath, validAgent);

      // Create agents.yaml with the test agent
      const agentsYaml = `version: "1.0.0"
agents:
  test-agent:
    id: "test-agent"
    name: "Test Agent"
    definition_file: ".claude/agents/test-agent.md"
`;
      fs.writeFileSync(path.join(configDir, 'agents.yaml'), agentsYaml);

      const result = validateAgentFile(filePath, {
        registryPath: path.join(configDir, 'agents.yaml'),
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.agent).toBeDefined();
      expect(result.agent?.frontmatter.name).toBe('test-agent');
      expect(result.agent?.frontmatter.tools).toContain('Read');
      expect(result.agent?.frontmatter.tools).toContain('Write');
      expect(result.agent?.frontmatter.model).toBe('sonnet');
    });

    it('should reject agent with missing frontmatter', () => {
      const invalidAgent = `# Test Agent

## Role
This agent has no frontmatter.
`;

      const filePath = path.join(agentsDir, 'no-frontmatter.md');
      fs.writeFileSync(filePath, invalidAgent);

      const result = validateAgentFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('frontmatter');
    });

    it('should reject agent with invalid name format', () => {
      const invalidAgent = `---
name: Test Agent
description: Invalid name format with spaces
tools:
  - Read
model: sonnet
---

# Test Agent
`;

      const filePath = path.join(agentsDir, 'invalid-name.md');
      fs.writeFileSync(filePath, invalidAgent);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('should reject agent with invalid tool', () => {
      const invalidAgent = `---
name: invalid-tools
description: Agent with invalid tool
tools:
  - Read
  - InvalidTool
model: sonnet
---

# Invalid Tools Agent
`;

      const filePath = path.join(agentsDir, 'invalid-tools.md');
      fs.writeFileSync(filePath, invalidAgent);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes('tools'))).toBe(true);
    });

    it('should reject agent with invalid model', () => {
      const invalidAgent = `---
name: invalid-model
description: Agent with invalid model
tools:
  - Read
model: gpt-4
---

# Invalid Model Agent
`;

      const filePath = path.join(agentsDir, 'invalid-model.md');
      fs.writeFileSync(filePath, invalidAgent);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'model')).toBe(true);
    });

    it('should reject agent with empty tools array', () => {
      const invalidAgent = `---
name: no-tools
description: Agent with no tools
tools: []
model: sonnet
---

# No Tools Agent
`;

      const filePath = path.join(agentsDir, 'no-tools.md');
      fs.writeFileSync(filePath, invalidAgent);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'tools')).toBe(true);
    });

    it('should reject agent with duplicate tools', () => {
      const invalidAgent = `---
name: duplicate-tools
description: Agent with duplicate tools
tools:
  - Read
  - Read
  - Write
model: sonnet
---

# Duplicate Tools Agent
`;

      const filePath = path.join(agentsDir, 'duplicate-tools.md');
      fs.writeFileSync(filePath, invalidAgent);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
    });

    it('should return error for non-existent file', () => {
      const result = validateAgentFile('/non/existent/path.md');

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('file');
    });

    it('should warn about missing recommended sections', () => {
      const minimalAgent = `---
name: minimal-agent
description: A minimal agent without recommended sections
tools:
  - Read
model: sonnet
---

# Minimal Agent

Some content without proper sections.
`;

      const filePath = path.join(agentsDir, 'minimal-agent.md');
      fs.writeFileSync(filePath, minimalAgent);

      const result = validateAgentFile(filePath, {
        checkRegistry: false,
        includeWarnings: true,
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.message.includes('Role'))).toBe(true);
    });

    it('should check registry consistency', () => {
      const validAgent = `---
name: unregistered-agent
description: Agent not in registry
tools:
  - Read
model: sonnet
---

# Unregistered Agent
`;

      const filePath = path.join(agentsDir, 'unregistered-agent.md');
      fs.writeFileSync(filePath, validAgent);

      // Create empty agents.yaml
      const agentsYaml = `version: "1.0.0"
agents: {}
`;
      fs.writeFileSync(path.join(configDir, 'agents.yaml'), agentsYaml);

      const result = validateAgentFile(filePath, {
        registryPath: path.join(configDir, 'agents.yaml'),
        checkRegistry: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('not registered'))).toBe(true);
    });
  });

  describe('validateAllAgents', () => {
    it('should validate all agent files in directory', () => {
      // Create multiple agent files
      const agent1 = `---
name: agent-one
description: First test agent
tools:
  - Read
model: sonnet
---

# Agent One

## Role
First agent.
`;

      const agent2 = `---
name: agent-two
description: Second test agent
tools:
  - Write
model: opus
---

# Agent Two

## Role
Second agent.
`;

      fs.writeFileSync(path.join(agentsDir, 'agent-one.md'), agent1);
      fs.writeFileSync(path.join(agentsDir, 'agent-two.md'), agent2);

      // Create agents.yaml
      const agentsYaml = `version: "1.0.0"
agents:
  agent-one:
    id: "agent-one"
    definition_file: ".claude/agents/agent-one.md"
  agent-two:
    id: "agent-two"
    definition_file: ".claude/agents/agent-two.md"
`;
      fs.writeFileSync(path.join(configDir, 'agents.yaml'), agentsYaml);

      const report = validateAllAgents({
        agentsDir,
        registryPath: path.join(configDir, 'agents.yaml'),
      });

      expect(report.totalFiles).toBe(2);
      expect(report.validCount).toBe(2);
      expect(report.invalidCount).toBe(0);
    });

    it('should skip .kr.md files', () => {
      const agent = `---
name: korean-agent
description: Agent with Korean translation
tools:
  - Read
model: sonnet
---

# Korean Agent
`;

      fs.writeFileSync(path.join(agentsDir, 'agent.md'), agent);
      fs.writeFileSync(path.join(agentsDir, 'agent.kr.md'), agent);

      const report = validateAllAgents({
        agentsDir,
        checkRegistry: false,
      });

      expect(report.totalFiles).toBe(1);
    });

    it('should return empty report for non-existent directory', () => {
      const report = validateAllAgents({
        agentsDir: '/non/existent/directory',
      });

      expect(report.totalFiles).toBe(0);
      expect(report.validCount).toBe(0);
    });
  });

  describe('formatValidationReport', () => {
    it('should format report with all validation results', () => {
      const report = {
        timestamp: '2024-12-28T00:00:00.000Z',
        totalFiles: 2,
        validCount: 1,
        invalidCount: 1,
        warningCount: 1,
        results: [
          {
            filePath: '/test/valid-agent.md',
            valid: true,
            errors: [],
            warnings: [
              {
                field: 'content',
                message: 'Missing recommended section',
                filePath: '/test/valid-agent.md',
              },
            ],
          },
          {
            filePath: '/test/invalid-agent.md',
            valid: false,
            errors: [
              {
                field: 'name',
                message: 'Invalid name format',
                filePath: '/test/invalid-agent.md',
              },
            ],
            warnings: [],
          },
        ],
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('Agent Definition Validation Report');
      expect(formatted).toContain('Total Files: 2');
      expect(formatted).toContain('Valid: 1');
      expect(formatted).toContain('Invalid: 1');
      expect(formatted).toContain('valid-agent.md');
      expect(formatted).toContain('invalid-agent.md');
      expect(formatted).toContain('ERROR');
      expect(formatted).toContain('WARN');
      expect(formatted).toContain('FAILED');
    });

    it('should show PASSED when all agents are valid', () => {
      const report = {
        timestamp: '2024-12-28T00:00:00.000Z',
        totalFiles: 1,
        validCount: 1,
        invalidCount: 0,
        warningCount: 0,
        results: [
          {
            filePath: '/test/valid-agent.md',
            valid: true,
            errors: [],
            warnings: [],
          },
        ],
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('PASSED');
    });
  });

  describe('AGENT_SCHEMA_VERSION', () => {
    it('should be a valid semver string', () => {
      expect(AGENT_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
