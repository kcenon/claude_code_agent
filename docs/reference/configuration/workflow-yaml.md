# workflow.yaml Reference

Location: `.ad-sdlc/config/workflow.yaml` in the project selected by `--project-dir`.

The SDK CLI resolves supported workflow settings before execution. Read the
[complete runtime support table, precedence, timeout mapping, and migration guide](../../configuration/RUNTIME_WORKFLOW.md).
It is the authoritative runtime contract. The broad
[syntax schema](../../../schemas/workflow.schema.json) also describes properties
used by separate APIs; schema validity alone does not establish CLI enforcement.

A newly initialized project uses the canonical graph:

```yaml
version: '1.0.0'
pipeline:
  default_mode: greenfield
```

Optional supported policy:

```yaml
execution:
  max_parallel_stages: 2
  stage_timeout_ms: 300000
  stage_timeouts_ms:
    orchestration: 300000
    implementation: 1800000
global:
  approval_mode: auto
  retry_policy:
    max_attempts: 4 # total attempts including the first
    backoff: exponential
    base_delay_seconds: 5
    max_delay_seconds: 60
  vnv:
    rigor: standard
    halt_on_verification_failure: false
```

Run `ad-sdlc run "requirements" --dry-run --format json` to inspect the exact
resolved plan and its value sources. Explicit CLI values override documented
direct environment overrides, which override environment-specific YAML, base
YAML, and live defaults. Feature flags retain their separate environment-first
precedence. See the [expanded supported example](../../../examples/config/workflow.yaml).

Previous versions of this reference described `schema_version`, `global_settings`,
custom stage lists, worker-pool concurrency, and quality/reviewer thresholds as
workflow controls. Those shapes did not govern the SDK CLI run loop. Replace
`schema_version` with `version: '1.0.0'`, review supported properties under `global`
and `execution`, and remove unsupported topology/quality/worker settings. There
is no safe automatic alias from the old controller `implement` stage to the
canonical worker `implementation` stage.

Existing customized files are preserved; migration is an explicit edit followed
by validation. See the [migration dispositions](../../configuration/RUNTIME_WORKFLOW.md#unsupported-settings-and-migration),
including settings that require removal because their advertised behavior was
never enforced. Saved runs retain their plan on resume even after YAML changes.
