# Source Code Directory

This directory contains source code for the AD-SDLC system.

## Current Modules

### Core Modules
```
src/
├── cli.ts                 # CLI entry point
├── index.ts               # Main module exports
├── config/                # Configuration validation module
├── init/                  # Project initialization module
├── issue-generator/       # GitHub issue generation
├── scratchpad/            # Inter-agent state sharing
└── security/              # Security and input validation
```

### config/ - Configuration Validation
- `schemas.ts` - Zod schemas for workflow.yaml and agents.yaml
- `validation.ts` - Validation functions with error handling
- `loader.ts` - YAML file loading and parsing
- `watcher.ts` - File watching for real-time validation
- `errors.ts` - Custom error types
- `types.ts` - TypeScript type definitions

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
