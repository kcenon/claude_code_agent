[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TraceabilityIssue

# Interface: TraceabilityIssue

Defined in: [src/srs-writer/TraceabilityBuilder.ts:328](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L328)

Traceability issue

## Properties

### type

> `readonly` **type**: `"uncovered_requirement"` \| `"orphan_feature"` \| `"missing_use_cases"` \| `"low_coverage"` \| `"broken_reference"`

Defined in: [src/srs-writer/TraceabilityBuilder.ts:330](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L330)

Issue type

***

### severity

> `readonly` **severity**: `"info"` \| `"warning"` \| `"error"`

Defined in: [src/srs-writer/TraceabilityBuilder.ts:337](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L337)

Issue severity

***

### message

> `readonly` **message**: `string`

Defined in: [src/srs-writer/TraceabilityBuilder.ts:339](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L339)

Issue message

***

### affectedIds

> `readonly` **affectedIds**: readonly `string`[]

Defined in: [src/srs-writer/TraceabilityBuilder.ts:341](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L341)

Affected IDs
