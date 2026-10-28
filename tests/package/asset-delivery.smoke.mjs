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
  run('npm', ['install', '--omit=dev', '--omit=optional', '--no-audit', '--no-fund', tarball], dir);
  return join(dir, 'node_modules', '.bin', 'ad-sdlc');
}
function moduleUrl(pkg, relative) {
  return pathToFileURL(join(pkg, relative)).href;
}
/**
 * Supported entry points (#958), resolved through the installed package's
 * exports map by an external ESM and NodeNext TypeScript consumer: every
 * value export recorded in tests/package/api-surface.json exists at runtime,
 * every recorded value and type name compiles, and a formerly reachable deep
 * import still works through the compatibility alias.
 */
function checkEntryPoints() {
  const surfacePath = join(repo, 'tests/package/api-surface.json');
  const surface = JSON.parse(readFileSync(surfacePath, 'utf8'));
  const specifier = (entry) => (entry === '.' ? 'ad-sdlc' : `ad-sdlc/${entry.slice(2)}`);
  const deepImport = 'ad-sdlc/dist/project-initializer/AgentAssets.js';
  writeFileSync(
    join(consumer, 'check-exports.mjs'),
    `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const surface = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const [entry, names] of Object.entries(surface.entries)) {
  const mod = await import(entry === '.' ? 'ad-sdlc' : 'ad-sdlc/' + entry.slice(2));
  assert.deepEqual(Object.keys(mod).sort(), [...names.values].sort(), entry);
}
const deep = await import(${JSON.stringify(deepImport)});
assert.equal(typeof deep.loadAssetBundle, 'function');
`
  );
  run(process.execPath, ['check-exports.mjs', surfacePath], consumer);
  const files = Object.entries(surface.entries).map(([entry, names], index) => {
    const file = `check-types-${String(index)}.mts`;
    writeFileSync(
      join(consumer, file),
      [
        `import { ${names.values.join(', ')} } from '${specifier(entry)}';`,
        names.types.length > 0
          ? `import type { ${names.types.join(', ')} } from '${specifier(entry)}';`
          : '',
        `export const used = [${names.values.join(', ')}];`,
        '',
      ].join('\n')
    );
    return file;
  });
  writeFileSync(
    join(consumer, 'check-deep.mts'),
    `import { loadAssetBundle } from '${deepImport}';\nexport const used = loadAssetBundle;\n`
  );
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
      files: [...files, 'check-deep.mts'],
    })
  );
  run(
    process.execPath,
    [join(repo, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'],
    consumer
  );
  process.stdout.write(
    `PACKAGE SMOKE: ${String(Object.keys(surface.entries).length)} supported entry points resolve code and declarations (NodeNext); deep import kept\n`
  );
}
/** Package modules of the optional subsystems (ADR-0006). */
const OPTIONAL_MODULES = [
  /^dist\/monitoring\//,
  /^dist\/controller\//,
  /^dist\/control-plane\/ControlPlane\.js$/,
  /^dist\/data-plane\/DataPlane\.js$/,
];
/**
 * Optional subsystem isolation (#959), observed through a module resolve
 * hook in the installed package: `ad-sdlc/core` and the CLI load no optional
 * module while the compatibility root does; selecting the SQLite backend
 * without its optional dependency reports the install command; and
 * `ad-sdlc/monitoring` loads OpenTelemetry once the peer is installed.
 */
function checkOptionalSubsystems() {
  const log = join(temp, 'resolved modules.log');
  writeFileSync(
    join(consumer, 'load-hooks.mjs'),
    `import { appendFileSync } from 'node:fs';
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  appendFileSync(${JSON.stringify(log)}, result.url + '\\n');
  return result;
}
`
  );
  writeFileSync(
    join(consumer, 'record-loads.mjs'),
    "import { register } from 'node:module';\nregister('./load-hooks.mjs', import.meta.url);\n"
  );
  const packageRoot = pathToFileURL(join(consumer, 'node_modules/ad-sdlc/')).href;
  const loads = (args) => {
    writeFileSync(log, '');
    run(process.execPath, ['--import', './record-loads.mjs', ...args], consumer);
    return readFileSync(log, 'utf8').trim().split('\n');
  };
  const optional = (urls) =>
    urls
      .filter((url) => url.startsWith(packageRoot))
      .map((url) => url.slice(packageRoot.length))
      .filter((path) => OPTIONAL_MODULES.some((pattern) => pattern.test(path)));
  const importing = (specifier) => ['--input-type=module', '-e', `await import('${specifier}')`];

  const core = loads(importing('ad-sdlc/core'));
  assert.deepEqual(optional(core), [], 'ad-sdlc/core loads an optional subsystem');
  const cli = loads([join(consumer, 'node_modules/ad-sdlc/dist/cli.js'), '--version']);
  assert.deepEqual(optional(cli), [], 'the CLI loads an optional subsystem');
  const root = loads(importing('ad-sdlc'));
  assert(
    optional(root).some((path) => path.startsWith('dist/monitoring/')),
    'root loads monitoring'
  );
  assert(
    optional(root).some((path) => path.startsWith('dist/controller/')),
    'root loads controller'
  );
  process.stdout.write(
    `PACKAGE SMOKE: ad-sdlc/core resolves ${String(core.length)} modules and the CLI ${String(cli.length)}, none optional; the root resolves ${String(root.length)} including ${String(optional(root).length)} optional\n`
  );

  const scratchpadDir = join(temp, 'sqlite scratchpad');
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Scratchpad } from 'ad-sdlc/core';
const dir = ${JSON.stringify(scratchpadDir)};
const scratchpad = new Scratchpad({ basePath: dir, backend: 'sqlite', sqlite: { dbPath: join(dir, 'test.db') } });
await assert.rejects(scratchpad.atomicWrite(join(dir, 'x.txt'), 'x'), /better-sqlite3 is required for SQLite scratchpad backend\\. Install: npm install better-sqlite3/);
`,
    ],
    consumer
  );
  process.stdout.write(
    'PACKAGE SMOKE: missing optional SQLite dependency reports the install command\n'
  );

  const peers = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).peerDependencies;
  run(
    'npm',
    [
      'install',
      '--omit=dev',
      '--omit=optional',
      '--no-audit',
      '--no-fund',
      `@opentelemetry/api@${peers['@opentelemetry/api']}`,
    ],
    consumer
  );
  const monitoring = loads(importing('ad-sdlc/monitoring'));
  assert(
    monitoring.some((url) => url.includes('/node_modules/@opentelemetry/api/')),
    'ad-sdlc/monitoring does not load the installed @opentelemetry/api peer'
  );
  process.stdout.write(
    'PACKAGE SMOKE: ad-sdlc/monitoring loads @opentelemetry/api once installed\n'
  );
}
/**
 * Quickstart first-run sequence (#960): the commands of the fenced blocks
 * between the onboarding-smoke markers of docs/quickstart.md run in order
 * against the installed package, in a fresh directory and without
 * credentials. Only `ad-sdlc` commands and `cd` are allowed, so the documented
 * sequence stays executable as written.
 */
function checkOnboarding(bin) {
  const quickstart = readFileSync(join(repo, 'docs/quickstart.md'), 'utf8');
  const section = /<!-- onboarding-smoke:start -->([\s\S]*?)<!-- onboarding-smoke:end -->/u.exec(
    quickstart
  )?.[1];
  assert(section, 'docs/quickstart.md has no onboarding-smoke section');
  const lines = [...section.matchAll(/```bash\r?\n([\s\S]*?)```/gu)]
    .flatMap((block) => block[1].split(/\r?\n/u))
    .map((line) => line.replace(/(^|\s)#.*$/u, '').trim())
    .filter((line) => line !== '');
  let cwd = join(temp, 'onboarding');
  mkdirSync(cwd);
  let output = '';
  for (const line of lines) {
    const words = [...line.matchAll(/"([^"]*)"|(\S+)/gu)].map((match) => match[1] ?? match[2]);
    if (words[0] === 'cd' && words.length === 2) {
      cwd = join(cwd, words[1]);
      continue;
    }
    assert.equal(words[0], 'ad-sdlc', `onboarding line is not an ad-sdlc command: ${line}`);
    output = run(bin, words.slice(1), cwd);
  }
  assert(existsSync(join(cwd, '.ad-sdlc/config/workflow.yaml')), 'onboarding did not initialize');
  assert(output.includes('Pipeline is ready to execute.'), output);
  process.stdout.write(
    `PACKAGE SMOKE: quickstart first-run sequence passed (${String(lines.length)} commands)\n`
  );
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
  checkEntryPoints();
  checkOptionalSubsystems();
  checkOnboarding(bin);
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
      assert((await validateAllConfigs(project, { runtime: true })).valid);
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
    // Resolve the installed CLI's canonical plan without SDK or paid persona execution.
    const plan = JSON.parse(
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
          'collection',
          '--approval-mode',
          'auto',
          '--format',
          'json',
        ],
        caller
      )
    );
    assert.equal(plan.ready, true);
    assert.equal(plan.config.mode, 'greenfield');
    assert.equal(plan.config.localMode, true);
    assert.equal(plan.config.approvalMode, 'auto');
    assert.equal(plan.stopAfterStage, 'collection');
    assert.equal(plan.stages.length, 18);
    assert(
      plan.stages.some((stage) => stage.name === 'collection' && stage.agentType === 'collector')
    );
    assert(!plan.stages.some((stage) => stage.name === 'github_repo_setup'));
    assert.deepEqual(plan.diagnostics, []);

    // Resume validates the saved session even for dry-run; a missing session is an error.
    const missingSession = JSON.parse(
      run(
        bin,
        [
          'run',
          'Original requirements',
          '--resume',
          'offline-session',
          '--project-dir',
          project,
          '--dry-run',
          '--format',
          'json',
        ],
        caller,
        1
      )
    );
    assert.equal(missingSession.ready, false);
    assert.equal(missingSession.diagnostics.length, 1);
    assert.equal(missingSession.diagnostics[0].source, 'CLI');
    assert.equal(missingSession.diagnostics[0].path, '--resume');
    assert.equal(missingSession.diagnostics[0].code, 'invalid');
    assert.match(missingSession.diagnostics[0].reason, /Session not found/);
    assert.match(missingSession.diagnostics[0].action, /saved session ID from status/);
    run(bin, ['assets', 'update', '--project-dir', project, '--dry-run'], caller);
    process.stdout.write(
      `PACKAGE SMOKE: ${template} initialized and verified using installed package\n`
    );
  }
  const explicitRoot = join(temp, 'explicit dot init');
  mkdirSync(explicitRoot);
  run(bin, ['init', '.', '--quick', '--skip-validation'], explicitRoot);
  assert(!existsSync(join(explicitRoot, 'my-project')));
  run(bin, ['status', '--format', 'json'], explicitRoot);
  // The installed CLI reports its own package version and finds the initialized configuration.
  // This credential-free env has no AI bridge: doctor warns and still exits 0.
  const installedVersion = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version;
  assert.equal(run(bin, ['--version'], caller).trim(), installedVersion);
  const doctor = run(bin, ['doctor', '--project-dir', explicitRoot], caller);
  assert(doctor.includes('OK  Config files: workflow.yaml + agents.yaml found'), doctor);
  assert(doctor.includes('WARN  AI Bridge: No ANTHROPIC_API_KEY'), doctor);
  assert(doctor.includes('Environment OK but no AI bridge configured.'), doctor);
  process.stdout.write(
    `PACKAGE SMOKE: installed --version ${installedVersion}; doctor found config, exit 0 without a bridge\n`
  );
  const audit = join(temp, 'offline audit fixture');
  cpSync(join(repo, 'tests/doc-audit/fixtures/valid-project'), audit, { recursive: true });
  run(bin, ['audit-docs', '--project-dir', audit], caller);
  assert(JSON.parse(readFileSync(join(audit, '.ad-sdlc/audit/audit-report.json'), 'utf8')).pass);
  assert(existsSync(join(audit, '.ad-sdlc/audit/audit-report.md')));
  for (const [command, requiredFlags] of Object.entries({
    init: ['--quick', '--template', '--skip-validation'],
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
  const initHelp = run(bin, ['init', '--help'], caller);
  assert(!initHelp.includes('--github-repo'), 'init has no repo option');
  assert(!initHelp.includes('--tech-stack'), 'init has no tech stack option');
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
  assert(!greenfield.includes('--tech-stack'), 'run-greenfield passes no tech stack to init');
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
