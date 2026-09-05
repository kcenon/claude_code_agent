/** Tests the manual missing-field repair documented in the quickstart. */

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearConfigCache,
  ConfigValidationError,
  loadAgentsConfig,
} from '../../src/config/index.js';

describe('documented agents.yaml repair', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'agents-repair-'));
    mkdirSync(join(projectDir, '.ad-sdlc', 'config'), { recursive: true });
  });

  afterEach(() => {
    clearConfigCache();
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('adds only missing fields while preserving custom values, agents, extensions, and comments', async () => {
    const quickstart = readFileSync(new URL('../../docs/quickstart.md', import.meta.url), 'utf-8');
    const repairSection = quickstart
      .split('### Existing agents.yaml Fails Validation for Missing id or name')[1]
      ?.split('\n### ')[0];
    const examples = [...(repairSection ?? '').matchAll(/```yaml\r?\n([\s\S]*?)```/g)];
    expect(examples).toHaveLength(2);
    const before = examples[0]?.[1];
    const after = examples[1]?.[1];
    if (before === undefined || after === undefined) {
      throw new Error('Quickstart must include before and after YAML repair examples');
    }
    // Include an existing custom agent with its own ID and name, plus extension
    // fields and comments beyond the example. None should change during repair.
    const customizations = `  team-helper:
    id: existing-team-id
    name: Our Team Helper
    description: Keep our custom agent
    model: haiku # Keep the cost preference
    definition: prompts/team-helper.md
    x-policy:
      review: manual
# Keep this registry extension too
x-owner: platform-team
`;
    const original = before + customizations;
    const agentsPath = join(projectDir, '.ad-sdlc', 'config', 'agents.yaml');
    const backupPath = `${agentsPath}.bak`;
    writeFileSync(agentsPath, original);
    copyFileSync(agentsPath, backupPath);
    const options = { baseDir: projectDir, environment: false } as const;
    await expect(loadAgentsConfig(options)).rejects.toBeInstanceOf(ConfigValidationError);

    // Simulate manual insertion without parsing and reserializing the YAML.
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    const addedFields = `    id: collector${newline}    name: Collector Agent${newline}`;
    const repaired = original.replace(
      `  collector:${newline}`,
      `  collector:${newline}${addedFields}`
    );
    expect(repaired).toBe(after + customizations);
    expect(repaired.replace(addedFields, '')).toBe(original);
    writeFileSync(agentsPath, repaired);
    clearConfigCache();

    const loaded = await loadAgentsConfig(options);
    expect(loaded.agents.collector).toMatchObject({
      id: 'collector',
      name: 'Collector Agent',
      description: "Collects our team's requirements",
      model: 'opus',
      definition: '.claude/agents/our-collector.md',
      'x-team': 'platform',
    });
    expect(loaded.agents['team-helper']).toEqual({
      id: 'existing-team-id',
      name: 'Our Team Helper',
      description: 'Keep our custom agent',
      model: 'haiku',
      definition: 'prompts/team-helper.md',
      'x-policy': { review: 'manual' },
    });
    expect(readFileSync(agentsPath, 'utf-8')).toBe(repaired);
    expect(readFileSync(backupPath)).toEqual(Buffer.from(original));
  });
});
