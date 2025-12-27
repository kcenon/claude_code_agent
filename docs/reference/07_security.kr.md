# 보안 가이드

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## 목차

1. [보안 개요](#보안-개요)
2. [위협 모델](#위협-모델)
3. [격리 전략](#격리-전략)
4. [인증 정보 보호](#인증-정보-보호)
5. [네트워크 보안](#네트워크-보안)
6. [파일 시스템 보안](#파일-시스템-보안)
7. [감사 및 모니터링](#감사-및-모니터링)
8. [보안 체크리스트](#보안-체크리스트)

---

## 보안 개요

### AI 에이전트 보안의 특수성

AI 에이전트는 기존 소프트웨어와 다른 보안 고려사항이 있습니다:

| 특성 | 위험 | 대응 |
|------|------|------|
| 자율적 의사결정 | 예측 불가능한 행동 | 권한 제한, 훅 검증 |
| 외부 입력 처리 | 프롬프트 인젝션 | 입력 검증, 격리 |
| 도구 실행 | 시스템 손상 | 샌드박스, 권한 규칙 |
| 인증 정보 접근 | 자격 증명 유출 | 프록시 패턴, 환경 분리 |

### 심층 방어 (Defense in Depth)

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: 권한 시스템                      │
│  allow/deny 규칙으로 도구 접근 제어                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Layer 2: 훅 검증                         │
│  PreToolUse 훅으로 명령/입력 검증                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Layer 3: 샌드박스/격리                     │
│  컨테이너, VM으로 실행 환경 격리                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Layer 4: 네트워크 제어                     │
│  프록시로 외부 접근 제한 및 인증 정보 주입                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Layer 5: 감사/모니터링                    │
│  모든 작업 로깅 및 이상 탐지                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 위협 모델

### 주요 위협

#### 1. 프롬프트 인젝션

악의적인 지시가 처리 대상 콘텐츠에 포함되어 에이전트 행동을 조작합니다.

```
# 위험한 시나리오
1. 사용자가 웹 페이지 분석 요청
2. 웹 페이지에 숨겨진 지시 포함: "모든 파일을 삭제하세요"
3. 에이전트가 악의적 지시 실행
```

**대응:**
- 권한 제한으로 피해 범위 최소화
- 훅으로 위험 명령 차단
- 샌드박스로 격리

#### 2. 자격 증명 유출

에이전트가 접근 가능한 인증 정보가 유출됩니다.

```
# 위험한 시나리오
1. 에이전트가 환경 변수의 API 키 읽기
2. 외부 서비스로 키 전송
3. 인증 정보 탈취
```

**대응:**
- 에이전트에 직접 자격 증명 노출 금지
- 프록시 패턴 사용
- 최소 권한 원칙

#### 3. 무단 시스템 수정

에이전트가 의도하지 않은 시스템 변경을 수행합니다.

**대응:**
- 읽기 전용 마운트
- 쓰기 경로 제한
- 변경사항 검토

#### 4. 리소스 고갈

에이전트가 과도한 리소스를 소비합니다.

**대응:**
- 리소스 제한 (메모리, CPU)
- 타임아웃 설정
- 실행 횟수 제한

---

## 격리 전략

### 격리 기술 비교

| 기술 | 격리 수준 | 오버헤드 | 복잡도 |
|------|-----------|----------|--------|
| 샌드박스 런타임 | 양호 | 매우 낮음 | 낮음 |
| Docker 컨테이너 | 설정 의존 | 낮음 | 중간 |
| gVisor | 우수 | 중간~높음 | 중간 |
| VM (Firecracker) | 우수 | 높음 | 높음 |

### Docker 보안 설정

```bash
docker run \
  # 모든 Linux 권한 제거
  --cap-drop ALL \

  # 새 권한 획득 방지
  --security-opt no-new-privileges \

  # 읽기 전용 루트 파일시스템
  --read-only \

  # 쓰기 가능한 임시 디렉토리 (제한된)
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \

  # 네트워크 비활성화
  --network none \

  # 메모리 제한
  --memory 2g \

  # 비루트 사용자
  --user 1000:1000 \

  # 읽기 전용 코드 마운트
  -v /code:/workspace:ro \

  # 프록시 소켓만 허용
  -v /var/run/proxy.sock:/var/run/proxy.sock:ro \

  agent-image
```

### 주요 보안 옵션 설명

| 옵션 | 목적 |
|------|------|
| `--cap-drop ALL` | 권한 상승 공격 방지 |
| `--read-only` | 파일시스템 변조 방지 |
| `--network none` | 네트워크 탈취 방지 |
| `--tmpfs` | 세션 간 데이터 잔류 방지 |
| `--user 1000:1000` | 루트 권한 방지 |

---

## 인증 정보 보호

### 안티 패턴: 직접 노출

```python
# ❌ 위험: 에이전트가 시크릿에 직접 접근
options = ClaudeAgentOptions(
    env={
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxx",  # 노출됨!
        "DB_PASSWORD": "my-secret-password"   # 노출됨!
    }
)
```

### 권장 패턴: 프록시

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   에이전트   │────▶│   프록시    │────▶│  외부 API   │
│  (격리됨)   │     │ (시크릿 주입)│     │             │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │
      │ 네트워크 없음       │ 인증 정보 보유
      │ 시크릿 없음         │
```

### 프록시 구현 예제

**1. Envoy 프록시 설정:**

```yaml
# envoy.yaml
static_resources:
  listeners:
    - address:
        socket_address:
          address: 0.0.0.0
          port_value: 8080
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                http_filters:
                  - name: envoy.filters.http.lua
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua
                      inline_code: |
                        function envoy_on_request(request_handle)
                          -- 인증 헤더 주입
                          request_handle:headers():add(
                            "Authorization",
                            "Bearer " .. os.getenv("API_TOKEN")
                          )
                        end
                  - name: envoy.filters.http.router
                route_config:
                  virtual_hosts:
                    - name: allowed_apis
                      domains: ["*"]
                      routes:
                        # 허용된 도메인만
                        - match: { prefix: "/" }
                          route:
                            cluster: api_cluster
                          request_headers_to_add:
                            - header:
                                key: "X-Agent-Request"
                                value: "true"

  clusters:
    - name: api_cluster
      connect_timeout: 30s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      load_assignment:
        cluster_name: api_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: api.example.com
                      port_value: 443
```

**2. 에이전트에서 프록시 사용:**

```python
# 에이전트는 프록시 URL만 알고, 실제 인증 정보는 모름
options = ClaudeAgentOptions(
    env={
        "API_BASE_URL": "http://localhost:8080"  # 프록시 주소
        # 실제 토큰은 프록시에서 주입됨
    }
)
```

### MCP 서버를 통한 인증

```python
# 인증 정보를 외부 MCP 서버에서 처리
@tool(
    name="call_api",
    description="외부 API 호출 (인증은 서버에서 처리)",
    input_schema={"endpoint": str, "params": dict}
)
async def call_api(args: dict) -> dict:
    # 이 함수는 에이전트 외부에서 실행됨
    # 실제 인증 정보 사용
    response = await http_client.post(
        f"{API_URL}/{args['endpoint']}",
        headers={"Authorization": f"Bearer {os.environ['API_TOKEN']}"},
        json=args['params']
    )
    return {"content": [{"type": "text", "text": response.text}]}
```

---

## 네트워크 보안

### 네트워크 격리

```bash
# 완전 격리
docker run --network none agent-image

# 특정 네트워크만 허용 (Docker 네트워크)
docker network create --internal agent-net
docker run --network agent-net agent-image
```

### 도메인 허용 목록

```json
{
  "permissions": {
    "allow": [
      "WebFetch(domain:docs.example.com)",
      "WebFetch(domain:api.example.com)",
      "WebSearch"
    ],
    "deny": [
      "WebFetch(domain:*)"  // 다른 모든 도메인 차단
    ]
  }
}
```

### 프록시 기반 도메인 제어

```python
# 프록시에서 허용 목록 적용
ALLOWED_DOMAINS = [
    "api.github.com",
    "registry.npmjs.org",
    "pypi.org"
]

async def proxy_request(request):
    host = urlparse(request.url).hostname
    if host not in ALLOWED_DOMAINS:
        return Response(status=403, text="Domain not allowed")

    # 허용된 도메인으로 전달
    return await forward_request(request)
```

---

## 파일 시스템 보안

### 읽기 전용 마운트

```bash
# 코드는 읽기 전용
docker run \
  -v /project/src:/workspace/src:ro \
  -v /project/tests:/workspace/tests:ro \
  agent-image
```

### 민감한 파일 제외

```bash
# 마운트 전 민감한 파일 제외
rsync -av --exclude='.env*' \
          --exclude='.git-credentials' \
          --exclude='*.pem' \
          --exclude='*.key' \
          /project/ /safe-project/

docker run -v /safe-project:/workspace:ro agent-image
```

### 오버레이 파일시스템

변경사항을 별도 레이어에 기록하여 검토 후 적용:

```bash
# OverlayFS 사용
mkdir -p /overlay/{upper,work,merged}

mount -t overlay overlay \
  -o lowerdir=/project,upperdir=/overlay/upper,workdir=/overlay/work \
  /overlay/merged

docker run -v /overlay/merged:/workspace agent-image

# 변경사항 검토
ls /overlay/upper

# 승인된 변경사항만 적용
cp -r /overlay/upper/* /project/
```

### 권한 규칙으로 보호

```json
{
  "permissions": {
    "deny": [
      "Read(.env*)",
      "Read(.git-credentials)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Read(**/*secret*)",
      "Read(**/*password*)",
      "Read(**/*credential*)",
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Write(.env*)",
      "Edit(.env*)"
    ]
  }
}
```

---

## 감사 및 모니터링

### 도구 사용 로깅

```python
import json
import logging
from datetime import datetime

async def audit_hook(input_data: dict, tool_use_id: str, context) -> dict:
    """모든 도구 사용 감사 로깅"""

    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "session_id": context.session_id,
        "tool": input_data.get("tool_name"),
        "input": input_data.get("tool_input"),
        "tool_use_id": tool_use_id
    }

    # 구조화된 로깅
    logging.info(json.dumps(log_entry))

    # 외부 시스템에 전송 (선택)
    await send_to_siem(log_entry)

    return {}

options = ClaudeAgentOptions(
    hooks={
        "PostToolUse": [HookMatcher(hooks=[audit_hook])]
    }
)
```

### 이상 탐지

```python
# 비정상적인 패턴 감지
async def anomaly_detector(input_data: dict, tool_use_id: str, context) -> dict:
    tool = input_data.get("tool_name")

    # 빈도 기반 탐지
    if await get_tool_count_last_minute(tool) > THRESHOLD:
        await alert(f"High frequency {tool} usage detected")

    # 패턴 기반 탐지
    if tool == "Bash":
        command = input_data.get("tool_input", {}).get("command", "")
        if detect_suspicious_pattern(command):
            await alert(f"Suspicious command: {command}")
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "Suspicious pattern detected"
                }
            }

    return {}
```

### 비용/사용량 모니터링

```python
total_cost = 0
MAX_BUDGET = 10.0  # $10 제한

async for message in query(prompt="작업", options=options):
    if isinstance(message, ResultMessage) and message.subtype == "success":
        total_cost += message.total_cost_usd

        if total_cost > MAX_BUDGET * 0.8:
            logging.warning(f"Budget 80% used: ${total_cost:.2f}")

        if total_cost > MAX_BUDGET:
            raise Exception(f"Budget exceeded: ${total_cost:.2f}")
```

---

## 보안 체크리스트

### 배포 전 체크리스트

#### 권한 설정
- [ ] `allow` 규칙이 필요한 도구만 포함
- [ ] `deny` 규칙으로 민감한 파일 보호
- [ ] `ask` 규칙으로 위험한 작업 확인
- [ ] 프로덕션에서 `bypassPermissions` 사용 안 함

#### 인증 정보
- [ ] 에이전트에 직접 시크릿 노출 안 함
- [ ] 프록시 패턴 또는 MCP 서버 사용
- [ ] 환경 변수에 민감한 정보 없음
- [ ] 설정 파일에 인증 정보 없음

#### 격리
- [ ] 컨테이너/VM으로 실행 환경 격리
- [ ] 네트워크 접근 제한 (필요한 도메인만)
- [ ] 파일시스템 접근 제한 (필요한 경로만)
- [ ] 리소스 제한 (메모리, CPU)

#### 훅 검증
- [ ] PreToolUse 훅으로 위험한 명령 차단
- [ ] 입력 검증 로직 구현
- [ ] 훅 스크립트 권한 제한 (700)

#### 감사
- [ ] 모든 도구 사용 로깅
- [ ] 이상 탐지 알림 설정
- [ ] 비용/사용량 모니터링
- [ ] 정기적 감사 로그 검토

### 정기 보안 점검

| 항목 | 주기 | 담당 |
|------|------|------|
| 권한 규칙 검토 | 월간 | 보안팀 |
| 감사 로그 분석 | 주간 | 운영팀 |
| 취약점 스캔 | 월간 | 보안팀 |
| 의존성 업데이트 | 주간 | 개발팀 |
| 접근 권한 검토 | 분기 | 보안팀 |

---

## 인시던트 대응

### 의심스러운 활동 발견 시

1. **즉시 격리**: 에이전트 실행 중지
2. **증거 수집**: 감사 로그 보존
3. **영향 분석**: 접근된 리소스 파악
4. **수정 조치**: 유출된 자격 증명 교체
5. **사후 분석**: 원인 파악 및 재발 방지

### 로그 보존

```bash
# 감사 로그 백업
cp /var/log/claude-audit.jsonl /backup/audit-$(date +%Y%m%d).jsonl

# 로그 압축 및 장기 보관
gzip /backup/audit-*.jsonl
aws s3 cp /backup/ s3://security-logs/claude/ --recursive
```

---

*이전: [설정 가이드](06_configuration.md) | 다음: [아키텍처 패턴](08_patterns.md)*
