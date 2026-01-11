[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PriorityAnalyzerConfig

# Interface: PriorityAnalyzerConfig

Defined in: [src/controller/types.ts:206](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L206)

Priority analyzer configuration

## Properties

### weights?

> `readonly` `optional` **weights**: [`PriorityWeights`](PriorityWeights.md)

Defined in: [src/controller/types.ts:208](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L208)

Priority weights

***

### criticalPathBonus?

> `readonly` `optional` **criticalPathBonus**: `number`

Defined in: [src/controller/types.ts:210](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L210)

Bonus score for issues on critical path

***

### dependentMultiplier?

> `readonly` `optional` **dependentMultiplier**: `number`

Defined in: [src/controller/types.ts:212](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L212)

Score multiplier per dependent issue

***

### quickWinBonus?

> `readonly` `optional` **quickWinBonus**: `number`

Defined in: [src/controller/types.ts:214](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L214)

Bonus for smaller effort (quick wins)

***

### quickWinThreshold?

> `readonly` `optional` **quickWinThreshold**: `number`

Defined in: [src/controller/types.ts:216](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L216)

Threshold hours for quick win bonus
