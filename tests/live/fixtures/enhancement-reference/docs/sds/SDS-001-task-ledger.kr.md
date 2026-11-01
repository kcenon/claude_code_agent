# SDS-001: Task Ledger

| 항목 | 값    |
| ---- | ----- |
| 버전 | 1.1.0 |

## 1. 소개

이 문서는 Task Ledger의 설계를 설명합니다. 각 컴포넌트는 구현하는 소프트웨어 기능과
소스 파일을 명시합니다.

## 2. 시스템 아키텍처

라이브러리는 `src/` 아래의 ES 모듈 모음입니다. 작업 목록은 `{ id, title, due, done }`
객체의 배열이며, 모든 함수는 입력을 변경하지 않고 새 데이터를 반환합니다.

## 3. 컴포넌트 설계

### CMP-001: 작업 (Tasks)

- **구현 기능**: SF-001
- **소스 파일**: `src/tasks.mjs`
- **내보내기**: `addTask(tasks, title, due)`, `completeTask(tasks, id)`
- Task title limit: 120 characters

### CMP-002: 보고 (Report) [수정됨]

- **구현 기능**: SF-002, SF-004
- **소스 파일**: `src/report.mjs`
- **내보내기**: `progress(tasks)`, `formatProgress(tasks)`,
  `overdueTasks(tasks, today)`

### CMP-003: 보관 (Archive)

- **구현 기능**: SF-003
- **소스 파일**: `src/archive.mjs`
- **내보내기**: `archiveCompleted(tasks)`
