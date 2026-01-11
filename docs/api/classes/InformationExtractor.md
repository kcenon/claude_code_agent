[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InformationExtractor

# Class: InformationExtractor

Defined in: [src/collector/InformationExtractor.ts:114](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InformationExtractor.ts#L114)

InformationExtractor class for analyzing and extracting structured information

## Constructors

### Constructor

> **new InformationExtractor**(`options`): `InformationExtractor`

Defined in: [src/collector/InformationExtractor.ts:122](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InformationExtractor.ts#L122)

#### Parameters

##### options

[`InformationExtractorOptions`](../interfaces/InformationExtractorOptions.md) = `{}`

#### Returns

`InformationExtractor`

## Methods

### extract()

> **extract**(`input`): [`ExtractionResult`](../interfaces/ExtractionResult.md)

Defined in: [src/collector/InformationExtractor.ts:132](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InformationExtractor.ts#L132)

Extract all information from parsed input

#### Parameters

##### input

[`ParsedInput`](../interfaces/ParsedInput.md)

Parsed input to analyze

#### Returns

[`ExtractionResult`](../interfaces/ExtractionResult.md)

ExtractionResult with all extracted information
