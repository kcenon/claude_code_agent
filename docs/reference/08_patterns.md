# Architecture Patterns

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## Table of Contents

1. [Agent Pattern Overview](#agent-pattern-overview)
2. [Single Agent Patterns](#single-agent-patterns)
3. [Multi-Agent Patterns](#multi-agent-patterns)
4. [Workflow Patterns](#workflow-patterns)
5. [Integration Patterns](#integration-patterns)
6. [Scaling Patterns](#scaling-patterns)
7. [Production Architecture](#production-architecture)

---

## Agent Pattern Overview

### Pattern Selection Guide

| Situation | Recommended Pattern |
|-----------|---------------------|
| Single task, independent | Single agent |
| Complex multi-step task | Pipeline |
| Specialized roles needed | Multi-agent |
| Repetitive task automation | Workflow |
| External system integration | Integration patterns |
| Large-scale processing | Scaling patterns |

### Complexity Spectrum

```
Simple                                                     Complex
  |                                                          |
  ▼                                                          ▼
[Single Query] → [Multi-Turn] → [Subagents] → [Pipeline] → [Distributed]
```

---

## Single Agent Patterns

### 1. One-Shot Agent

Processes independent tasks in a single turn.

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async def one_shot_agent(task: str) -> str:
    """Single task processing"""
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

# Usage
result = await one_shot_agent("Analyze bugs in src/utils.py")
```

**Suitable for:**
- Code analysis
- Documentation generation
- Single file modification

### 2. Conversational Agent

Maintains context across multiple turns.

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
        """Process conversation turn"""
        await self.client.query(message)

        responses = []
        async for msg in self.client.receive_response():
            responses.append(msg)

        return responses

# Usage
async with ConversationalAgent(options) as agent:
    await agent.chat("Explain the project structure")
    await agent.chat("Read the main.py file")
    await agent.chat("Suggest improvements for this file")
```

**Suitable for:**
- Exploratory coding
- Complex debugging
- Step-by-step refactoring

### 3. Resumable Agent

Saves session and resumes later.

```python
class ResumableAgent:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path

    async def run(self, task: str, session_id: str = None) -> tuple[str, str]:
        """Execute or resume task"""
        options = ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash"],
            resume=session_id  # Resume previous session
        )

        result = None
        new_session_id = session_id

        async for message in query(prompt=task, options=options):
            if hasattr(message, 'session_id') and message.subtype == 'init':
                new_session_id = message.session_id
            if hasattr(message, 'result'):
                result = message.result

        # Save session ID
        self._save_session(new_session_id)

        return result, new_session_id

# Usage
agent = ResumableAgent("/tmp/agent-sessions")

# First run
result, session_id = await agent.run("Start writing tests")

# Resume later
result, _ = await agent.run("Complete remaining tests", session_id)
```

---

## Multi-Agent Patterns

### 1. Specialized Agents

Each agent handles a specific role.

```python
from claude_agent_sdk import AgentDefinition

SPECIALIZED_AGENTS = {
    "analyst": AgentDefinition(
        description="Code analysis and quality assessment expert",
        prompt="""You are a senior code analyst.
        You analyze code quality, architecture, and patterns.
        Provide specific improvement suggestions.""",
        tools=["Read", "Grep", "Glob"],
        model="sonnet"
    ),
    "implementer": AgentDefinition(
        description="Code implementation and modification expert",
        prompt="""You are a senior developer.
        Write clean, testable code.
        Follow best practices.""",
        tools=["Read", "Write", "Edit", "Bash"],
        model="opus"
    ),
    "tester": AgentDefinition(
        description="Test writing and execution expert",
        prompt="""You are a QA engineer.
        Write comprehensive tests.
        Consider edge cases.""",
        tools=["Read", "Write", "Bash"],
        model="sonnet"
    ),
    "reviewer": AgentDefinition(
        description="Code review expert",
        prompt="""You are a code reviewer.
        Review security, performance, and maintainability.
        Provide constructive feedback.""",
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
        prompt=f"""Perform the following task:

        {task}

        1. Analyze current code with analyst agent
        2. Implement improvements with implementer agent
        3. Write tests with tester agent
        4. Final review with reviewer agent""",
        options=options
    ):
        yield message
```

### 2. Hierarchical Agents

Manager agent coordinates worker agents.

```python
class HierarchicalAgentSystem:
    def __init__(self):
        self.workers = {
            "frontend": AgentDefinition(
                description="Frontend development",
                prompt="React/TypeScript expert",
                tools=["Read", "Write", "Edit", "Bash"]
            ),
            "backend": AgentDefinition(
                description="Backend development",
                prompt="Python/FastAPI expert",
                tools=["Read", "Write", "Edit", "Bash"]
            ),
            "devops": AgentDefinition(
                description="Infrastructure and deployment",
                prompt="Docker/K8s expert",
                tools=["Read", "Write", "Bash"]
            )
        }

    async def run(self, project_task: str):
        """Manager agent distributes work"""
        manager_options = ClaudeAgentOptions(
            system_prompt="""You are a project manager.
            Analyze the given task and delegate to appropriate specialists.
            Integrate each agent's results into the final output.""",
            allowed_tools=["Task", "Read", "AskUserQuestion"],
            agents=self.workers
        )

        async for message in query(prompt=project_task, options=manager_options):
            yield message
```

### 3. Collaborative Agents

Multiple agents work in parallel and integrate results.

```python
import asyncio

async def parallel_analysis(files: list[str]):
    """Analyze multiple files in parallel"""

    async def analyze_file(file_path: str):
        async for message in query(
            prompt=f"Analyze {file_path} file",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Grep"],
                model="haiku"  # Fast model
            )
        ):
            if hasattr(message, 'result'):
                return {"file": file_path, "analysis": message.result}
        return None

    # Parallel execution
    tasks = [analyze_file(f) for f in files]
    results = await asyncio.gather(*tasks)

    # Integrate results
    return [r for r in results if r is not None]
```

---

## Workflow Patterns

### 1. Pipeline Pattern

Processes work through sequential stages.

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
        """Execute pipeline"""
        context = {"input": initial_input}
        results = {}

        for stage in self.stages:
            print(f"Stage: {stage.name}")

            stage_result = await self._run_stage(stage, context)
            results[stage.name] = stage_result

            # Update context for next stage
            if stage.process_output:
                context = await stage.process_output(stage_result)
            else:
                context = {"previous": stage_result, "input": initial_input}

        return results

# Code review pipeline example
review_pipeline = AgentPipeline([
    PipelineStage(
        name="analyze",
        prompt="Analyze the following code: {input}",
        tools=["Read", "Grep", "Glob"]
    ),
    PipelineStage(
        name="identify_issues",
        prompt="Identify issues based on analysis: {previous}",
        tools=["Read"]
    ),
    PipelineStage(
        name="suggest_fixes",
        prompt="Suggest fixes for identified issues: {previous}",
        tools=["Read", "Edit"]
    ),
    PipelineStage(
        name="generate_report",
        prompt="Write final review report: {previous}",
        tools=["Write"]
    )
])

results = await review_pipeline.run("src/auth/ directory")
```

### 2. Conditional Workflow

Executes different paths based on conditions.

```python
class ConditionalWorkflow:
    async def run(self, code_path: str):
        # 1. Analyze code
        analysis = await self._analyze(code_path)

        # 2. Branch based on conditions
        if analysis['has_tests']:
            # Run tests
            test_result = await self._run_tests(code_path)
            if not test_result['passed']:
                # Fix failing tests
                await self._fix_failing_tests(test_result)
        else:
            # Generate tests if none exist
            await self._generate_tests(code_path)

        # 3. Linting
        if analysis['needs_linting']:
            await self._run_linting(code_path)

        return await self._generate_summary()
```

### 3. Iterative Workflow

Repeats until condition is satisfied.

```python
class IterativeWorkflow:
    def __init__(self, max_iterations: int = 5):
        self.max_iterations = max_iterations

    async def run_until_success(self, task: str):
        """Repeat until success"""
        for i in range(self.max_iterations):
            print(f"Iteration {i + 1}/{self.max_iterations}")

            result = await self._attempt(task)

            if result['success']:
                return result

            # Analyze failure and improve approach
            task = await self._improve_approach(task, result['error'])

        raise Exception(f"Failed after {self.max_iterations} iterations")
```

---

## Integration Patterns

### 1. API Integration

Integrate with external APIs.

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

# Define custom API tools
@tool("fetch_user", "Fetch user information", {"user_id": str})
async def fetch_user(args):
    response = await api_client.get(f"/users/{args['user_id']}")
    return {"content": [{"type": "text", "text": json.dumps(response)}]}

@tool("create_ticket", "Create ticket", {"title": str, "description": str})
async def create_ticket(args):
    response = await api_client.post("/tickets", json=args)
    return {"content": [{"type": "text", "text": f"Ticket created: {response['id']}"}]}

# Create MCP server
api_server = create_sdk_mcp_server(
    name="internal-api",
    version="1.0.0",
    tools=[fetch_user, create_ticket]
)

# Use in agent
options = ClaudeAgentOptions(
    mcp_servers={"api": api_server},
    allowed_tools=[
        "mcp__api__fetch_user",
        "mcp__api__create_ticket",
        "Read", "Write"
    ]
)
```

### 2. Event-Driven Integration

React to external events.

```python
class EventDrivenAgent:
    def __init__(self, event_source):
        self.event_source = event_source
        self.running = False

    async def start(self):
        """Start event listening"""
        self.running = True

        async for event in self.event_source:
            if not self.running:
                break

            await self._handle_event(event)

    async def _handle_event(self, event: dict):
        """Handle event"""
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
        """Handle PR opened event"""
        async for msg in query(
            prompt=f"Review PR #{event['pr_number']}",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Grep", "Glob"],
                cwd=event['repo_path']
            )
        ):
            if hasattr(msg, 'result'):
                await self._post_review(event['pr_number'], msg.result)
```

### 3. CI/CD Integration

```python
class CICDAgent:
    async def run_ci_check(self, commit_sha: str) -> dict:
        """Run CI checks"""
        results = {
            "commit": commit_sha,
            "checks": {}
        }

        # 1. Code analysis
        async for msg in query(
            prompt="Analyze changed files and find potential issues",
            options=ClaudeAgentOptions(
                allowed_tools=["Bash", "Read", "Grep"],
                system_prompt="As a CI analyzer, check code quality."
            )
        ):
            if hasattr(msg, 'result'):
                results["checks"]["analysis"] = msg.result

        # 2. Run tests
        async for msg in query(
            prompt="Run tests and report results",
            options=ClaudeAgentOptions(allowed_tools=["Bash", "Read"])
        ):
            if hasattr(msg, 'result'):
                results["checks"]["tests"] = msg.result

        # 3. Build verification
        async for msg in query(
            prompt="Build project and check for errors",
            options=ClaudeAgentOptions(allowed_tools=["Bash"])
        ):
            if hasattr(msg, 'result'):
                results["checks"]["build"] = msg.result

        return results
```

---

## Scaling Patterns

### 1. Work Distribution

Distribute large workloads.

```python
import asyncio

class DistributedAgent:
    def __init__(self, concurrency: int = 3):
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)

    async def process_batch(self, items: list) -> list[dict]:
        """Batch processing"""
        tasks = [self._process_with_limit(item) for item in items]
        return await asyncio.gather(*tasks)

    async def _process_with_limit(self, item) -> dict:
        async with self.semaphore:
            return await self._process_item(item)

# Usage
agent = DistributedAgent(concurrency=5)
items = [f"src/module_{i}.py" for i in range(20)]
results = await agent.process_batch(items)
```

### 2. Caching Pattern

Cache repeated requests.

```python
import hashlib
import time

class CachedAgent:
    def __init__(self, cache_ttl: int = 3600):
        self.cache = {}
        self.cache_ttl = cache_ttl

    async def query_cached(self, prompt: str, tools: list[str]) -> str:
        """Cached query"""
        cache_key = self._make_key(prompt, tools)

        # Check cache
        if cache_key in self.cache:
            entry = self.cache[cache_key]
            if time.time() - entry['time'] < self.cache_ttl:
                return entry['result']

        # Execute new query
        result = await self._query(prompt, tools)

        # Store in cache
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

## Production Architecture

### Complete Production Setup

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
        """Production agent execution"""
        start_time = datetime.now()

        try:
            # Rate limiting
            await self.rate_limiter.acquire()

            # Configure options
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

            # Execute
            result = None
            cost = 0

            async for message in query(prompt=task, options=options):
                if isinstance(message, ResultMessage):
                    if message.subtype == 'success':
                        result = message.result
                        cost = message.total_cost_usd
                    elif message.subtype == 'error':
                        raise Exception(f"Agent error: {message.error}")

            # Record metrics
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

# Configuration
config = {
    "allowed_tools": ["Read", "Edit", "Bash", "Glob", "Grep"],
    "model": "claude-sonnet-4-5-20251101",
    "max_turns": 20,
    "rate_limit": 10  # Requests per minute
}

agent = ProductionAgent(config)
result = await agent.run("Fix bugs and add tests")
```

---

*Previous: [Security Guide](07_security.md) | Next: [API Reference](09_api_reference.md)*
