# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records (ADRs) for the AD-SDLC project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help the team:

- Understand **why** certain decisions were made
- Evaluate if past decisions are still valid
- Onboard new team members faster
- Avoid repeating past discussions

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-0001](ADR-0001-scratchpad-state-sharing.md) | Scratchpad-based State Sharing | Accepted | 2024-01-15 |
| [ADR-0002](ADR-0002-agent-factory-pattern.md) | Agent Factory Pattern | Accepted | 2024-02-01 |
| [ADR-0003](ADR-0003-file-based-locking.md) | File-based Distributed Locking | Accepted | 2024-02-15 |
| [ADR-0004](ADR-0004-error-handling-strategy.md) | Error Classification and Retry Strategy | Accepted | 2024-03-01 |
| [ADR-0005](ADR-0005-layered-architecture.md) | Layered Architecture (Control/Data/Agent) | Accepted | 2024-01-10 |

## When to Write an ADR

Write an ADR when making a decision that:

1. **Affects structure**: Changes to module organization, component boundaries, or system layers
2. **Is hard to reverse**: Decisions with significant switching costs
3. **Has trade-offs**: Multiple valid approaches were considered
4. **Will be questioned later**: Decisions that aren't immediately obvious
5. **Crosses team boundaries**: Decisions affecting multiple modules or teams

## ADR Lifecycle

```
[Proposed] → [Accepted] → [Deprecated] → [Superseded by ADR-XXXX]
                ↓
           [Rejected]
```

### Statuses

| Status | Description |
|--------|-------------|
| **Proposed** | Under discussion, not yet decided |
| **Accepted** | Decision made and currently in effect |
| **Deprecated** | No longer recommended but still in use |
| **Superseded** | Replaced by a newer ADR |
| **Rejected** | Considered but not adopted |

## How to Write an ADR

1. Copy `template.md` to `ADR-XXXX-short-title.md`
2. Assign the next sequential number
3. Fill in all sections (Context, Decision, Consequences, Alternatives)
4. Submit a PR for team review
5. Update the index in this README

## ADR Template Structure

Every ADR follows a consistent structure:

```markdown
# ADR-XXXX: Title

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-YYYY]

## Date
YYYY-MM-DD

## Context
What problem are we solving? What constraints exist?

## Decision
What change are we making?

## Consequences
What are the positive, negative, and neutral outcomes?

## Alternatives Considered
What other options were evaluated and why were they rejected?

## References
Links to related code, issues, and external resources.
```

## Best Practices

### Do

- Keep ADRs concise and focused on one decision
- Include concrete examples when helpful
- Link to relevant code and issues
- Update status when circumstances change
- Reference related ADRs

### Don't

- Write ADRs for trivial decisions
- Combine multiple decisions into one ADR
- Leave the "Alternatives Considered" section empty
- Forget to update the index

## Review Process

1. **Draft**: Author creates ADR in a feature branch
2. **Review**: Team reviews via PR comments
3. **Revise**: Author addresses feedback
4. **Accept**: Merge PR when consensus is reached
5. **Communicate**: Share decision in team channels

## Related Documentation

- [System Architecture](../system-architecture.md)
- [Error Handling](../error-handling.md)
- [Scratchpad Module](../../src/scratchpad/README.md)
- [Agents Module](../../src/agents/README.md)
