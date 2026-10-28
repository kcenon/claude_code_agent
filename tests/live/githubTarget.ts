/**
 * Disposable GitHub repository operations of the Import live scenarios (#955).
 * Live lane only. Every call goes through the `gh` CLI with the lane's
 * repository-scoped token; nothing here reads or writes any other repository.
 */

import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DISPOSABLE_REPO_TOPIC,
  exec,
  materializeTarget,
  type GithubPullRequest,
} from './importScenario.js';

/**
 * Environment for `gh` and `git`: the repository-scoped token, an isolated
 * `gh` configuration, and an isolated global git configuration with a commit
 * identity and `gh` as the credential helper. The caller's own git and `gh`
 * configuration are never read or changed.
 * @param base - Environment to copy
 * @param token - Repository-scoped token
 * @param dir - Directory for the isolated configuration
 * @returns Environment
 */
export function githubEnv(base: NodeJS.ProcessEnv, token: string, dir: string): NodeJS.ProcessEnv {
  const gitConfig = join(dir, 'gitconfig');
  writeFileSync(
    gitConfig,
    [
      '[user]',
      '\tname = AD-SDLC live lane',
      '\temail = ad-sdlc-live@users.noreply.github.com',
      '[credential "https://github.com"]',
      '\thelper =',
      '\thelper = !gh auth git-credential',
      '[init]',
      '\tdefaultBranch = main',
      '',
    ].join('\n')
  );
  return {
    ...base,
    GH_TOKEN: token,
    GITHUB_TOKEN: token,
    GH_CONFIG_DIR: join(dir, 'gh'),
    GH_PROMPT_DISABLED: '1',
    GIT_CONFIG_GLOBAL: gitConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
}

/**
 * Refuse to write to a repository that is not marked as disposable.
 * @param repo - `owner/name`
 * @param env - GitHub environment
 * @returns Default branch name
 * @throws Error when the repository lacks the topic or is archived
 */
export function assertDisposableRepository(repo: string, env: NodeJS.ProcessEnv): string {
  const view = JSON.parse(
    exec('gh', ['repo', 'view', repo, '--json', 'repositoryTopics,defaultBranchRef,isArchived'], {
      env,
    })
  ) as {
    repositoryTopics: { name: string }[] | null;
    defaultBranchRef: { name: string } | null;
    isArchived: boolean;
  };
  const topics = (view.repositoryTopics ?? []).map((topic) => topic.name);
  if (!topics.includes(DISPOSABLE_REPO_TOPIC))
    throw new Error(
      `${repo} does not carry the "${DISPOSABLE_REPO_TOPIC}" topic; the live lane writes only to repositories marked as disposable`
    );
  if (view.isArchived) throw new Error(`${repo} is archived`);
  return view.defaultBranchRef?.name ?? 'main';
}

/**
 * Clone the repository.
 * @param repo - `owner/name`
 * @param dir - Destination (must not exist)
 * @param env - GitHub environment
 */
export function cloneRepository(repo: string, dir: string, env: NodeJS.ProcessEnv): void {
  exec('git', ['clone', `https://github.com/${repo}.git`, dir], { env });
}

/**
 * Make the default branch hold exactly the fixture. Commits and pushes only
 * when the tree differs, so repeated runs leave the branch unchanged.
 * @param repo - `owner/name`
 * @param branch - Default branch
 * @param dir - Working directory for the clone (must not exist)
 * @param env - GitHub environment
 * @returns Whether a commit was pushed
 */
export function ensureFixture(
  repo: string,
  branch: string,
  dir: string,
  env: NodeJS.ProcessEnv
): boolean {
  cloneRepository(repo, dir, env);
  exec('git', ['checkout', '-B', branch], { cwd: dir, env });
  for (const entry of readdirSync(dir))
    if (entry !== '.git') rmSync(join(dir, entry), { recursive: true, force: true });
  materializeTarget(dir);
  exec('git', ['add', '-A'], { cwd: dir, env });
  if (exec('git', ['status', '--porcelain'], { cwd: dir, env }).trim() === '') return false;
  exec('git', ['commit', '-m', 'test: reset the AD-SDLC Import fixture'], { cwd: dir, env });
  exec('git', ['push', 'origin', `HEAD:${branch}`], { cwd: dir, env });
  return true;
}

/**
 * Create the run's label.
 * @param repo - `owner/name`
 * @param label - Label name
 * @param env - GitHub environment
 */
export function createLabel(repo: string, label: string, env: NodeJS.ProcessEnv): void {
  exec('gh', ['label', 'create', label, '--repo', repo, '--color', 'ededed', '--force'], { env });
}

/**
 * Create one seeded issue.
 * @param repo - `owner/name`
 * @param issue - Title, body, and label
 * @param issue.title - Issue title
 * @param issue.body - Issue body
 * @param issue.label - Label of the run
 * @param env - GitHub environment
 * @returns Issue number
 */
export function createIssue(
  repo: string,
  issue: { readonly title: string; readonly body: string; readonly label: string },
  env: NodeJS.ProcessEnv
): number {
  const url = exec(
    'gh',
    [
      'issue',
      'create',
      '--repo',
      repo,
      '--title',
      issue.title,
      '--body',
      issue.body,
      '--label',
      issue.label,
    ],
    { env }
  ).trim();
  const number = Number(/\/issues\/(\d+)\s*$/.exec(url)?.[1]);
  if (!Number.isInteger(number)) throw new Error(`Unexpected gh issue create output: ${url}`);
  return number;
}

/**
 * Pull requests of the repository, any state.
 * @param repo - `owner/name`
 * @param env - GitHub environment
 * @returns Pull requests
 */
export function listPullRequests(repo: string, env: NodeJS.ProcessEnv): GithubPullRequest[] {
  return JSON.parse(
    exec(
      'gh',
      [
        'pr',
        'list',
        '--repo',
        repo,
        '--state',
        'all',
        '--limit',
        '200',
        '--json',
        'number,headRefName,headRefOid,state,mergedAt,title,body,closingIssuesReferences',
      ],
      { env }
    )
  ) as GithubPullRequest[];
}

/**
 * Issue numbers that carry a label, any state.
 * @param repo - `owner/name`
 * @param label - Label name
 * @param env - GitHub environment
 * @returns Issue numbers
 */
export function listLabeledIssues(repo: string, label: string, env: NodeJS.ProcessEnv): number[] {
  return (
    JSON.parse(
      exec(
        'gh',
        ['issue', 'list', '--repo', repo, '--label', label, '--state', 'all', '--json', 'number'],
        { env }
      )
    ) as { number: number }[]
  ).map((issue) => issue.number);
}

/**
 * Branch names of the repository.
 * @param repo - `owner/name`
 * @param env - GitHub environment
 * @returns Branch names
 */
export function listBranches(repo: string, env: NodeJS.ProcessEnv): string[] {
  return exec('gh', ['api', '--paginate', `repos/${repo}/branches`, '--jq', '.[].name'], { env })
    .split('\n')
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

/** Resources one scenario run created. */
export interface OwnedResources {
  readonly label: string;
  readonly issues: readonly number[];
  readonly pullRequests: readonly GithubPullRequest[];
  /** Branches that did not exist before the run */
  readonly branches: readonly string[];
}

/**
 * Remove what a scenario run created, and nothing else: close its open pull
 * requests without merging, delete its branches, close its issues, and
 * delete its label. Every step runs even when an earlier one fails.
 * @param repo - `owner/name`
 * @param owned - Resources the run created
 * @param env - GitHub environment
 * @returns One line per action, prefixed with `failed:` when it failed
 */
export function cleanupRun(repo: string, owned: OwnedResources, env: NodeJS.ProcessEnv): string[] {
  const actions: string[] = [];
  const attempt = (description: string, action: () => void): void => {
    try {
      action();
      actions.push(description);
    } catch (error) {
      actions.push(
        `failed: ${description} (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`
      );
    }
  };
  for (const pr of owned.pullRequests)
    if (pr.state === 'OPEN')
      attempt(`closed pull request #${String(pr.number)} without merging`, () =>
        exec('gh', ['pr', 'close', String(pr.number), '--repo', repo], { env })
      );
  const remaining = new Set(listBranches(repo, env));
  for (const branch of owned.branches)
    if (remaining.has(branch))
      attempt(`deleted branch ${branch}`, () =>
        exec('gh', ['api', '-X', 'DELETE', `repos/${repo}/git/refs/heads/${branch}`], { env })
      );
  for (const issue of owned.issues)
    attempt(`closed issue #${String(issue)}`, () =>
      exec('gh', ['issue', 'close', String(issue), '--repo', repo], { env })
    );
  attempt(`deleted label ${owned.label}`, () =>
    exec('gh', ['label', 'delete', owned.label, '--repo', repo, '--yes'], { env })
  );
  return actions;
}
