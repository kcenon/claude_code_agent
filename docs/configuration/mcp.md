# MCP Configuration

AD-SDLC uses [Model Context Protocol](https://modelcontextprotocol.io/) servers to give Claude
Agent SDK first-class tools for external systems. The `.mcp.json` at the repository root
defines team-shared MCP servers; secrets are interpolated from environment variables, never
committed.

## What MCP gives us

The `gh` CLI works for ad-hoc shell calls but does not expose retry, rate-limit handling, or
typed tool I/O. The official `@modelcontextprotocol/server-github` exposes issues, pull
requests, comments, and reviews as first-class MCP tools, letting the SDK manage retries and
errors. AD-SDLC stages that interact with GitHub — `pr-reviewer`, `issue-generator`, and the
out-of-pipeline `ci-fixer` — preload this server.

## Configuration

The configuration lives in `.mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github@latest"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

Secret values use `${VAR}` interpolation. **Never** hard-code a token in `.mcp.json`. A copy
without secrets is committed at `.mcp.json.example` for reference.

## Setting `GITHUB_TOKEN`

Create a fine-scoped GitHub Personal Access Token (PAT) and export it:

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

For day-to-day development, prefer a `.env` file (gitignored) over a shell profile. CI runs
already have `secrets.GITHUB_TOKEN` available — see `.github/workflows/ci.yml` for the
exposure pattern.

For more on PAT scopes (issues, pull requests, contents) see GitHub's
[fine-grained token documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

## Which stages use it

The github MCP server is wired through the shared `GITHUB_MCP_SERVERS` constant in
`src/ad-sdlc-orchestrator/types.ts`:

- `pr-reviewer` stage (Greenfield, Enhancement, Import pipelines)
- `issue-generator` stage (Greenfield, Enhancement pipelines)
- `ci-fixer` adapter consumer (out-of-pipeline; uses `CI_FIXER_MCP_SERVERS`)

## Local debugging

Inspect the MCP server interactively with the official inspector:

```bash
npx @modelcontextprotocol/inspector \
  npx -y @modelcontextprotocol/server-github@latest
```

Set `GITHUB_TOKEN` before running so the inspector can list issues and PRs.

## Troubleshooting

| Symptom                   | Likely cause                      | Fix                                                                                                              |
| ------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `401 Bad credentials`     | Token missing or invalid          | Re-export `GITHUB_TOKEN`; confirm with `gh auth status`                                                          |
| `403 rate limit exceeded` | Anonymous request slipped through | Verify the token is set in the shell that launched the agent                                                     |
| `404 Not Found` for repo  | PAT scope insufficient            | Re-issue token with `repo` (or fine-grained `Contents: Read`, `Issues: Read/Write`, `Pull requests: Read/Write`) |
| MCP server fails to start | `npx` cannot reach registry       | Check network/proxy; pre-pull with `npx -y @modelcontextprotocol/server-github@latest --version`                 |

## See also

- `src/execution/types.ts` — `McpServerConfig` type definition
- `src/ad-sdlc-orchestrator/types.ts` — `GITHUB_MCP_SERVER`, `GITHUB_MCP_SERVERS`, `CI_FIXER_MCP_SERVERS`
- `docs/secret-management.md` — broader secret-handling policy
