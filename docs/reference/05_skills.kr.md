# 스킬 시스템 레퍼런스

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## 목차

1. [스킬 개요](#스킬-개요)
2. [스킬 구조](#스킬-구조)
3. [SKILL.md 작성](#skillmd-작성)
4. [스킬 vs 슬래시 명령](#스킬-vs-슬래시-명령)
5. [실전 예제](#실전-예제)
6. [베스트 프랙티스](#베스트-프랙티스)

---

## 스킬 개요

### 스킬이란?

스킬(Skills)은 Claude의 기능을 확장하는 모듈화된 기능 단위입니다. 지침, 스크립트, 리소스를 담은 디렉토리로 구성됩니다.

### 스킬 호출 방식

| 호출 방식 | 설명 |
|-----------|------|
| **모델 호출** | Claude가 작업에 적합하다고 판단하면 자동 호출 |
| **명시적 호출** | 사용자가 스킬 이름으로 직접 호출 |

### 스킬 위치

| 위치 | 경로 | 공유 |
|------|------|------|
| 개인 | `~/.claude/skills/skill-name/` | 개인 전용 |
| 프로젝트 | `.claude/skills/skill-name/` | Git으로 팀 공유 |
| 플러그인 | 플러그인 패키지 내 | 플러그인과 함께 |

---

## 스킬 구조

### 기본 디렉토리 구조

```
my-skill/
├── SKILL.md              # 필수: 스킬 정의 및 지침
├── reference.md          # 선택: 참조 문서
├── examples.md           # 선택: 사용 예제
├── templates/            # 선택: 템플릿 파일
│   ├── component.tsx
│   └── test.ts
└── scripts/              # 선택: 보조 스크립트
    ├── helper.py
    └── validate.sh
```

### 파일 역할

| 파일 | 필수 | 설명 |
|------|------|------|
| `SKILL.md` | ✅ | 스킬 이름, 설명, 지침 정의 |
| `reference.md` | ❌ | 추가 참조 정보 |
| `examples.md` | ❌ | 구체적 사용 예제 |
| `templates/` | ❌ | 코드/설정 템플릿 |
| `scripts/` | ❌ | 자동화 스크립트 |

---

## SKILL.md 작성

### 기본 형식

```markdown
---
name: my-awesome-skill
description: 이 스킬의 목적과 언제 사용하는지 상세히 설명합니다.
allowed-tools: Read, Grep, Glob
---

# My Awesome Skill

## 목적
이 스킬은 [목적]을 위해 설계되었습니다.

## 사용 시기
- [상황 1]
- [상황 2]
- [상황 3]

## 지침

### 단계 1: [제목]
[상세 지침]

### 단계 2: [제목]
[상세 지침]

## 주의사항
- [주의사항 1]
- [주의사항 2]

## 예제
[구체적인 사용 예제]
```

### 프론트매터 필드

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | ✅ | 스킬 고유 이름 |
| `description` | ✅ | 상세 설명 (Claude가 호출 판단에 사용) |
| `allowed-tools` | ❌ | 허용 도구 제한 |
| `disable-model-invocation` | ❌ | 자동 호출 비활성화 |

### description 작성 팁

```markdown
# 좋은 예
description: |
  React 컴포넌트 테스트 작성 스킬입니다.
  Jest와 React Testing Library를 사용합니다.
  단위 테스트, 통합 테스트, 스냅샷 테스트를 지원합니다.
  "테스트 작성", "컴포넌트 테스트", "Jest 테스트" 키워드에 반응합니다.

# 나쁜 예
description: 테스트 작성  # 너무 모호함
```

### allowed-tools 활용

```yaml
---
name: code-review
description: 코드 리뷰 전용 스킬 (읽기만 수행)
allowed-tools: Read, Grep, Glob  # 쓰기 도구 제외
---
```

---

## 스킬 vs 슬래시 명령

### 비교

| 특성 | 스킬 | 슬래시 명령 |
|------|------|-------------|
| 호출 방식 | 모델이 판단 | 사용자가 `/명령` 입력 |
| 복잡도 | 높음 (다중 파일, 스크립트) | 낮음 (단일 프롬프트) |
| 구조 | 디렉토리 | 단일 .md 파일 |
| 용도 | 복잡한 워크플로우 | 빠른 프롬프트 |

### 언제 스킬을 사용?

- 복잡한 다단계 작업
- 템플릿이나 스크립트 필요
- 팀 표준화가 필요한 워크플로우
- 자동 호출이 바람직한 경우

### 언제 슬래시 명령을 사용?

- 단순한 단일 프롬프트
- 명시적 호출만 필요
- 빠른 설정이 필요

---

## 실전 예제

### 1. 코드 리뷰 스킬

**.claude/skills/code-review/SKILL.md:**

```markdown
---
name: code-review
description: |
  전문적인 코드 리뷰를 수행합니다.
  코드 품질, 보안, 성능, 베스트 프랙티스를 검토합니다.
  "코드 리뷰", "리뷰", "PR 리뷰" 키워드에 반응합니다.
allowed-tools: Read, Grep, Glob
---

# 코드 리뷰 스킬

## 목적
변경된 코드에 대한 포괄적인 리뷰를 제공합니다.

## 리뷰 체크리스트

### 1. 코드 품질
- 가독성: 변수명, 함수명이 명확한가?
- 구조: 함수가 단일 책임을 가지는가?
- 중복: DRY 원칙을 따르는가?
- 복잡도: 과도하게 복잡하지 않은가?

### 2. 보안
- 입력 검증이 되어 있는가?
- SQL 인젝션, XSS 취약점이 없는가?
- 민감한 정보가 하드코딩되어 있지 않은가?
- 인증/인가가 적절히 구현되어 있는가?

### 3. 성능
- 불필요한 연산이 없는가?
- N+1 쿼리 문제가 없는가?
- 메모리 누수 가능성이 없는가?

### 4. 테스트
- 테스트 커버리지가 충분한가?
- 엣지 케이스가 테스트되는가?

## 출력 형식

리뷰 결과를 다음 형식으로 정리하세요:

### 요약
[전체적인 코드 품질 요약]

### 주요 이슈 (심각도: 높음)
1. [이슈 설명] - [파일:라인]
   - 문제점: ...
   - 해결방안: ...

### 개선 제안 (심각도: 중간)
1. [제안 설명] - [파일:라인]

### 칭찬할 점
1. [좋은 코드 패턴]
```

### 2. 테스트 작성 스킬

**.claude/skills/test-writer/SKILL.md:**

```markdown
---
name: test-writer
description: |
  코드에 대한 테스트를 작성합니다.
  Jest, pytest, JUnit 등 주요 테스트 프레임워크를 지원합니다.
  "테스트 작성", "테스트 추가", "유닛 테스트" 키워드에 반응합니다.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# 테스트 작성 스킬

## 지원 프레임워크
- JavaScript/TypeScript: Jest, Vitest, Mocha
- Python: pytest, unittest
- Java/Kotlin: JUnit, Kotest

## 테스트 작성 원칙

### AAA 패턴
```
Arrange: 테스트 데이터 준비
Act: 테스트 대상 실행
Assert: 결과 검증
```

### 테스트 범위
1. 정상 케이스 (Happy Path)
2. 엣지 케이스 (경계값)
3. 에러 케이스 (예외 상황)
4. 널/빈 값 처리

## 단계별 지침

### 1. 기존 테스트 구조 파악
- 테스트 디렉토리 구조 확인
- 사용 중인 테스트 프레임워크 확인
- 기존 테스트 패턴 분석

### 2. 테스트 대상 분석
- 공개 API 식별
- 의존성 파악
- 모킹 필요 여부 결정

### 3. 테스트 작성
- 파일명 규칙 준수 (*.test.ts, *_test.py 등)
- describe/it 구조로 그룹화
- 명확한 테스트 설명

### 4. 검증
- 테스트 실행 및 통과 확인
- 커버리지 확인
```

**.claude/skills/test-writer/templates/jest.ts:**

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('{{ComponentName}}', () => {
  beforeEach(() => {
    // 테스트 전 설정
  });

  afterEach(() => {
    // 테스트 후 정리
    jest.clearAllMocks();
  });

  describe('{{methodName}}', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = {};

      // Act
      const result = {{methodName}}(input);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle edge case', () => {
      // 엣지 케이스 테스트
    });

    it('should throw error for invalid input', () => {
      // 에러 케이스 테스트
      expect(() => {{methodName}}(null)).toThrow();
    });
  });
});
```

### 3. API 문서화 스킬

**.claude/skills/api-docs/SKILL.md:**

```markdown
---
name: api-docs
description: |
  API 엔드포인트 문서화 스킬입니다.
  OpenAPI/Swagger 형식 또는 Markdown 형식으로 문서를 생성합니다.
  "API 문서", "문서화", "Swagger", "OpenAPI" 키워드에 반응합니다.
allowed-tools: Read, Write, Glob, Grep
---

# API 문서화 스킬

## 문서화 범위

### 각 엔드포인트별
- HTTP 메서드 및 경로
- 설명
- 요청 파라미터 (path, query, body)
- 응답 형식 및 상태 코드
- 인증 요구사항
- 예제 요청/응답

## 출력 형식

### Markdown 형식
```md
## GET /api/users/{id}

사용자 정보를 조회합니다.

### 파라미터

| 이름 | 위치 | 타입 | 필수 | 설명 |
|------|------|------|------|------|
| id | path | string | Yes | 사용자 ID |

### 응답

**200 OK**
```json
{
  "id": "user123",
  "name": "홍길동",
  "email": "hong@example.com"
}
```

**404 Not Found**
```json
{
  "error": "User not found"
}
```
```
```

### 4. 보안 감사 스킬

**.claude/skills/security-audit/SKILL.md:**

```markdown
---
name: security-audit
description: |
  보안 취약점 감사 스킬입니다.
  OWASP Top 10 취약점을 중심으로 검사합니다.
  "보안 감사", "취약점 검사", "보안 리뷰" 키워드에 반응합니다.
allowed-tools: Read, Grep, Glob
---

# 보안 감사 스킬

## 검사 항목

### OWASP Top 10

1. **A01: Broken Access Control**
   - 권한 검사 누락
   - 직접 객체 참조 취약점

2. **A02: Cryptographic Failures**
   - 하드코딩된 시크릿
   - 취약한 암호화 알고리즘

3. **A03: Injection**
   - SQL Injection
   - Command Injection
   - XSS

4. **A04: Insecure Design**
   - 누락된 인증
   - 비즈니스 로직 취약점

5. **A05: Security Misconfiguration**
   - 디버그 모드 활성화
   - 기본 자격 증명

6. **A06: Vulnerable Components**
   - 알려진 취약 라이브러리

7. **A07: Authentication Failures**
   - 취약한 비밀번호 정책
   - 세션 관리 문제

8. **A08: Data Integrity Failures**
   - 안전하지 않은 역직렬화

9. **A09: Logging Failures**
   - 민감 정보 로깅
   - 로깅 누락

10. **A10: SSRF**
    - 서버 사이드 요청 위조

## 보고서 형식

### 요약
- 심각: X건
- 경고: X건
- 정보: X건

### 상세 발견사항

#### [심각도] 취약점 제목
- **위치**: 파일:라인
- **설명**: 취약점 상세 설명
- **영향**: 악용 시 영향
- **권장 조치**: 수정 방법
```

---

## 베스트 프랙티스

### 1. 설명은 구체적으로

```yaml
# 좋음
description: |
  React 컴포넌트 테스트 작성 스킬.
  Jest와 React Testing Library 사용.
  "컴포넌트 테스트", "React 테스트", "Jest" 키워드에 반응.

# 나쁨
description: 테스트 작성
```

### 2. 스킬은 단일 목적으로

```
# 좋음
code-review/     # 코드 리뷰만
test-writer/     # 테스트 작성만
api-docs/        # API 문서만

# 나쁨
everything/      # 모든 것 (너무 큼)
```

### 3. allowed-tools로 범위 제한

```yaml
# 읽기 전용 스킬
allowed-tools: Read, Grep, Glob

# 쓰기 필요 스킬
allowed-tools: Read, Write, Edit, Glob, Grep
```

### 4. 템플릿 활용

```
my-skill/
└── templates/
    ├── component.tsx     # 컴포넌트 템플릿
    ├── test.ts           # 테스트 템플릿
    └── README.md         # 문서 템플릿
```

### 5. 버전 관리

```markdown
---
name: my-skill
version: 1.2.0
description: ...
---

## 변경 이력
- 1.2.0: 새 기능 추가
- 1.1.0: 버그 수정
- 1.0.0: 초기 릴리즈
```

### 6. 팀과 공유

```bash
# 프로젝트 스킬로 커밋
git add .claude/skills/my-skill/
git commit -m "feat: add my-skill"
git push
```

---

*이전: [MCP 통합](04_mcp.md) | 다음: [설정 가이드](06_configuration.md)*
