/**
 * Status Service - Pipeline status retrieval and display
 *
 * Provides functionality to retrieve and format pipeline status
 * information from the state manager and scratchpad.
 *
 * @module status/StatusService
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { StateManager, getStateManager } from '../state-manager/index.js';
import { Scratchpad, getScratchpad } from '../scratchpad/index.js';
import type { ProjectState } from '../state-manager/types.js';
import type {
  StatusOptions,
  PipelineStatus,
  ProjectStatus,
  StageInfo,
  StageStatus,
  IssueStatusCounts,
  WorkerStatus,
  ActivityEntry,
  StatusDisplayResult,
} from './types.js';

/**
 * Default status options
 */
const DEFAULT_OPTIONS: Required<StatusOptions> = {
  format: 'text',
  projectId: '',
  verbose: false,
};

/**
 * Pipeline stage definitions with their corresponding states
 */
const PIPELINE_STAGES: ReadonlyArray<{ name: string; states: readonly ProjectState[]; description: string }> = [
  { name: 'Collection', states: ['collecting', 'clarifying'], description: 'Requirements gathering' },
  { name: 'PRD Generation', states: ['prd_drafting', 'prd_approved'], description: 'Product requirements' },
  { name: 'SRS Generation', states: ['srs_drafting', 'srs_approved'], description: 'System requirements' },
  { name: 'SDS Generation', states: ['sds_drafting', 'sds_approved'], description: 'System design' },
  { name: 'Issue Generation', states: ['issues_creating', 'issues_created'], description: 'Issue breakdown' },
  { name: 'Implementation', states: ['implementing'], description: 'Code development' },
  { name: 'PR Review', states: ['pr_review'], description: 'Code review' },
  { name: 'Merged', states: ['merged'], description: 'Completed' },
];

/**
 * StatusService class for pipeline status operations
 */
export class StatusService {
  private readonly stateManager: StateManager;
  private readonly scratchpad: Scratchpad;
  private readonly options: Required<StatusOptions>;

  constructor(options: StatusOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.stateManager = getStateManager();
    this.scratchpad = getScratchpad();
  }

  /**
   * Get pipeline status for all projects or a specific project
   *
   * @param projectId - Optional specific project ID
   * @returns Pipeline status information
   */
  async getStatus(projectId?: string): Promise<PipelineStatus> {
    const targetProjectId = projectId ?? this.options.projectId;
    const timestamp = new Date().toISOString();

    if (targetProjectId !== '' && targetProjectId !== undefined) {
      // Get status for specific project
      const projectStatus = await this.getProjectStatus(targetProjectId);
      return {
        projects: projectStatus !== null ? [projectStatus] : [],
        totalProjects: projectStatus !== null ? 1 : 0,
        activeProjects: projectStatus !== null && !this.isTerminalState(projectStatus.currentState) ? 1 : 0,
        timestamp,
      };
    }

    // Get status for all projects
    const projectIds = await this.scratchpad.listProjectIds();
    const projectStatuses: ProjectStatus[] = [];

    for (const pid of projectIds) {
      const status = await this.getProjectStatus(pid);
      if (status !== null) {
        projectStatuses.push(status);
      }
    }

    const activeCount = projectStatuses.filter(
      (p) => !this.isTerminalState(p.currentState)
    ).length;

    return {
      projects: projectStatuses,
      totalProjects: projectStatuses.length,
      activeProjects: activeCount,
      timestamp,
    };
  }

  /**
   * Get status for a specific project
   *
   * @param projectId - Project identifier
   * @returns Project status or null if not found
   */
  async getProjectStatus(projectId: string): Promise<ProjectStatus | null> {
    try {
      const exists = await this.stateManager.projectExists(projectId);
      if (!exists) {
        return null;
      }

      const summary = await this.stateManager.getProjectSummary(projectId);
      const currentState = summary.currentState;

      // Get project info
      const projectName = await this.getProjectName(projectId);

      // Get stage information
      const stages = this.buildStageInfo(currentState);

      // Get issue counts
      const issues = await this.getIssueCounts(projectId);

      // Get worker status
      const workers = await this.getWorkerStatus(projectId);

      // Get recent activity
      const recentActivity = await this.getRecentActivity(projectId);

      // Calculate progress
      const progressPercent = this.calculateProgress(currentState, issues);

      const result: ProjectStatus = {
        projectId,
        currentState,
        progressPercent,
        stages,
        issues,
        workers,
        recentActivity,
        lastUpdated: summary.lastUpdated,
      };

      // Add optional properties only if they have values
      if (projectName !== undefined) {
        return { ...result, projectName };
      }

      return result;
    } catch {
      return null;
    }
  }

  /**
   * Display status to console
   *
   * @param options - Display options
   * @returns Display result
   */
  async displayStatus(options?: StatusOptions): Promise<StatusDisplayResult> {
    const format = options?.format ?? this.options.format;
    const projectId = options?.projectId ?? this.options.projectId;
    const verbose = options?.verbose ?? this.options.verbose;

    try {
      const status = await this.getStatus(projectId !== '' ? projectId : undefined);

      if (format === 'json') {
        console.log(JSON.stringify(status, null, 2));
      } else {
        this.displayTextStatus(status, verbose);
      }

      return { success: true, data: status };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (format === 'json') {
        console.log(JSON.stringify({ error: errorMessage, timestamp: new Date().toISOString() }));
      } else {
        console.error(chalk.red(`\n❌ Error: ${errorMessage}\n`));
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Display status in text format
   */
  private displayTextStatus(status: PipelineStatus, verbose: boolean): void {
    console.log(chalk.blue('\n📊 Pipeline Status\n'));

    if (status.totalProjects === 0) {
      console.log(chalk.yellow('No projects found.'));
      console.log(chalk.dim('Run "ad-sdlc init" to create a new project.\n'));
      return;
    }

    console.log(chalk.dim(`Total Projects: ${String(status.totalProjects)}, Active: ${String(status.activeProjects)}\n`));

    for (const project of status.projects) {
      this.displayProjectStatus(project, verbose);
    }
  }

  /**
   * Display single project status
   */
  private displayProjectStatus(project: ProjectStatus, verbose: boolean): void {
    const stateColor = this.isTerminalState(project.currentState) ? chalk.dim : chalk.green;

    // Header
    console.log(chalk.white.bold(`Project: ${project.projectName ?? project.projectId}`));
    console.log(chalk.white(`Phase: ${stateColor(project.currentState)}`));
    console.log(chalk.white(`Progress: ${this.formatProgressBar(project.progressPercent)} ${String(project.progressPercent)}%`));
    console.log('');

    // Stages table
    console.log(chalk.blue('┌──────────────────────────────────────────────┐'));
    console.log(chalk.blue('│ Stage              │ Status    │ Duration   │'));
    console.log(chalk.blue('├──────────────────────────────────────────────┤'));

    for (const stage of project.stages) {
      const statusIcon = this.getStatusIcon(stage.status);
      const statusText = this.formatStatus(stage.status);
      const duration = stage.durationSeconds !== undefined
        ? this.formatDuration(stage.durationSeconds)
        : '-';

      const name = stage.name.padEnd(18);
      const stat = statusText.padEnd(9);
      const dur = duration.padEnd(10);

      console.log(chalk.blue(`│ ${statusIcon} ${name}│ ${stat} │ ${dur} │`));
    }

    console.log(chalk.blue('└──────────────────────────────────────────────┘'));
    console.log('');

    // Issues summary
    if (project.issues.total > 0) {
      console.log(chalk.white(`Issues: ${String(project.issues.completed)}/${String(project.issues.total)} completed`));
      if (project.issues.inProgress > 0) {
        console.log(chalk.dim(`  In Progress: ${String(project.issues.inProgress)}`));
      }
      if (project.issues.blocked > 0) {
        console.log(chalk.yellow(`  Blocked: ${String(project.issues.blocked)}`));
      }
      console.log('');
    }

    // Workers (if any)
    if (project.workers.length > 0 && verbose) {
      console.log(chalk.white(`Active Workers: ${String(project.workers.length)}`));
      for (const worker of project.workers) {
        const progressStr = worker.progress !== undefined ? `(${String(worker.progress)}% complete)` : '';
        const issueStr = worker.currentIssue ?? 'idle';
        console.log(chalk.dim(`- ${worker.id}: ${issueStr} ${progressStr}`));
      }
      console.log('');
    }

    // Recent activity (if verbose)
    if (project.recentActivity.length > 0 && verbose) {
      console.log(chalk.white('Recent Activity:'));
      for (const activity of project.recentActivity.slice(0, 5)) {
        const icon = this.getActivityIcon(activity.type);
        const time = new Date(activity.timestamp).toLocaleTimeString();
        console.log(chalk.dim(`  ${icon} [${time}] ${activity.agent}: ${activity.description}`));
      }
      console.log('');
    }

    console.log(chalk.dim(`Last updated: ${project.lastUpdated}\n`));
  }

  /**
   * Build stage information based on current state
   */
  private buildStageInfo(currentState: ProjectState): StageInfo[] {
    const currentIndex = this.getStateStageIndex(currentState);

    return PIPELINE_STAGES.map((stage, index): StageInfo => {
      let status: StageStatus;

      if (currentState === 'cancelled') {
        // All stages after current are skipped
        const wasActive = index <= currentIndex;
        status = wasActive ? 'completed' : 'skipped';
      } else if (index < currentIndex) {
        status = 'completed';
      } else if (index === currentIndex) {
        status = 'running';
      } else {
        status = 'pending';
      }

      return {
        name: stage.name,
        status,
        description: stage.description,
      };
    });
  }

  /**
   * Get stage index for a state
   */
  private getStateStageIndex(state: ProjectState): number {
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i];
      if (stage !== undefined && stage.states.includes(state)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get project name from info
   */
  private async getProjectName(projectId: string): Promise<string | undefined> {
    try {
      const infoPath = path.join(this.scratchpad.getProjectPath('info', projectId), 'project.yaml');
      const exists = await this.scratchpad.exists(infoPath);
      if (!exists) {
        return undefined;
      }
      const info = await this.scratchpad.readYaml<{ name?: string }>(infoPath);
      return info?.name;
    } catch {
      return undefined;
    }
  }

  /**
   * Get issue status counts
   */
  private async getIssueCounts(projectId: string): Promise<IssueStatusCounts> {
    try {
      const issueListPath = this.scratchpad.getIssueListPath(projectId);
      const exists = await this.scratchpad.exists(issueListPath);

      if (!exists) {
        return { total: 0, pending: 0, inProgress: 0, completed: 0, blocked: 0 };
      }

      const issueList = await this.scratchpad.readJson<{
        issues?: Array<{ status?: string }>;
      }>(issueListPath);

      if (issueList === null || issueList.issues === undefined) {
        return { total: 0, pending: 0, inProgress: 0, completed: 0, blocked: 0 };
      }

      const counts = {
        total: issueList.issues.length,
        pending: 0,
        inProgress: 0,
        completed: 0,
        blocked: 0,
      };

      for (const issue of issueList.issues) {
        switch (issue.status) {
          case 'pending':
          case 'open':
            counts.pending++;
            break;
          case 'in_progress':
          case 'in-progress':
            counts.inProgress++;
            break;
          case 'completed':
          case 'closed':
          case 'done':
            counts.completed++;
            break;
          case 'blocked':
            counts.blocked++;
            break;
          default:
            counts.pending++;
        }
      }

      return counts;
    } catch {
      return { total: 0, pending: 0, inProgress: 0, completed: 0, blocked: 0 };
    }
  }

  /**
   * Get worker status
   */
  private async getWorkerStatus(projectId: string): Promise<WorkerStatus[]> {
    try {
      const workOrdersPath = this.scratchpad.getProgressSubsectionPath(projectId, 'work_orders');
      const exists = await fs.promises.access(workOrdersPath, fs.constants.F_OK).then(() => true).catch(() => false);

      if (!exists) {
        return [];
      }

      const files = await fs.promises.readdir(workOrdersPath);
      const workers: WorkerStatus[] = [];

      for (const file of files) {
        if (!file.endsWith('.yaml')) continue;

        try {
          const orderPath = path.join(workOrdersPath, file);
          const order = await this.scratchpad.readYaml<{
            workerId?: string;
            issueId?: string;
            status?: string;
            progress?: number;
          }>(orderPath);

          if (order !== null && order.status === 'in_progress') {
            const workerStatus: WorkerStatus = {
              id: order.workerId ?? file.replace('.yaml', ''),
              state: 'working',
            };

            // Build worker status with optional properties
            let finalStatus = workerStatus;
            if (order.issueId !== undefined) {
              finalStatus = { ...finalStatus, currentIssue: order.issueId };
            }
            if (order.progress !== undefined) {
              finalStatus = { ...finalStatus, progress: order.progress };
            }
            workers.push(finalStatus);
          }
        } catch {
          // Skip invalid files
        }
      }

      return workers;
    } catch {
      return [];
    }
  }

  /**
   * Get recent activity from history
   */
  private async getRecentActivity(projectId: string): Promise<ActivityEntry[]> {
    try {
      const history = await this.stateManager.getHistory('progress', projectId);

      if (history === null || history.entries.length === 0) {
        return [];
      }

      return history.entries.slice(0, 10).map((entry): ActivityEntry => {
        const value = entry.value as { transition?: { from: string; to: string }; agent?: string };

        let description = entry.description ?? 'State update';
        let agent = 'System';

        if (value.transition !== undefined) {
          description = `State: ${value.transition.from} → ${value.transition.to}`;
          agent = 'Controller';
        } else if (value.agent !== undefined) {
          agent = value.agent;
        }

        return {
          timestamp: entry.timestamp,
          agent,
          description,
          type: 'info',
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateProgress(currentState: ProjectState, issues: IssueStatusCounts): number {
    // Base progress from stages
    const stageIndex = this.getStateStageIndex(currentState);
    const stageProgress = stageIndex >= 0 ? Math.round((stageIndex / (PIPELINE_STAGES.length - 1)) * 100) : 0;

    // If we're in implementation phase, use issue progress
    if (currentState === 'implementing' && issues.total > 0) {
      const issueProgress = Math.round((issues.completed / issues.total) * 100);
      // Blend stage progress with issue progress
      return Math.round((stageProgress + issueProgress) / 2);
    }

    // Terminal states
    if (currentState === 'merged') {
      return 100;
    }
    if (currentState === 'cancelled') {
      return stageProgress;
    }

    return stageProgress;
  }

  /**
   * Check if state is terminal
   */
  private isTerminalState(state: ProjectState): boolean {
    return state === 'merged' || state === 'cancelled';
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: StageStatus): string {
    switch (status) {
      case 'completed':
        return chalk.green('✓');
      case 'running':
        return chalk.blue('⟳');
      case 'failed':
        return chalk.red('✗');
      case 'skipped':
        return chalk.dim('○');
      case 'pending':
      default:
        return chalk.dim('○');
    }
  }

  /**
   * Format status text
   */
  private formatStatus(status: StageStatus): string {
    switch (status) {
      case 'completed':
        return chalk.green('Done');
      case 'running':
        return chalk.blue('Running');
      case 'failed':
        return chalk.red('Failed');
      case 'skipped':
        return chalk.dim('Skipped');
      case 'pending':
      default:
        return chalk.dim('Pending');
    }
  }

  /**
   * Get activity icon
   */
  private getActivityIcon(type: ActivityEntry['type']): string {
    switch (type) {
      case 'success':
        return chalk.green('✓');
      case 'warning':
        return chalk.yellow('⚠');
      case 'error':
        return chalk.red('✗');
      case 'info':
      default:
        return chalk.blue('ℹ');
    }
  }

  /**
   * Format duration in human readable form
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${String(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return `${String(minutes)}m ${String(remainingSeconds)}s`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${String(hours)}h ${String(remainingMinutes)}m`;
  }

  /**
   * Format progress bar
   */
  private formatProgressBar(percent: number): string {
    const filled = Math.round(percent / 5);
    const empty = 20 - filled;
    return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  }
}

/**
 * Singleton instance for global access
 */
let globalStatusService: StatusService | null = null;

/**
 * Get or create the global StatusService instance
 *
 * @param options - Options for creating new instance
 * @returns The global StatusService instance
 */
export function getStatusService(options?: StatusOptions): StatusService {
  if (globalStatusService === null) {
    globalStatusService = new StatusService(options);
  }
  return globalStatusService;
}

/**
 * Reset the global StatusService instance (for testing)
 */
export function resetStatusService(): void {
  globalStatusService = null;
}
