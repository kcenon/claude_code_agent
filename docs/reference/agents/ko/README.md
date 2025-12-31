# 에이전트 참조 문서 (한국어)

> **버전**: 1.0.0
> **최종 업데이트**: 2025-01-01

## 개요

이 디렉토리는 AD-SDLC 에이전트에 대한 한국어 참조 문서를 포함합니다.

> **참고**: 이 문서들은 참조용으로만 제공됩니다. 실제 에이전트 정의 파일은 `.claude/agents/`에 있습니다.

---

## 에이전트 카테고리

### 문서 생성 파이프라인

| 에이전트 | 파일 | 설명 |
|----------|------|------|
| Collector | [collector.md](./collector.md) | 다양한 소스에서 요구사항 수집 |
| PRD Writer | [prd-writer.md](./prd-writer.md) | 제품 요구사항 문서 생성 |
| SRS Writer | [srs-writer.md](./srs-writer.md) | 소프트웨어 요구사항 명세 생성 |
| SDS Writer | [sds-writer.md](./sds-writer.md) | 소프트웨어 설계 명세 생성 |

### 인프라 파이프라인

| 에이전트 | 파일 | 설명 |
|----------|------|------|
| Project Initializer | [project-initializer.md](./project-initializer.md) | .ad-sdlc 디렉토리 구조 및 설정 파일 생성 |
| Mode Detector | [mode-detector.md](./mode-detector.md) | Greenfield vs Enhancement 모드 감지 |
| GitHub Repo Setup | [github-repo-setup.md](./github-repo-setup.md) | GitHub 저장소 생성 및 구성 |

### 실행 파이프라인

| 에이전트 | 파일 | 설명 |
|----------|------|------|
| Issue Reader | [issue-reader.md](./issue-reader.md) | 기존 GitHub 이슈 가져오기 |
| Issue Generator | [issue-generator.md](./issue-generator.md) | GitHub 이슈 생성 |
| Controller | [controller.md](./controller.md) | 작업 분배 조율 |
| Worker | [worker.md](./worker.md) | 이슈에 대한 코드 구현 |
| PR Reviewer | [pr-reviewer.md](./pr-reviewer.md) | PR 검토 및 병합 |
| CI Fixer | [ci-fixer.md](./ci-fixer.md) | CI 실패 자동 진단 및 수정 |
| Code Reader | [code-reader.md](./code-reader.md) | 코드 인벤토리 추출 |

---

## 문서 구조

각 에이전트 문서는 다음 구조를 따릅니다:

- **역할**: 에이전트의 목적
- **주요 책임**: 핵심 기능
- **입력/출력**: 데이터 형식
- **워크플로우**: 처리 단계
- **오류 처리**: 에러 대응 방법
- **예시**: 사용 예제

---

## 영어 문서

영어 버전은 [상위 디렉토리](../)에서 확인할 수 있습니다.

---

*[AD-SDLC 참조 문서](../../README.md)의 일부*
