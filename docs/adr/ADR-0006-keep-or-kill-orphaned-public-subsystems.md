# ADR-0006: Keep-or-Kill Disposition for Orphaned-but-Public Subsystems

## Status

Accepted

The project owner ratified this decision when the decision PR merged. No source
subsystem code was deleted by that PR; per-disposition execution remains scoped
to dedicated follow-up issues.

## Date

2026-06-20

## Context

The v0.1 cutover (#797, #798, #785) routed all 35 pipeline stages through a
single `ExecutionAdapter` and removed the in-tree `AgentBridge` / `Dispatcher` /
`Registry` stack. That refactor left several subsystems with **no remaining
consumer on the CLI run-loop** — they look like dead code when traced from
`src/cli.ts`.

A run-loop reachability trace alone is, however, the **wrong deletion gate** for
this package. `src/index.ts` re-exports four of these subsystems wholesale via
`export *`, so they are part of the **published library API** compiled into
`dist/index.d.ts`. Verified entry point (`src/index.ts`):

```typescript
export * from './control-plane/index.js'; // line 19
export * from './data-plane/index.js';    // line 24
export * from './agents/index.js';        // line 33
export * from './utilities/index.js';     // line 38
```

Deleting any symbol reachable from these barrels is a **SemVer-breaking change**
for downstream consumers of `ad-sdlc`. The deletion gate must therefore be
**"public-export OR run-loop reachability"**, not run-loop reachability alone.

Compounding this, the published `package.json` declares `"version": "0.0.1"`
while `CHANGELOG.md` already documents a released `[0.1.0] - 2026-05-09` section
covering the cutover (including two `**Breaking**` removals). The package version
and the changelog disagree, so the SemVer baseline that any future deletion
would bump from is itself unresolved. This ADR finalizes that baseline as part of
the same decision.

### Constraints

- This is a **decision**, not an execution. No subsystem source is removed here.
- The package has **no `package.json` `exports` map** (verified absent), so the
  default disposition (extract-to-an-optional-subpath) is not yet mechanically
  possible; adding that map is its own execution step, gated on this decision.
- Recommendations must be **conservative**: pre-1.0 breaking-change tolerance is
  an owner call, and several subsystems back the optional `peerDependencies`
  (`@opentelemetry/*`, `better-sqlite3`, `ioredis`) whose presence is otherwise
  unexplained.

## Decision

Record a per-subsystem keep-or-kill verdict on **two axes** plus a recommended
disposition, the required SemVer impact, and the coupling notes. The default
disposition for any `src/index.ts`-reachable orphan is **extract-to-optional-
subpath** (per epic #866), which requires first adding a `package.json` `exports`
map. `delete` is permitted only with a coordinated SemVer major/minor bump and a
CHANGELOG breaking entry.

**Disposition vocabulary** (from #866):

| Disposition | Meaning |
|---|---|
| `extract-optional` | Move off the default `.` entry to an optional `exports` subpath (e.g. `ad-sdlc/monitoring`); non-breaking *if* done before/with the `exports` map, breaking if it silently disappears from `.`. Default for `src/index.ts`-reachable orphans. |
| `keep-wire` | Keep and actively route through the run-loop; not an orphan once wired. |
| `delete-later` | Eligible for removal, but only via a coordinated SemVer bump + CHANGELOG breaking entry in a dedicated execution issue. |
| `defer` | No keep-or-kill verdict yet; blocked on a separate decision (e.g. V&V enforce-or-demote, #877). |

### Verdict table

Axis-1 = reachable from the CLI run-loop (`src/cli.ts` -> orchestrator -> stages).
Axis-2 = reachable from the published `src/index.ts` surface (i.e. in
`dist/index.d.ts`); evidence is `file:line -> symbol`.

| Subsystem | Axis-1: run-loop | Axis-2: public export (verified evidence) | Disposition | SemVer impact | Coupling notes |
|---|---|---|---|---|---|
| `monitoring/` (10,872 LOC) | No — no production consumer traces from the run-loop | **Public.** `src/utilities/index.ts:319` `export * as Monitoring from '../monitoring/index.js'`, reached via `src/index.ts:38` | **extract-optional** (default) | minor (add `exports` subpath, non-breaking) now; **major/minor breaking** only if later removed from `.` | Sole reason the optional `@opentelemetry/*` peerDeps exist; extracting keeps that justification intact. |
| `controller/` (8,820 LOC) | Partial — `worker/` statically imports its **types** | **Public.** `src/control-plane/index.ts:64,67` value re-exports `PriorityAnalyzer` / `ControllerError`; `src/agents/index.ts:725` `export * as Controller`; both reached via `src/index.ts:19,33` | **keep-wire / extract-optional** (conservative; not `delete`) | non-breaking if kept; **breaking** if removed | `worker/types.ts:11` and `worker/workerEntryPoint.ts:11-13` `import type { WorkOrder, WorkerIPCMessage } from '../controller/types.js'` — deleting `controller/` yields TS2307/TS2305 in `worker/`. Hard internal coupling; do not delete. |
| `ControlPlane` facade (part of 1,672 LOC) | No production consumer | **Public.** `src/control-plane/index.ts:18-24` value exports `ControlPlane`, `getControlPlane`, `ControlPlaneError`; reached via `src/index.ts:19` | **extract-optional** | non-breaking if kept; **breaking** if removed | Zero production consumers but live named exports. Error codes live separately in `errors/codes.ts`, so removing the facade does not orphan them. |
| `DataPlane` facade (part of 1,672 LOC) | No production consumer | **Public.** `src/data-plane/index.ts:21-28` value exports `DataPlane`, `getDataPlane`, `DataValidationError`; reached via `src/index.ts:24` | **extract-optional** | non-breaking if kept; **breaking** if removed | Same as `ControlPlane`: facade-only, no run-loop consumer, but a published named surface. |
| SQLite scratchpad backend | Reachable via config — `BackendFactory.create` `case 'sqlite'` (`src/scratchpad/backends/BackendFactory.ts:64`) | **Public.** `src/scratchpad/index.ts:168` `export { SQLiteBackend }`, `:171` `export { BackendFactory }`; reached via `src/index.ts:24` (data-plane re-exports scratchpad) | **keep-wire** | non-breaking | Selectable backend (#873 routed `Scratchpad` through `BackendFactory`). Backed by optional `better-sqlite3` peerDep. Keep. |
| Redis scratchpad backend | Reachable via config — `BackendFactory.create` `case 'redis'` (`src/scratchpad/backends/BackendFactory.ts:70`) | **Public.** `src/scratchpad/index.ts:169` `export { RedisBackend }`, `:171` `BackendFactory` | **keep-wire** | non-breaking | Same as SQLite. Backed by optional `ioredis` peerDep. Keep. |
| TS V&V stack (`StageVerifierAgent`, `RtmBuilderAgent`, compliance writers) | No — not referenced outside `stage-verifier/` and `rtm-builder/`; gated by V&V/pipeline config, not the CLI default run-loop | **NOT public via `src/index.ts`.** `src/stage-verifier/index.ts:45` and `src/rtm-builder/index.ts` export only within their own barrels; **no plane barrel re-exports them**, so they are absent from `dist/index.d.ts` | **defer** to #877 (V&V enforce-or-demote) | none from this ADR; deletion would be **non-breaking on the published surface** but is a V&V-policy call | Because they are not on the public surface, the SemVer argument does **not** protect them — unlike the four big orphans. Their fate is a V&V enforce-or-demote decision, not a public-API decision. |
| `src/utils` vs `src/utilities` dual-root | Both live | `utilities/` is public via `src/index.ts:38`; `utils/` is internal (imported, not re-exported on the public barrel) | **defer / keep** (consolidation, not keep-or-kill) | non-breaking if internal `utils/` is merged carefully | ~18 internal importers of `utils/index`, ~1 of `utilities/index` (verified counts). This is a naming-consolidation question, better handled with the doc/ADR-tree consolidation in #872 than as a keep-or-kill verdict. Defer. |
| `useSdkForWorker` / `AD_SDLC_USE_SDK_FOR_WORKER` flag | Live in `config/featureFlags.ts:39,53-55`; default `false` | Public (exported from `config`) | **keep** (do not retire yet) | non-breaking | CHANGELOG `[0.1.0]` says all 33 cutover stages route through `ExecutionAdapter` "independent of" this flag (#823-#827, #795). The flag is therefore **inert for the migrated stages** but still a documented config surface; retiring it is a follow-up cleanup, not a keep-or-kill. Keep until a dedicated retire-flag issue. |

### Version / SemVer reconciliation (executed in this PR)

The package version is reconciled now because it sets the baseline every future
disposition bumps from:

- `package.json` `"version"`: **`0.0.1` -> `0.1.0`**, matching the released
  `CHANGELOG.md` `[0.1.0] - 2026-05-09` section. The cutover already shipped two
  `**Breaking**` removals under that section, so the changelog — not the stale
  `0.0.1` — is the correct published baseline.
- `package.json` `"exports"` map: **deferred.** Adding an `exports` map is the
  prerequisite for the `extract-optional` disposition, but it changes module
  resolution semantics (once `exports` is present, only declared subpaths are
  importable). Introducing it without exercising the repo's build/`main`/`types`
  resolution under real tooling risks breaking consumers. Per the "prefer not
  breaking the build" constraint, the `exports` scaffold is **deferred to the
  WS2 extract-to-subpath execution issue**, where it can be added and validated
  together with the first subpath move. This PR keeps the existing
  `main` / `types` resolution untouched.

### What we will NOT do in this PR

- Delete, move, or rename any subsystem source.
- Add a `package.json` `exports` map (deferred, see above).
- Consolidate the two ADR trees (`docs/adr/` and `docs/architecture/decisions/`)
  — that is #872's job; this ADR is added only to the 4-digit `docs/adr/` tree.

## Consequences

### Positive

- The deletion gate is now explicitly "public-export OR run-loop reachability",
  preventing a future contributor from deleting a published surface on a naive
  dead-code trace.
- The `0.0.1` / `0.1.0` disagreement is resolved; future SemVer bumps have a
  correct, changelog-consistent baseline.
- Each surviving disposition has a named follow-up path, unblocking the WS2
  execution issues that #866 gated on this decision.

### Negative

- Several subsystems are retained that have no current run-loop consumer
  (`monitoring/`, the facades), carrying maintenance and build cost until the
  `extract-optional` execution lands.
- The `exports`-map deferral means the `extract-optional` disposition cannot be
  executed until that scaffold is added in a follow-up.

### Neutral

- The V&V stack and the `utils`/`utilities` dual-root are explicitly deferred to
  their natural owning decisions (#877, #872) rather than force-classified here.
- The `useSdkForWorker` flag stays as an inert-but-documented config surface.

## Alternatives Considered

### Alternative 1: Gate deletion on run-loop reachability alone

**Description:** Treat any subsystem with no run-loop consumer as dead code and
delete it.

**Pros:**
- Simple, single-axis rule.
- Largest immediate LOC reduction.

**Cons:**
- Silently breaks the published `ad-sdlc` library API — `monitoring/`,
  `controller/`, and both facades are reachable from `dist/index.d.ts` via
  `src/index.ts` `export *`.
- Removes the only justification for the optional `@opentelemetry/*` /
  `better-sqlite3` / `ioredis` peerDeps.

**Why rejected:** Reachability from the CLI run-loop is not the boundary of the
package's public contract. The re-review (#866) overturned 4 of 6 initial
deletion assumptions precisely on this point.

### Alternative 2: Delete now with a coordinated major bump

**Description:** Accept the breaking change, delete the four big orphans, and bump
SemVer accordingly in one sweep.

**Pros:**
- Removes ~21k LOC of unconsumed surface.
- One coordinated breaking release rather than a staged extraction.

**Cons:**
- Pre-1.0 breaking-change tolerance is the owner's call, not the contributor's.
- A hard delete forecloses the optional-capability path; consumers who *do* want
  monitoring or alternate backends lose them entirely instead of moving to a
  subpath.
- Higher blast radius with no rollback granularity.

**Why rejected:** Too aggressive for a decision-only issue. Extract-to-optional-
subpath preserves the capabilities as opt-in while removing them from the default
surface, which is the conservative default in #866. Deletion remains available as
`delete-later` per subsystem if the owner ratifies it.

### Alternative 3: Keep everything wired, change nothing

**Description:** Declare all subsystems "kept" and close the issue without
dispositions.

**Pros:**
- Zero risk now.

**Cons:**
- Leaves the speculative infrastructure built ahead of its consumers in place
  indefinitely, with no path to either wire or remove it.
- Does not resolve the `0.0.1` / `0.1.0` version disagreement.

**Why rejected:** The version reconciliation is mechanically required and
CI-verifiable, and the WS2 execution issues are blocked until per-subsystem
dispositions exist. Doing nothing keeps the epic stalled.

## References

- Decision issue: #874 (this ADR records its verdict table and version decision)
- Parent epic: #866 (extract-to-optional-subpath default disposition; deletion
  gate = public-export OR run-loop reachability)
- Related issue: #873 (route `Scratchpad` through `BackendFactory` — basis for
  the SQLite/Redis `keep-wire` verdicts)
- Related issue: #872 (doc-vs-code symbol gate + consolidate the two ADR trees —
  the `utils`/`utilities` dual-root and tree consolidation belong here)
- Related issue: #877 (V&V enforce-or-demote — owns the V&V stack disposition)
- Related issue: #876 (collapse duplicated retry / circuit-breaker engines —
  unblocked once dispositions are recorded)
- Related code: `src/index.ts:19,24,33,38` (public `export *` surface)
- Related code: `src/utilities/index.ts:319` (`export * as Monitoring`)
- Related code: `src/control-plane/index.ts:18-24,64,67` (facade + controller
  re-exports); `src/data-plane/index.ts:21-28` (facade re-exports)
- Related code: `src/agents/index.ts:725` (`export * as Controller`)
- Related code: `src/scratchpad/index.ts:168-171`,
  `src/scratchpad/backends/BackendFactory.ts:64,70` (SQLite/Redis backends)
- Related code: `src/worker/types.ts:11`,
  `src/worker/workerEntryPoint.ts:11-13` (`controller/types.js` static coupling)
- Related code: `src/config/featureFlags.ts:39,53-55` (`useSdkForWorker` flag)
- Related ADR: [ADR-0005](ADR-0005-layered-architecture.md) (Control/Data/Agent
  layering this surface stems from)
- Related ADR: [ADR-0001](ADR-0001-scratchpad-state-sharing.md) (scratchpad
  backend pattern)
- CHANGELOG baseline: `CHANGELOG.md` `[0.1.0] - 2026-05-09`
