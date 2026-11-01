# SRS-001: Task Ledger

| Field   | Value |
| ------- | ----- |
| Version | 1.0.0 |

## 1. Introduction

This document specifies the software features of Task Ledger. Every feature
names the product requirement it implements and the component that realizes it.

## 3. System Features

### SF-001: Task tracking

- **Source**: FR-001
- **Realized by**: CMP-001
- **Description**: `addTask` appends an open task with the next free identifier,
  and `completeTask` marks one task as done. Neither changes its input.
- Task title limit: 120 characters

### SF-002: Progress reporting

- **Source**: FR-002
- **Realized by**: CMP-002
- **Description**: `progress` returns the total, done, and open counts, and
  `formatProgress` returns them as one line such as `2 of 5 tasks done`.

### SF-003: Task archiving

- **Source**: FR-003
- **Realized by**: CMP-003
- **Description**: `archiveCompleted` returns the active list and the archive,
  which holds the tasks that are done.
