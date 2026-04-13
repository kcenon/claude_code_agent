---
doc_id: SDS-VALID-001
title: Valid Project SDS
version: 1.0.0
status: Approved
generated_by: test
generated_at: 2026-04-12T00:00:00Z
---

# 1. Introduction

SDS introduction.

# 2. Architecture

Layered architecture with service layer and repository layer.

```mermaid
flowchart TD
    A[Client] --> B[API]
    B --> C[Auth Service]
```

# 3. Components

## CMP-001: AuthService

Realizes SF-001 by validating credentials against the user store.

## CMP-002: PasswordResetService

Realizes SF-002 by emailing a reset token.
