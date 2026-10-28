# Troubleshooting Guide

For the production SDK CLI workflow contract, supported setting owners, and migration, see [runtime workflow configuration](../configuration/RUNTIME_WORKFLOW.md). Settings for separate APIs below do not imply CLI workflow enforcement.

> **Version**: 1.0.0

This guide provides comprehensive troubleshooting procedures for diagnosing and resolving issues in the AD-SDLC system. It covers error diagnosis, recovery procedures, performance optimization, and common integration issues.

## Table of Contents

- [Quick Diagnostic Commands](#quick-diagnostic-commands)
- [Error Reference Guide](#error-reference-guide)
- [Diagnostic Procedures](#diagnostic-procedures)
- [Recovery Procedures](#recovery-procedures)
- [Performance Troubleshooting](#performance-troubleshooting)
- [GitHub Integration Issues](#github-integration-issues)
- [Agent-Specific Issues](#agent-specific-issues)
- [Environment Issues](#environment-issues)

---

## Quick Diagnostic Commands

Use these commands for rapid issue identification:

```bash
# Check overall system status
ad-sdlc status

# Validate configuration files
ad-sdlc validate

# View recent logs
tail -100 .ad-sdlc/logs/pipeline.log

# Check GitHub authentication
gh auth status

# Verify Claude API connectivity
curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

---

## Error Reference Guide

### E001: API Rate Limit Exceeded

**Symptom:**

```
Error: GitHub API rate limit exceeded. Retry after: 3600s
```

**Cause:**
Too many GitHub API calls in a short period. Unauthenticated requests are limited to 60/hour; authenticated requests allow 5,000/hour.

**Diagnosis:**

```bash
# Check current rate limit status
gh api rate_limit --jq '.rate'
```

**Solutions:**

1. **Wait for reset:**

   ```bash
   # Check when rate limit resets
   gh api rate_limit --jq '.rate.reset | strftime("%Y-%m-%d %H:%M:%S")'
   ```

2. **Authenticate for higher limits:**

   ```bash
   gh auth login
   ```

3. **Reduce parallelism:**

   ```yaml
   # .ad-sdlc/config/workflow.yaml
   execution:
     max_parallel_stages: 2 # Runnable stages; not worker-pool concurrency
   ```

4. **Enable request caching:**
   ```yaml
   # .ad-sdlc/config/workflow.yaml
   github:
     cache_enabled: true
     cache_ttl_seconds: 300
   ```

---

### E002: Agent Timeout

**Symptom:**

```
Error: Agent 'worker' timed out after 600000ms
```

**Cause:**
Task complexity exceeds time limit, or external service (API, GitHub) is responding slowly.

**Diagnosis:**

```bash
# Check agent-specific logs
tail -50 .ad-sdlc/logs/agent-logs/worker.log

# Check API response times
time curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

**Solutions:**

1. **Increase timeout:**

   ```yaml
   # .ad-sdlc/config/workflow.yaml
   timeouts:
     worker: 900 # 15 minutes (was 600)
   ```

2. **Break down large tasks:**
   Split complex issues into smaller, focused issues in the PRD stage.

3. **Use faster model for simple tasks:**

   ```yaml
   agents:
     worker:
       model: 'haiku' # For simple tasks
   ```

4. **Check network connectivity:**
   ```bash
   # Test latency to API
   ping -c 5 api.anthropic.com

   # Check for proxy issues
   echo $http_proxy $https_proxy
   ```

---

### E003: Scratchpad Corruption

**Symptom:**

```
Error: Invalid YAML in .ad-sdlc/scratchpad/documents/prd.yaml
```

**Cause:**
YAML file contains syntax errors, possibly from interrupted writes or manual edits.

**Diagnosis:**

```bash
# Validate YAML syntax
npx js-yaml .ad-sdlc/scratchpad/documents/prd.yaml

# Or with Python
python3 -c "import yaml; yaml.safe_load(open('.ad-sdlc/scratchpad/documents/prd.yaml'))"

# Find syntax error location
yamllint .ad-sdlc/scratchpad/documents/prd.yaml
```

**Solutions:**

1. **Backup and fix:**

   ```bash
   # Create backup
   cp -r .ad-sdlc/scratchpad .ad-sdlc/scratchpad.bak.$(date +%Y%m%d_%H%M%S)

   # Fix common issues
   # - Check for unescaped special characters
   # - Verify proper indentation
   # - Look for unclosed quotes
   ```

2. **Restore from checkpoint:**

   ```bash
   # List available checkpoints
   ls -la .ad-sdlc/scratchpad/checkpoints/

   # Restore specific checkpoint
   cp .ad-sdlc/scratchpad/checkpoints/prd_20241230_120000.yaml \
      .ad-sdlc/scratchpad/documents/prd.yaml
   ```

3. **Regenerate:** the CLI cannot rerun a single completed stage. Start a new
   session (run without `--resume`), or resume the saved session if the stage
   did not complete:
   ```bash
   ad-sdlc run "<requirements>" --resume <session-id>
   ```

---

### E004: Authentication Failed

**Symptom:**

```
Error: Authentication failed for repository
```

or

```
Error: Invalid API key
```

**Diagnosis:**

```bash
# Check GitHub authentication
gh auth status

# Verify API key is set
echo ${ANTHROPIC_API_KEY:0:20}...

# Test API key validity
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
```

**Solutions:**

1. **Re-authenticate GitHub:**

   ```bash
   gh auth logout
   gh auth login
   ```

2. **Refresh API key:**

   ```bash
   # Update in environment
   export ANTHROPIC_API_KEY="sk-ant-api03-new-key..."

   # Or update .env file
   echo "ANTHROPIC_API_KEY=sk-ant-api03-new-key..." > .env
   ```

3. **Check SSH keys (for SSH Git URLs):**
   ```bash
   ssh -T git@github.com
   ```

---

### E005: Permission Denied

**Symptom:**

```
Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/ad-sdlc'
```

or

```
Error: Permission denied writing to .ad-sdlc/scratchpad/
```

**Diagnosis:**

```bash
# Check directory ownership
ls -la .ad-sdlc/
ls -la /usr/local/lib/node_modules/

# Check current user
whoami
```

**Solutions:**

1. **Fix local permissions:**

   ```bash
   # Fix project directory
   sudo chown -R $(whoami) .ad-sdlc/
   chmod -R u+rw .ad-sdlc/
   ```

2. **Use user-local npm:**

   ```bash
   # Configure npm to use user directory
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc

   # Reinstall
   npm install -g ad-sdlc
   ```

3. **Avoid running as root:**
   Never run `ad-sdlc` with `sudo`. If you must, ensure proper ownership afterward.

---

### E006: Dependency Resolution Failed

**Symptom:**

```
Error: Circular dependency detected in issue graph
```

or

```
Error: Unresolved dependency: issue-15 requires issue-99 (not found)
```

**Diagnosis:**

```bash
# View dependency graph
cat .ad-sdlc/scratchpad/issues/dependency_graph.yaml
```

**Solutions:**

1. **For circular dependencies:**

   ```bash
   # Find the cycle in the dependency graph, then break it by editing issues
   vim .ad-sdlc/scratchpad/issues/issues.yaml
   ```

2. **For missing dependencies:**
   ```bash
   # Check if dependency issue exists
   gh issue view 99

   # If not, create it or remove the dependency
   ```

---

### E007: Model Context Exceeded

**Symptom:**

```
Error: Context window exceeded. Input tokens: 250000, Maximum: 200000
```

**Cause:**
The combined input (agent prompt + scratchpad content + conversation) exceeds model limits.

**Solutions:**

1. **Reduce scratchpad content:**

   ```yaml
   # .ad-sdlc/config/workflow.yaml
   scratchpad:
     max_document_size_kb: 100 # Limit individual documents
     summarize_large_outputs: true
   ```

2. **Use chunking strategy:**

   ```yaml
   agents:
     document-reader:
       chunking:
         enabled: true
         max_chunk_size: 50000 # tokens
         overlap: 1000
   ```

3. **Clean up old scratchpad data:** there is no cleanup command; remove the
   saved data of sessions you no longer need from `.ad-sdlc/scratchpad/`.

---

## Diagnostic Procedures

### Checking Agent Status

```bash
# Overall pipeline status
ad-sdlc status

# Expected output:
# Pipeline Status: running
# Current Stage: implementation
# Active Agents: worker-1, worker-2
# Completed Stages: collector, prd-writer, srs-writer, sds-writer, issue-generator
# Issues: 5/10 completed (50%)
# Estimated Time Remaining: 15 minutes
```

**Understanding Status Output:**

| Field            | Description                                        |
| ---------------- | -------------------------------------------------- |
| Pipeline Status  | `idle`, `running`, `paused`, `completed`, `failed` |
| Current Stage    | Active pipeline stage                              |
| Active Agents    | Currently executing agents                         |
| Completed Stages | Successfully finished stages                       |
| Issues           | Implementation progress                            |

### Inspecting Scratchpad State

The scratchpad contains all intermediate outputs:

```bash
# View scratchpad structure
tree .ad-sdlc/scratchpad/

# Output structure:
# .ad-sdlc/scratchpad/
# ├── documents/
# │   ├── prd.yaml          # PRD output
# │   ├── srs.yaml          # SRS output
# │   └── sds.yaml          # SDS output
# ├── issues/
# │   ├── issues.yaml       # Generated issues
# │   └── dependency_graph.yaml
# ├── progress/
# │   ├── checkpoint.yaml   # Resume point
# │   └── results/          # Issue implementation results
# └── logs/
#     └── stage_logs/       # Per-stage logs
```

**Inspect specific outputs:**

```bash
# View PRD content
cat .ad-sdlc/scratchpad/documents/prd.yaml | head -100

# View generated issues
cat .ad-sdlc/scratchpad/issues/issues.yaml

# Check progress
cat .ad-sdlc/scratchpad/progress/checkpoint.yaml
```

### Viewing Logs

**Log Locations:**

| Log File                         | Content                     |
| -------------------------------- | --------------------------- |
| `.ad-sdlc/logs/pipeline.log`     | Main pipeline execution log |
| `.ad-sdlc/logs/agent-logs/*.log` | Individual agent logs       |
| `.ad-sdlc/logs/api-calls.log`    | Claude API call records     |
| `.ad-sdlc/logs/github-ops.log`   | GitHub operation logs       |

**Common Log Commands:**

```bash
# Follow pipeline log in real-time
tail -f .ad-sdlc/logs/pipeline.log

# Search for errors
grep -i "error\|failed\|exception" .ad-sdlc/logs/pipeline.log

# View specific agent's activity
cat .ad-sdlc/logs/agent-logs/worker.log

# View last 50 API calls
tail -50 .ad-sdlc/logs/api-calls.log

# Filter by timestamp
grep "2024-12-30" .ad-sdlc/logs/pipeline.log
```

**Log Level Configuration:**

```yaml
# .ad-sdlc/config/workflow.yaml
logging:
  level: debug # trace, debug, info, warn, error
  file_retention_days: 7
  max_file_size_mb: 50
```

---

## Recovery Procedures

### Resume from Failure

Every run saves its state per session in
`.ad-sdlc/scratchpad/pipeline/<session-id>.yaml`. Resuming reuses the saved
stage graph and runtime policy and skips the stages that session already
completed:

```bash
# List saved sessions and their state
ad-sdlc status --verbose

# Resume a session
ad-sdlc run "<requirements>" --resume <session-id>
```

Only `--stop-after` may change on resume; other runtime overrides are
rejected.

### Redo a Stage

The CLI cannot reset or rerun a single completed stage, mark a stage complete,
or start from a later stage. When a completed stage produced incorrect output,
start a new session:

```bash
ad-sdlc run "<requirements>"
```

To keep earlier documents and only update them, use the Enhancement pipeline
(`--mode enhancement`), which reads the existing documents and code.

### Manual Intervention

Stop a running pipeline with `Ctrl+C`, back up the state before editing
anything by hand, then resume:

```bash
cp -r .ad-sdlc/scratchpad .ad-sdlc/scratchpad.manual-backup
ad-sdlc run "<requirements>" --resume <session-id>
```

---

## Performance Troubleshooting

### Slow Pipeline Execution

**Diagnosis:**

```bash
# Check stage timing
grep "Stage completed" .ad-sdlc/logs/pipeline.log | tail -20

# View API response times
grep "response_time" .ad-sdlc/logs/api-calls.log | awk '{sum+=$NF; count++} END {print "Avg:", sum/count, "ms"}'

# Check parallel worker utilization
grep "Worker" .ad-sdlc/logs/pipeline.log | grep -E "start|complete"
```

**Optimization Strategies:**

1. **Increase parallelism (if rate limits allow):**

   ```yaml
   execution:
     max_parallel_stages: 5 # Runnable stages; not worker-pool concurrency
   ```

2. **Use appropriate models:**

   ```yaml
   agents:
     collector:
       model: 'haiku' # Fast for simple tasks
     prd-writer:
       model: 'sonnet' # Balanced
     worker:
       model: 'sonnet' # Good code generation
   ```

3. **Enable caching:**
   ```yaml
   caching:
     enabled: true
     ttl_minutes: 30
     cache_dir: '.ad-sdlc/cache'
   ```

### High Token Usage

**Diagnosis:**

```bash
# Check token usage per stage
grep "tokens_used" .ad-sdlc/logs/api-calls.log | \
  awk '{stage=$2; tokens+=$NF} END {for(s in stage) print s, tokens[s]}'

# Token usage of recorded runs (part of the delivery metrics report)
ad-sdlc telemetry report
```

**Reduction Strategies:**

1. **Limit document size:**

   ```yaml
   documents:
     prd:
       max_requirements: 20
     sds:
       max_components: 30
   ```

2. **Use efficient prompts:**
   - Keep agent prompts concise
   - Avoid redundant context

3. **Summarize large inputs:**
   ```yaml
   agents:
     document-reader:
       summarize_inputs: true
       max_input_tokens: 50000
   ```

### Memory Issues

**Symptoms:**

- Process killed unexpectedly
- "JavaScript heap out of memory" errors

**Solutions:**

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or add to workflow.yaml
runtime:
  node_options: "--max-old-space-size=4096"
```

---

## GitHub Integration Issues

### Issues Not Being Created

**Diagnosis:**

```bash
# Check GitHub CLI auth
gh auth status

# Test issue creation manually
gh issue create --title "Test" --body "Test issue" --repo owner/repo

# Check GitHub operation logs
tail -50 .ad-sdlc/logs/github-ops.log
```

**Solutions:**

1. **Verify repository access:**

   ```bash
   gh repo view owner/repo
   ```

2. **Check configuration:**

   ```yaml
   # .ad-sdlc/config/workflow.yaml
   github:
     repository: 'owner/repo' # Must match exactly
     create_issues: true
   ```

3. **Verify permissions:**
   ```bash
   gh api repos/owner/repo --jq '.permissions'
   ```

### PRs Not Merging

**Diagnosis:**

```bash
# Check PR status
gh pr status

# View PR checks
gh pr checks <pr-number>

# View PR review status
gh pr view <pr-number> --json reviews
```

**Common Causes and Solutions:**

| Issue             | Solution                               |
| ----------------- | -------------------------------------- |
| Failed checks     | Fix failing tests/lint                 |
| Review required   | Configure auto-review or add reviewers |
| Branch protection | Adjust branch rules or use admin merge |
| Conflicts         | Rebase or resolve conflicts            |

```bash
# Force merge (admin only, use cautiously)
gh pr merge <pr-number> --admin --squash
```

### Branch Conflicts

**Resolution:**

```bash
# Fetch latest changes
git fetch origin

# Rebase feature branch
git checkout feature/issue-123
git rebase origin/main

# If conflicts, resolve and continue
# ... edit conflicting files ...
git add .
git rebase --continue

# Force push (careful!)
git push --force-with-lease
```

---

## Agent-Specific Issues

### Collector Agent Issues

**Issue: Requirements not being extracted properly**

```bash
# Check collector output
cat .ad-sdlc/scratchpad/collected_info.yaml

# Verify input was received
grep "user_input" .ad-sdlc/logs/agent-logs/collector.log
```

**Solution:** Provide clearer, more structured requirements.

### Worker Agent Issues

**Issue: Code not passing tests**

```bash
# View worker attempts
grep "verification" .ad-sdlc/logs/agent-logs/worker.log

# Check test output
cat .ad-sdlc/scratchpad/progress/results/issue-5/test_output.log
```

**Solution:**

- Increase retry attempts
- Provide more context in issue description
- Consider simpler test requirements initially

### PR Reviewer Agent Issues

**Issue: Reviews are too strict/lenient**

```yaml
# Adjust review thresholds
agents:
  pr-reviewer:
    quality_gates:
      coverage_threshold: 70 # Lower from 80
      complexity_threshold: 15 # Raise from 10
      allow_warnings: true
```

---

## Environment Issues

### Proxy Configuration

For corporate environments:

```bash
# Set proxy
export http_proxy=http://proxy.company.com:8080
export https_proxy=http://proxy.company.com:8080
export no_proxy=localhost,127.0.0.1

# Or in workflow.yaml
network:
  proxy:
    http: "http://proxy.company.com:8080"
    https: "http://proxy.company.com:8080"
    no_proxy: ["localhost", "127.0.0.1"]
```

### SSL Certificate Issues

```bash
# If using self-signed certificates
export NODE_TLS_REJECT_UNAUTHORIZED=0  # Not recommended for production

# Better: add certificate to trust store
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.crt
```

### Cloud Provider Integration

**AWS Bedrock:**

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1
export AWS_PROFILE=my-profile
```

**Google Vertex AI:**

```bash
export CLAUDE_CODE_USE_VERTEX=1
export GOOGLE_CLOUD_PROJECT=my-project
export GOOGLE_CLOUD_REGION=us-central1
```

---

## Getting More Help

If issues persist after following this guide:

1. **Search existing issues:**
   [GitHub Issues](https://github.com/kcenon/claude_code_agent/issues)

2. **Open new issue with diagnostics:**

   ```bash
   # Collect environment checks and pipeline status
   ad-sdlc doctor > diagnostic-report.txt
   ad-sdlc status --verbose >> diagnostic-report.txt

   # Include in issue
   gh issue create --title "Issue: <description>" \
     --body-file diagnostic-report.txt
   ```

3. **Community support:**
   Join discussions in the repository.

---

_Part of [AD-SDLC Documentation](../README.md)_
