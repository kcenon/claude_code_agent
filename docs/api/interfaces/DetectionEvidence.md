[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DetectionEvidence

# Interface: DetectionEvidence

Defined in: [src/mode-detector/types.ts:83](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L83)

Combined detection evidence

## Properties

### documents

> `readonly` **documents**: [`DocumentEvidence`](DocumentEvidence.md)

Defined in: [src/mode-detector/types.ts:85](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L85)

Document presence evidence

***

### codebase

> `readonly` **codebase**: [`CodebaseEvidence`](CodebaseEvidence.md)

Defined in: [src/mode-detector/types.ts:87](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L87)

Codebase presence evidence

***

### keywords

> `readonly` **keywords**: [`KeywordEvidence`](KeywordEvidence.md)

Defined in: [src/mode-detector/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L89)

Keyword analysis evidence

***

### userOverride

> `readonly` **userOverride**: [`UserOverride`](UserOverride.md)

Defined in: [src/mode-detector/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L91)

User override information
