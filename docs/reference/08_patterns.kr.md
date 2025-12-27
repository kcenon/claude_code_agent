# 아키텍처 패턴

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## 목차

1. [에이전트 패턴 개요](#에이전트-패턴-개요)
2. [단일 에이전트 패턴](#단일-에이전트-패턴)
3. [멀티 에이전트 패턴](#멀티-에이전트-패턴)
4. [워크플로우 패턴](#워크플로우-패턴)
5. [통합 패턴](#통합-패턴)
6. [확장 패턴](#확장-패턴)
7. [프로덕션 아키텍처](#프로덕션-아키텍처)

---

## 에이전트 패턴 개요

### 패턴 선택 가이드

| 상황 | 권장 패턴 |
|------|-----------|
| 단일 작업, 독립적 | 단일 에이전트 |
| 복잡한 다단계 작업 | 파이프라인 |
| 전문화된 역할 필요 | 멀티 에이전트 |
| 반복 작업 자동화 | 워크플로우 |
| 외부 시스템 연동 | 통합 패턴 |
| 대규모 처리 | 확장 패턴 |

### 복잡도 스펙트럼

```
단순                                                     복잡
  |                                                        |
  ▼                                                        ▼
[단일 쿼리] → [다중 턴] → [서브에이전트] → [파이프라인] → [분산 시스템]
```

---

## 단일 에이전트 패턴

### 1. 단일 턴 에이전트 (One-Shot)

독립적인 작업을 한 번에 처리합니다.

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async def one_shot_agent(task: str) -> str:
    """단일 작업 처리"""
    result = None

    async for message in query(
        prompt=task,
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep"],
            max_turns=5
        )
    ):
        if hasattr(message, 'result'):
            result = message.result

    return result

# 사용
result = await one_shot_agent("src/utils.py의 버그를 분석하세요")
```

**적합한 경우:**
- 코드 분석
- 문서 생성
- 단일 파일 수정

### 2. 대화형 에이전트 (Conversational)

여러 턴에 걸쳐 컨텍스트를 유지합니다.

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

class ConversationalAgent:
    def __init__(self, options: ClaudeAgentOptions):
        self.options = options
        self.client = None

    async def __aenter__(self):
        self.client = ClaudeSDKClient(options=self.options)
        await self.client.connect()
        return self

    async def __aexit__(self, *args):
        await self.client.disconnect()

    async def chat(self, message: str) -> list:
        """대화 턴 처리"""
        await self.client.query(message)

        responses = []
        async for msg in self.client.receive_response():
            responses.append(msg)

        return responses

# 사용
async with ConversationalAgent(options) as agent:
    await agent.chat("프로젝트 구조를 설명해주세요")
    await agent.chat("main.py 파일을 읽어주세요")
    await agent.chat("이 파일의 개선점을 제안해주세요")
```

**적합한 경우:**
- 탐색적 코딩
- 복잡한 디버깅
- 단계적 리팩토링

### 3. 재개 가능 에이전트 (Resumable)

세션을 저장하고 나중에 재개합니다.

```python
class ResumableAgent:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path

    async def run(self, task: str, session_id: str = None) -> tuple[str, str]:
        """작업 실행 또는 재개"""
        options = ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash"],
            resume=session_id  # 이전 세션 재개
        )

        result = None
        new_session_id = session_id

        async for message in query(prompt=task, options=options):
            if hasattr(message, 'session_id') and message.subtype == 'init':
                new_session_id = message.session_id
            if hasattr(message, 'result'):
                result = message.result

        # 세션 ID 저장
        self._save_session(new_session_id)

        return result, new_session_id

    def _save_session(self, session_id: str):
        with open(f"{self.storage_path}/session.txt", 'w') as f:
            f.write(session_id)

# 사용
agent = ResumableAgent("/tmp/agent-sessions")

# 첫 실행
result, session_id = await agent.run("테스트 작성을 시작하세요")

# 나중에 재개
result, _ = await agent.run("남은 테스트를 완료하세요", session_id)
```

---

## 멀티 에이전트 패턴

### 1. 전문화 에이전트 (Specialized)

각 에이전트가 특정 역할을 담당합니다.

```python
from claude_agent_sdk import AgentDefinition

SPECIALIZED_AGENTS = {
    "analyst": AgentDefinition(
        description="코드 분석 및 품질 평가 전문가",
        prompt="""당신은 시니어 코드 분석가입니다.
        코드 품질, 아키텍처, 패턴을 분석합니다.
        구체적인 개선 제안을 제공합니다.""",
        tools=["Read", "Grep", "Glob"],
        model="sonnet"
    ),
    "implementer": AgentDefinition(
        description="코드 구현 및 수정 전문가",
        prompt="""당신은 시니어 개발자입니다.
        깔끔하고 테스트 가능한 코드를 작성합니다.
        베스트 프랙티스를 따릅니다.""",
        tools=["Read", "Write", "Edit", "Bash"],
        model="opus"
    ),
    "tester": AgentDefinition(
        description="테스트 작성 및 실행 전문가",
        prompt="""당신은 QA 엔지니어입니다.
        포괄적인 테스트를 작성합니다.
        엣지 케이스를 고려합니다.""",
        tools=["Read", "Write", "Bash"],
        model="sonnet"
    ),
    "reviewer": AgentDefinition(
        description="코드 리뷰 전문가",
        prompt="""당신은 코드 리뷰어입니다.
        보안, 성능, 유지보수성을 검토합니다.
        건설적인 피드백을 제공합니다.""",
        tools=["Read", "Grep", "Glob"],
        model="haiku"
    )
}

async def run_specialized_workflow(task: str):
    options = ClaudeAgentOptions(
        allowed_tools=["Task", "Read"],
        agents=SPECIALIZED_AGENTS
    )

    async for message in query(
        prompt=f"""다음 작업을 수행하세요:

        {task}

        1. analyst 에이전트로 현재 코드 분석
        2. implementer 에이전트로 개선 구현
        3. tester 에이전트로 테스트 작성
        4. reviewer 에이전트로 최종 리뷰""",
        options=options
    ):
        yield message
```

### 2. 계층적 에이전트 (Hierarchical)

관리자 에이전트가 작업자 에이전트를 조율합니다.

```python
class HierarchicalAgentSystem:
    def __init__(self):
        self.workers = {
            "frontend": AgentDefinition(
                description="프론트엔드 개발",
                prompt="React/TypeScript 전문가",
                tools=["Read", "Write", "Edit", "Bash"]
            ),
            "backend": AgentDefinition(
                description="백엔드 개발",
                prompt="Python/FastAPI 전문가",
                tools=["Read", "Write", "Edit", "Bash"]
            ),
            "devops": AgentDefinition(
                description="인프라 및 배포",
                prompt="Docker/K8s 전문가",
                tools=["Read", "Write", "Bash"]
            )
        }

    async def run(self, project_task: str):
        """관리자 에이전트가 작업 분배"""
        manager_options = ClaudeAgentOptions(
            system_prompt="""당신은 프로젝트 매니저입니다.
            주어진 작업을 분석하고 적절한 전문가에게 위임하세요.
            각 에이전트의 결과를 통합하여 최종 결과를 만드세요.""",
            allowed_tools=["Task", "Read", "AskUserQuestion"],
            agents=self.workers
        )

        async for message in query(prompt=project_task, options=manager_options):
            yield message
```

### 3. 협력 에이전트 (Collaborative)

여러 에이전트가 병렬로 작업하고 결과를 통합합니다.

```python
import asyncio

async def parallel_analysis(files: list[str]):
    """여러 파일을 병렬로 분석"""

    async def analyze_file(file_path: str):
        async for message in query(
            prompt=f"{file_path} 파일을 분석하세요",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Grep"],
                model="haiku"  # 빠른 모델
            )
        ):
            if hasattr(message, 'result'):
                return {"file": file_path, "analysis": message.result}
        return None

    # 병렬 실행
    tasks = [analyze_file(f) for f in files]
    results = await asyncio.gather(*tasks)

    # 결과 통합
    return [r for r in results if r is not None]
```

---

## 워크플로우 패턴

### 1. 파이프라인 패턴

순차적인 단계로 작업을 처리합니다.

```python
from dataclasses import dataclass
from typing import Any, Callable, Awaitable

@dataclass
class PipelineStage:
    name: str
    prompt: str
    tools: list[str]
    process_output: Callable[[Any], Awaitable[Any]] = None

class AgentPipeline:
    def __init__(self, stages: list[PipelineStage]):
        self.stages = stages

    async def run(self, initial_input: str) -> dict:
        """파이프라인 실행"""
        context = {"input": initial_input}
        results = {}

        for stage in self.stages:
            print(f"Stage: {stage.name}")

            stage_result = await self._run_stage(stage, context)
            results[stage.name] = stage_result

            # 다음 스테이지를 위한 컨텍스트 업데이트
            if stage.process_output:
                context = await stage.process_output(stage_result)
            else:
                context = {"previous": stage_result, "input": initial_input}

        return results

    async def _run_stage(self, stage: PipelineStage, context: dict):
        prompt = stage.prompt.format(**context)

        async for message in query(
            prompt=prompt,
            options=ClaudeAgentOptions(allowed_tools=stage.tools)
        ):
            if hasattr(message, 'result'):
                return message.result
        return None

# 코드 리뷰 파이프라인 예제
review_pipeline = AgentPipeline([
    PipelineStage(
        name="analyze",
        prompt="다음 코드를 분석하세요: {input}",
        tools=["Read", "Grep", "Glob"]
    ),
    PipelineStage(
        name="identify_issues",
        prompt="분석 결과를 바탕으로 이슈를 식별하세요: {previous}",
        tools=["Read"]
    ),
    PipelineStage(
        name="suggest_fixes",
        prompt="발견된 이슈에 대한 수정안을 제안하세요: {previous}",
        tools=["Read", "Edit"]
    ),
    PipelineStage(
        name="generate_report",
        prompt="최종 리뷰 보고서를 작성하세요: {previous}",
        tools=["Write"]
    )
])

results = await review_pipeline.run("src/auth/ 디렉토리")
```

### 2. 조건부 워크플로우

조건에 따라 다른 경로를 실행합니다.

```python
class ConditionalWorkflow:
    async def run(self, code_path: str):
        # 1. 코드 분석
        analysis = await self._analyze(code_path)

        # 2. 조건에 따른 분기
        if analysis['has_tests']:
            # 테스트 실행
            test_result = await self._run_tests(code_path)
            if not test_result['passed']:
                # 테스트 실패 시 수정
                await self._fix_failing_tests(test_result)
        else:
            # 테스트 없으면 생성
            await self._generate_tests(code_path)

        # 3. 린팅
        if analysis['needs_linting']:
            await self._run_linting(code_path)

        return await self._generate_summary()

    async def _analyze(self, path: str) -> dict:
        async for msg in query(
            prompt=f"""분석하세요:
            1. 테스트 파일 존재 여부
            2. 린팅 필요 여부
            JSON으로 응답: {{"has_tests": bool, "needs_linting": bool}}""",
            options=ClaudeAgentOptions(allowed_tools=["Glob", "Grep"])
        ):
            if hasattr(msg, 'result'):
                return json.loads(msg.result)
        return {"has_tests": False, "needs_linting": True}
```

### 3. 반복 워크플로우

조건을 만족할 때까지 반복합니다.

```python
class IterativeWorkflow:
    def __init__(self, max_iterations: int = 5):
        self.max_iterations = max_iterations

    async def run_until_success(self, task: str):
        """성공할 때까지 반복"""
        for i in range(self.max_iterations):
            print(f"Iteration {i + 1}/{self.max_iterations}")

            result = await self._attempt(task)

            if result['success']:
                return result

            # 실패 원인 분석 및 수정
            task = await self._improve_approach(task, result['error'])

        raise Exception(f"Failed after {self.max_iterations} iterations")

    async def _attempt(self, task: str) -> dict:
        try:
            async for msg in query(
                prompt=task,
                options=ClaudeAgentOptions(
                    allowed_tools=["Read", "Edit", "Bash"]
                )
            ):
                if hasattr(msg, 'result'):
                    # 테스트 실행으로 검증
                    test_result = await self._verify()
                    return {"success": test_result, "result": msg.result}
        except Exception as e:
            return {"success": False, "error": str(e)}

        return {"success": False, "error": "No result"}
```

---

## 통합 패턴

### 1. API 통합

외부 API와 연동합니다.

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

# 커스텀 API 도구 정의
@tool("fetch_user", "사용자 정보 조회", {"user_id": str})
async def fetch_user(args):
    response = await api_client.get(f"/users/{args['user_id']}")
    return {"content": [{"type": "text", "text": json.dumps(response)}]}

@tool("create_ticket", "티켓 생성", {"title": str, "description": str})
async def create_ticket(args):
    response = await api_client.post("/tickets", json=args)
    return {"content": [{"type": "text", "text": f"티켓 생성됨: {response['id']}"}]}

# MCP 서버 생성
api_server = create_sdk_mcp_server(
    name="internal-api",
    version="1.0.0",
    tools=[fetch_user, create_ticket]
)

# 에이전트에서 사용
options = ClaudeAgentOptions(
    mcp_servers={"api": api_server},
    allowed_tools=[
        "mcp__api__fetch_user",
        "mcp__api__create_ticket",
        "Read", "Write"
    ]
)
```

### 2. 이벤트 기반 통합

외부 이벤트에 반응합니다.

```python
import asyncio
from collections.abc import AsyncIterator

class EventDrivenAgent:
    def __init__(self, event_source: AsyncIterator):
        self.event_source = event_source
        self.running = False

    async def start(self):
        """이벤트 리스닝 시작"""
        self.running = True

        async for event in self.event_source:
            if not self.running:
                break

            await self._handle_event(event)

    async def stop(self):
        self.running = False

    async def _handle_event(self, event: dict):
        """이벤트 처리"""
        event_type = event.get("type")

        handlers = {
            "pr_opened": self._handle_pr_opened,
            "issue_created": self._handle_issue_created,
            "deployment_failed": self._handle_deployment_failed
        }

        handler = handlers.get(event_type)
        if handler:
            await handler(event)

    async def _handle_pr_opened(self, event: dict):
        """PR 열림 이벤트 처리"""
        async for msg in query(
            prompt=f"PR #{event['pr_number']}를 리뷰하세요",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Grep", "Glob"],
                cwd=event['repo_path']
            )
        ):
            if hasattr(msg, 'result'):
                await self._post_review(event['pr_number'], msg.result)
```

### 3. CI/CD 통합

```python
class CICDAgent:
    async def run_ci_check(self, commit_sha: str) -> dict:
        """CI 체크 실행"""
        results = {
            "commit": commit_sha,
            "checks": {}
        }

        # 1. 코드 분석
        async for msg in query(
            prompt="변경된 파일을 분석하고 잠재적 이슈를 찾으세요",
            options=ClaudeAgentOptions(
                allowed_tools=["Bash", "Read", "Grep"],
                system_prompt="CI 분석기로서 코드 품질을 검사합니다."
            )
        ):
            if hasattr(msg, 'result'):
                results["checks"]["analysis"] = msg.result

        # 2. 테스트 실행
        async for msg in query(
            prompt="테스트를 실행하고 결과를 보고하세요",
            options=ClaudeAgentOptions(allowed_tools=["Bash", "Read"])
        ):
            if hasattr(msg, 'result'):
                results["checks"]["tests"] = msg.result

        # 3. 빌드 검증
        async for msg in query(
            prompt="프로젝트를 빌드하고 오류가 있는지 확인하세요",
            options=ClaudeAgentOptions(allowed_tools=["Bash"])
        ):
            if hasattr(msg, 'result'):
                results["checks"]["build"] = msg.result

        return results
```

---

## 확장 패턴

### 1. 작업 분산

대량 작업을 분산 처리합니다.

```python
import asyncio
from dataclasses import dataclass

@dataclass
class WorkItem:
    id: str
    data: Any

class DistributedAgent:
    def __init__(self, concurrency: int = 3):
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)

    async def process_batch(self, items: list[WorkItem]) -> list[dict]:
        """배치 처리"""
        tasks = [self._process_with_limit(item) for item in items]
        return await asyncio.gather(*tasks)

    async def _process_with_limit(self, item: WorkItem) -> dict:
        async with self.semaphore:
            return await self._process_item(item)

    async def _process_item(self, item: WorkItem) -> dict:
        async for msg in query(
            prompt=f"처리하세요: {item.data}",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Write"],
                model="haiku"  # 빠른 모델로 대량 처리
            )
        ):
            if hasattr(msg, 'result'):
                return {"id": item.id, "result": msg.result}
        return {"id": item.id, "error": "No result"}

# 사용
agent = DistributedAgent(concurrency=5)
items = [WorkItem(id=f"file_{i}", data=f"src/module_{i}.py") for i in range(20)]
results = await agent.process_batch(items)
```

### 2. 캐싱 패턴

반복 요청을 캐싱합니다.

```python
from functools import lru_cache
import hashlib

class CachedAgent:
    def __init__(self, cache_ttl: int = 3600):
        self.cache = {}
        self.cache_ttl = cache_ttl

    async def query_cached(self, prompt: str, tools: list[str]) -> str:
        """캐싱된 쿼리"""
        cache_key = self._make_key(prompt, tools)

        # 캐시 확인
        if cache_key in self.cache:
            entry = self.cache[cache_key]
            if time.time() - entry['time'] < self.cache_ttl:
                return entry['result']

        # 새 쿼리 실행
        result = await self._query(prompt, tools)

        # 캐시 저장
        self.cache[cache_key] = {
            'result': result,
            'time': time.time()
        }

        return result

    def _make_key(self, prompt: str, tools: list[str]) -> str:
        content = f"{prompt}:{','.join(sorted(tools))}"
        return hashlib.sha256(content.encode()).hexdigest()
```

---

## 프로덕션 아키텍처

### 완전한 프로덕션 설정

```python
import asyncio
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProductionAgent:
    def __init__(self, config: dict):
        self.config = config
        self.metrics = MetricsCollector()
        self.rate_limiter = RateLimiter(config['rate_limit'])

    async def run(self, task: str) -> dict:
        """프로덕션 에이전트 실행"""
        start_time = datetime.now()

        try:
            # 속도 제한
            await self.rate_limiter.acquire()

            # 옵션 구성
            options = ClaudeAgentOptions(
                allowed_tools=self.config['allowed_tools'],
                permission_mode="acceptEdits",
                model=self.config['model'],
                max_turns=self.config['max_turns'],
                hooks={
                    'PreToolUse': [HookMatcher(hooks=[self._security_hook])],
                    'PostToolUse': [HookMatcher(hooks=[self._audit_hook])]
                }
            )

            # 실행
            result = None
            cost = 0

            async for message in query(prompt=task, options=options):
                if isinstance(message, ResultMessage):
                    if message.subtype == 'success':
                        result = message.result
                        cost = message.total_cost_usd
                    elif message.subtype == 'error':
                        raise Exception(f"Agent error: {message.error}")

            # 메트릭 기록
            duration = (datetime.now() - start_time).total_seconds()
            self.metrics.record(
                duration=duration,
                cost=cost,
                success=True
            )

            return {
                "success": True,
                "result": result,
                "duration_seconds": duration,
                "cost_usd": cost
            }

        except Exception as e:
            logger.error(f"Agent failed: {e}")
            self.metrics.record(success=False, error=str(e))
            return {
                "success": False,
                "error": str(e)
            }

    async def _security_hook(self, input_data, tool_use_id, context):
        """보안 검증"""
        # 위험한 패턴 검사
        if input_data.get('tool_name') == 'Bash':
            command = input_data.get('tool_input', {}).get('command', '')
            if any(p in command for p in ['rm -rf', 'sudo', ':(){:']):
                return {
                    'hookSpecificOutput': {
                        'hookEventName': 'PreToolUse',
                        'permissionDecision': 'deny',
                        'permissionDecisionReason': 'Dangerous command blocked'
                    }
                }
        return {}

    async def _audit_hook(self, input_data, tool_use_id, context):
        """감사 로깅"""
        logger.info(f"Tool used: {input_data.get('tool_name')}")
        return {}

# 설정
config = {
    "allowed_tools": ["Read", "Edit", "Bash", "Glob", "Grep"],
    "model": "claude-sonnet-4-5-20251101",
    "max_turns": 20,
    "rate_limit": 10  # 분당 요청 수
}

agent = ProductionAgent(config)
result = await agent.run("버그를 수정하고 테스트를 추가하세요")
```

---

*이전: [보안 가이드](07_security.md) | 다음: [API 레퍼런스](09_api_reference.md)*
