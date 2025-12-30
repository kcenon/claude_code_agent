# GitHub Repo Setup Agent Documentation

## Overview

The GitHub Repo Setup Agent is responsible for creating and initializing public GitHub repositories after SRS approval. It bridges the gap between requirements specification and design, ensuring the project is publicly available before detailed design begins.

## Pipeline Position

```
Collector → PRD Writer → SRS Writer → GitHub Repo Setup → SDS Writer → Issue Generator
                                            ↑
                                       You are here
```

## Purpose

The GitHub Repo Setup Agent:
1. Extracts project information from PRD and SRS documents
2. Generates comprehensive README.md with project overview
3. Selects and generates appropriate LICENSE file
4. Creates .gitignore based on technology stack
5. Creates public GitHub repository using gh CLI
6. Performs initial commit and push
7. Stores repository information for downstream agents

## Input

- **PRD Location**: `.ad-sdlc/scratchpad/documents/{project_id}/prd.md`
- **SRS Location**: `.ad-sdlc/scratchpad/documents/{project_id}/srs.md`
- **Requirements**:
  - Valid PRD with project name and description
  - Valid SRS with technology stack
  - GitHub CLI authenticated (`gh auth status`)

## Output

- **Scratchpad**: `.ad-sdlc/scratchpad/repo/{project_id}/github_repo.yaml`
- **Repository Files** (committed to GitHub):
  - `README.md`
  - `LICENSE`
  - `.gitignore`
  - Initial directory structure

## Output Schema

```yaml
github_repo:
  name: string              # Repository name (kebab-case)
  owner: string             # GitHub username or organization
  url: string               # Full repository URL
  visibility: public
  created_at: datetime      # ISO 8601 format

  configuration:
    description: string     # Short description from PRD
    topics: list            # Topic tags for discoverability
    has_issues: true
    has_projects: true
    default_branch: main

  initial_files:
    readme: true
    license: string         # MIT, Apache-2.0, GPL-3.0, etc.
    gitignore: string       # Template name (e.g., Node, Python)

  initial_commit:
    sha: string
    message: string

  status: success|failed
  error_message: string     # Only if status is failed
```

## Supported Licenses

| License | SPDX ID | Description |
|---------|---------|-------------|
| MIT | MIT | Permissive, simple and short |
| Apache 2.0 | Apache-2.0 | Permissive with patent grant |
| GPL 3.0 | GPL-3.0-only | Copyleft, derivative works must be GPL |
| BSD 3-Clause | BSD-3-Clause | Permissive, no endorsement clause |
| ISC | ISC | Simplified MIT/BSD license |
| Unlicense | Unlicense | Public domain dedication |

## .gitignore Generation

Technology detection maps SRS technology stack to templates:

| Technology | Template |
|------------|----------|
| TypeScript/JavaScript | Node |
| Python | Python |
| Java | Java |
| Go | Go |
| Rust | Rust |
| C/C++ | C++ |

## GitHub CLI Commands

```bash
# Authentication check
gh auth status

# Create public repository
gh repo create {repo-name} \
  --public \
  --description "{description}" \
  --source . \
  --remote origin \
  --push

# Add topics for discoverability
gh repo edit {owner}/{repo-name} \
  --add-topic "{topic1}" \
  --add-topic "{topic2}"
```

## Workflow

1. **Read Documents** - Load PRD and SRS from scratchpad
2. **Extract Information** - Parse project name, description, tech stack
3. **Prepare Files** - Generate README, LICENSE, .gitignore
4. **Verify Auth** - Check `gh auth status`
5. **Create Repository** - Execute `gh repo create`
6. **Initial Commit** - Stage, commit, and push files
7. **Store Info** - Save metadata to scratchpad
8. **Verify Success** - Confirm repository is accessible

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| GitHubAuthError | gh not authenticated | Run `gh auth login` |
| RepoNameTakenError | Repository name exists | Suggest alternative names |
| NetworkError | Connection issues | Retry with exponential backoff |
| PermissionDeniedError | Insufficient permissions | Check required permissions |
| InvalidProjectNameError | Invalid characters | Sanitize to valid name |

## Configuration

```yaml
# .ad-sdlc/config/workflow.yaml
agents:
  github-repo-setup:
    model: "sonnet"
    tools:
      - Read
      - Write
      - Edit
      - Glob
      - Grep
      - Bash
    repository:
      visibility: "public"
      default_branch: "main"
      default_license: "MIT"
    github:
      require_auth: true
      add_topics: true
```

## Quality Criteria

The GitHub Repo Setup Agent ensures:

1. **Repository Creation**: Repository successfully created and accessible
2. **README Quality**: All required sections present
3. **License Accuracy**: LICENSE file matches selected type
4. **gitignore Coverage**: Covers technology stack
5. **Data Availability**: Repository URL stored for downstream agents
6. **Discoverability**: Topics set for search visibility

## Security Considerations

- Never commit secrets or credentials
- Exclude `.env` files in .gitignore
- Use public visibility only
- Verify gh authentication is for correct account

## Related Documentation

- [SRS Writer Agent](srs-writer.md)
- [SDS Writer Agent](sds-writer.md)
- [Issue Generator Agent](issue-generator.md)
- [System Architecture](system-architecture.md)
