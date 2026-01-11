[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RiskAssessment

# Interface: RiskAssessment

Defined in: [src/impact-analyzer/types.ts:163](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L163)

Overall risk assessment

## Properties

### overallRisk

> `readonly` **overallRisk**: [`RiskLevel`](../type-aliases/RiskLevel.md)

Defined in: [src/impact-analyzer/types.ts:165](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L165)

Overall risk level

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/impact-analyzer/types.ts:167](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L167)

Confidence in the assessment (0.0 - 1.0)

***

### factors

> `readonly` **factors**: readonly [`RiskFactor`](RiskFactor.md)[]

Defined in: [src/impact-analyzer/types.ts:169](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L169)

Individual risk factors
