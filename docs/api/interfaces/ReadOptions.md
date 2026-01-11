[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ReadOptions

# Interface: ReadOptions

Defined in: [src/scratchpad/types.ts:340](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L340)

Read options for scratchpad files

## Properties

### encoding?

> `readonly` `optional` **encoding**: `BufferEncoding`

Defined in: [src/scratchpad/types.ts:342](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L342)

Encoding (default: 'utf8')

***

### allowMissing?

> `readonly` `optional` **allowMissing**: `boolean`

Defined in: [src/scratchpad/types.ts:344](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L344)

Return null instead of throwing on missing file
