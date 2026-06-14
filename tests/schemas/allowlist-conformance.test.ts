/**
 * Allowlist conformance tests (issue #871)
 *
 * Asserts that:
 *  1. Every .claude/agents/*.md file validates against the canonical allowlist
 *     with ZERO rejections (round-trip conformance).
 *  2. The JSON schema files (schemas/workflow.schema.json,
 *     schemas/agents.schema.json) carry the same tool/model enums as the
 *     canonical TS allowlist — this is the anti-divergence enforcement that
 *     replaces manual synchronisation.
 *  3. Out-of-allowlist tool/model values are rejected by the validator.
 *
 * The test file is the authoritative enforcement gate.  Any edit that changes
 * a JSON schema enum or the canonical TS allowlist without also updating the
 * other will break these tests and be caught before merge.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

import { CANONICAL_TOOLS, CANONICAL_MODELS } from '../../src/config/allowlist.js';
import { validateAgentFile, validateAllAgents } from '../../src/agent-validator/index.js';

// ============================================================
// Helpers
// ============================================================

const PROJECT_ROOT = path.resolve(new URL('../../', import.meta.url).pathname);
const AGENTS_DIR = path.join(PROJECT_ROOT, '.claude', 'agents');
const WORKFLOW_SCHEMA = path.join(PROJECT_ROOT, 'schemas', 'workflow.schema.json');
const AGENTS_SCHEMA = path.join(PROJECT_ROOT, 'schemas', 'agents.schema.json');

/** Enumerate every .md file in .claude/agents/ (excludes .kr.md) */
function listAgentFiles(): string[] {
  if (!fs.existsSync(AGENTS_DIR)) return [];
  return fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.md') && !f.endsWith('.kr.md'))
    .map((f) => path.join(AGENTS_DIR, f));
}

/** Load a JSON schema from disk */
function loadJsonSchema(schemaPath: string): Record<string, unknown> {
  const raw = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

// ============================================================
// 1. Round-trip conformance — every real agent must validate to zero errors
// ============================================================

describe('Allowlist round-trip conformance', () => {
  const agentFiles = listAgentFiles();

  it('should find at least one agent file to validate', () => {
    expect(agentFiles.length).toBeGreaterThan(0);
  });

  it(`should validate all ${agentFiles.length} agent files with zero errors`, () => {
    const report = validateAllAgents({
      agentsDir: AGENTS_DIR,
      checkRegistry: false,
      includeWarnings: false,
    });

    const failures = report.results.filter((r) => !r.valid);

    if (failures.length > 0) {
      const details = failures
        .map(
          (f) =>
            `  ${path.basename(f.filePath)}:\n${f.errors.map((e) => `    [${e.field}] ${e.message}`).join('\n')}`
        )
        .join('\n');
      expect.fail(
        `${failures.length} of ${report.totalFiles} agent files failed validation:\n${details}`
      );
    }

    expect(report.invalidCount).toBe(0);
    expect(report.totalFiles).toBe(agentFiles.length);
    expect(report.validCount).toBe(agentFiles.length);
  });

  // One test per agent file for granular CI failure reporting
  for (const filePath of agentFiles) {
    const name = path.basename(filePath);
    it(`${name} passes validation`, () => {
      const result = validateAgentFile(filePath, {
        checkRegistry: false,
        includeWarnings: false,
      });
      if (!result.valid) {
        const msgs = result.errors.map((e) => `[${e.field}] ${e.message}`).join('; ');
        expect.fail(`${name} failed: ${msgs}`);
      }
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  }
});

// ============================================================
// 2. JSON schema parity — JSON enum arrays must equal canonical TS lists
// ============================================================

describe('JSON schema parity with canonical allowlist', () => {
  describe('schemas/workflow.schema.json', () => {
    const schema = loadJsonSchema(WORKFLOW_SCHEMA);

    it('agents.*.model enum equals CANONICAL_MODELS', () => {
      // Path: properties.agents.additionalProperties.properties.model.enum
      const agentsSection = (schema as Record<string, unknown>)['properties'] as
        | Record<string, unknown>
        | undefined;
      const agentsAdditional = (agentsSection?.['agents'] as Record<string, unknown> | undefined)?.[
        'additionalProperties'
      ] as Record<string, unknown> | undefined;
      const modelEnum = (
        (agentsAdditional?.['properties'] as Record<string, unknown> | undefined)?.['model'] as
          | Record<string, unknown>
          | undefined
      )?.['enum'] as string[] | undefined;

      expect(modelEnum).toBeDefined();
      expect([...modelEnum!].sort()).toEqual([...CANONICAL_MODELS].sort());
    });

    it('agents.*.tools.items.enum equals CANONICAL_TOOLS', () => {
      const agentsSection = (schema as Record<string, unknown>)['properties'] as
        | Record<string, unknown>
        | undefined;
      const agentsAdditional = (agentsSection?.['agents'] as Record<string, unknown> | undefined)?.[
        'additionalProperties'
      ] as Record<string, unknown> | undefined;
      const toolsItems = (
        (agentsAdditional?.['properties'] as Record<string, unknown> | undefined)?.['tools'] as
          | Record<string, unknown>
          | undefined
      )?.['items'] as Record<string, unknown> | undefined;
      const toolsEnum = toolsItems?.['enum'] as string[] | undefined;

      expect(toolsEnum).toBeDefined();
      expect([...toolsEnum!].sort()).toEqual([...CANONICAL_TOOLS].sort());
    });

    it('token_budgets.default_model enum equals CANONICAL_MODELS', () => {
      const properties = (schema as Record<string, unknown>)['properties'] as
        | Record<string, unknown>
        | undefined;
      const tokenBudgets = properties?.['token_budgets'] as Record<string, unknown> | undefined;
      const defaultModel = (tokenBudgets?.['properties'] as Record<string, unknown> | undefined)?.[
        'default_model'
      ] as Record<string, unknown> | undefined;
      const modelEnum = defaultModel?.['enum'] as string[] | undefined;

      expect(modelEnum).toBeDefined();
      expect([...modelEnum!].sort()).toEqual([...CANONICAL_MODELS].sort());
    });
  });

  describe('schemas/agents.schema.json', () => {
    const schema = loadJsonSchema(AGENTS_SCHEMA);

    it('agents.*.model_preference enum equals CANONICAL_MODELS', () => {
      const properties = (schema as Record<string, unknown>)['properties'] as
        | Record<string, unknown>
        | undefined;
      const agents = properties?.['agents'] as Record<string, unknown> | undefined;
      const additionalProperties = agents?.['additionalProperties'] as
        | Record<string, unknown>
        | undefined;
      const agentProperties = additionalProperties?.['properties'] as
        | Record<string, unknown>
        | undefined;
      const modelPreference = agentProperties?.['model_preference'] as
        | Record<string, unknown>
        | undefined;
      const modelEnum = modelPreference?.['enum'] as string[] | undefined;

      expect(modelEnum).toBeDefined();
      expect([...modelEnum!].sort()).toEqual([...CANONICAL_MODELS].sort());
    });

    it('agents.*.token_budget.model_preference enum equals CANONICAL_MODELS', () => {
      const properties = (schema as Record<string, unknown>)['properties'] as
        | Record<string, unknown>
        | undefined;
      const agents = properties?.['agents'] as Record<string, unknown> | undefined;
      const additionalProperties = agents?.['additionalProperties'] as
        | Record<string, unknown>
        | undefined;
      const agentProperties = additionalProperties?.['properties'] as
        | Record<string, unknown>
        | undefined;
      const tokenBudget = agentProperties?.['token_budget'] as Record<string, unknown> | undefined;
      const tbProperties = tokenBudget?.['properties'] as Record<string, unknown> | undefined;
      const modelPreference = tbProperties?.['model_preference'] as
        | Record<string, unknown>
        | undefined;
      const modelEnum = modelPreference?.['enum'] as string[] | undefined;

      expect(modelEnum).toBeDefined();
      expect([...modelEnum!].sort()).toEqual([...CANONICAL_MODELS].sort());
    });
  });
});

// ============================================================
// 3. Negative tests — out-of-allowlist values are rejected
// ============================================================

describe('Negative: out-of-allowlist values are rejected', () => {
  let tempDir: string;

  // Create a fresh temp dir for each test group
  function setup(): { agentsDir: string } {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-neg-'));
    const agentsDir = path.join(tempDir, '.claude', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    return { agentsDir };
  }

  function teardown() {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }

  it('rejects an agent declaring an unknown tool', () => {
    const { agentsDir } = setup();
    try {
      const content = `---
name: bad-tool-agent
description: Agent with an unknown tool for negative testing
tools:
  - Read
  - UnknownTool
model: inherit
---

# Bad Tool Agent

## Role
Testing only.
`;
      const filePath = path.join(agentsDir, 'bad-tool-agent.md');
      fs.writeFileSync(filePath, content);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes('tools'))).toBe(true);
    } finally {
      teardown();
    }
  });

  it('rejects an agent declaring an unknown model', () => {
    const { agentsDir } = setup();
    try {
      const content = `---
name: bad-model-agent
description: Agent with an unknown model for negative testing
tools:
  - Read
model: gpt-4
---

# Bad Model Agent

## Role
Testing only.
`;
      const filePath = path.join(agentsDir, 'bad-model-agent.md');
      fs.writeFileSync(filePath, content);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'model')).toBe(true);
    } finally {
      teardown();
    }
  });

  it('accepts an agent declaring model: inherit', () => {
    const { agentsDir } = setup();
    try {
      const content = `---
name: inherit-model-agent
description: Agent using the inherit model keyword
tools:
  - Read
  - Write
model: inherit
---

# Inherit Model Agent

## Role
Testing inherit model acceptance.
`;
      const filePath = path.join(agentsDir, 'inherit-model-agent.md');
      fs.writeFileSync(filePath, content);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    } finally {
      teardown();
    }
  });

  it('accepts an agent declaring model: haiku', () => {
    const { agentsDir } = setup();
    try {
      const content = `---
name: haiku-model-agent
description: Agent using the haiku model
tools:
  - Read
  - Bash
  - Glob
model: haiku
---

# Haiku Model Agent

## Role
Testing haiku model acceptance.
`;
      const filePath = path.join(agentsDir, 'haiku-model-agent.md');
      fs.writeFileSync(filePath, content);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    } finally {
      teardown();
    }
  });

  it('accepts an agent declaring the Task tool', () => {
    const { agentsDir } = setup();
    try {
      const content = `---
name: task-tool-agent
description: Agent using the Task tool for orchestration
tools:
  - Read
  - Write
  - Task
  - Bash
model: inherit
---

# Task Tool Agent

## Role
Testing Task tool acceptance.
`;
      const filePath = path.join(agentsDir, 'task-tool-agent.md');
      fs.writeFileSync(filePath, content);

      const result = validateAgentFile(filePath, { checkRegistry: false });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    } finally {
      teardown();
    }
  });
});

// ============================================================
// 4. Canonical allowlist self-checks
// ============================================================

describe('Canonical allowlist self-checks', () => {
  it('CANONICAL_TOOLS contains the minimum expected tools', () => {
    const required = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];
    for (const tool of required) {
      expect(CANONICAL_TOOLS).toContain(tool);
    }
  });

  it('CANONICAL_TOOLS contains Task (used by orchestrator agents)', () => {
    expect(CANONICAL_TOOLS).toContain('Task');
  });

  it('CANONICAL_MODELS contains inherit', () => {
    expect(CANONICAL_MODELS).toContain('inherit');
  });

  it('CANONICAL_MODELS contains sonnet, opus, haiku', () => {
    expect(CANONICAL_MODELS).toContain('sonnet');
    expect(CANONICAL_MODELS).toContain('opus');
    expect(CANONICAL_MODELS).toContain('haiku');
  });

  it('CANONICAL_TOOLS has no duplicates', () => {
    const unique = new Set(CANONICAL_TOOLS);
    expect(unique.size).toBe(CANONICAL_TOOLS.length);
  });

  it('CANONICAL_MODELS has no duplicates', () => {
    const unique = new Set(CANONICAL_MODELS);
    expect(unique.size).toBe(CANONICAL_MODELS.length);
  });
});
