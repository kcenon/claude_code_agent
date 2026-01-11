[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TraceabilityValidationResult

# Interface: TraceabilityValidationResult

Defined in: [src/srs-writer/TraceabilityBuilder.ts:316](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L316)

Traceability validation result

## Properties

### isValid

> `readonly` **isValid**: `boolean`

Defined in: [src/srs-writer/TraceabilityBuilder.ts:318](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L318)

Whether the matrix is valid

***

### issues

> `readonly` **issues**: readonly [`TraceabilityIssue`](TraceabilityIssue.md)[]

Defined in: [src/srs-writer/TraceabilityBuilder.ts:320](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L320)

List of issues found

***

### coverage

> `readonly` **coverage**: `number`

Defined in: [src/srs-writer/TraceabilityBuilder.ts:322](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L322)

Forward coverage percentage
