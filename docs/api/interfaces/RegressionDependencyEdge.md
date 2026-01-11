[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionDependencyEdge

# Interface: RegressionDependencyEdge

Defined in: [src/regression-tester/types.ts:440](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L440)

Dependency graph edge (from Codebase Analyzer)

## Properties

### from

> `readonly` **from**: `string`

Defined in: [src/regression-tester/types.ts:442](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L442)

Source node ID

***

### to

> `readonly` **to**: `string`

Defined in: [src/regression-tester/types.ts:444](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L444)

Target node ID

***

### type

> `readonly` **type**: `"uses"` \| `"implements"` \| `"extends"` \| `"import"`

Defined in: [src/regression-tester/types.ts:446](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L446)

Edge type

***

### weight

> `readonly` **weight**: `number`

Defined in: [src/regression-tester/types.ts:448](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L448)

Edge weight
