# Frequently Asked Questions (FAQ)

> **Version**: 1.1.0

This document answers common questions about the AD-SDLC system. For detailed troubleshooting procedures, see the [Troubleshooting Guide](guides/troubleshooting.md).

## Table of Contents

1. [General Questions](#general-questions)
2. [Setup & Configuration](#setup--configuration)
3. [Usage & Workflow](#usage--workflow)
4. [Documents & Output](#documents--output)
5. [Agents & Customization](#agents--customization)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Topics](#advanced-topics)
8. [Enterprise & Security](#enterprise--security)

---

## General Questions

### What is AD-SDLC?

AD-SDLC (Agent-Driven Software Development Lifecycle) is an automated pipeline that uses Claude-powered agents to transform natural language requirements into production-ready code. It handles the entire software development process: requirements gathering, documentation, issue tracking, implementation, and code review.

### How long does a typical project take?

| Project Type      | Estimated Time |
| ----------------- | -------------- |
| Simple feature    | 15-20 minutes  |
| Medium complexity | 30-45 minutes  |
| Complex feature   | 45-90 minutes  |
| Full application  | 2-4 hours      |

Times depend on:

- Complexity of requirements
- Number of issues generated
- API response times
- Code review iterations

### What languages/frameworks are supported?

AD-SDLC is language-agnostic. It can generate code in any language Claude supports, including:

- TypeScript/JavaScript
- Python
- Java
- Go
- Rust
- C/C++
- Ruby
- PHP

### Do I need a GitHub account?

GitHub is optional but recommended. Without GitHub:

- Documents are still generated locally
- Issues are saved to `.ad-sdlc/scratchpad/issues/`
- PRs are simulated as local branches

With GitHub:

- Issues are created on your repository
- PRs are opened automatically
- Full automation of the development workflow

### How much does it cost?

AD-SDLC uses Claude API tokens. Costs depend on:

- Model used (Sonnet, Opus, Haiku)
- Complexity of tasks
- Number of iterations

**Typical costs:**

| Task            | Estimated Cost |
| --------------- | -------------- |
| Simple feature  | $0.50 - $2.00  |
| Medium feature  | $2.00 - $5.00  |
| Complex feature | $5.00 - $15.00 |

Use `ad-sdlc status` to view token usage during execution.

---

## Setup & Configuration

### How do I set my API key?

**Option 1: Environment Variable (Recommended)**

```bash
# Add to ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

**Option 2: Claude CLI Login**

```bash
claude login
```

**Option 3: Project-specific**

```bash
# Create .env file (add to .gitignore!)
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

### Can I use a different model?

Yes. Configure in `.ad-sdlc/config/agents.yaml`:

```yaml
agents:
  prd-writer:
    model: opus # Use opus for complex reasoning
  worker:
    model: sonnet # sonnet is good for most tasks
  validator:
    model: haiku # haiku for simple validation tasks
```

### How do I configure GitHub integration?

1. **Authenticate GitHub CLI:**

   ```bash
   gh auth login
   ```

2. **Configure repository in project:**
   ```yaml
   # .ad-sdlc/config/workflow.yaml
   github:
     repository: owner/repo-name
     default_branch: main
     create_issues: true
     create_prs: true
   ```

### Can I use this in a corporate environment?

Yes. For corporate environments:

1. **Proxy configuration:**

   ```bash
   export http_proxy=http://proxy.company.com:8080
   export https_proxy=http://proxy.company.com:8080
   ```

2. **Cloud provider integration:**

   ```bash
   # AWS Bedrock
   export CLAUDE_CODE_USE_BEDROCK=1

   # Google Vertex AI
   export CLAUDE_CODE_USE_VERTEX=1
   ```

3. **Air-gapped environments:**
   Contact sales for enterprise deployment options.

---

## Usage & Workflow

### Can I intervene in the process?

Yes! The system supports intervention at multiple points:

1. **Approval Gates:**
   Request a decision at every review and delivery gate in
   `.ad-sdlc/config/workflow.yaml`:

   ```yaml
   global:
     approval_mode: manual # or: auto (default), critical
   ```

   Or for one run: `ad-sdlc run "<requirements>" --approval-mode manual`.
   See [Approval Policy](guides/approval-policy.md).

2. **Stop and Resume:**
   Press `Ctrl+C` to cancel the run, or stop early with `--stop-after <stage>`.
   Find the session ID with `ad-sdlc status`, then resume:

   ```bash
   ad-sdlc run "<requirements>" --resume <session-id>
   ```

3. **Manual Edits:**
   Edit documents in `.ad-sdlc/scratchpad/documents/` before proceeding.

### What if something goes wrong?

**Check status:**

```bash
ad-sdlc status
```

**View logs:**

```bash
# All logs
cat .ad-sdlc/logs/pipeline.log

# Specific agent
cat .ad-sdlc/logs/agent-logs/worker.log
```

**Resume a saved session** (completed stages are skipped):

```bash
ad-sdlc run "<requirements>" --resume <session-id>
```

**Start over:** run `ad-sdlc run "<requirements>"` without `--resume`; it
starts a new session.

### Can I customize the agents?

Yes. Agent definitions are in `.claude/agents/`:

1. **Modify prompts:**
   Edit the markdown content in agent files.

2. **Change tools:**

   ```yaml
   ---
   name: worker
   tools: Read, Write, Edit, Bash, Grep
   ---
   ```

3. **Add new agents:**
   Create a new `.md` file in `.claude/agents/`.

See [Agent Customization Guide](guides/deployment.md) for details.

### How do I customize document templates?

Templates are in `.ad-sdlc/templates/`:

1. **PRD Template:** `prd-template.md`
2. **SRS Template:** `srs-template.md`
3. **SDS Template:** `sds-template.md`
4. **Issue Template:** `issue-template.md`

Modify these files to change document structure.

### Can agents work in parallel?

Yes. The Controller agent manages parallel execution:

```yaml
# .ad-sdlc/config/workflow.yaml
execution:
  max_parallel_workers: 3 # Run up to 3 workers
  dependency_check: true # Respect issue dependencies
```

Document generation is sequential, but issue implementation can be parallel.

---

## Documents & Output

### What documents are generated?

AD-SDLC generates three core documents following software engineering best practices:

| Document                                      | Purpose                   | Contains                                         |
| --------------------------------------------- | ------------------------- | ------------------------------------------------ |
| **PRD** (Product Requirements Document)       | Define WHAT to build      | Features, user stories, acceptance criteria      |
| **SRS** (Software Requirements Specification) | Define HOW it should work | Functional requirements, data models, interfaces |
| **SDS** (Software Design Specification)       | Define HOW to build it    | Architecture, components, APIs, database schema  |

### Can I customize document templates?

Yes. Templates are in `.ad-sdlc/templates/`:

```bash
# List available templates
ls .ad-sdlc/templates/

# Customize PRD template
vim .ad-sdlc/templates/prd-template.md
```

Template variables available:

- `{{project_name}}` - Project name
- `{{timestamp}}` - Generation timestamp
- `{{requirements}}` - Extracted requirements
- `{{version}}` - Document version

### How do I export documents to other formats?

AD-SDLC has no export command. Generated documents are Markdown files in the
project (the PRD, for example, is `docs/prd/PRD-<project-id>.md`), so convert
them with your own tooling, for example
`pandoc docs/prd/PRD-<project-id>.md -o PRD.pdf`.

### Can I use existing documents instead of generating new ones?

Yes, through the pipeline mode rather than per-document options:

```bash
# Existing project: read the existing documents and code, then update them
ad-sdlc run "Add rate limiting to the public API" --mode enhancement

# Existing GitHub issues: skip document generation and implement the issues
ad-sdlc run "Implement the open issues" --mode import
```

`ad-sdlc run` has no option to skip individual stages or to start from a later
stage; `--stop-after <stage>` only ends a run early.

### Where are the generated files saved?

All outputs are saved to the scratchpad directory:

```
.ad-sdlc/scratchpad/
├── documents/         # PRD, SRS, SDS
│   ├── prd.yaml
│   ├── srs.yaml
│   └── sds.yaml
├── issues/            # Generated issues
│   └── issues.yaml
├── progress/          # Implementation results
│   ├── checkpoint.yaml
│   └── results/
└── logs/              # Execution logs
```

---

## Agents & Customization

### What agents are available?

| Agent             | Purpose                                      | Stage             |
| ----------------- | -------------------------------------------- | ----------------- |
| Collector         | Extract requirements from user input         | Input Processing  |
| PRD Writer        | Generate Product Requirements Document       | Documentation     |
| SRS Writer        | Generate Software Requirements Specification | Documentation     |
| SDS Writer        | Generate Software Design Specification       | Documentation     |
| Issue Generator   | Create GitHub issues from SDS                | Issue Management  |
| Controller        | Orchestrate worker execution                 | Execution         |
| Worker            | Implement issues (write code)                | Implementation    |
| PR Reviewer       | Review and merge PRs                         | Quality Assurance |
| Regression Tester | Test for regressions                         | Testing           |

### How do I create a custom agent?

1. **Define agent metadata** in `.ad-sdlc/config/agents.yaml`:

   ```yaml
   agents:
     my-agent:
       id: 'my-agent'
       name: 'My Agent'
       definition_file: '.claude/agents/my-agent.md'
       category: 'custom'
   ```

2. **Create agent definition** in `.claude/agents/my-agent.md`

3. **Add to workflow** in `.ad-sdlc/config/workflow.yaml`

See the [Agent Customization Guide](guides/agent-customization.md) for details.

### Can agents use external tools?

Yes, via MCP (Model Context Protocol):

```yaml
# .ad-sdlc/config/workflow.yaml
mcp:
  servers:
    my-tools:
      command: 'node'
      args: ['tools/server.js']
```

### How do I change which model an agent uses?

```yaml
# .ad-sdlc/config/workflow.yaml
agents:
  prd-writer:
    model: 'opus' # For complex reasoning
  worker:
    model: 'sonnet' # Default for most tasks
  collector:
    model: 'haiku' # For quick, simple tasks
```

### Can I disable specific agents?

Not individually. The pipeline mode selects the stages, and `ad-sdlc run` has
no option to skip a stage. These options narrow a run instead:

```bash
# Stop after the documents are generated (no issues, code, or pull requests)
ad-sdlc run "<requirements>" --stop-after sds_generation

# Run without GitHub (local mode)
ad-sdlc run "<requirements>" --local

# Keep failed verification checks as findings instead of stopping the run
ad-sdlc run "<requirements>" --vnv-profile advisory
```

The verification stage itself always runs; see the
[verification policy guide](guides/verification-policy.md).

---

## Troubleshooting

For detailed troubleshooting procedures, see the [Troubleshooting Guide](guides/troubleshooting.md).

### Error: API Rate Limit Exceeded

**Symptom:**

```
Error: GitHub API rate limit exceeded. Retry after: 3600s
```

**Cause:** Too many GitHub API calls.

**Solutions:**

1. Wait for rate limit reset
2. Authenticate with GitHub CLI for higher limits:
   ```bash
   gh auth login
   ```
3. Reduce parallelism:
   ```yaml
   execution:
     max_parallel_workers: 2
   ```

### Error: Agent Timeout

**Symptom:**

```
Error: Agent 'worker' timed out after 600000ms
```

**Cause:** Task too complex or slow API response.

**Solutions:**

1. Increase timeout:
   ```yaml
   agents:
     worker:
       timeout_ms: 900000 # 15 minutes
   ```
2. Break down into smaller tasks
3. Check network connectivity

### Error: Invalid Configuration

**Symptom:**

```
Error: Invalid configuration in workflow.yaml
```

**Solution:**

1. Validate configuration:
   ```bash
   ad-sdlc validate
   ```
2. Check YAML syntax
3. Ensure all required fields are present

### Error: Scratchpad Corruption

**Symptom:**

```
Error: Invalid YAML in .ad-sdlc/scratchpad/documents/output.yaml
```

**Solutions:**

1. Backup current state:
   ```bash
   cp -r .ad-sdlc/scratchpad .ad-sdlc/scratchpad.bak
   ```
2. Validate YAML:
   ```bash
   npx js-yaml .ad-sdlc/scratchpad/documents/output.yaml
   ```
3. Fix syntax errors or restore from backup
4. Resume the saved session (`ad-sdlc status` lists the session IDs):
   ```bash
   ad-sdlc run "<requirements>" --resume <session-id>
   ```

### Error: Permission Denied

**Symptom:**

```
Error: EACCES: permission denied
```

**Solutions:**

1. Check file permissions
2. Don't run as root
3. For global npm:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   ```

### Error: Git Authentication Failed

**Symptom:**

```
Error: Authentication failed for repository
```

**Solutions:**

1. Check GitHub CLI authentication:
   ```bash
   gh auth status
   ```
2. Re-authenticate:
   ```bash
   gh auth login
   ```
3. Check SSH keys if using SSH URLs

### Pipeline Stuck - No Progress

**Symptom:** Pipeline shows no progress for extended time.

**Diagnostic Steps:**

1. Check status:
   ```bash
   ad-sdlc status
   ```
2. Check logs for errors:
   ```bash
   tail -f .ad-sdlc/logs/pipeline.log
   ```
3. Check API connectivity:
   ```bash
   curl https://api.anthropic.com/v1/messages
   ```

**Solutions:**

- Bound a stalled stage: `ad-sdlc run "<requirements>" --stage-timeout-ms <ms>`
- Resume the saved session: `ad-sdlc run "<requirements>" --resume <session-id>`
  (completed stages are skipped)
- Start over: run without `--resume`, which starts a new session

---

## Advanced Topics

### Can I use AD-SDLC in CI/CD?

Yes. Example GitHub Actions workflow:

```yaml
name: AD-SDLC Implementation
on:
  issues:
    types: [labeled]

jobs:
  implement:
    if: github.event.label.name == 'auto-implement'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install AD-SDLC (from source; it is not on the npm registry yet)
        run: |
          git clone https://github.com/kcenon/claude_code_agent.git "$RUNNER_TEMP/ad-sdlc"
          (cd "$RUNNER_TEMP/ad-sdlc" && npm ci && npm run build)
          npm install -g "$RUNNER_TEMP/ad-sdlc"
      - name: Run the Import pipeline
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: ad-sdlc run "" --mode import --non-interactive
```

The Import pipeline reads the repository's open issues; with the default
`approval_mode: auto` it never waits for input. See
[Headless Execution](headless-execution.md) for exit statuses and
[Usage Scenarios](guides/usage-scenarios.md#scenario-d-import-from-issues).

### How do I extend with custom tools?

Use MCP (Model Context Protocol) to add custom tools:

1. **Create MCP server:**

   ```javascript
   // tools/my-tool.js
   module.exports = {
     name: 'my-tool',
     description: 'Custom tool description',
     execute: async (params) => {
       // Implementation
       return result;
     },
   };
   ```

2. **Register in configuration:**
   ```yaml
   mcp:
     servers:
       my-tools:
         command: node
         args: [tools/server.js]
   ```

### How do I integrate with my existing workflow?

Pick the mode and the stopping point:

1. **Existing project with documents:**

   ```bash
   ad-sdlc run "<change request>" --mode enhancement
   ```

2. **Existing issues:**

   ```bash
   ad-sdlc run "" --mode import
   ```

3. **Documents only:**
   ```bash
   ad-sdlc run "<requirements>" --stop-after sds_generation  # no implementation
   ```

### Is there an API for programmatic access?

The package exports the modules the CLI is built from (orchestrator, agents,
configuration, scratchpad); see
[Package entry points](guides/package-entry-points.md). There is no single
facade class that runs the whole pipeline: `ad-sdlc run` is the supported way
to run it, and `--format json` gives a machine-readable result.

---

## Enterprise & Security

### Is my data sent to external servers?

Your data is processed through:

1. **Claude API (Anthropic)** - For AI reasoning
2. **GitHub API** - For issue/PR management (if enabled)

**Data NOT sent externally:**

- Source code (unless explicitly included in prompts)
- Environment variables
- Credentials

### Can I use AD-SDLC offline?

No. AD-SDLC requires:

- Internet connection for Claude API
- GitHub API access (optional but recommended)

For air-gapped environments, contact for enterprise deployment options.

### How do I use AD-SDLC with SSO/SAML?

For enterprise SSO:

```yaml
# .ad-sdlc/config/workflow.yaml
authentication:
  type: 'sso'
  provider: 'okta' # or azure-ad, google, etc.
  client_id: '${SSO_CLIENT_ID}'
```

### Is there an audit log?

Yes. The security audit logger writes JSON Lines files, one event per line, to
`.ad-sdlc/logs/audit/audit-<timestamp>.jsonl` (set `AD_SDLC_AUDIT_LOG_DIR` to
change the directory). There is no export command; the files are already
machine-readable:

```bash
cat .ad-sdlc/logs/audit/audit-*.jsonl
```

### How do I prevent secrets from being committed?

AD-SDLC's logger masks values that match known secret patterns (API keys,
tokens) in its own log output, but it does not scan commits or pull requests
for secrets and has no configuration or command for that. Keep `.env` files in `.gitignore` and use
your repository's secret scanning or a pre-commit secret scanner.

### Can I run AD-SDLC in a Docker container?

Yes, with the Docker Compose setup in this repository's `docker/` directory;
there is no published image. See
[Usage Scenarios](guides/usage-scenarios.md#scenario-e-docker-single-instance-tier-a).

### How do I integrate with my CI/CD pipeline?

There is no published GitHub Action or container image. Install AD-SDLC in the
job and run the pipeline non-interactively; see
[Can I use AD-SDLC in CI/CD?](#can-i-use-ad-sdlc-in-cicd) for a GitHub Actions
example. The same steps work in other CI systems, for example GitLab CI:

```yaml
implement:
  image: node:22
  script:
    - git clone https://github.com/kcenon/claude_code_agent.git /opt/ad-sdlc
    - (cd /opt/ad-sdlc && npm ci && npm run build)
    - npm install -g /opt/ad-sdlc
    - ad-sdlc run "" --mode import --non-interactive
```

### What compliance certifications does AD-SDLC support?

None. AD-SDLC is not certified against any compliance standard and has no
compliance configuration; assess it within your own compliance program.

### How do I rotate API keys?

```bash
# Update environment
export ANTHROPIC_API_KEY="sk-ant-new-key..."

# Or update .env
echo "ANTHROPIC_API_KEY=sk-ant-new-key..." > .env

# Check that a key or Claude Code session is detected
ad-sdlc doctor
```

`ad-sdlc doctor` checks that a key is present; it does not call the API. The
next live run uses the new key.

---

## Getting More Help

If your question isn't answered here:

1. **Check documentation:**
   - [Installation Guide](installation.md)
   - [Quickstart](quickstart.md)
   - [Use Cases](use-cases.md)
   - [Troubleshooting Guide](guides/troubleshooting.md)

2. **Search issues:**
   [GitHub Issues](https://github.com/kcenon/claude_code_agent/issues)

3. **Open new issue:**
   [New Issue](https://github.com/kcenon/claude_code_agent/issues/new)

4. **Community:**
   Join discussions in the repository.

---

_Part of [AD-SDLC Documentation](../README.md)_
