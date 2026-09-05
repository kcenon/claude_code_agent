# Canonical agent and command assets

Every `minimal`, `standard`, and `enterprise` scaffold receives the same versioned
asset bundle: currently 36 agent prompts and four commands (`run-greenfield`,
`resume`, `status`, `audit-docs`). The [runtime inventory](architecture/runtime-inventory.md)
distinguishes the 29 direct agent types from seven support/delegated definitions:
`ad-sdlc-orchestrator`, `analysis-orchestrator`, `ci-fixer`, `local-issue-reader`,
`local-reviewer`, `rtm-builder`, and `stage-verifier`. Template quality gates,
parallel-worker settings, and the existing workflow configuration mapping are
preserved. Available prompts do not establish SDK persona selection or live
pipeline correctness; those execution contracts are separate work (#947/#949).

## Package boundary and validation

`.claude/agents/*.md` and `.claude/commands/*.md` are the sole content sources.
`agent-assets.manifest.json` declares schema version 1, an independent semantic
bundle version, and each asset's stable `agent:<name>` or `command:<name>` ID,
kind, package-relative path, SHA-256 digest, role, and required references.
It also records runtime local substitutions and optional external skills.

`src/project-initializer/AgentAssets.ts` (or its compiled counterpart under
`dist/project-initializer/`) resolves `../../` from its own `import.meta.url`
using Node URL utilities. It reads that package's manifest and files. It does
not search the current directory, target project, Git checkout, or Claude home.
A broken package fails instead of falling back to development files. Source
usage works before `dist/` exists with the same canonical paths.

Before scaffold writes, validation checks nonempty inventory, all manifest
entries, safe paths, file existence, digests, unique IDs/targets, agent
name/filename equality, the shared frontmatter schema and tool/model allowlists,
and command descriptions. Agent and command metadata have separate requirements.
A missing directory never establishes completeness. Required references are
checked against the runtime arrays, shared local-substitution map, explicit
`subagent_type`/line-leading `@agent` invocations, and slash-command references.
Prose-only delegation is declared in canonical frontmatter as `required-assets`;
it is not guessed from every example filename or code path. Source discovery
must match the manifest exactly. Unknown references and missing commands fail.
Errors include asset/field context and bundle/package versions.

Configuration schema validation also remains mandatory before writes (#945).
`--skip-validation` skips prerequisite checks only. Generated registry entries
include `id`, readable `name`, canonical description, model/tools, and
`definition_file`. The matching legacy `definition` field is retained for
existing consumers; the shared registry validator uses `definition_file`.

`package.json.files` explicitly selects the manifest and prompt globs alongside
compiled output. README/LICENSE entries are rooted to avoid pulling unrelated
nested files into the tarball. Settings, caches, credentials, plugin installations,
and unrelated `.claude` files are excluded. `npm run build` checks the bundle;
`npm pack` cleans compiled output and runs that build through `prepack`, so consumers need no build tools.

## Maintaining the bundle

```bash
# After editing canonical content or dependency declarations:
npm run assets:generate -- --bundle-version 1.0.1
npm run assets:check
npm run test:package
```

Generation uses stable ordering, source discovery, and runtime declarations.
`assets:check` is read-only; an added/removed source prompt without a matching
manifest change fails. Do not hand-edit digests or maintain duplicate prompt
copies. Update structured `required-assets` for prose-only delegation when its
source contract changes. Runtime local substitutions belong in
`LOCAL_AGENT_SUBSTITUTIONS`, consumed by both execution and validation.

Bump the **bundle patch** for prompt, command, or dependency corrections; **minor**
for compatible additions; **major** for incompatible asset contracts or removals
that require manual migration. Manifest/lock schema changes require explicit
reader support. Bundle versions are independent of npm and template-configuration
versions. Once distributed, never reuse a bundle version for different content
or metadata. An updater detects a reused version through the manifest digest.
Generating without `--bundle-version` refreshes the current version for an
unreleased edit only; it does not authorize reusing a released version.

The repository requests CRLF in `.gitattributes`. Manifest digests cover UTF-8
content with only CRLF normalized to LF: no trimming, BOM removal, or final-newline
rewriting. The installer copies the actual packaged bytes. Installed ownership
uses a separate SHA-256 over exact bytes, so even newline-only user changes
remain visible to the updater.

## Initialization and customization

```bash
# Initialize this directory explicitly; omitting the name defaults to my-project.
ad-sdlc init . --quick
```

Ordinary init rejects a project with `.ad-sdlc` without modifying it. If `.claude`
already exists without `.ad-sdlc`, init preflights every incoming asset. Identical
files are accepted without rewriting them, unrelated files are preserved, and
differing required files cause failure before any scaffold/lock writes.

Initialization records `.ad-sdlc/asset-lock.json` after successful installation.
Commit this file with the project's agents and commands. It records schema,
bundle/package provenance, manifest digest, and each file's installed version
and exact-byte baseline. It is separate from template configuration versioning.

## Explicit updates and legacy migration

Install the desired npm package version first, then review and apply its assets:

```bash
ad-sdlc assets update --project-dir /path/to/project --dry-run
ad-sdlc assets update --project-dir /path/to/project
```

The asset-only API is `updateAssets({ projectDir, dryRun })`, exported from the
project-initializer module. It preserves workflow and other user configuration.

| Target state | Result |
| --- | --- |
| Missing | Install validated incoming bytes |
| Exactly equals incoming bytes | Keep file; safely record that state |
| Equals recorded installed baseline | Replace with incoming bytes |
| Differs from recorded baseline | Preserve and report a conflict |
| No trustworthy baseline | Preserve as unmanaged unless exactly incoming |

Legacy abbreviated prompts have no implied ownership. To migrate, review the
reported comparison against the installed package file, save your customization
outside `.claude/agents` and `.claude/commands` if needed, manually reconcile or
copy the incoming file, and rerun update. Exactly matching incoming content can
then acquire a baseline. A preserved customization retains its previous baseline
across repeated conflicts. No incoming candidates are written automatically.

For registries, the updater adds missing entries and unambiguous missing
`id`/`name`/canonical path fields using the complete original YAML object, never
a partial schema parse. Existing settings and unknown fields remain. Conflicting
IDs/paths, invalid proposals, or a commented/anchored registry that needs changes
are left unchanged with the required manual additions reported. A complete
commented registry is left byte-identical. Whole-registry baselines are provenance
for the managed merge, not permission to replace customized configuration.

The entire plan is computed and validated before writing. **Any conflict leaves
the entire project unchanged**, including its lock, and exits nonzero. Dry runs
create no directories, files, candidates, or lock updates. Successful updates use
atomic per-file replacement and commit the lock last. An I/O failure may leave
some completed file replacements but never a falsely advanced lock; rerun after
fixing the reported error. Files already equal to incoming are safe to retry.
Do not run concurrent init/update operations on the same project.

Retired/unknown files are preserved, not deleted. Newer bundles are not downgraded;
major-version changes and unsupported lock schemas require manual migration.

## Commands and optional plugins

The four commands use the installed CLI, with concrete project directories and
supported flags. Greenfield explicitly initializes `.` and passes requirements
as one argument; resume uses `run <requirements> --resume <session-id>`.
Requirements must remain data in an argument array, never shell-interpolated
source. Status runs from the project root and uses `--project` for IDs, not paths.
The packaged `ad-sdlc audit-docs --project-dir .` runs the existing offline document
auditor and report writer. See [Document Audit CLI](doc-audit.md) for its scope.
The repository's `scripts/audit-docs.ts` remains a thin compatible wrapper.

No required local asset depends on a global plugin. `claude-config` skills declared
by the runtime remain optional external skills, separately classified in the
manifest. The existing runtime warns when the plugin is unavailable and follows
its existing graceful-degradation behavior; this package does not install plugins
or redesign SDK skill loading.

## Verification boundary

`npm run test:package` is a standalone, unconditional smoke test, separate from
Vitest to avoid build/pack races. CI runs it in the **Package Asset Delivery
(offline)** job with no credential gate. It builds through prepack, inspects the
actual tarball, installs production dependencies in an external consumer, and
launches that consumer's explicit local executable from another directory.
Child processes use fresh Claude/home directories and omit inherited credentials,
module-resolution overrides, and plugin state. Parent environment is unchanged.

It initializes all templates, validates inventory, registry/configuration,
frontmatter, exact content and command references using the installed package,
runs the auditor on an offline fixture, and checks CLI options without executing
SDK agents. A second tarball deliberately lacks a required prompt while retaining
its manifest entry; its installed CLI must fail before target writes. npm dependency
installation may use network access. Scaffold and command checks use no live services.
