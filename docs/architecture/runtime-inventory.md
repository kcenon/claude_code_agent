# Runtime and Documentation Inventory

> **Status**: Current
> **Last verified**: 2026-08-01

AD-SDLC previously used “agent count” for several different quantities. This
page keeps those axes separate. The table is checked against the TypeScript
stage arrays, checked-in agent definitions, release history, and canonical
PRD/SRS/SDS documents by `npm run docs:check-inventory`.

<!-- generated-runtime-inventory:start -->

| Axis                                  | Current value | Authoritative source                                         |
| ------------------------------------- | ------------: | ------------------------------------------------------------ |
| Checked-in agent definition prompts   |            36 | `.claude/agents/*.md`                                        |
| Unique agent types used by a pipeline |            29 | `PipelineStageDefinition.agentType` values                   |
| Greenfield stage slots                |            19 | `GREENFIELD_STAGES`                                          |
| Enhancement stage slots               |            15 | `ENHANCEMENT_STAGES`                                         |
| Import stage slots                    |             5 | `IMPORT_STAGES`                                              |
| Mode-specific stage slots (sum)       |            39 | All three stage-definition arrays                            |
| Support/delegated agent definitions   |             7 | Definition prompts not used as a direct pipeline `agentType` |
| v0.1 cutover targets (historical)     |            33 | `CHANGELOG.md` v0.1.0 migration record                       |
| Functional requirements               |            33 | Unique `FR-*` IDs in PRD-001                                 |
| Software features                     |            31 | Unique `SF-*` IDs in SRS-001                                 |
| Design components                     |            36 | Unique `CMP-*` IDs in SDS-001                                |

<!-- generated-runtime-inventory:end -->

“Stage slot” means one entry in a mode-specific stage array. Reused stages such
as `implementation` appear once in each applicable mode, so the sum of slots is
larger than the number of unique agent types. The 33 cutover targets describe
the historical v0.1 migration scope; they are not a current runtime count.

The seven support/delegated definitions are the two orchestrators, CI fixer,
the two local-mode aliases, RTM builder, and stage verifier. They remain prompt
definitions even though they are not direct `agentType` values in the three
mode arrays.

All 36 prompts and four project commands ship in the npm asset bundle and are
installed for every template. The [asset manifest and upgrade guide](../agent-assets.md)
documents delivery validation, local/delegated closure, and customization ownership.
