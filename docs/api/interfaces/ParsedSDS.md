[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ParsedSDS

# Interface: ParsedSDS

Defined in: [src/issue-generator/types.ts:78](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L78)

Parsed SDS document structure

## Properties

### metadata

> `readonly` **metadata**: `SDSMetadata`

Defined in: [src/issue-generator/types.ts:80](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L80)

Document metadata

***

### components

> `readonly` **components**: readonly `SDSComponent`[]

Defined in: [src/issue-generator/types.ts:82](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L82)

Extracted components

***

### technologyStack

> `readonly` **technologyStack**: readonly `TechnologyEntry`[]

Defined in: [src/issue-generator/types.ts:84](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L84)

Technology stack

***

### traceabilityMatrix

> `readonly` **traceabilityMatrix**: readonly `TraceabilityEntry`[]

Defined in: [src/issue-generator/types.ts:86](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L86)

Traceability matrix entries
