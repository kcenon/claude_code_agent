import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveProjectAgent, SdkExecutionAdapter } from '../../src/execution/index.js';
import { agentMarkdown, installAgent } from './fixtures/sdk.js';

let projectDir: string;
beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'resolve-agent-'));
});
afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe('real project agent resolver', () => {
  it('preserves supported SDK metadata and customized CRLF prompts without consulting the registry', async () => {
    const metadata = `skills: [custom-skill]
disallowedTools: [Bash]
maxTurns: 8
permissionMode: acceptEdits
memory: project
effort: high
background: false
initialPrompt: Read the project guide.
criticalSystemReminder_EXPERIMENTAL: Respect project conventions.
observer: custom-observer
observerMessage: Review changes.
mcpServers:
  - project-docs
  - command:
      command: node
      args: [server.js]
      env: {MODE: offline}
      timeout: 5000
      alwaysLoad: true
  - remote:
      type: http
      url: https://example.invalid/mcp
      headers: {X-Test: offline}
      tools: [{name: lookup, permission_policy: always_ask, org_max_permission: ask}]
`;
    await installAgent(
      projectDir,
      'worker',
      agentMarkdown()
        .replace('model: sonnet\n', `model: sonnet\n${metadata}`)
        .replace(/\n/g, '\r\n')
    );
    const definition = await resolveProjectAgent(projectDir, 'worker');
    expect(definition).toMatchObject({
      prompt: 'Project-specific worker prompt.\n',
      description: 'Customized worker for this project',
      tools: ['Read', 'Write'],
      model: 'sonnet',
      skills: ['custom-skill'],
      disallowedTools: ['Bash'],
      maxTurns: 8,
      permissionMode: 'acceptEdits',
      memory: 'project',
      effort: 'high',
      background: false,
      initialPrompt: 'Read the project guide.',
      criticalSystemReminder_EXPERIMENTAL: 'Respect project conventions.',
      observer: 'custom-observer',
      observerMessage: 'Review changes.',
      mcpServers: [
        'project-docs',
        {
          command: {
            command: 'node',
            args: ['server.js'],
            env: { MODE: 'offline' },
            timeout: 5000,
            alwaysLoad: true,
          },
        },
        {
          remote: {
            type: 'http',
            url: 'https://example.invalid/mcp',
            headers: { 'X-Test': 'offline' },
            tools: [{ name: 'lookup', permission_policy: 'always_ask', org_max_permission: 'ask' }],
          },
        },
      ],
    });
    expect(definition).not.toHaveProperty('name');
  });

  it.each(['description', 'tools', 'model'] as const)(
    'rejects missing required %s metadata',
    async (field) => {
      const content = agentMarkdown()
        .split('\n')
        .filter((line) => !line.startsWith(`${field}:`))
        .join('\n');
      const path = await installAgent(projectDir, 'worker', content);
      const loader = vi.fn();
      const result = await new SdkExecutionAdapter({ loader }).execute({
        projectDir,
        agentType: 'worker',
        workOrder: '',
        priorOutputs: {},
      });
      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain(path);
      expect(result.error?.message).toContain(field);
      expect(loader).not.toHaveBeenCalled();
    }
  );

  it('rereads user edits on subsequent executions', async () => {
    const path = await installAgent(projectDir);
    expect((await resolveProjectAgent(projectDir, 'worker')).prompt).toContain('Project-specific');
    await writeFile(path, agentMarkdown('worker', 'New customization', ['Grep'], 'haiku'));
    expect(await resolveProjectAgent(projectDir, 'worker')).toMatchObject({
      prompt: 'New customization\n',
      tools: ['Grep'],
      model: 'haiku',
    });
  });

  it.each([
    '../worker',
    '/worker',
    'worker/other',
    'worker\\other',
    'Worker',
    '',
    'worker.md',
    'worker\0',
  ])('rejects unsafe agent name %j before query', async (agentType) => {
    const loader = vi.fn();
    const result = await new SdkExecutionAdapter({ loader }).execute({
      projectDir,
      agentType,
      workOrder: '',
      priorOutputs: {},
    });
    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('Invalid agentType');
    expect(loader).not.toHaveBeenCalled();
  });

  it('rejects non-absolute, nonexistent, and non-directory project roots before query', async () => {
    const file = join(projectDir, 'file');
    await writeFile(file, 'not a directory');
    const loader = vi.fn();
    const adapter = new SdkExecutionAdapter({ loader });
    for (const invalid of [
      '',
      '.',
      'relative/project',
      '/bad\0path',
      join(projectDir, 'missing'),
      file,
    ]) {
      const result = await adapter.execute({
        projectDir: invalid,
        agentType: 'worker',
        workOrder: '',
        priorOutputs: {},
      });
      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('worker');
      expect(result.error?.message).toMatch(/absolute directory|ENOENT|not a directory/);
    }
    expect(loader).not.toHaveBeenCalled();
  });

  it('removes abort listeners when definition validation fails', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const result = await new SdkExecutionAdapter().execute({
      projectDir,
      agentType: 'missing',
      workOrder: '',
      priorOutputs: {},
      signal: controller.signal,
    });
    expect(result.status).toBe('failed');
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
