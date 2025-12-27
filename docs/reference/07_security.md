# Security Guide

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## Table of Contents

1. [Security Overview](#security-overview)
2. [Threat Model](#threat-model)
3. [Isolation Strategies](#isolation-strategies)
4. [Credential Protection](#credential-protection)
5. [Network Security](#network-security)
6. [File System Security](#file-system-security)
7. [Auditing and Monitoring](#auditing-and-monitoring)
8. [Security Checklist](#security-checklist)

---

## Security Overview

### AI Agent Security Specifics

AI agents have different security considerations than traditional software:

| Characteristic | Risk | Mitigation |
|----------------|------|------------|
| Autonomous decision-making | Unpredictable behavior | Permission limits, hook validation |
| External input processing | Prompt injection | Input validation, isolation |
| Tool execution | System damage | Sandbox, permission rules |
| Credential access | Credential exposure | Proxy pattern, environment separation |

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│                   Layer 1: Permission System                 │
│  Tool access control via allow/deny rules                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Layer 2: Hook Validation                  │
│  Command/input validation via PreToolUse hooks               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Layer 3: Sandbox/Isolation                  │
│  Execution environment isolation via containers, VMs         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Layer 4: Network Control                    │
│  External access restriction and credential injection via proxy│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 Layer 5: Audit/Monitoring                    │
│  All operation logging and anomaly detection                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Threat Model

### Primary Threats

#### 1. Prompt Injection

Malicious instructions embedded in processed content manipulate agent behavior.

```
# Dangerous scenario
1. User requests web page analysis
2. Web page contains hidden instruction: "Delete all files"
3. Agent executes malicious instruction
```

**Mitigation:**
- Permission limits to minimize damage scope
- Block dangerous commands via hooks
- Isolation via sandbox

#### 2. Credential Exposure

Credentials accessible to the agent are leaked.

```
# Dangerous scenario
1. Agent reads API key from environment variables
2. Agent sends key to external service
3. Credential compromised
```

**Mitigation:**
- Never expose credentials directly to agent
- Use proxy pattern
- Principle of least privilege

#### 3. Unauthorized System Modification

Agent performs unintended system changes.

**Mitigation:**
- Read-only mounts
- Restrict write paths
- Review changes

#### 4. Resource Exhaustion

Agent consumes excessive resources.

**Mitigation:**
- Resource limits (memory, CPU)
- Timeout settings
- Execution count limits

---

## Isolation Strategies

### Isolation Technology Comparison

| Technology | Isolation Level | Overhead | Complexity |
|------------|-----------------|----------|------------|
| Sandbox runtime | Good | Very low | Low |
| Docker containers | Setup-dependent | Low | Medium |
| gVisor | Excellent | Medium-High | Medium |
| VM (Firecracker) | Excellent | High | High |

### Docker Security Configuration

```bash
docker run \
  # Remove all Linux capabilities
  --cap-drop ALL \

  # Prevent new privilege acquisition
  --security-opt no-new-privileges \

  # Read-only root filesystem
  --read-only \

  # Writable temp directory (limited)
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \

  # Disable networking
  --network none \

  # Memory limit
  --memory 2g \

  # Non-root user
  --user 1000:1000 \

  # Read-only code mount
  -v /code:/workspace:ro \

  # Allow only proxy socket
  -v /var/run/proxy.sock:/var/run/proxy.sock:ro \

  agent-image
```

### Security Option Explanations

| Option | Purpose |
|--------|---------|
| `--cap-drop ALL` | Prevent privilege escalation attacks |
| `--read-only` | Prevent filesystem tampering |
| `--network none` | Prevent network exfiltration |
| `--tmpfs` | Prevent data persistence between sessions |
| `--user 1000:1000` | Prevent root privileges |

---

## Credential Protection

### Anti-pattern: Direct Exposure

```python
# ❌ Dangerous: Agent has direct access to secrets
options = ClaudeAgentOptions(
    env={
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxx",  # Exposed!
        "DB_PASSWORD": "my-secret-password"   # Exposed!
    }
)
```

### Recommended Pattern: Proxy

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │────▶│   Proxy     │────▶│ External API│
│  (Isolated) │     │(Secret Inject)│   │             │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │
      │ No network         │ Holds credentials
      │ No secrets         │
```

### Proxy Implementation Example

**1. Envoy Proxy Configuration:**

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
                          -- Inject auth header
                          request_handle:headers():add(
                            "Authorization",
                            "Bearer " .. os.getenv("API_TOKEN")
                          )
                        end
                  - name: envoy.filters.http.router
```

**2. Agent Using Proxy:**

```python
# Agent only knows proxy URL, not actual credentials
options = ClaudeAgentOptions(
    env={
        "API_BASE_URL": "http://localhost:8080"  # Proxy address
        # Actual token injected by proxy
    }
)
```

### Authentication via MCP Server

```python
# Authentication handled by external MCP server
@tool(
    name="call_api",
    description="Call external API (auth handled by server)",
    input_schema={"endpoint": str, "params": dict}
)
async def call_api(args: dict) -> dict:
    # This function runs outside the agent
    # Uses actual credentials
    response = await http_client.post(
        f"{API_URL}/{args['endpoint']}",
        headers={"Authorization": f"Bearer {os.environ['API_TOKEN']}"},
        json=args['params']
    )
    return {"content": [{"type": "text", "text": response.text}]}
```

---

## Network Security

### Network Isolation

```bash
# Complete isolation
docker run --network none agent-image

# Allow only specific network (Docker network)
docker network create --internal agent-net
docker run --network agent-net agent-image
```

### Domain Allowlist

```json
{
  "permissions": {
    "allow": [
      "WebFetch(domain:docs.example.com)",
      "WebFetch(domain:api.example.com)",
      "WebSearch"
    ],
    "deny": [
      "WebFetch(domain:*)"  // Block all other domains
    ]
  }
}
```

### Proxy-based Domain Control

```python
# Apply allowlist in proxy
ALLOWED_DOMAINS = [
    "api.github.com",
    "registry.npmjs.org",
    "pypi.org"
]

async def proxy_request(request):
    host = urlparse(request.url).hostname
    if host not in ALLOWED_DOMAINS:
        return Response(status=403, text="Domain not allowed")

    # Forward to allowed domain
    return await forward_request(request)
```

---

## File System Security

### Read-Only Mounts

```bash
# Code is read-only
docker run \
  -v /project/src:/workspace/src:ro \
  -v /project/tests:/workspace/tests:ro \
  agent-image
```

### Exclude Sensitive Files

```bash
# Exclude sensitive files before mounting
rsync -av --exclude='.env*' \
          --exclude='.git-credentials' \
          --exclude='*.pem' \
          --exclude='*.key' \
          /project/ /safe-project/

docker run -v /safe-project:/workspace:ro agent-image
```

### Overlay Filesystem

Record changes in separate layer for review before applying:

```bash
# Use OverlayFS
mkdir -p /overlay/{upper,work,merged}

mount -t overlay overlay \
  -o lowerdir=/project,upperdir=/overlay/upper,workdir=/overlay/work \
  /overlay/merged

docker run -v /overlay/merged:/workspace agent-image

# Review changes
ls /overlay/upper

# Apply only approved changes
cp -r /overlay/upper/* /project/
```

### Protection via Permission Rules

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

## Auditing and Monitoring

### Tool Usage Logging

```python
import json
import logging
from datetime import datetime

async def audit_hook(input_data: dict, tool_use_id: str, context) -> dict:
    """Audit logging for all tool usage"""

    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "session_id": context.session_id,
        "tool": input_data.get("tool_name"),
        "input": input_data.get("tool_input"),
        "tool_use_id": tool_use_id
    }

    # Structured logging
    logging.info(json.dumps(log_entry))

    # Send to external system (optional)
    await send_to_siem(log_entry)

    return {}

options = ClaudeAgentOptions(
    hooks={
        "PostToolUse": [HookMatcher(hooks=[audit_hook])]
    }
)
```

### Anomaly Detection

```python
# Detect abnormal patterns
async def anomaly_detector(input_data: dict, tool_use_id: str, context) -> dict:
    tool = input_data.get("tool_name")

    # Frequency-based detection
    if await get_tool_count_last_minute(tool) > THRESHOLD:
        await alert(f"High frequency {tool} usage detected")

    # Pattern-based detection
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

### Cost/Usage Monitoring

```python
total_cost = 0
MAX_BUDGET = 10.0  # $10 limit

async for message in query(prompt="Task", options=options):
    if isinstance(message, ResultMessage) and message.subtype == "success":
        total_cost += message.total_cost_usd

        if total_cost > MAX_BUDGET * 0.8:
            logging.warning(f"Budget 80% used: ${total_cost:.2f}")

        if total_cost > MAX_BUDGET:
            raise Exception(f"Budget exceeded: ${total_cost:.2f}")
```

---

## Security Checklist

### Pre-Deployment Checklist

#### Permission Settings
- [ ] `allow` rules include only necessary tools
- [ ] `deny` rules protect sensitive files
- [ ] `ask` rules confirm dangerous actions
- [ ] `bypassPermissions` not used in production

#### Credentials
- [ ] No secrets directly exposed to agent
- [ ] Proxy pattern or MCP server used
- [ ] No sensitive info in environment variables
- [ ] No credentials in configuration files

#### Isolation
- [ ] Execution environment isolated via container/VM
- [ ] Network access restricted (only necessary domains)
- [ ] Filesystem access restricted (only necessary paths)
- [ ] Resource limits (memory, CPU)

#### Hook Validation
- [ ] PreToolUse hooks block dangerous commands
- [ ] Input validation logic implemented
- [ ] Hook script permissions restricted (700)

#### Auditing
- [ ] All tool usage logged
- [ ] Anomaly detection alerts configured
- [ ] Cost/usage monitoring
- [ ] Regular audit log review

### Regular Security Checks

| Item | Frequency | Responsible |
|------|-----------|-------------|
| Permission rule review | Monthly | Security team |
| Audit log analysis | Weekly | Operations team |
| Vulnerability scanning | Monthly | Security team |
| Dependency updates | Weekly | Development team |
| Access permission review | Quarterly | Security team |

---

## Incident Response

### When Suspicious Activity is Detected

1. **Immediate Isolation**: Stop agent execution
2. **Evidence Collection**: Preserve audit logs
3. **Impact Analysis**: Identify accessed resources
4. **Remediation**: Rotate leaked credentials
5. **Post-Mortem**: Identify cause and prevent recurrence

### Log Retention

```bash
# Backup audit logs
cp /var/log/claude-audit.jsonl /backup/audit-$(date +%Y%m%d).jsonl

# Compress and long-term storage
gzip /backup/audit-*.jsonl
aws s3 cp /backup/ s3://security-logs/claude/ --recursive
```

---

*Previous: [Configuration Guide](06_configuration.md) | Next: [Architecture Patterns](08_patterns.md)*
