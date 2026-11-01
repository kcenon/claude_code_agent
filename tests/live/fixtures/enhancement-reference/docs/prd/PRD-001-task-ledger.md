# PRD-001: Task Ledger

| Field   | Value |
| ------- | ----- |
| Version | 1.1.0 |

## Introduction

Task Ledger is a small JavaScript library that keeps a list of tasks and reports
on it. Applications pass the list in and get a new list back, so the library
holds no state of its own and needs no storage.

## Functional Requirements

### FR-001: Track tasks

- **Description**: The library adds a task with a title and an optional due
  date, and marks a task as done.
- **Priority**: P0
- Task title limit: 120 characters

### FR-002: Report progress

- **Description**: The library reports how many tasks a list has, how many are
  done, and how many are open, as numbers and as one line of text.
- **Priority**: P1

### FR-003: Archive completed tasks

- **Description**: The library moves the completed tasks of a list into an
  archive, so that the active list holds only open tasks.
- **Priority**: P2

### FR-004: Report overdue tasks [NEW]

- **Description**: The library lists the open tasks whose due date is before a
  given day, oldest due date first and then lowest identifier.
- **Priority**: P1
- **Added**: 2026-11-01
- **Change Reason**: Requested enhancement; it extends the reporting of FR-002.

## Non-Functional Requirements

The library has no runtime dependency and runs on Node.js 22 or later.
