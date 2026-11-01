# SDS-001: Task Ledger

| Field   | Value |
| ------- | ----- |
| Version | 1.1.0 |

## Introduction

This document describes the design of Task Ledger. Every component names the
software feature it implements and its source file.

## System Architecture

The library is a set of ES modules under `src/`. A task list is a plain array of
`{ id, title, due, done }` objects, and every function returns new data instead
of changing its input.

## Component Design

### CMP-001: Tasks

- **Implements**: SF-001
- **Source file**: `src/tasks.mjs`
- **Exports**: `addTask(tasks, title, due)`, `completeTask(tasks, id)`
- Task title limit: 120 characters

### CMP-002: Report [MODIFIED]

- **Implements**: SF-002, SF-004
- **Source file**: `src/report.mjs`
- **Exports**: `progress(tasks)`, `formatProgress(tasks)`,
  `overdueTasks(tasks, today)`

### CMP-003: Archive

- **Implements**: SF-003
- **Source file**: `src/archive.mjs`
- **Exports**: `archiveCompleted(tasks)`
