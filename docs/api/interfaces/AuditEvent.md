[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AuditEvent

# Interface: AuditEvent

Defined in: [src/security/types.ts:28](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L28)

Audit event data structure

## Extended by

- [`AuditLogEntry`](AuditLogEntry.md)

## Properties

### type

> `readonly` **type**: [`AuditEventType`](../type-aliases/AuditEventType.md)

Defined in: [src/security/types.ts:30](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L30)

Event type identifier

***

### actor

> `readonly` **actor**: `string`

Defined in: [src/security/types.ts:32](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L32)

Actor performing the action (user, agent, system)

***

### resource

> `readonly` **resource**: `string`

Defined in: [src/security/types.ts:34](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L34)

Resource being accessed or modified

***

### action

> `readonly` **action**: `string`

Defined in: [src/security/types.ts:36](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L36)

Action being performed

***

### result

> `readonly` **result**: [`AuditEventResult`](../type-aliases/AuditEventResult.md)

Defined in: [src/security/types.ts:38](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L38)

Result of the action

***

### details?

> `readonly` `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: [src/security/types.ts:40](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L40)

Additional event details
