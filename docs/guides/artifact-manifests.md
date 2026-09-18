# Durable stage artifact manifests

SDK pipeline stages publish version 1 artifact manifests through the configured
Scratchpad backend. A stage result's `manifest` reference is authoritative.
`artifacts` arrays and the JSON output summary remain compatibility views of
project files and directories recorded as present. They exclude deletions and external
references. Final prose such as `status: success` does not declare an artifact.

## Production flow

1. The orchestrator supplies `artifactContext`: pipeline session ID, canonical
   stage, unique attempt ID, scratchpad directory, trusted required-output
   patterns, upstream references, and any permitted external locations.
2. Each SDK invocation owns its Edit/Write capture hooks. They retain SDK session
   and tool-use IDs and await Scratchpad persistence before returning.
3. The SDK receives `outputFormat: { type: 'json_schema', schema: ... }`. Its
   `structured_output` attachment declares outputs from Bash, MCP, or other
   tools. The adapter adds the declaration instructions and expected paths to the
   request, so customized agent definitions need no replacement.
4. After SDK cleanup, the adapter joins capture writes, reconciles declarations,
   checks locations/types and required outputs, and publishes immutable metadata.
5. The scheduler records a typed manifest reference in `StageResult`. Session
   YAML, pipeline results, and checkpoints retain it. Subsequent SDK requests
   receive both references and hydrated manifest JSON, including for SQLite or
   Redis storage. Existing `priorOutputs` entries are still forwarded verbatim.

Capture failure remains fatal even if the SDK swallows a hook rejection and
returns success. Missing required outputs also fail the stage before dependent
work. Manifest writes share the adapter's bounded cleanup budget with SDK
cleanup; unresolved writes stop replacement work with an `EXEC-004` diagnostic.
Ordinary checkpoint writes retain their existing best-effort policy.

## Output declarations

The complete declaration envelope is:

```json
{
  "schemaVersion": 1,
  "artifacts": [
    {
      "path": "docs/design notes.md",
      "kind": "file",
      "operation": "written",
      "description": "Produced through Bash"
    },
    {
      "path": "src/설계.ts",
      "kind": "file",
      "operation": "modified"
    },
    {
      "path": "reports",
      "kind": "directory",
      "operation": "created"
    },
    {
      "path": "src/obsolete.ts",
      "kind": "file",
      "operation": "deleted"
    },
    {
      "path": "https://github.com/example/project/issues/123",
      "kind": "external-uri",
      "operation": "reused"
    }
  ]
}
```

An optional `checksum` is the lowercase SHA-256 digest of the entire file's
current bytes. The adapter computes checksums for existing files and verifies
any supplied digest. Directory and deletion declarations cannot carry a current
content checksum.

`created` and `modified` are producer declarations; a PostToolUse Write event
alone establishes only `written`. Rename is represented as deletion of the old
location plus creation/writing of the new location. A local `reused` declaration
must point to an artifact in an upstream manifest. The orchestrator may explicitly
allow existing infrastructure, currently the initialization scratchpad directory.

Exact duplicate normalized declarations coalesce. Conflicting declarations and
capture/declaration kind mismatches fail. A declaration can refine a captured
file's description or change operation, including a subsequently verified
deletion. Valid captures omitted from the final response remain in the manifest.
Missing optional/transient captures have `availability: "absent"` and do not
appear in compatibility arrays.

An absent structured attachment is allowed for capture-only stages. A present
attachment must validate completely. Malformed structured data never falls back
to text parsing. Files neither captured nor declared are not discoverable through
this contract; the implementation does not infer ownership by parsing shell
commands or scanning the project.

## Locations and required outputs

Local locations use portable paths relative to the explicit target project root.
An absolute location inside that root is converted to relative form. Windows
separators in relative inputs are normalized to `/`. Spaces, Unicode, and case are
preserved. Foreign Windows drive/UNC paths are rejected on POSIX; native Windows
absolute paths still have to remain within the selected root.

Traversal, control characters, URIs disguised as local paths, final-component
symlinks, and symlink parents escaping the project are rejected. Even absent
deletion targets must have a safe existing ancestor. Existing directory and file
types are checked separately. Deletions require absence and cannot satisfy a
requirement for a present output.

The stage contract supplies required patterns, using the existing single-segment
`*` convention and the session's configured scratchpad path. Requirements are
matched against observed/declared entries, not unrelated old files matching a
filesystem glob. SDK output cannot lower a requirement by setting `required:
false` or omitting the artifact. Required-output checks are distinct from the
existing content-quality and V&V policies.

External references are denied by default. A trusted programmatic caller can set
`artifactContext.externalReferences` to exact permitted locations. `external-file`
requires a native absolute path and is checked locally. `external-uri` accepts
HTTP(S) references without credentials, uses operation `reused`, and records
`external-unverified`; no network existence check is claimed. Agent declarations
cannot grant permission. External references are not substitutes for required
project files.

## Identity, storage, and restart

A manifest contains `schemaVersion`, pipeline `sessionId`, `stageName`,
`attemptId`, `agentType`, optional `sdkSessionId`, creation time, execution
observations, status, required-output policy, permitted external locations,
upstream references, and artifact entries. Entries retain location/kind,
operation, availability, requiredness, checksums, and provenance events.

The reference has `{ version: 1, sessionId, stageName, id }`, where `id` is the
SHA-256 digest of canonical manifest metadata. Store lookups validate the schema,
digest, and ownership. Logical artifact IDs derive from pipeline session and
normalized location (with a distinct external namespace); editing a file does
not change its logical ID. A new metadata revision gets a new manifest reference.
The store archives metadata, not historical file contents.

Records live under the selected scratchpad base:

```text
pipeline/artifacts/<pipeline-session-id>/
  capture-<stage-digest>-<event-digest>.json
  manifest-<metadata-digest>.json
```

These are logical record keys for SQLite/Redis. Use `ManifestStore.load()` rather
than assuming a reference is a readable disk filename. File storage uses atomic
replacement; distinct event keys avoid a shared read-modify-write index. The
raw-file backend preserves filename extensions during enumeration.

`scratchpad.file.base_path` selects the metadata store location when configured;
otherwise it uses the session scratchpad directory. SQLite database paths are
resolved against the project, and Redis uses the existing configured connection
and prefix. Manifest records disable Redis TTL so a saved reference does not
expire. Durability across a Redis server failure still depends on that server's
persistence configuration. Optional backend dependencies remain lazy. Each store
owns and closes its own backend. Pipeline session IDs must be unique when
programmatic callers share a backend.

Capture keys include attempt, SDK session/tool-use identity, normalized location,
and observed content. Repeated observations coalesce; a later edit retains new
provenance. Retries recover matching-lineage capture records from interrupted
attempts, then reconcile one logical entry per location. A failed/aborted
manifest never becomes successful upstream output. Publication overlapping
cancellation records an aborted attempt that recovery excludes.

The initial session is saved before SDK work, including runs without a runtime
snapshot. On restart, checkpoint and session-only paths preserve manifest
references. If an interruption happened after manifest publication but before
stage/checkpoint persistence, the same-session stage can recover the completed
manifest with matching upstream lineage and required-output contract. This does
not rerun its SDK invocation. Repeated recovery keeps the same reference.

Required artifacts must still exist with their recorded type and SHA-256 content
before reuse. Restore a missing/changed required output or start a fresh run;
resume will not silently bless drift. Optional metadata, including its availability
in compatibility arrays, remains an observation of its recorded revision rather
than a fresh filesystem check. Relative locations resolve against the explicitly
selected project root, allowing a moved project to resume. Restore/reconnect its
selected backend as necessary; backend migration is not automatic.

Checkpoint pruning and successful checkpoint cleanup do not delete manifests or
captures. Keep the session's records while results or downstream stages reference
them. Missing, corrupt, foreign, or unsupported new-format records require an
actionable recovery rather than silently yielding an empty artifact set.

## Migrating existing integrations

- v1/missing-version checkpoints still migrate to v2. Manifest references are
  additive fields in v2 stage results. Optional SDK resume IDs and the saved
  runtime plan retain their existing behavior.
- Old session path arrays and JSON summaries remain readable as legacy data.
  Requests label upstream summaries lacking manifests as having unverified
  artifact lineage. No historical tool events or checksums are fabricated.
  Legacy degraded stages still rerun on session-only resume; degraded stages
  with validated complete manifests retain their persisted output references.
- Custom execution adapters may continue returning legacy `ArtifactRef[]`.
  Supplying `manifest` opts into validated authoritative storage; the orchestrator
  derives compatibility arrays from it. `ArtifactRef.path` means project-relative,
  not relative to the scratchpad directory.
- Standalone SDK calls without `artifactContext` produce no artifacts from final
  prose by default. A temporary `legacyTextArtifacts: true` constructor option
  recognizes explicit path annotations only after checking an existing project
  file. It accepts spaces/Unicode, deduplicates paths, and ignores status prose.
  Production pipeline manifests do not use this fallback.
- For reliable standalone integration, supply `artifactContext` and use the
  structured declaration contract. Pass hydrated `priorManifests` when a caller
  supplies upstream references directly.

The offline suites cover the real SDK adapter/options and hooks, scratchpad
file/SQLite persistence, controlled Redis routing, production scheduling, both
resume paths, a terminated producer process, path/schema failures, duplicate
events, cancellation during publication, and storage cleanup timeouts. They do
not establish live model compliance or paid Import delivery.

```sh
npx vitest run tests/execution/artifactManifests.test.ts tests/ad-sdlc-orchestrator/artifactManifests.test.ts
npm run test:sdk-contract
```
