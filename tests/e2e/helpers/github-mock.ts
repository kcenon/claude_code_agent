/**
 * GitHub Mock Server
 *
 * Provides a mock HTTP server that simulates GitHub API responses
 * for E2E testing. Supports failure simulation and response customization.
 */

import * as http from 'node:http';
import * as net from 'node:net';

/**
 * Configuration for simulated failures
 */
export interface FailureConfig {
  /** Number of times to fail before succeeding */
  times: number;
  /** HTTP status code to return on failure */
  statusCode?: number;
  /** Error message to return */
  errorMessage?: string;
}

/**
 * Mock issue response
 */
export interface MockIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string }>;
}

/**
 * Mock PR response
 */
export interface MockPullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  head: { ref: string; sha: string };
  base: { ref: string };
  mergeable: boolean;
  merged: boolean;
}

/**
 * Mock check run response
 */
export interface MockCheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | null;
}

/**
 * GitHub Mock Server configuration
 */
export interface GitHubMockConfig {
  /** Port to listen on (0 for random available port) */
  port?: number;
  /** Default issues to return */
  issues?: MockIssue[];
  /** Default PRs to return */
  pullRequests?: MockPullRequest[];
  /** Default check runs to return */
  checkRuns?: MockCheckRun[];
}

/**
 * GitHub Mock Server
 *
 * Simulates GitHub API endpoints for testing without making real API calls.
 */
export class GitHubMock {
  private server: http.Server | null = null;
  private failures: Map<string, FailureConfig> = new Map();
  private issues: MockIssue[] = [];
  private pullRequests: MockPullRequest[] = [];
  private checkRuns: MockCheckRun[] = [];
  private actualPort = 0;
  private originalGitHubApiUrl: string | undefined;

  constructor(private config: GitHubMockConfig = {}) {
    this.issues = config.issues ?? [];
    this.pullRequests = config.pullRequests ?? [];
    this.checkRuns = config.checkRuns ?? [];
  }

  /**
   * Start the mock server
   */
  async start(port?: number): Promise<number> {
    const targetPort = port ?? this.config.port ?? 0;

    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.handleRequest.bind(this));

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${targetPort} is already in use`));
        } else {
          reject(error);
        }
      });

      this.server.listen(targetPort, '127.0.0.1', () => {
        const address = this.server!.address() as net.AddressInfo;
        this.actualPort = address.port;

        // Save and override GitHub API URL
        this.originalGitHubApiUrl = process.env.GITHUB_API_URL;
        process.env.GITHUB_API_URL = `http://127.0.0.1:${this.actualPort}`;

        resolve(this.actualPort);
      });
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Restore original GitHub API URL
      if (this.originalGitHubApiUrl !== undefined) {
        process.env.GITHUB_API_URL = this.originalGitHubApiUrl;
      } else {
        delete process.env.GITHUB_API_URL;
      }

      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the port the server is listening on
   */
  getPort(): number {
    return this.actualPort;
  }

  /**
   * Get the base URL for the mock server
   */
  getBaseUrl(): string {
    return `http://127.0.0.1:${this.actualPort}`;
  }

  /**
   * Configure a simulated failure for an operation
   */
  simulateFailure(operation: string, config: FailureConfig): void {
    this.failures.set(operation, { ...config });
  }

  /**
   * Clear all simulated failures
   */
  clearFailures(): void {
    this.failures.clear();
  }

  /**
   * Add a mock issue
   */
  addIssue(issue: MockIssue): void {
    this.issues.push(issue);
  }

  /**
   * Add a mock pull request
   */
  addPullRequest(pr: MockPullRequest): void {
    this.pullRequests.push(pr);
  }

  /**
   * Add a mock check run
   */
  addCheckRun(checkRun: MockCheckRun): void {
    this.checkRuns.push(checkRun);
  }

  /**
   * Clear all mock data
   */
  clearMockData(): void {
    this.issues = [];
    this.pullRequests = [];
    this.checkRuns = [];
  }

  /**
   * Reset the mock server state
   */
  reset(): void {
    this.clearFailures();
    this.clearMockData();
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    // Determine operation from URL
    const operation = this.getOperation(url, method);

    // Check for simulated failures
    const failure = this.failures.get(operation);
    if (failure && failure.times > 0) {
      failure.times--;
      res.statusCode = failure.statusCode ?? 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        message: failure.errorMessage ?? 'Simulated failure',
        documentation_url: 'https://docs.github.com/rest',
      }));
      return;
    }

    // Route to appropriate handler
    this.routeRequest(url, method, req, res);
  }

  /**
   * Determine the operation type from URL and method
   */
  private getOperation(url: string, method: string): string {
    if (url.includes('/issues')) {
      return method === 'POST' ? 'create_issue' : 'list_issues';
    }
    if (url.includes('/pulls')) {
      if (method === 'POST') return 'create_pr';
      if (url.includes('/merge')) return 'merge_pr';
      if (url.includes('/reviews')) return 'pr_review';
      return 'list_prs';
    }
    if (url.includes('/check-runs')) {
      return 'check_runs';
    }
    if (url.includes('/commits') && url.includes('/check-suites')) {
      return 'check_suites';
    }
    return 'unknown';
  }

  /**
   * Route request to appropriate handler
   */
  private routeRequest(
    url: string,
    method: string,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    res.setHeader('Content-Type', 'application/json');

    // Issues endpoints
    if (url.match(/\/repos\/[^/]+\/[^/]+\/issues$/)) {
      if (method === 'GET') {
        this.handleListIssues(res);
        return;
      }
      if (method === 'POST') {
        this.handleCreateIssue(req, res);
        return;
      }
    }

    // Single issue endpoint
    if (url.match(/\/repos\/[^/]+\/[^/]+\/issues\/\d+$/)) {
      const issueNumber = parseInt(url.split('/').pop() ?? '0', 10);
      this.handleGetIssue(issueNumber, res);
      return;
    }

    // Pull requests endpoints
    if (url.match(/\/repos\/[^/]+\/[^/]+\/pulls$/)) {
      if (method === 'GET') {
        this.handleListPullRequests(res);
        return;
      }
      if (method === 'POST') {
        this.handleCreatePullRequest(req, res);
        return;
      }
    }

    // Single PR endpoint
    if (url.match(/\/repos\/[^/]+\/[^/]+\/pulls\/\d+$/)) {
      const prNumber = parseInt(url.split('/').pop() ?? '0', 10);
      this.handleGetPullRequest(prNumber, res);
      return;
    }

    // PR merge endpoint
    if (url.match(/\/repos\/[^/]+\/[^/]+\/pulls\/\d+\/merge$/)) {
      if (method === 'PUT') {
        const prNumber = parseInt(url.split('/')[url.split('/').length - 2], 10);
        this.handleMergePullRequest(prNumber, res);
        return;
      }
    }

    // Check runs endpoint
    if (url.includes('/check-runs')) {
      this.handleCheckRuns(res);
      return;
    }

    // Check suites endpoint
    if (url.includes('/check-suites')) {
      this.handleCheckSuites(res);
      return;
    }

    // Default: 404
    res.statusCode = 404;
    res.end(JSON.stringify({
      message: 'Not Found',
      documentation_url: 'https://docs.github.com/rest',
    }));
  }

  /**
   * Handle list issues request
   */
  private handleListIssues(res: http.ServerResponse): void {
    res.statusCode = 200;
    res.end(JSON.stringify(this.issues));
  }

  /**
   * Handle create issue request
   */
  private handleCreateIssue(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const newIssue: MockIssue = {
          number: this.issues.length + 1,
          title: data.title,
          body: data.body,
          state: 'open',
          labels: (data.labels ?? []).map((name: string) => ({ name, color: 'ffffff' })),
          assignees: (data.assignees ?? []).map((login: string) => ({ login })),
        };
        this.issues.push(newIssue);

        res.statusCode = 201;
        res.end(JSON.stringify(newIssue));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'Invalid JSON' }));
      }
    });
  }

  /**
   * Handle get single issue request
   */
  private handleGetIssue(issueNumber: number, res: http.ServerResponse): void {
    const issue = this.issues.find((i) => i.number === issueNumber);
    if (issue) {
      res.statusCode = 200;
      res.end(JSON.stringify(issue));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not Found' }));
    }
  }

  /**
   * Handle list pull requests request
   */
  private handleListPullRequests(res: http.ServerResponse): void {
    res.statusCode = 200;
    res.end(JSON.stringify(this.pullRequests));
  }

  /**
   * Handle create pull request request
   */
  private handleCreatePullRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const newPR: MockPullRequest = {
          number: this.pullRequests.length + 1,
          title: data.title,
          body: data.body,
          state: 'open',
          head: { ref: data.head, sha: 'abc123' },
          base: { ref: data.base },
          mergeable: true,
          merged: false,
        };
        this.pullRequests.push(newPR);

        res.statusCode = 201;
        res.end(JSON.stringify(newPR));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'Invalid JSON' }));
      }
    });
  }

  /**
   * Handle get single pull request request
   */
  private handleGetPullRequest(prNumber: number, res: http.ServerResponse): void {
    const pr = this.pullRequests.find((p) => p.number === prNumber);
    if (pr) {
      res.statusCode = 200;
      res.end(JSON.stringify(pr));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not Found' }));
    }
  }

  /**
   * Handle merge pull request request
   */
  private handleMergePullRequest(prNumber: number, res: http.ServerResponse): void {
    const pr = this.pullRequests.find((p) => p.number === prNumber);
    if (pr) {
      pr.state = 'merged';
      pr.merged = true;
      res.statusCode = 200;
      res.end(JSON.stringify({
        sha: 'merged123',
        merged: true,
        message: 'Pull Request successfully merged',
      }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not Found' }));
    }
  }

  /**
   * Handle check runs request
   */
  private handleCheckRuns(res: http.ServerResponse): void {
    res.statusCode = 200;
    res.end(JSON.stringify({
      total_count: this.checkRuns.length,
      check_runs: this.checkRuns,
    }));
  }

  /**
   * Handle check suites request
   */
  private handleCheckSuites(res: http.ServerResponse): void {
    res.statusCode = 200;
    res.end(JSON.stringify({
      total_count: 1,
      check_suites: [
        {
          id: 1,
          status: 'completed',
          conclusion: 'success',
        },
      ],
    }));
  }
}

/**
 * Create a pre-configured GitHub mock with common test data
 */
export function createTestGitHubMock(): GitHubMock {
  return new GitHubMock({
    issues: [
      {
        number: 1,
        title: 'Test Issue 1',
        body: 'Test issue body',
        state: 'open',
        labels: [{ name: 'bug', color: 'd73a4a' }],
        assignees: [{ login: 'testuser' }],
      },
    ],
    pullRequests: [
      {
        number: 1,
        title: 'Test PR 1',
        body: 'Test PR body',
        state: 'open',
        head: { ref: 'feature-branch', sha: 'abc123' },
        base: { ref: 'main' },
        mergeable: true,
        merged: false,
      },
    ],
    checkRuns: [
      {
        id: 1,
        name: 'build',
        status: 'completed',
        conclusion: 'success',
      },
      {
        id: 2,
        name: 'test',
        status: 'completed',
        conclusion: 'success',
      },
    ],
  });
}
