# fix(agents): doc-code-comparator.md frontmatter 추가 + CI 검증 step

> **PR Track**: A (urgent surgical fix)
> **Branch**: `fix/doc-code-comparator-frontmatter`
> **Base**: `develop`
> **Closes**: AD-04 (issue draft: `.github/.issue-drafts/v0.1/AD-04.md`)

## What

Claude Code 공식 사양상 필수인 **YAML frontmatter**가 누락되어 있던 `.claude/agents/doc-code-comparator.md`에 frontmatter를 추가하고, 동일 위반 재발을 막기 위한 **CI 검증 job**을 `docs-check.yml`에 추가합니다.

### 변경 파일

| 파일 | 변경 |
|---|---|
| `.claude/agents/doc-code-comparator.md` | frontmatter 추가 (15줄) |
| `.github/workflows/docs-check.yml` | `validate-agent-frontmatter` job 추가 + path trigger 확장 |

## Why

- 공식 사양: subagent는 YAML frontmatter(`name`/`description` 필수) 보유 필수
  - https://code.claude.com/docs/en/sub-agents §"Write subagent files"
- 현재 동작: `head -1 doc-code-comparator.md`가 `# Doc-Code Comparator Agent` → Claude Code가 subagent로 인식 불가
- 영향: Enhancement 파이프라인에서 본 에이전트 invoke 시 fallback prompt(generic)으로 동작 → 분석 품질 저하
- v0.1 마이그레이션의 RFC(`docs/architecture/v0.1-hybrid-pipeline-rfc.md`)와 무관하게 즉시 처리해야 할 사양 위반 — 별도 PR로 분리

## Who

- **Reviewers**: 코어 메인테이너 1, doc-code-comparator 도메인 1 (선택)
- **Approval**: LGTM ≥ 1

## When

- 발의: 2026-05-07
- merge ASAP — RFC PR과 독립

## Where

- `.claude/agents/doc-code-comparator.md`
- `.github/workflows/docs-check.yml`

## How

### 적용된 frontmatter

```yaml
---
name: doc-code-comparator
description: |
  Doc-Code Comparator Agent. Analyzes the gap between documentation specifications
  and actual code implementations. Detects discrepancies, missing implementations,
  and undocumented code, generating actionable gap analysis with confidence scores.
  Use this agent in the Enhancement pipeline after Document Reader and Code Reader
  to produce gap_analysis.yaml.
tools:
  - Read
  - Write
  - Glob
  - Grep
model: inherit
---
```

- 패턴: sibling 에이전트(`impact-analyzer.md`, `codebase-analyzer.md`)와 동일
- tools: 본문이 명시한 작업(읽기·검색·매핑·점수 계산)에 필요한 4개만 allowlist (Bash 미포함)
- model: 다른 33개 에이전트와 일관되게 `inherit`

### 추가된 CI job (`docs-check.yml`)

`validate-agent-frontmatter`:
1. 모든 `.claude/agents/*.md`의 첫 줄이 `---`인지 검증 → 누락 시 fail
2. frontmatter 안에 `name`/`description` 필드 존재 검증 → 누락 시 fail
3. trigger path에 `.claude/agents/**` 추가하여 향후 같은 회귀 자동 감지

### Acceptance Criteria

- [x] frontmatter 추가됨 (`---`로 시작, 15줄)
- [x] `name: doc-code-comparator` (kebab-case)
- [x] `description`에 위임 트리거 키워드("Use this agent") 포함
- [x] `tools` 리스트가 본문 작업에 매칭
- [x] `model: inherit` (project-initializer 외 일관)
- [x] 다른 에이전트 변경 0
- [x] CI 검증 step 추가
- [x] 로컬 검증 — 34/34 frontmatter 보유, 34/34 name+description 보유 (Python script)

### Test Plan

- [x] 로컬 검증: `python3 -c "..."` 결과 34/34 통과
- [ ] CI: `validate-agent-frontmatter` job 그린
- [ ] CI: 기존 `validate-traceability`/`check-cascade` job 회귀 0
- [ ] (선택) Enhancement 파이프라인 dry-run에서 doc-code-comparator stage가 실제 정의 로드 확인

### Risks & Mitigation

- **R1**: tools 리스트가 부족해 도구 호출 거부될 가능성
  - 완화: 본문 §Capabilities/Process가 file I/O와 grep만 명시 — 충분
  - escape hatch: 이슈 발생 시 hot-fix로 Bash 추가
- **R2**: CI step의 zsh 호환성
  - 완화: GitHub Actions는 bash 사용 — `set -euo pipefail` + `[ ... ]` 표준 POSIX 구문 사용

### Out of Scope

- 본문 콘텐츠 변경
- 다른 에이전트의 frontmatter 표준화 (이미 33개 모두 보유)
- AD-05 네이밍 정합화 (별도 PR)
- v0.1 RFC (별도 PR)

## Linked Issues

- Closes: AD-04 (이슈 발행 후 번호 채움)
- Related: AD-05 (`validation` 에이전트 네이밍 — 동일 사양 컴플라이언스 영역)
- Parent context: `docs/architecture/v0.1-hybrid-pipeline-rfc.md` (별도 PR로 진행 중)

## Reviewer Checklist

- [ ] frontmatter 필드가 sibling 에이전트와 일관 (`impact-analyzer.md` 비교)
- [ ] CI job이 의도대로 동작 — 새 PR에서 `head -1`이 `---` 아닌 .md 추가 시 fail 확인 (옵션 — 별도 검증 PR로 시뮬레이션 가능)
- [ ] 변경 라인 수 ≤ 50 (실제: 약 18라인 + CI job 약 35라인)
- [ ] 본 PR이 v0.1 RFC PR과 독립 — 머지 순서 무관
