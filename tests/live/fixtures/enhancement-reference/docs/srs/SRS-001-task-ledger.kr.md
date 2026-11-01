# SRS-001: Task Ledger

| 항목 | 값    |
| ---- | ----- |
| 버전 | 1.1.0 |

## 1. 소개

이 문서는 Task Ledger의 소프트웨어 기능을 정의합니다. 각 기능은 구현하는 제품
요구사항과 이를 실현하는 컴포넌트를 명시합니다.

## 3. 시스템 기능

### SF-001: 작업 추적 (Task tracking)

- **출처**: FR-001
- **실현 컴포넌트**: CMP-001
- **설명**: `addTask`는 다음 식별자로 미완료 작업을 추가하고, `completeTask`는
  작업 하나를 완료로 표시합니다. 둘 다 입력을 변경하지 않습니다.
- Task title limit: 120 characters

### SF-002: 진행 상황 보고 (Progress reporting)

- **출처**: FR-002
- **실현 컴포넌트**: CMP-002
- **설명**: `progress`는 전체, 완료, 미완료 수를 반환하고, `formatProgress`는
  이를 `2 of 5 tasks done` 같은 한 줄로 반환합니다.

### SF-003: 작업 보관 (Task archiving)

- **출처**: FR-003
- **실현 컴포넌트**: CMP-003
- **설명**: `archiveCompleted`는 활성 목록과 완료 작업을 담은 보관함을 반환합니다.

### SF-004: 기한 초과 보고 (Overdue report) [신규]

- **출처**: FR-004
- **실현 컴포넌트**: CMP-002
- **설명**: `overdueTasks`는 지정한 날 이전이 마감일인 미완료 작업을 마감일이 이른
  순서와 낮은 식별자 순서로 반환하며, 입력을 변경하지 않습니다.
