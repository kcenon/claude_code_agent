/** Real delivery boundary. No Vitest/API-key skip, source CLI, npm link or checkout dependency fallback. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const temp = realpathSync(mkdtempSync(join(tmpdir(), 'ad-sdlc package smoke ')));
const caller = join(temp, 'unrelated caller');
const consumer = join(temp, 'external consumer');
const configHome = join(temp, 'fresh claude home');
for (const dir of [caller, consumer, configHome]) mkdirSync(dir);
// Construct child-only environment: no inherited API keys, NODE_PATH, NODE_OPTIONS,
// Claude session markers, plugin settings or checkout node_modules/.bin in PATH.
const env = {
  PATH: [dirname(process.execPath), '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(delimiter),
  HOME: join(temp, 'child home'),
  CLAUDE_CONFIG_DIR: configHome,
  XDG_CONFIG_HOME: join(temp, 'xdg'),
  NO_COLOR: '1',
  npm_config_cache: join(temp, 'npm cache'),
};
mkdirSync(env.HOME);
function run(executable, args, cwd, expected = 0) {
  const result = spawnSync(executable, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(
    result.status,
    expected,
    `${executable} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`
  );
  return result.stdout + result.stderr;
}
function pack(root, destination, ignoreScripts = false) {
  mkdirSync(destination, { recursive: true });
  run(
    'npm',
    ['pack', '--pack-destination', destination, ...(ignoreScripts ? ['--ignore-scripts'] : [])],
    root
  );
  const tarballs = readdirSync(destination).filter((file) => file.endsWith('.tgz'));
  assert.equal(tarballs.length, 1);
  return join(destination, tarballs[0]);
}
function install(tarball, dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'offline-asset-consumer',
      version: '1.0.0',
      private: true,
      type: 'module',
    })
  );
  run(
    'npm',
    [
      'install',
      '--omit=dev',
      '--omit=optional',
      '--no-audit',
      '--no-fund',
      tarball,
    ],
    dir
  );
  return join(dir, 'node_modules', '.bin', 'ad-sdlc');
}
function moduleUrl(pkg, relative) {
  return pathToFileURL(join(pkg, relative)).href;
}
try {
  process.stdout.write('PACKAGE SMOKE: build via prepack, create and inspect real tarball\n');
  const tarball = pack(repo, join(temp, 'pack'));
  const tarEntries = run('tar', ['-tzf', tarball], caller).trim().split('\n');
  const sourceAssets = ['agents', 'commands']
    .flatMap((kind) =>
      readdirSync(join(repo, '.claude', kind))
        .filter((file) => file.endsWith('.md'))
        .map((file) => `.claude/${kind}/${file}`)
    )
    .sort();
  assert.deepEqual(
    tarEntries
      .filter((p) => p.startsWith('package/.claude/'))
      .map((p) => p.slice('package/'.length))
      .sort(),
    sourceAssets
  );
  assert(tarEntries.includes('package/agent-assets.manifest.json'));
  assert(tarEntries.includes('package/dist/project-initializer/AgentAssets.js'));
  process.stdout.write(
    `PACKAGE SMOKE: ${sourceAssets.length} canonical assets in tarball; production-only install\n`
  );
  const bin = install(tarball, consumer);
  const pkg = join(consumer, 'node_modules/ad-sdlc');
  assert(
    !existsSync(join(consumer, 'node_modules/tsx')),
    'Consumer must not need TypeScript development tools'
  );
  const manifest = JSON.parse(readFileSync(join(pkg, 'agent-assets.manifest.json'), 'utf8'));
  assert.deepEqual(
    manifest.assets.map((a) => a.path),
    sourceAssets
  );
  for (const template of ['minimal', 'standard', 'enterprise']) {
    const project = join(temp, `${template} target with spaces`);
    run(bin, ['init', project, '--quick', '--skip-validation', '--template', template], caller);
    run(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      import { readFileSync, readdirSync } from 'node:fs';
      import { join } from 'node:path';
      import { loadAssetBundle, byteDigest, assetReferences } from ${JSON.stringify(moduleUrl(pkg, 'dist/project-initializer/AgentAssets.js'))};
      import { validateAllAgents } from ${JSON.stringify(moduleUrl(pkg, 'dist/agent-validator/validator.js'))};
      import { validateAllConfigs, loadAgentsConfig } from ${JSON.stringify(moduleUrl(pkg, 'dist/config/index.js'))};
      import { GREENFIELD_STAGES, ENHANCEMENT_STAGES, IMPORT_STAGES, LOCAL_AGENT_SUBSTITUTIONS } from ${JSON.stringify(moduleUrl(pkg, 'dist/ad-sdlc-orchestrator/types.js'))};
      const project = ${JSON.stringify(project)};
      const bundle = loadAssetBundle();
      assert.equal(bundle.packageRoot, ${JSON.stringify(pkg + '/')});
      assert((await validateAllConfigs(project)).valid);
      const report = validateAllAgents({ agentsDir: join(project, '.claude/agents'), registryPath: join(project, '.ad-sdlc/config/agents.yaml'), checkRegistry: true });
      assert(report.totalFiles > 0); assert.equal(report.invalidCount, 0);
      assert.equal(report.totalFiles, bundle.assets.filter((a) => a.kind === 'agent').length);
      const registry = await loadAgentsConfig({ baseDir: project, environment: false });
      assert.deepEqual(Object.keys(registry.agents).sort(), bundle.assets.filter((a) => a.kind === 'agent').map((a) => a.frontmatter.name).sort());
      const lock = JSON.parse(readFileSync(join(project, '.ad-sdlc/asset-lock.json'), 'utf8'));
      const ids = new Set(bundle.assets.map((a) => a.id));
      for (const asset of bundle.assets) {
        const bytes = readFileSync(join(project, asset.path));
        assert(bytes.equals(asset.bytes), asset.path);
        assert.equal(lock.files[asset.path].byteDigest, byteDigest(bytes));
        for (const dependency of assetReferences(bytes.toString('utf8'), asset.kind)) assert(ids.has(dependency), dependency);
        for (const dependency of asset.requires) assert(ids.has(dependency), dependency);
      }
      for (const stage of [...GREENFIELD_STAGES, ...ENHANCEMENT_STAGES, ...IMPORT_STAGES]) assert(ids.has('agent:' + stage.agentType));
      for (const local of Object.values(LOCAL_AGENT_SUBSTITUTIONS)) assert(ids.has('agent:' + local));
      for (const kind of ['agent', 'command']) assert.equal(readdirSync(join(project, '.claude', kind + 's')).length, bundle.assets.filter((a) => a.kind === kind).length);
    `,
      ],
      caller
    );
    // Offline run verifies flags/config only; no SDK or paid persona execution.
    run(
      bin,
      [
        'run',
        'Offline contract check $(never execute)',
        '--project-dir',
        project,
        '--mode',
        'greenfield',
        '--dry-run',
        '--local',
        '--stop-after',
        'collect',
        '--approval-mode',
        'auto',
      ],
      caller
    );
    run(
      bin,
      [
        'run',
        'Original requirements',
        '--resume',
        'offline-session',
        '--project-dir',
        project,
        '--mode',
        'greenfield',
        '--dry-run',
      ],
      caller
    );
    run(bin, ['assets', 'update', '--project-dir', project, '--dry-run'], caller);
    process.stdout.write(
      `PACKAGE SMOKE: ${template} initialized and verified using installed package\n`
    );
  }
  const explicitRoot = join(temp, 'explicit dot init');
  mkdirSync(explicitRoot);
  run(
    bin,
    ['init', '.', '--quick', '--skip-validation', '--tech-stack', 'typescript'],
    explicitRoot
  );
  assert(!existsSync(join(explicitRoot, 'my-project')));
  run(bin, ['status', '--format', 'json'], explicitRoot);
  const audit = join(temp, 'offline audit fixture');
  cpSync(join(repo, 'tests/doc-audit/fixtures/valid-project'), audit, { recursive: true });
  run(bin, ['audit-docs', '--project-dir', audit], caller);
  assert(JSON.parse(readFileSync(join(audit, '.ad-sdlc/audit/audit-report.json'), 'utf8')).pass);
  assert(existsSync(join(audit, '.ad-sdlc/audit/audit-report.md')));
  for (const [command, requiredFlags] of Object.entries({
    init: ['--quick', '--tech-stack'],
    run: [
      '--project-dir',
      '--resume',
      '--mode',
      '--stop-after',
      '--local',
      '--approval-mode',
      '--dry-run',
    ],
    status: ['--project', '--format', '--verbose'],
    'audit-docs': ['--project-dir', '--output'],
  })) {
    const help = run(bin, [command, '--help'], caller);
    for (const flag of requiredFlags) assert(help.includes(flag), `${command} ${flag}`);
  }
  assert(!run(bin, ['--help'], caller).includes('resume '), 'Resume is a run flag');
  process.stdout.write('PACKAGE SMOKE: packaged audit and command CLI contracts passed\n');

  // Inspect the shipped instructions, not just an independent list of expected flags.
  const helpFor = (name) => run(bin, [name, '--help'], caller);
  const contracts = {
    'run-greenfield': helpFor('init') + helpFor('run'),
    resume: helpFor('run'),
    status: helpFor('status'),
    'audit-docs': helpFor('audit-docs'),
  };
  for (const [name, help] of Object.entries(contracts)) {
    const content = readFileSync(join(pkg, '.claude/commands', name + '.md'), 'utf8');
    const hint = content.match(/^argument-hint: (.*)$/m)?.[1] ?? '';
    const argumentArrays = [...content.matchAll(/```javascript([\s\S]*?)```/g)]
      .map((m) => m[1])
      .join('\n');
    for (const match of (hint + argumentArrays).matchAll(/--[a-z-]+/g))
      assert(help.includes(match[0]), `${name}: unsupported documented flag ${match[0]}`);
    assert(!content.includes('npm run audit:docs'));
    assert(!/ad-sdlc resume\b/.test(content));
  }
  const greenfield = readFileSync(join(pkg, '.claude/commands/run-greenfield.md'), 'utf8');
  assert(greenfield.includes('ad-sdlc init . --quick'));
  assert(greenfield.includes('shell: false'));
  const resume = readFileSync(join(pkg, '.claude/commands/resume.md'), 'utf8');
  assert(
    resume.includes("'run', requirements, '--resume', sessionId, '--project-dir', projectRoot")
  );
  const brokenAudit = join(temp, 'broken offline audit');
  cpSync(join(repo, 'tests/doc-audit/fixtures/broken-project'), brokenAudit, { recursive: true });
  run(bin, ['audit-docs', '--project-dir', brokenAudit], caller, 1);
  assert.equal(
    JSON.parse(readFileSync(join(brokenAudit, '.ad-sdlc/audit/audit-report.json'), 'utf8')).pass,
    false
  );
  run(bin, ['audit-docs'], caller, 1);

  const brokenRoot = join(temp, 'incomplete package');
  mkdirSync(brokenRoot);
  run('tar', ['-xzf', tarball, '-C', brokenRoot], caller);
  const missing = manifest.assets.find((a) => a.id === 'agent:worker').path;
  unlinkSync(join(brokenRoot, 'package', missing));
  const brokenTarball = pack(join(brokenRoot, 'package'), join(temp, 'broken pack'), true);
  const brokenBin = install(brokenTarball, join(temp, 'broken consumer'));
  const target = join(temp, 'must not be written');
  const failure = run(brokenBin, ['init', target, '--quick', '--skip-validation'], caller, 1);
  assert(failure.includes(missing), failure);
  assert(failure.includes(manifest.bundleVersion), failure);
  assert(
    failure.includes(
      'package ' + JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version
    ),
    failure
  );
  assert(!existsSync(target), 'Incomplete packaged bundle wrote the target scaffold');
  assert.equal(readdirSync(configHome).length, 0, 'Offline verification must not install plugins');
  process.stdout.write(
    'PACKAGE SMOKE PASS: incomplete packaged prompt rejected before target writes; no credentials or live SDK execution\n'
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
