[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CompatibilityIssue

# Interface: CompatibilityIssue

Defined in: [src/regression-tester/types.ts:245](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L245)

Compatibility issue

## Properties

### type

> `readonly` **type**: [`CompatibilityIssueType`](../type-aliases/CompatibilityIssueType.md)

Defined in: [src/regression-tester/types.ts:247](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L247)

Issue type

***

### severity

> `readonly` **severity**: [`IssueSeverity`](../type-aliases/IssueSeverity.md)

Defined in: [src/regression-tester/types.ts:249](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L249)

Issue severity

***

### description

> `readonly` **description**: `string`

Defined in: [src/regression-tester/types.ts:251](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L251)

Description of the issue

***

### affectedCode

> `readonly` **affectedCode**: `string`

Defined in: [src/regression-tester/types.ts:253](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L253)

Affected code location

***

### suggestedAction

> `readonly` **suggestedAction**: `string`

Defined in: [src/regression-tester/types.ts:255](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L255)

Suggested action to fix
