[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AgentFrontmatterSchema

# Variable: AgentFrontmatterSchema

> `const` **AgentFrontmatterSchema**: `ZodObject`\<\{ `name`: `ZodString`; `description`: `ZodString`; `tools`: `ZodArray`\<`ZodEnum`\<\{ `Read`: `"Read"`; `Write`: `"Write"`; `Edit`: `"Edit"`; `Bash`: `"Bash"`; `Glob`: `"Glob"`; `Grep`: `"Grep"`; `WebFetch`: `"WebFetch"`; `WebSearch`: `"WebSearch"`; `LSP`: `"LSP"`; `Task`: `"Task"`; `TodoWrite`: `"TodoWrite"`; `NotebookEdit`: `"NotebookEdit"`; \}\>\>; `model`: `ZodEnum`\<\{ `sonnet`: `"sonnet"`; `opus`: `"opus"`; `haiku`: `"haiku"`; \}\>; \}, `$strip`\>

Defined in: [src/agent-validator/schemas.ts:50](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/agent-validator/schemas.ts#L50)

Schema for agent frontmatter
