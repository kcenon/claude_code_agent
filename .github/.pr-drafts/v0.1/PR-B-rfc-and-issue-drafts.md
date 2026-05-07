# docs(architecture): add v0.1 Hybrid Pipeline RFC + 22 issue drafts

> **PR Track**: B (parent RFC, large but doc-only)
> **Branch**: `docs/v01-rfc-and-drafts`
> **Base**: `develop`
> **Closes**: AD-01, AD-02 (issue drafts 자체)
> **Related**: PR-A (병렬 진행)

## What

AD-SDLC v0.0.1 → v0.1.0 마이그레이션의 부모 RFC와 22개 후속 이슈 드래프트를 docs-only PR로 도입합니다. 코드 변경 0건 — 본 PR은 **합의의 컨테이너**.

### 변경 파일 요약 (25 files, +2,196 LoC)

| 디렉터리 | 파일 수 | 역할 |
|---|---|---|
| `docs/architecture/` | 2 | RFC 본문 + 마이그레이션 가이드 |
| `.github/.issue-drafts/v0.1/` | 23 | INDEX.md + 22 issue drafts (AD-01 ~ AD-22) |

### 변경 파일 목록

```
docs/architecture/v0.1-hybrid-pipeline-rfc.md    (신규, ~250 lines)
docs/architecture/v0.1-migration-guide.md         (신규, ~120 lines)
.github/.issue-drafts/v0.1/INDEX.md               (신규, 마스터 인덱스)
.github/.issue-drafts/v0.1/AD-01.md ~ AD-22.md    (신규, 5W1H 이슈 드래프트 22개)
```

## Why

`v0.0.1` 분석 결과 (3 round-trip 결과 본 PR 산출):

1. **진실성 갭**: README는 "built with Claude Agent SDK"이나 의존성은 raw `@anthropic-ai/sdk@^0.92.0`만
2. **자산 미활용**: 같은 호스트에 있는 `claude-config` v2.3.0 plugin (8 agents + 7 skills + global hooks)이 코드 경로상 미결합
3. **사양 위반 잠복**: `.claude/agents/doc-code-comparator.md` frontmatter 누락 (PR-A에서 별도 fix)

본 RFC는 위 3가지를 **하이브리드 아키텍처**로 해소합니다:
- 도메인 자산(35단계 SDLC 파이프라인·V&V·트레이서빌리티)은 보존
- 에이전트 실행만 `@anthropic-ai/claude-agent-sdk`에 위임 (~2,000 LoC 슬림화)
- claude-config plugin을 `skills:` frontmatter로 표준 결합

## Who

- **Reviewers**: 코어 메인테이너 2 (architecture, docs)
- **Approval**: LGTM ≥ 1 (RFC 채택 결정)
- **Optional reviewers**: 외부 사용자 대표(베타) 1, claude-config 메인테이너 1

## When

- 발의: 2026-05-07
- 검토 deadline: +5 영업일 (2026-05-14)
- 머지 후: 22개 이슈 일괄 게시 (`gh issue create --body-file ...`)

## Where

- `docs/architecture/`
- `.github/.issue-drafts/v0.1/`

## How

### 새 3-Tier 아키텍처

```
T1 Pipeline Control Plane (도메인, 유지)
   ├ AdsdlcOrchestratorAgent (stage DAG)
   ├ PipelineCheckpointManager (mid-stage resume)
   ├ ArtifactValidator + V&V (stage-verifier, rtm-builder, doc-audit)
   ├ Writers / Analyzers / Updaters (35 agents)
   └ Scratchpad (File / SQLite / Redis)
                ↓
T2 Agent Execution Layer (신규, 얇음)
   ├ ExecutionAdapter (단일 SDK 진입점)
   ├ Hook Pipeline (PostToolUse → scratchpad/OTel)
   └ Telemetry Bridge
                ↓
T3 Knowledge Layer (외부 자산, 표준 결합)
   ├ .claude/agents/*.md (35, 100% frontmatter)
   ├ .claude/skills/  (claude-config plugin 흡수)
   ├ .claude/commands/  (신규)
   ├ .mcp.json (github MCP)
   └ claude-config v2.3.0 plugin (별도 설치)
```

### 5 Phase 마이그레이션

| Phase | 이슈 | 게이트 |
|---|---|---|
| **P0 Docs** | AD-01, AD-02 | RFC LGTM ≥ 1 |
| **P1 Foundation** | AD-03 ~ AD-08 | 기존 테스트 100% + Adapter 단위 테스트 |
| **P2 Pilot** | AD-09 ~ AD-12 | worker stage 산출물 동등 |
| **P3 Cutover** | AD-13 ~ AD-17 | E2E 3종 + 코드 -2,000 LoC |
| **P4 Knowledge** | AD-18 ~ AD-22 | plugin enable 시나리오 통과 |

### 주요 인터페이스 (RFC §4 발췌)

```typescript
export interface ExecutionAdapter {
  execute(req: StageExecutionRequest): Promise<StageExecutionResult>;
  dispose(): Promise<void>;
}
```

### 측정 지표 목표

| 지표 | 베이스라인 | 목표 |
|---|---|---|
| 자체 에이전트 인프라 LoC | ~2,000 | ≤ 200 |
| `.claude/agents` frontmatter 준수율 | 33/34 (97%) | 35/35 (100%) |
| claude-config skill 활용 | 0 | ≥ 3 |
| MCP server 활용 | 0 | ≥ 1 |

### Acceptance Criteria (이 PR)

- [x] `docs/architecture/v0.1-hybrid-pipeline-rfc.md` 작성 (10 섹션, mermaid 다이어그램 포함)
- [x] `docs/architecture/v0.1-migration-guide.md` 작성 (사용자·기여자 영향, 롤백, FAQ)
- [x] `.github/.issue-drafts/v0.1/INDEX.md` 작성 (의존 그래프 + 발행 절차)
- [x] 22개 이슈 드래프트 모두 frontmatter + 5W1H 5섹션 충족
- [x] INDEX.md mermaid 노드 수와 이슈 수 일치 (22)
- [x] 모든 이슈에 `depends_on`/`blocks` 명시
- [ ] 외부 링크 모두 200 OK (CI에서 자동 검증, 옵션)
- [ ] mermaid 미리보기 정상 (GitHub PR 미리보기 검토)

### Test Plan

이 PR은 docs-only — 코드 테스트 무관.

- [ ] markdown lint 통과
- [ ] mermaid 다이어그램 미리보기 정상
- [ ] 본문 내 cross-link 동작 (RFC ↔ 마이그레이션 가이드 ↔ 이슈 드래프트)

### 리뷰 가이드

리뷰어가 큰 PR(25 files)을 효율적으로 검토할 수 있도록 권장 순서:

1. **`docs/architecture/v0.1-hybrid-pipeline-rfc.md`** — 본 PR의 본질
2. **`.github/.issue-drafts/v0.1/INDEX.md`** — 의존 그래프와 phase gate
3. **샘플 이슈 1개씩 phase별** (예: AD-04, AD-06, AD-09, AD-13, AD-19) — 5W1H 품질 검증
4. **`docs/architecture/v0.1-migration-guide.md`** — 외부 사용자 영향
5. **나머지 이슈 드래프트** — skim 또는 머지 후 게시 시점 추가 보완

### 머지 후 작업

```bash
# 22개 이슈 일괄 게시 (예시)
cd /project/claude_code_agent
for n in 01 02 04 05 03 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22; do
  title=$(awk -F'"' '/^title:/{print $2}' .github/.issue-drafts/v0.1/AD-$n.md)
  labels=$(grep -oP '(?<=labels: \[).*?(?=\])' .github/.issue-drafts/v0.1/AD-$n.md)
  gh issue create \
    --title "$title" \
    --body-file ".github/.issue-drafts/v0.1/AD-$n.md" \
    --label "$labels"
done
```

## Linked Items

- Track A 병렬 PR: `fix(agents): doc-code-comparator.md frontmatter` (PR-A)
- 후속: 22 issue drafts → 머지 후 GitHub 이슈로 발행
- 외부 레포 후속: `claude-config:docs/ad-sdlc-integration.md` 갱신 PR (AD-22)

## Reviewer Checklist

- [ ] RFC §3 3-tier 분리가 명확하고 책임 경계 자연스러움
- [ ] §4 인터페이스 시그니처가 TypeScript에서 실제로 컴파일 가능
- [ ] §5 변경 영향 매트릭스의 LoC 추정이 합리적
- [ ] §6 5 phase가 각각 독립 mergeable + revertible
- [ ] §7 위험 등록부 R1~R5의 완화책이 구체적
- [ ] 22개 이슈 드래프트 의존 그래프(INDEX.md)에 사이클 없음
- [ ] 각 이슈가 ≤ 2-3일 작업으로 추정 가능 (size/L인 AD-13만 sub-PR 5개로 분할 명시)
- [ ] AI/Claude attribution 0건 (Commit Settings 준수)
