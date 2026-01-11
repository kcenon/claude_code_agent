[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InitOptions

# Interface: InitOptions

Defined in: [src/init/types.ts:25](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L25)

Configuration options for project initialization

## Properties

### projectName

> `readonly` **projectName**: `string`

Defined in: [src/init/types.ts:27](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L27)

Project name (defaults to current directory name)

***

### description?

> `readonly` `optional` **description**: `string`

Defined in: [src/init/types.ts:30](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L30)

Project description

***

### githubRepo?

> `readonly` `optional` **githubRepo**: `string`

Defined in: [src/init/types.ts:33](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L33)

GitHub repository URL (optional)

***

### techStack

> `readonly` **techStack**: [`TechStack`](../type-aliases/TechStack.md)

Defined in: [src/init/types.ts:36](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L36)

Primary technology stack

***

### template

> `readonly` **template**: [`TemplateType`](../type-aliases/TemplateType.md)

Defined in: [src/init/types.ts:39](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L39)

Project template variant

***

### targetDir?

> `readonly` `optional` **targetDir**: `string`

Defined in: [src/init/types.ts:42](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L42)

Target directory for initialization (defaults to cwd)

***

### quick?

> `readonly` `optional` **quick**: `boolean`

Defined in: [src/init/types.ts:45](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L45)

Skip interactive prompts and use defaults

***

### skipValidation?

> `readonly` `optional` **skipValidation**: `boolean`

Defined in: [src/init/types.ts:48](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L48)

Skip prerequisite validation
