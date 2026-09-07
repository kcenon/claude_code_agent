# Environment Variables Reference

For SDK CLI workflow policy, explicit CLI options take precedence over direct
environment overrides. See the
[explicit supported environment mapping](../../configuration/RUNTIME_WORKFLOW.md#supported-settings-and-owners)
for each setting's unit, default, owner, and matching CLI option.

```sh
export AD_SDLC_ENV=development # workflow.development.yaml, before NODE_ENV
export AD_SDLC_MODE=enhancement
export AD_SDLC_APPROVAL_MODE=auto
export AD_SDLC_MAX_PARALLEL_STAGES=2
export AD_SDLC_MAX_ATTEMPTS=3 # total, including the first attempt
export AD_SDLC_RETRY_BACKOFF=exponential
export AD_SDLC_RETRY_BASE_DELAY_SECONDS=1
export AD_SDLC_RETRY_MAX_DELAY_SECONDS=3
export AD_SDLC_STAGE_TIMEOUT_MS=300000
export AD_SDLC_LOCAL=false
export AD_SDLC_VNV_RIGOR=standard
export AD_SDLC_HALT_ON_VERIFICATION_FAILURE=false
```

Absent values fall through to the selected overlay/base YAML and live defaults.
Malformed supplied numeric/boolean values fail before adapter creation. There
are no inferred per-property environment variables. Feature flags are a
compatibility exception: `AD_SDLC_USE_SDK_FOR_WORKER` overrides its CLI flag,
feature-flags YAML, and default. It does not control a worker pool.

Earlier versions advertised `AD_SDLC_MAX_WORKERS`, `AD_SDLC_TIMEOUT`, and
`AD_SDLC_APPROVAL_GATES`; these are not supported workflow overrides. Remove
them and choose the explicit settings above. Stage concurrency is not a worker
limit. Model, notification, logging, or path variables used by separate APIs do
not become workflow policy overrides; consult those APIs' documentation.

SDK authentication remains separate from workflow policy. `ANTHROPIC_API_KEY`
is used for API authentication when applicable, and SDK cloud-provider/session
authentication remains available. GitHub-dependent tools use their existing
authentication, such as `GITHUB_TOKEN`. Credentials and unrelated environment
values are excluded from runtime snapshots. Installed project agent frontmatter
continues to supply SDK agent settings.

The workflow loader selects `workflow.<environment>.yaml`; it does not promise
a `.env.local` / `.env.<environment>` loading chain. Supply environment variables
through your shell or deployment environment. `${VAR}` substitution in explicit
workflow values is validated; `${PWD}` means the selected project root. Resume
uses saved workflow policy, as described in the
[resume contract](../../configuration/RUNTIME_WORKFLOW.md#saved-plans-and-resume).
