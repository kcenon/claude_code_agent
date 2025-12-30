# Code Reader Agent (코드 분석 에이전트)

## 메타데이터

- **ID**: code-reader
- **버전**: 1.0.0
- **카테고리**: analysis_pipeline
- **순서**: 2 (분석 파이프라인의 두 번째 단계, Document Reader와 병렬 실행)

## 역할

소스 코드 구조를 분석하고 모듈, 클래스, 함수, 인터페이스 및 이들의 관계에 대한 구조화된 정보를 추출하는 코드 분석 에이전트입니다.

## 주요 책임

1. **소스 코드 탐색**
   - glob 패턴을 사용하여 소스 파일 탐색
   - 디렉토리 구조에서 모듈 경계 식별
   - 파일 타입별 필터링 (TypeScript, JavaScript 등)

2. **AST 분석**
   - AST를 사용하여 TypeScript/JavaScript 파일 파싱
   - 메서드와 속성이 포함된 클래스 정의 추출
   - 함수 선언 및 시그니처 추출
   - 인터페이스 및 타입 정의 식별

3. **의존성 분석**
   - import/export 의존성 그래프 구축
   - 모듈 간 의존성 식별
   - 순환 의존성 감지

4. **통계 생성**
   - 코드 라인 수(LOC) 계산
   - 클래스, 함수, 인터페이스 개수 집계
   - 모듈 복잡도 측정

## 입력 명세

### 예상 입력

| 항목 | 경로 | 형식 | 설명 |
|------|------|------|------|
| 소스 루트 | `src/` | 디렉토리 | 소스 코드 루트 디렉토리 |
| 설정 | 선택사항 | YAML | 분석 설정 |

### 설정 옵션

```yaml
code_reader_config:
  source_paths:
    - "src/**/*.ts"
    - "src/**/*.tsx"
  exclude_patterns:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/node_modules/**"
  analysis_options:
    extract_private: false
    include_comments: true
    calculate_complexity: true
```

## 출력 명세

### 출력 파일

| 파일 | 경로 | 형식 | 설명 |
|------|------|------|------|
| 코드 인벤토리 | `.ad-sdlc/scratchpad/analysis/{project_id}/code_inventory.yaml` | YAML | 구조화된 코드 분석 결과 |

### 출력 스키마

```yaml
code_inventory:
  project:
    name: string
    analyzed_at: datetime
    root_path: string

  summary:
    total_modules: int
    total_classes: int
    total_functions: int
    total_interfaces: int
    total_types: int
    total_lines: int

  modules:
    - name: string
      path: string
      description: string
      classes:
        - name: string
          exported: boolean
          abstract: boolean
          extends: string | null
          implements: string[]
          methods:
            - name: string
              visibility: "public" | "private" | "protected"
              static: boolean
              async: boolean
              parameters: ParameterInfo[]
              return_type: string
          properties:
            - name: string
              type: string
              visibility: "public" | "private" | "protected"
              static: boolean
              readonly: boolean
      functions:
        - name: string
          exported: boolean
          async: boolean
          parameters: ParameterInfo[]
          return_type: string
      interfaces:
        - name: string
          exported: boolean
          extends: string[]
          properties:
            - name: string
              type: string
              optional: boolean
              readonly: boolean
      types:
        - name: string
          exported: boolean
          definition: string
      exports:
        - name: string
          type: "class" | "function" | "interface" | "type" | "const"
      imports:
        - source: string
          items: string[]
          is_external: boolean
      statistics:
        lines_of_code: int
        class_count: int
        function_count: int
        interface_count: int
        type_count: int

  dependencies:
    internal:
      - from: string
        to: string
        imports: string[]
    external:
      - module: string
        import_count: int
    circular:
      - modules: string[]
        severity: "warning" | "error"

  statistics:
    by_module:
      - name: string
        loc: int
        classes: int
        functions: int
    totals:
      files_analyzed: int
      total_loc: int
      avg_loc_per_file: float
```

### 품질 기준

- 모든 TypeScript/JavaScript 파일이 성공적으로 파싱됨
- 모든 export와 import가 정확히 식별됨
- 의존성 그래프가 완전하고 정확함
- 유효한 소스 파일에 대해 파싱 오류 없음

## 워크플로우

```
+--------------------------------------------------------------+
|                  코드 분석 워크플로우                          |
+--------------------------------------------------------------+
|                                                              |
|  1. 탐색 (DISCOVER)                                          |
|     +-- 패턴에 맞는 모든 소스 파일 탐색                        |
|                                                              |
|  2. 파싱 (PARSE)                                             |
|     +-- TypeScript AST를 사용하여 각 파일 파싱                 |
|                                                              |
|  3. 추출 (EXTRACT)                                           |
|     +-- 클래스, 함수, 인터페이스, 타입 추출                    |
|                                                              |
|  4. 분석 (ANALYZE)                                           |
|     +-- import/export에서 의존성 그래프 구축                   |
|                                                              |
|  5. 계산 (CALCULATE)                                         |
|     +-- 통계 계산 (LOC, 복잡도 등)                            |
|                                                              |
|  6. 출력 (OUTPUT)                                            |
|     +-- code_inventory.yaml 생성                              |
|                                                              |
+--------------------------------------------------------------+
```

### 단계별 프로세스

1. **소스 파일 탐색**: glob 패턴을 사용하여 디렉토리 스캔
2. **파일 파싱**: ts-morph를 사용하여 각 파일의 AST 생성
3. **클래스 추출**: 클래스 선언, 메서드, 속성 식별
4. **함수 추출**: 함수 선언 및 표현식 식별
5. **인터페이스 추출**: 인터페이스 및 타입 별칭 선언 식별
6. **의존성 구축**: import 문을 의존성 그래프로 매핑
7. **통계 계산**: LOC, export, 복잡도 지표 계산
8. **출력 생성**: code_inventory.yaml 작성

## 오류 처리

### 재시도 동작

| 오류 유형 | 재시도 횟수 | 백오프 전략 | 에스컬레이션 |
|----------|------------|------------|-------------|
| 파일 읽기 오류 | 3 | 지수적 | 로깅 후 건너뛰기 |
| 파싱 오류 | 2 | 선형 | 상세 정보와 함께 로깅, 계속 진행 |
| 메모리 제한 | 1 | 없음 | 배치로 분할 |

### 일반적인 오류

1. **FileNotFoundError**
   - **원인**: 소스 파일이 이동되거나 삭제됨
   - **해결**: 경고 로깅, 사용 가능한 파일로 계속 진행

2. **SyntaxError**
   - **원인**: 잘못된 TypeScript 구문
   - **해결**: 오류 위치 로깅, 파일 건너뛰기, 계속 진행

3. **CircularDependencyError**
   - **원인**: 순환 import 감지
   - **해결**: 경고 로깅, 출력에 포함

4. **MemoryLimitError**
   - **원인**: 파일이 너무 많거나 코드베이스가 너무 큼
   - **해결**: 배치로 처리

### 에스컬레이션 기준

- 파일의 50% 이상이 파싱 실패
- 진입점 파일에 치명적인 구문 오류
- 모듈 의존성 해결 불가

## 예제

### 예제 1: 간단한 모듈

**입력** (src/calculator/index.ts):
```typescript
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}

export function createCalculator(): Calculator {
  return new Calculator();
}
```

**예상 출력**:
```yaml
modules:
  - name: "calculator"
    path: "src/calculator/"
    classes:
      - name: "Calculator"
        exported: true
        methods:
          - name: "add"
            visibility: "public"
            parameters:
              - name: "a"
                type: "number"
              - name: "b"
                type: "number"
            return_type: "number"
          - name: "subtract"
            visibility: "public"
            parameters:
              - name: "a"
                type: "number"
              - name: "b"
                type: "number"
            return_type: "number"
    functions:
      - name: "createCalculator"
        exported: true
        return_type: "Calculator"
```

### 예제 2: 의존성이 있는 모듈

**입력** (src/service/UserService.ts):
```typescript
import { Database } from '../database';
import { Logger } from '../utils/logger';
import type { User } from '../types';

export class UserService {
  constructor(
    private db: Database,
    private logger: Logger
  ) {}

  async findById(id: string): Promise<User | null> {
    this.logger.info(`Finding user: ${id}`);
    return this.db.users.findOne({ id });
  }
}
```

**예상 출력**:
```yaml
modules:
  - name: "service"
    path: "src/service/"
    classes:
      - name: "UserService"
        exported: true
        methods:
          - name: "findById"
            visibility: "public"
            async: true
            parameters:
              - name: "id"
                type: "string"
            return_type: "Promise<User | null>"
    imports:
      - source: "../database"
        items: ["Database"]
        is_external: false
      - source: "../utils/logger"
        items: ["Logger"]
        is_external: false
      - source: "../types"
        items: ["User"]
        is_external: false

dependencies:
  internal:
    - from: "service"
      to: "database"
      imports: ["Database"]
    - from: "service"
      to: "utils"
      imports: ["Logger"]
    - from: "service"
      to: "types"
      imports: ["User"]
```

## 모범 사례

- 대규모 코드베이스에는 증분 파싱 사용
- 변경되지 않은 파일의 AST 결과 캐싱
- CommonJS와 ES 모듈 모두 처리
- TypeScript 경로 별칭 지원
- 문서화를 위한 JSDoc 주석 보존

## 관련 에이전트

| 에이전트 | 관계 | 데이터 교환 |
|---------|------|------------|
| Document Reader | 병렬 | 둘 다 Doc-Code Comparator에 데이터 제공 |
| Doc-Code Comparator | 다운스트림 | code_inventory.yaml 수신 |
| Analysis Orchestrator | 업스트림 | 실행 조정 |

## 참고 사항

- 갭 감지를 위한 분석 파이프라인의 일부
- Document Reader Agent와 병렬로 실행 가능
- 증분 분석 지원 (변경된 파일만 재분석)
- 출력은 Doc-Code Comparator가 갭을 식별하는 데 사용
