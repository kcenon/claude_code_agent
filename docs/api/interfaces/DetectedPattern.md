[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DetectedPattern

# Interface: DetectedPattern

Defined in: [src/codebase-analyzer/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L89)

Detected pattern in the codebase

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/codebase-analyzer/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L91)

Pattern name

***

### type

> `readonly` **type**: [`PatternType`](../type-aliases/PatternType.md)

Defined in: [src/codebase-analyzer/types.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L93)

Pattern type

***

### locations

> `readonly` **locations**: readonly [`PatternLocation`](PatternLocation.md)[]

Defined in: [src/codebase-analyzer/types.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L95)

Locations where pattern is found

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/codebase-analyzer/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L97)

Detection confidence (0.0 - 1.0)
