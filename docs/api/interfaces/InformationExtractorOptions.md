[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InformationExtractorOptions

# Interface: InformationExtractorOptions

Defined in: [src/collector/InformationExtractor.ts:74](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InformationExtractor.ts#L74)

InformationExtractor options

## Properties

### defaultPriority?

> `readonly` `optional` **defaultPriority**: `"P0"` \| `"P1"` \| `"P2"` \| `"P3"`

Defined in: [src/collector/InformationExtractor.ts:76](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InformationExtractor.ts#L76)

Default priority for unclassified requirements

***

### minConfidence?

> `readonly` `optional` **minConfidence**: `number`

Defined in: [src/collector/InformationExtractor.ts:78](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InformationExtractor.ts#L78)

Minimum confidence threshold for including extractions

***

### maxQuestions?

> `readonly` `optional` **maxQuestions**: `number`

Defined in: [src/collector/InformationExtractor.ts:80](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InformationExtractor.ts#L80)

Maximum number of clarification questions to generate
