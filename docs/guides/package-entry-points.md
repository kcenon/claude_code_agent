# Package entry points

> **Status**: Current

`ad-sdlc` declares its supported import paths in the `package.json` `exports`
map. The root entry keeps the full library surface; `ad-sdlc/core` is the
same surface without the optional subsystems; the other subpaths expose the
optional capabilities that
[ADR-0006](../adr/ADR-0006-keep-or-kill-orphaned-public-subsystems.md)
accepted for extraction, so a consumer can import one capability without the
root barrel.

## Supported entry points

| Import path             | Module                     | Contents                                                       | ADR-0006 disposition             |
| ----------------------- | -------------------------- | -------------------------------------------------------------- | -------------------------------- |
| `ad-sdlc`               | `dist/index.js`            | Full surface: control plane, data plane, agents, utilities     | compatibility root               |
| `ad-sdlc/core`          | `dist/core.js`             | The root surface without the optional subsystems below         | core                             |
| `ad-sdlc/control-plane` | `dist/control-plane/index` | `ControlPlane` facade, orchestration, and state management     | `extract-optional` (facade)      |
| `ad-sdlc/data-plane`    | `dist/data-plane/index`    | `DataPlane` facade, scratchpad storage, schemas, serialization | `extract-optional` (facade)      |
| `ad-sdlc/controller`    | `dist/controller/index`    | Dependency graph, prioritization, worker pool, progress        | `keep-wire` / `extract-optional` |
| `ad-sdlc/monitoring`    | `dist/monitoring/index`    | Metrics, logging, budgets, and OpenTelemetry tracing           | `extract-optional`               |
| `ad-sdlc/package.json`  | `package.json`             | Package metadata                                               | —                                |

Every entry resolves both code (`default`) and declarations (`types`). The
subpaths are additive: every name they export is also exported by the root,
so existing root imports keep working.

The subpaths need an `exports`-aware resolver: Node.js ESM (and `require` of
ESM on Node.js 22), or TypeScript with `moduleResolution` `node16`, `nodenext`,
or `bundler`. `main` and `types` still point at the root entry for resolvers
that ignore `exports`.

`ad-sdlc/monitoring` declares types from the optional `@opentelemetry/*` peer
dependencies, but loads without them; install the peers to enable tracing.

## Core, optional, and compatibility-only

| Subsystem                                                                       | Kind                                  | Import from                                                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Pipeline runtime: orchestrator, agents, configuration, state, scratchpad        | core                                  | `ad-sdlc/core` (the CLI uses the same modules)                                                                 |
| Scratchpad SQLite and Redis backends                                            | core, with optional peer dependencies | `Scratchpad` with `backend: 'sqlite'` or `'redis'`; needs `better-sqlite3` or `ioredis`                        |
| Monitoring: metrics, budgets, OpenTelemetry tracing                             | optional                              | `ad-sdlc/monitoring`; the root `Monitoring` namespace                                                          |
| Controller: dependency graph, prioritization, worker pool, progress             | optional                              | `ad-sdlc/controller`; the root `Controller` namespace and the controller re-exports of `ad-sdlc/control-plane` |
| `ControlPlane` and `DataPlane` facades (and the facade's serialization helpers) | optional                              | `ad-sdlc/control-plane`, `ad-sdlc/data-plane`                                                                  |
| `ad-sdlc` root                                                                  | compatibility-only                    | Existing imports; it loads every subsystem above                                                               |

`ad-sdlc/core` and the CLI load no module of an optional subsystem; the root
loads all of them so existing imports keep working. Worker code depends on
controller types only at compile time, so it does not load the controller at
runtime. The SQLite and Redis backend modules import their peer dependency
only when the backend is selected; without it, the first scratchpad operation
reports `better-sqlite3 is required ... Install: npm install better-sqlite3`
(or the `ioredis` equivalent, which the Redis connection fallback does not
mask).

New code should import from `ad-sdlc/core` and add an optional entry point
only for the capability it uses.

## Deep imports

Before the `exports` map existed, any file in the published package could be
imported by its path, for example
`ad-sdlc/dist/project-initializer/AgentAssets.js`. The map keeps that working
with a compatibility alias (`"./*": "./*"`), so **no previously reachable path
changes behavior**. Deep paths are not a supported contract: what a file under
`dist/` exports can change in any release. Import from a supported entry
point instead.

Removing the alias, or any name from a supported entry point, is a breaking
change. It needs a SemVer-major release (a minor release while the version is
below 1.0.0), a `Breaking` CHANGELOG entry, and a migration note that lists
each affected path or name and its replacement.

## API surface baseline

`tests/package/api-surface.json` records, for every supported entry point, the
names it exports, split into runtime values and type-only names. It is
checked in two places:

- `tests/package/api-surface.test.ts` compares the baseline with the source
  (TypeScript compiler API) and checks that the `exports` map lists exactly the
  supported entries.
- The package smoke test (`npm run test:package`) installs the packed tarball
  in an external project without optional dependencies, imports every entry
  point (and a deep path through the alias), compares the runtime exports with
  the baseline, and compiles an import of every recorded name with TypeScript
  `NodeNext`. A module resolve hook then records what the installed package
  loads: `ad-sdlc/core` and the CLI load no optional module while the root
  does, the SQLite backend without `better-sqlite3` reports the install
  command, and `ad-sdlc/monitoring` loads `@opentelemetry/api` once it is
  installed.

A change to a supported surface must update the baseline in the same pull
request:

```sh
npm run api:surface               # compare the source with the baseline
npm run api:surface -- --write    # record the reviewed surface
```

Added names are compatible. Removed names are breaking; see the policy above.
