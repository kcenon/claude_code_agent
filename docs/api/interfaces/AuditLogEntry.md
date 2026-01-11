[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AuditLogEntry

# Interface: AuditLogEntry

Defined in: [src/security/types.ts:46](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L46)

Serialized audit log entry

## Extends

- [`AuditEvent`](AuditEvent.md)

## Properties

### type

> `readonly` **type**: [`AuditEventType`](../type-aliases/AuditEventType.md)

Defined in: [src/security/types.ts:30](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L30)

Event type identifier

#### Inherited from

[`AuditEvent`](AuditEvent.md).[`type`](AuditEvent.md#type)

***

### actor

> `readonly` **actor**: `string`

Defined in: [src/security/types.ts:32](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L32)

Actor performing the action (user, agent, system)

#### Inherited from

[`AuditEvent`](AuditEvent.md).[`actor`](AuditEvent.md#actor)

***

### resource

> `readonly` **resource**: `string`

Defined in: [src/security/types.ts:34](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L34)

Resource being accessed or modified

#### Inherited from

[`AuditEvent`](AuditEvent.md).[`resource`](AuditEvent.md#resource)

***

### action

> `readonly` **action**: `string`

Defined in: [src/security/types.ts:36](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L36)

Action being performed

#### Inherited from

[`AuditEvent`](AuditEvent.md).[`action`](AuditEvent.md#action)

***

### result

> `readonly` **result**: [`AuditEventResult`](../type-aliases/AuditEventResult.md)

Defined in: [src/security/types.ts:38](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L38)

Result of the action

#### Inherited from

[`AuditEvent`](AuditEvent.md).[`result`](AuditEvent.md#result)

***

### details?

> `readonly` `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: [src/security/types.ts:40](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L40)

Additional event details

#### Inherited from

[`AuditEvent`](AuditEvent.md).[`details`](AuditEvent.md#details)

***

### timestamp

> `readonly` **timestamp**: `string`

Defined in: [src/security/types.ts:48](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L48)

ISO timestamp of the event

***

### correlationId

> `readonly` **correlationId**: `string`

Defined in: [src/security/types.ts:50](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L50)

Unique correlation ID for request tracing

***

### sessionId?

> `readonly` `optional` **sessionId**: `string`

Defined in: [src/security/types.ts:52](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L52)

Session identifier
