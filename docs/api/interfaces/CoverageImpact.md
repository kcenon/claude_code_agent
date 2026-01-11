[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CoverageImpact

# Interface: CoverageImpact

Defined in: [src/regression-tester/types.ts:231](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L231)

Coverage impact analysis

## Properties

### before

> `readonly` **before**: [`CoverageMetrics`](CoverageMetrics.md)

Defined in: [src/regression-tester/types.ts:233](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L233)

Coverage before changes

***

### after

> `readonly` **after**: [`CoverageMetrics`](CoverageMetrics.md)

Defined in: [src/regression-tester/types.ts:235](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L235)

Coverage after changes

***

### delta

> `readonly` **delta**: [`CoverageMetrics`](CoverageMetrics.md)

Defined in: [src/regression-tester/types.ts:237](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L237)

Coverage delta

***

### uncoveredLines

> `readonly` **uncoveredLines**: readonly [`UncoveredLines`](UncoveredLines.md)[]

Defined in: [src/regression-tester/types.ts:239](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L239)

Newly uncovered lines
