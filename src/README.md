# Source Code Directory

This directory contains source code for the AD-SDLC system.

## Current Modules

### Core Modules
```
src/
├── cli.ts                 # CLI entry point
├── index.ts               # Main module exports
├── completion/            # Shell autocompletion support
├── config/                # Configuration validation module
├── error-handler/         # Retry logic and error handling
├── init/                  # Project initialization module
├── issue-generator/       # GitHub issue generation
├── scratchpad/            # Inter-agent state sharing
├── security/              # Security and input validation
└── telemetry/             # Opt-in usage analytics
```

### completion/ - Shell Autocompletion Support
- `CompletionGenerator.ts` - Generates shell completion scripts
- `types.ts` - Shell types and command definitions
- `index.ts` - Module exports

Features:
- Bash, Zsh, and Fish shell support
- Command and option completion
- Value completion for enum-type options
- Installation instructions for each shell

### config/ - Configuration Validation
- `schemas.ts` - Zod schemas for workflow.yaml and agents.yaml
- `validation.ts` - Validation functions with error handling
- `loader.ts` - YAML file loading and parsing
- `watcher.ts` - File watching for real-time validation
- `errors.ts` - Custom error types
- `types.ts` - TypeScript type definitions

### error-handler/ - Retry Logic, Error Handling, and Circuit Breaker
- `RetryHandler.ts` - Core retry logic with exponential backoff
- `CircuitBreaker.ts` - Circuit breaker pattern for fault tolerance
- `types.ts` - Retry policy, circuit breaker config, and error classification types
- `errors.ts` - Custom error classes (MaxRetriesExceeded, CircuitOpen, OperationTimeout, etc.)
- `index.ts` - Module exports

Features:
- Configurable retry policies (max attempts, delays, backoff strategy)
- Exponential, linear, and fixed backoff strategies
- Jitter support to prevent thundering herd
- Error categorization (retryable vs non-retryable)
- Timeout handling for long-running operations
- Abort signal support for cancellation
- Circuit breaker pattern (CLOSED/OPEN/HALF_OPEN states)
- Automatic circuit recovery with configurable reset timeout
- Integration between retry logic and circuit breaker

### telemetry/ - Opt-In Usage Analytics
- `Telemetry.ts` - Core telemetry service with consent management
- `types.ts` - Type definitions for events, consent, and configuration
- `errors.ts` - Custom error classes
- `index.ts` - Module exports

Features:
- Explicit opt-in consent mechanism
- Anonymous-only data collection
- CLI commands: status, enable, disable, policy
- Privacy policy with clear data collection/non-collection lists
- Configurable buffer and flush settings
- Session and event tracking

## Structure Examples

The structure for generated projects depends on the target project type:

### TypeScript/JavaScript Project
```
src/
├── index.ts           # Entry point
├── types/             # Type definitions
├── lib/               # Core libraries
├── services/          # Business logic
└── utils/             # Utility functions
```

### Python Project
```
src/
├── __init__.py
├── main.py            # Entry point
├── models/            # Data models
├── services/          # Business logic
└── utils/             # Utility functions
```

## Code Generation Flow

1. Worker Agent receives Work Order
2. Worker analyzes context and related files
3. Worker generates/modifies code
4. Worker writes unit tests
5. Worker runs self-verification
6. PR Reviewer creates pull request

## Coding Standards

Generated code follows:
- Project-specific coding conventions
- Language-specific best practices
- Existing patterns in the codebase
- 80% minimum test coverage

## Notes

- This directory is initially empty
- Code is generated during the implementation phase
- All code changes go through PR review
