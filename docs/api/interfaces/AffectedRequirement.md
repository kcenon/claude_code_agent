[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AffectedRequirement

# Interface: AffectedRequirement

Defined in: [src/impact-analyzer/types.ts:121](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L121)

Affected requirement information

## Properties

### requirementId

> `readonly` **requirementId**: `string`

Defined in: [src/impact-analyzer/types.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L123)

Requirement identifier (FR-XXX, NFR-XXX, etc.)

***

### type

> `readonly` **type**: [`RequirementType`](../type-aliases/RequirementType.md)

Defined in: [src/impact-analyzer/types.ts:125](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L125)

Type of requirement

***

### impact

> `readonly` **impact**: [`RequirementImpact`](../type-aliases/RequirementImpact.md)

Defined in: [src/impact-analyzer/types.ts:127](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L127)

How the requirement is impacted

***

### reason

> `readonly` **reason**: `string`

Defined in: [src/impact-analyzer/types.ts:129](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L129)

Reason for the impact
