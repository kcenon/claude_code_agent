// Executed by Node in project A, outside Vitest. Only the SDK boundary is injected.
import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { SdkExecutionAdapter, type SdkLike } from '../../../src/execution/SdkExecutionAdapter.js';
import { agentMarkdown, installAgent, sdkResult } from './sdk.js';

const projectA = process.cwd();
const projectB = process.argv[2];
assert.ok(projectB);
const captured: Options[] = [];
let concurrent = false;
let arrivals = 0;
let release: () => void = () => {};
const rendezvous = new Promise<void>((resolve) => {
  release = resolve;
});
const sdk: SdkLike = {
  async *query({ options }) {
    assert.ok(options?.cwd);
    assert.ok(options.agent);
    const definition = options.agents?.[options.agent];
    assert.ok(definition);
    captured.push(options);
    if (concurrent) {
      if (++arrivals === 2) release();
      await rendezvous;
    }
    const artifact = `${concurrent ? 'concurrent' : 'sequential'}-${options.agent}.txt`;
    await writeFile(join(options.cwd, artifact), definition.prompt);
    yield sdkResult({ result: `${artifact}: sentinel` });
  },
};
const adapter = new SdkExecutionAdapter({ loader: async () => sdk });
const request = (projectDir: string, agentType = 'worker') => ({
  projectDir,
  agentType,
  workOrder: 'Write a sentinel',
  priorOutputs: {},
});

// Conflicting definitions and two named stages must select B's actual personas.
await installAgent(
  projectA,
  'worker',
  agentMarkdown('worker', 'A customized worker', ['Read'], 'haiku')
);
await installAgent(
  projectB,
  'worker',
  agentMarkdown('worker', 'B customized worker', ['Write'], 'opus')
);
await installAgent(
  projectB,
  'reviewer',
  agentMarkdown('reviewer', 'B customized reviewer', ['Read', 'Grep'], 'sonnet')
);
for (const [name, prompt, tools, model] of [
  ['worker', 'B customized worker\n', ['Write'], 'opus'],
  ['reviewer', 'B customized reviewer\n', ['Read', 'Grep'], 'sonnet'],
] as const) {
  const result = await adapter.execute(request(projectB, name));
  assert.equal(result.status, 'success', result.error?.message ?? 'Unexpected result');
  const options = captured.at(-1);
  assert.equal(options?.cwd, projectB);
  assert.equal(options.agent, name);
  assert.deepEqual(options.agents, {
    [name]: {
      description: `Customized ${name} for this project`,
      prompt,
      tools: [...tools],
      model,
    },
  });
  assert.deepEqual(options.settingSources, ['user', 'project', 'local']);
  assert.equal(await readFile(join(projectB, `sequential-${name}.txt`), 'utf8'), prompt);
  assert.equal(existsSync(join(projectA, `sequential-${name}.txt`)), false);
}

// A valid same-named definition in A must never rescue a bad definition in B.
const invalidDefinitions = [
  ['missing', undefined, 'ENOENT'],
  ['malformed', '---\nname: [\n---\nPrompt', 'parse'],
  ['empty-file', '', 'frontmatter'],
  ['empty-prompt', agentMarkdown('empty-prompt', ' \n\t'), 'Prompt body'],
  ['mismatch', agentMarkdown('different-name'), 'frontmatter.name'],
  ['bad-tools', agentMarkdown('bad-tools', 'Prompt', ['NotATool']), 'tools'],
  ['bad-model', agentMarkdown('bad-model', 'Prompt', ['Read'], 'invalid-model'), 'model'],
  [
    'bad-description',
    agentMarkdown('bad-description').replace('Customized bad-description for this project', '   '),
    'description',
  ],
] as const;
for (const [name, content, detail] of invalidDefinitions) {
  await installAgent(projectA, name);
  if (content !== undefined) await installAgent(projectB, name, content);
  const before = captured.length;
  const result = await adapter.execute(request(projectB, name));
  assert.equal(result.status, 'failed');
  assert.equal(captured.length, before);
  assert.ok(result.error?.message.includes(name));
  assert.ok(result.error?.message.includes(join(projectB, '.claude', 'agents', `${name}.md`)));
  assert.ok(
    result.error?.message.toLowerCase().includes(detail.toLowerCase()),
    result.error?.message ?? 'Unexpected result'
  );
}
// Reading a directory as a definition fails consistently, including privileged CI.
await installAgent(projectA, 'unreadable');
await mkdir(join(projectB, '.claude', 'agents', 'unreadable.md'));
let before = captured.length;
assert.equal((await adapter.execute(request(projectB, 'unreadable'))).status, 'failed');
assert.equal(captured.length, before);
// Also cover a real read-permission failure where the OS enforces mode bits.
if (process.getuid?.() !== 0 && process.platform !== 'win32') {
  await installAgent(projectA, 'restricted');
  const path = await installAgent(projectB, 'restricted');
  await chmod(path, 0);
  try {
    const result = await adapter.execute(request(projectB, 'restricted'));
    assert.equal(result.status, 'failed');
    assert.ok(result.error?.message.includes(path));
    assert.ok(result.error?.message.includes('EACCES'));
    assert.equal(captured.length, before);
  } finally {
    await chmod(path, 0o600);
  }
}

// Overlapping requests share the adapter while retaining separate definitions/cwds.
concurrent = true;
before = captured.length;
const results = await Promise.all([
  adapter.execute(request(projectA)),
  adapter.execute(request(projectB)),
]);
assert.deepEqual(
  results.map((r) => r.status),
  ['success', 'success']
);
assert.equal(arrivals, 2);
const optionsA = captured.slice(before).find((o) => o.cwd === projectA);
const optionsB = captured.slice(before).find((o) => o.cwd === projectB);
assert.ok(optionsA && optionsB);
assert.notEqual(optionsA, optionsB);
assert.notEqual(optionsA.agents, optionsB.agents);
assert.equal(optionsA.agents?.worker?.prompt, 'A customized worker\n');
assert.equal(optionsB.agents?.worker?.prompt, 'B customized worker\n');
assert.equal(
  await readFile(join(projectA, 'concurrent-worker.txt'), 'utf8'),
  'A customized worker\n'
);
assert.equal(
  await readFile(join(projectB, 'concurrent-worker.txt'), 'utf8'),
  'B customized worker\n'
);
assert.equal(process.cwd(), projectA);
await adapter.dispose();
// Report the same canonical spelling as the parent, including Windows 8.3 aliases.
process.stdout.write(
  JSON.stringify({
    cwd: await realpath(process.cwd()),
    queries: captured.length,
    isolation: 'passed',
  })
);
