# Use Cases Guide

> **Version**: 1.0.0
> **Audience**: Developers using AD-SDLC

This guide provides detailed examples of common use cases for the AD-SDLC system.

Each example passes the requirements text to `ad-sdlc run`. The pipeline mode
decides what happens with it: the default `greenfield` starts a new project,
`--mode enhancement` changes an existing project by reading its documents and
code, and `--mode import` implements the repository's open GitHub issues. Every
run ends, at most, with a pull request ready for review; see the
[capability matrix](architecture/capability-matrix.md). Inside Claude Code, the
`/run-greenfield` project command runs the same pipeline; a plain `claude`
prompt does not.

## Table of Contents

1. [New Feature Implementation](#new-feature-implementation)
2. [Bug Fix Workflow](#bug-fix-workflow)
3. [Refactoring Project](#refactoring-project)
4. [API Development](#api-development)
5. [Full Application Build](#full-application-build)
6. [From Requirements File](#from-requirements-file)
7. [Incremental Development](#incremental-development)
8. [Tips and Best Practices](#tips-and-best-practices)

---

## New Feature Implementation

Implement a complete feature from a high-level description.

### Simple Feature

```bash
# User authentication
ad-sdlc run "Implement user authentication with email and password"

# File upload
ad-sdlc run "Add file upload functionality with size validation and progress tracking"

# Search functionality
ad-sdlc run "Implement full-text search across products with filters and pagination"
```

### Complex Feature

```bash
# Multi-step workflow
ad-sdlc run "Implement a user dashboard with:
- Profile management (view, edit, avatar upload)
- Activity logs showing recent actions
- Settings page with notification preferences
- Account deletion with confirmation flow"
```

### Feature with Technical Requirements

```bash
# Specify technology stack
ad-sdlc run "Implement real-time notifications using:
- WebSocket connection for push notifications
- Redis for message queue
- React hooks for client-side state
- Proper reconnection handling"
```

### Expected Output

For a feature request, AD-SDLC will:

1. **PRD**: Detailed requirements with user stories
2. **SRS**: Functional specifications
3. **SDS**: Component design and interfaces
4. **Issues**: 5-15 GitHub issues with dependencies
5. **Code**: Working implementation with tests

---

## Bug Fix Workflow

Fix issues with reference to existing GitHub issues or bug descriptions. Run
these in the existing project with `--mode enhancement`.

### From GitHub Issue

```bash
# Implement the repository's open issues (the Import pipeline reads them all)
ad-sdlc run "" --mode import

# Or describe the issue to fix as an enhancement
ad-sdlc run "Fix #42: Login fails when email contains + character" --mode enhancement
```

### From Bug Description

```bash
# Describe the bug directly
ad-sdlc run "Fix: Users are logged out after 5 minutes of inactivity instead of 30 minutes"

# With reproduction steps
ad-sdlc run "Fix: Shopping cart loses items on page refresh.
Reproduction:
1. Add items to cart
2. Refresh the page
3. Cart is empty
Expected: Cart should persist across refresh"
```

### With Root Cause Analysis

```bash
# Ask for investigation
ad-sdlc run "Investigate and fix: API responses are slow (>3s) for authenticated requests.
Check for:
- N+1 queries
- Missing indexes
- Session handling overhead"
```

### Expected Output

For bug fixes, AD-SDLC will:

1. **Analysis**: Root cause investigation
2. **SRS Update**: Clarified expected behavior
3. **Issue**: Single issue with fix description
4. **Code**: Fix with unit test for regression
5. **PR**: With before/after description

---

## Refactoring Project

Improve code structure without changing behavior.

### Module Refactoring

```bash
# Extract module
ad-sdlc run "Refactor: Extract authentication logic into a separate auth module"

# Apply design pattern
ad-sdlc run "Refactor auth module to use dependency injection for database and cache services"
```

### Code Quality Improvement

```bash
# Reduce complexity
ad-sdlc run "Refactor UserService class - current cyclomatic complexity is too high.
Break down into smaller, focused services."

# Apply SOLID principles
ad-sdlc run "Refactor OrderProcessor to follow Single Responsibility Principle"
```

### Architecture Migration

```bash
# Change pattern
ad-sdlc run "Refactor from callback-based API to async/await throughout the codebase"

# Database migration
ad-sdlc run "Refactor database layer from raw SQL to use TypeORM repository pattern"
```

### Expected Output

For refactoring, AD-SDLC will:

1. **SDS Update**: New component structure
2. **Issues**: Step-by-step refactoring tasks
3. **Code**: Refactored implementation
4. **Tests**: Updated tests ensuring behavior is preserved

---

## API Development

Build RESTful or GraphQL APIs.

### REST API

```bash
# CRUD endpoints
ad-sdlc run "Implement REST API for product management:
- GET /products (list with pagination)
- GET /products/:id
- POST /products
- PUT /products/:id
- DELETE /products/:id
Include validation, error handling, and OpenAPI documentation"
```

### GraphQL API

```bash
# GraphQL schema and resolvers
ad-sdlc run "Implement GraphQL API for user management:
- Query: users, user(id)
- Mutation: createUser, updateUser, deleteUser
- Use DataLoader for N+1 prevention
- Include authentication middleware"
```

### API with Authentication

```bash
# Protected endpoints
ad-sdlc run "Implement order API with:
- JWT authentication
- Role-based access control (admin, user)
- Rate limiting (100 req/min)
- Request/response logging"
```

### Expected Output

For API development, AD-SDLC will:

1. **PRD**: API requirements and use cases
2. **SRS**: Endpoint specifications
3. **SDS**: Route handlers, middleware, models
4. **Code**: API implementation with:
   - Request validation
   - Error handling
   - Authentication/authorization
   - Tests (unit + integration)
5. **Docs**: OpenAPI/Swagger specification

---

## Full Application Build

Build a complete application from scratch.

### Web Application

```bash
ad-sdlc run "Build a task management web application:

Features:
- User registration and login
- Create, edit, delete tasks
- Organize tasks into projects
- Due dates and reminders
- Task assignment to team members
- Activity timeline

Tech stack:
- Backend: Node.js with Express
- Frontend: React with TypeScript
- Database: PostgreSQL
- Authentication: JWT"
```

### CLI Tool

```bash
ad-sdlc run "Build a CLI tool for managing dotfiles:

Commands:
- init: Initialize dotfiles repository
- add <file>: Add file to dotfiles
- link: Create symlinks for all dotfiles
- sync: Push changes to remote
- status: Show current state

Features:
- Profile support (work, home)
- Conflict resolution
- Backup before linking"
```

### Microservice

```bash
ad-sdlc run "Build a notification microservice:

Channels:
- Email (SMTP, SendGrid)
- SMS (Twilio)
- Push (FCM, APNs)
- Webhook

Features:
- Template management
- Delivery tracking
- Retry with exponential backoff
- Rate limiting per user

API:
- REST endpoints for sending
- Webhook for delivery status"
```

---

## From Requirements File

Use existing requirements documents as input.

### From Markdown File

```bash
# Read requirements from file
ad-sdlc run "Read requirements from docs/requirements.md and implement"

# With specific section
ad-sdlc run "Implement the 'Payment Processing' section from docs/product-spec.md"
```

### From YAML/JSON Specification

```bash
# OpenAPI specification
ad-sdlc run "Implement API endpoints from openapi.yaml"

# Feature specification
ad-sdlc run "Implement features defined in features.json"
```

### From Multiple Sources

```bash
# Combine sources
ad-sdlc run "Implement user management based on:
- Requirements: docs/user-management.md
- API spec: api/users.yaml
- UI mockups: designs/users.fig (describe the mockups)"
```

### Example Requirements File

Create `docs/requirements.md`:

```markdown
# User Management Requirements

## Overview

Implement user registration, authentication, and profile management.

## User Stories

### US-001: User Registration

As a new user, I want to register with my email so that I can access the system.

**Acceptance Criteria:**

- Email validation
- Password strength check (8+ chars, uppercase, number)
- Email verification flow
- Duplicate email prevention

### US-002: User Login

As a registered user, I want to log in so that I can access my account.

**Acceptance Criteria:**

- Email/password authentication
- Remember me option
- Failed attempt lockout (5 attempts)
- Session management

## Technical Requirements

- Use bcrypt for password hashing
- JWT tokens with 24h expiry
- Rate limiting: 10 requests/minute for auth endpoints
```

Then run:

```bash
ad-sdlc run "Implement requirements from docs/requirements.md"
```

---

## Incremental Development

Build features incrementally across multiple runs. The first run creates the
project; run the later phases with `--mode enhancement`, which reads the
documents and code the earlier runs produced.

### Phase 1: Foundation

```bash
# Start with core structure
ad-sdlc run "Phase 1: Set up project structure for an e-commerce platform.
Create:
- Project scaffolding with Express/React
- Database schema for users, products, orders
- Basic authentication
- Development environment setup"
```

### Phase 2: Core Features

```bash
# Add main features
ad-sdlc run "Phase 2: Implement core e-commerce features.
Add:
- Product catalog with categories
- Shopping cart
- Basic checkout flow
- Order management"
```

### Phase 3: Enhancement

```bash
# Enhance with additional features
ad-sdlc run "Phase 3: Add e-commerce enhancements.
Add:
- Product reviews and ratings
- Wishlist functionality
- Email notifications
- Search with filters"
```

### Resuming Development

An interrupted run continues with its original requirements and session ID
(`ad-sdlc status` lists the sessions); the completed stages are skipped:

```bash
ad-sdlc run "Phase 3: Add e-commerce enhancements. ..." --resume <session-id>
```

New work after a completed run is a new run, for example
`ad-sdlc run "Implement payment integration" --mode enhancement`.

---

## Tips and Best Practices

### Writing Effective Prompts

**Be Specific:**

```bash
# Good: Specific requirements
ad-sdlc run "Implement password reset with:
- Email-based reset flow
- Token expires in 1 hour
- Rate limit: 3 requests per hour
- Log all reset attempts"

# Less effective: Vague
ad-sdlc run "Add password reset"
```

**Include Context:**

```bash
# Good: Provide context
ad-sdlc run "We use Express with TypeORM and PostgreSQL.
Implement a caching layer using Redis for product queries.
Follow the existing pattern in src/services/"

# Less effective: No context
ad-sdlc run "Add caching"
```

**Specify Constraints:**

```bash
# Good: Clear constraints
ad-sdlc run "Implement file upload:
- Max size: 10MB
- Allowed types: jpg, png, pdf
- Store in S3 with signed URLs
- Return presigned upload URLs"
```

### Managing Large Projects

```bash
# Break into phases
ad-sdlc run "This is a large project. Let's break it into phases:
1. Core infrastructure
2. User management
3. Main features
4. Integrations
Start with Phase 1."

# Set scope limits
ad-sdlc run "Implement MVP version of checkout.
Scope: Cart -> Address -> Payment (Stripe) -> Confirmation
Skip: Multiple shipping options, gift cards, promo codes"
```

### Reviewing Generated Code

```bash
# Always review critical code
# Check security-sensitive areas:
# - Authentication/authorization
# - Input validation
# - SQL queries
# - File operations

# Run generated tests
npm test

# Check for security issues
npm audit
```

---

## See Also

- [Quickstart Guide](quickstart.md) - First project tutorial
- [FAQ](faq.md) - Common questions
- [Configuration](reference/06_configuration.md) - Customize behavior

---

_Part of [AD-SDLC Documentation](../README.md)_
