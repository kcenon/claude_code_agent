#!/usr/bin/env node

/**
 * AD-SDLC CLI Entry Point
 *
 * NOTE: Using process.exit(1) in error handlers for reliability.
 *
 * @packageDocumentation
 */

import chalk from 'chalk';
import { Command } from 'commander';

import {
  createInteractiveWizard,
  createProjectInitializer,
  getPrerequisiteValidator,
} from './project-initializer/index.js';
import type { InitOptions, TechStack, TemplateType } from './project-initializer/types.js';
import {
  validateAllConfigs,
  validateConfigFile,
  watchConfigWithLogging,
  configFilesExist,
  CONFIG_SCHEMA_VERSION,
  type ValidationReport,
  type FileValidationResult,
} from './config/index.js';
import {
  getAnalysisOrchestratorAgent,
  resetAnalysisOrchestratorAgent,
} from './analysis-orchestrator/index.js';
import type { AnalysisScope } from './analysis-orchestrator/types.js';
import {
  getAdsdlcOrchestratorAgent,
  resetAdsdlcOrchestratorAgent,
} from './ad-sdlc-orchestrator/index.js';
import type { PipelineMode, PipelineRequest } from './ad-sdlc-orchestrator/index.js';
import { StatusService } from './status/index.js';
import type { OutputFormat } from './status/types.js';
import { initializeProject, isProjectInitialized } from './utils/index.js';
import { resolve } from 'node:path';
import { getCompletionGenerator, SUPPORTED_SHELLS, type ShellType } from './completion/index.js';
import { getTelemetry, PRIVACY_POLICY, PRIVACY_POLICY_VERSION } from './telemetry/index.js';
import { getCLIOutput } from './cli/CLIOutput.js';

const output = getCLIOutput();
const program = new Command();

program
  .name('ad-sdlc')
  .description('Agent-Driven Software Development Lifecycle CLI')
  .version('0.0.1');

/**
 * Init command - Initialize a new AD-SDLC project
 */
program
  .command('init [project-name]')
  .description('Initialize a new AD-SDLC project')
  .option('-g, --github-repo <url>', 'GitHub repository URL')
  .option(
    '-t, --tech-stack <stack>',
    'Primary technology stack (typescript, python, java, go, rust, other)'
  )
  .option('-T, --template <template>', 'Project template (minimal, standard, enterprise)')
  .option('-q, --quick', 'Quick setup with defaults (skip interactive prompts)')
  .option('--skip-validation', 'Skip prerequisite validation')
  .action(async (projectName: string | undefined, cmdOptions: Record<string, unknown>) => {
    try {
      output.info(chalk.blue('\n🚀 AD-SDLC Project Initialization\n'));

      let options: InitOptions;

      const isQuickMode = cmdOptions['quick'] === true;
      const hasTemplate =
        typeof cmdOptions['template'] === 'string' && cmdOptions['template'].length > 0;
      const hasProjectName = typeof projectName === 'string' && projectName.length > 0;

      if (isQuickMode || (hasProjectName && hasTemplate)) {
        // Non-interactive mode with command-line options
        const githubRepo =
          typeof cmdOptions['githubRepo'] === 'string' ? cmdOptions['githubRepo'] : undefined;
        const techStack =
          typeof cmdOptions['techStack'] === 'string'
            ? (cmdOptions['techStack'] as TechStack)
            : 'typescript';
        const template =
          typeof cmdOptions['template'] === 'string'
            ? (cmdOptions['template'] as TemplateType)
            : 'standard';
        const skipValidation = cmdOptions['skipValidation'] === true;

        options = {
          projectName: hasProjectName ? projectName : 'my-project',
          githubRepo,
          techStack,
          template,
          quick: true,
          skipValidation,
        };
      } else {
        // Interactive mode
        const wizard = createInteractiveWizard();
        const wizardOptions = await wizard.run();

        // Override with command-line project name if provided
        if (hasProjectName) {
          options = { ...wizardOptions, projectName };
        } else {
          options = wizardOptions;
        }

        // Confirm configuration
        const confirmed = await wizard.confirmConfiguration(options);
        if (!confirmed) {
          output.info(chalk.yellow('\n⚠️  Initialization cancelled.\n'));
          process.exit(0);
        }
      }

      // Validate prerequisites
      const shouldValidate = cmdOptions['skipValidation'] !== true;
      if (shouldValidate) {
        output.info(chalk.blue('\n🔍 Validating prerequisites...\n'));
        const validator = getPrerequisiteValidator();
        const validation = await validator.validate();

        for (const check of validation.checks) {
          if (check.passed) {
            output.info(chalk.green(`  ✓ ${check.name}`));
          } else if (check.required) {
            output.info(chalk.red(`  ✗ ${check.name}`));
            output.info(chalk.yellow(`    Fix: ${check.fix ?? 'Unknown'}`));
          } else {
            output.info(chalk.yellow(`  ⚠ ${check.name} (optional)`));
            output.info(chalk.dim(`    ${check.fix ?? ''}`));
          }
        }

        if (!validation.valid) {
          output.info(
            chalk.red(
              '\n❌ Prerequisite validation failed. Please fix the required issues above.\n'
            )
          );
          process.exit(1);
        }

        if (validation.warnings > 0) {
          output.info(
            chalk.yellow(
              `\n⚠️  ${String(validation.warnings)} optional check(s) failed. Continuing anyway...\n`
            )
          );
        } else {
          output.info(chalk.green('\n✓ All prerequisites validated.\n'));
        }
      }

      // Initialize project
      output.info(chalk.blue('📁 Creating project structure...\n'));
      const initializer = createProjectInitializer(options);
      const result = await initializer.initialize();

      if (result.success) {
        output.info(chalk.green('\n✅ Project initialized successfully!\n'));
        output.info(chalk.dim('Created files:'));
        for (const file of result.createdFiles.slice(0, 10)) {
          output.info(chalk.dim(`  - ${file}`));
        }
        if (result.createdFiles.length > 10) {
          output.info(chalk.dim(`  ... and ${String(result.createdFiles.length - 10)} more files`));
        }

        output.info(chalk.blue('\n📖 Next steps:\n'));
        output.info(`  1. ${chalk.cyan(`cd ${options.projectName}`)}`);
        output.info(
          `  2. Set up your Claude API key: ${chalk.cyan('export CLAUDE_API_KEY="your-key"')}`
        );
        output.info(`  3. Run AD-SDLC: ${chalk.cyan('npx ad-sdlc run "Your requirements"')}`);
        output.blank();
      } else {
        output.info(chalk.red(`\n❌ Initialization failed: ${result.error ?? 'Unknown error'}\n`));
        process.exit(1);
      }
    } catch (error) {
      output.error(
        `${chalk.red('\n❌ Error:')} ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

/**
 * Format validation result for CLI output
 * @param result - The file validation result to display
 */
function formatFileResult(result: FileValidationResult): void {
  const statusIcon = result.valid ? chalk.green('✓') : chalk.red('✗');
  output.info(`${statusIcon} ${result.filePath}`);

  if (!result.valid && result.errors.length > 0) {
    for (const error of result.errors) {
      output.info(chalk.red(`    ❌ ${error.path}: ${error.message}`));
      if (error.suggestion !== undefined && error.suggestion !== '') {
        output.info(chalk.yellow(`       Suggestion: ${error.suggestion}`));
      }
    }
  }
}

/**
 * Format validation report as JSON
 * @param report - The validation report to serialize as JSON
 */
function formatReportAsJson(report: ValidationReport): void {
  output.info(JSON.stringify(report, null, 2));
}

/**
 * Validate command - Validate configuration files
 */
program
  .command('validate')
  .description('Validate AD-SDLC configuration files')
  .option('-f, --file <path>', 'Validate a specific file')
  .option('-w, --watch', 'Watch for file changes')
  .option('--format <format>', 'Output format (text, json)', 'text')
  .action(async (cmdOptions: Record<string, unknown>) => {
    const filePath = typeof cmdOptions['file'] === 'string' ? cmdOptions['file'] : null;
    const watchMode = cmdOptions['watch'] === true;
    const format = typeof cmdOptions['format'] === 'string' ? cmdOptions['format'] : 'text';
    const isJson = format === 'json';

    if (!isJson) {
      output.info(chalk.blue('\n🔍 Validating configuration...\n'));
      output.info(chalk.dim(`Schema version: ${CONFIG_SCHEMA_VERSION}\n`));
    }

    try {
      // Check if config files exist
      const exists = configFilesExist();
      if (!exists.workflow && !exists.agents) {
        if (isJson) {
          output.info(
            JSON.stringify({
              valid: false,
              error: 'No configuration files found. Run "ad-sdlc init" first.',
              files: [],
              totalErrors: 1,
              timestamp: new Date().toISOString(),
            })
          );
        } else {
          output.info(chalk.yellow('⚠️  No configuration files found.'));
          output.info(chalk.dim('Run "ad-sdlc init" to create a new project.\n'));
        }
        process.exit(1);
      }

      // Validate specific file or all files
      if (filePath !== null && filePath.length > 0) {
        const result = await validateConfigFile(filePath);

        if (isJson) {
          output.info(
            JSON.stringify(
              {
                valid: result.valid,
                files: [result],
                totalErrors: result.errors.length,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            )
          );
        } else {
          formatFileResult(result);
          output.blank();
        }

        if (!result.valid) {
          process.exit(1);
        }
      } else {
        const report = await validateAllConfigs();

        if (isJson) {
          formatReportAsJson(report);
        } else {
          for (const result of report.files) {
            formatFileResult(result);
          }

          output.blank();
          if (report.valid) {
            output.info(chalk.green('✅ All configuration files are valid.\n'));
          } else {
            output.info(
              chalk.red(
                `❌ Found ${String(report.totalErrors)} error(s). Fix these issues and try again.\n`
              )
            );
          }
        }

        if (!report.valid && !watchMode) {
          process.exit(1);
        }
      }

      // Watch mode
      if (watchMode) {
        if (!isJson) {
          output.info(chalk.blue('👀 Watching for changes... (Press Ctrl+C to stop)\n'));
        }

        const cleanup = watchConfigWithLogging(
          undefined,
          (changedPath) => {
            if (isJson) {
              output.info(
                JSON.stringify({
                  event: 'valid',
                  filePath: changedPath,
                  timestamp: new Date().toISOString(),
                })
              );
            } else {
              output.info(chalk.green(`✓ ${changedPath} - Valid`));
            }
          },
          (changedPath, errors) => {
            if (isJson) {
              output.info(
                JSON.stringify({
                  event: 'invalid',
                  filePath: changedPath,
                  errors,
                  timestamp: new Date().toISOString(),
                })
              );
            } else {
              output.info(chalk.red(`✗ ${changedPath} - Invalid`));
              for (const error of errors) {
                output.info(chalk.red(`    ❌ ${error.path}: ${error.message}`));
              }
            }
          }
        );

        // Handle Ctrl+C
        process.on('SIGINT', () => {
          cleanup();
          if (!isJson) {
            output.info(chalk.dim('\n\nStopped watching.\n'));
          }
          process.exit(0);
        });

        // Keep the process running
        await new Promise(() => {});
      }
    } catch (error) {
      if (isJson) {
        output.info(
          JSON.stringify({
            valid: false,
            error: error instanceof Error ? error.message : String(error),
            files: [],
            totalErrors: 1,
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        output.error(
          `${chalk.red('\n❌ Error:')} ${error instanceof Error ? error.message : String(error)}`
        );
      }
      process.exit(1);
    }
  });

/**
 * Status command - Show current pipeline status
 */
program
  .command('status')
  .description('Show current pipeline status')
  .option('-p, --project <id>', 'Show status for specific project')
  .option('--format <format>', 'Output format (text, json)', 'text')
  .option('-v, --verbose', 'Show verbose output with more details')
  .action(async (cmdOptions: Record<string, unknown>) => {
    const projectId = typeof cmdOptions['project'] === 'string' ? cmdOptions['project'] : undefined;
    const formatInput = typeof cmdOptions['format'] === 'string' ? cmdOptions['format'] : 'text';
    const verbose = cmdOptions['verbose'] === true;

    // Validate format
    const validFormats = ['text', 'json'];
    if (!validFormats.includes(formatInput)) {
      output.error(chalk.red(`\n❌ Invalid format: ${formatInput}`));
      output.info(chalk.dim(`Valid formats: ${validFormats.join(', ')}\n`));
      process.exit(1);
    }
    const format = formatInput as OutputFormat;

    const statusService = new StatusService({ format, verbose });
    const displayOptions = projectId !== undefined ? { projectId } : {};
    const result = await statusService.displayStatus(displayOptions);

    if (!result.success) {
      process.exit(1);
    }
  });

/**
 * Analyze command - Run the analysis pipeline
 */
program
  .command('analyze')
  .description('Analyze a project to detect documentation-code gaps')
  .option('-p, --project <path>', 'Project root path', '.')
  .option(
    '-s, --scope <scope>',
    'Analysis scope (full, documents_only, code_only, comparison)',
    'full'
  )
  .option('-g, --generate-issues', 'Generate GitHub issues from detected gaps')
  .option('-i, --project-id <id>', 'Custom project ID')
  .option('-r, --resume <analysisId>', 'Resume a failed analysis')
  .option('--status <analysisId>', 'Check status of an analysis')
  .option('--no-parallel', 'Disable parallel execution of stages')
  .option('--no-continue-on-error', 'Stop on first stage failure')
  .option('-o, --output-format <format>', 'Output format (yaml, json)', 'yaml')
  .action(async (cmdOptions: Record<string, unknown>) => {
    try {
      const projectPath = typeof cmdOptions['project'] === 'string' ? cmdOptions['project'] : '.';
      const scopeInput = typeof cmdOptions['scope'] === 'string' ? cmdOptions['scope'] : 'full';
      const generateIssues = cmdOptions['generateIssues'] === true;
      const projectId =
        typeof cmdOptions['projectId'] === 'string' ? cmdOptions['projectId'] : undefined;
      const resumeId = typeof cmdOptions['resume'] === 'string' ? cmdOptions['resume'] : undefined;
      const statusId = typeof cmdOptions['status'] === 'string' ? cmdOptions['status'] : undefined;
      const parallel = cmdOptions['parallel'] !== false;
      const continueOnError = cmdOptions['continueOnError'] !== false;
      const outputFormat =
        typeof cmdOptions['outputFormat'] === 'string' ? cmdOptions['outputFormat'] : 'yaml';

      // Initialize project context for centralized path management
      if (!isProjectInitialized()) {
        try {
          initializeProject(resolve(projectPath), { silent: true });
        } catch {
          // Ignore initialization errors - modules will fallback to process.cwd()
        }
      }

      // Validate scope
      const validScopes = ['full', 'documents_only', 'code_only', 'comparison'];
      if (!validScopes.includes(scopeInput)) {
        output.error(chalk.red(`\n❌ Invalid scope: ${scopeInput}`));
        output.info(chalk.dim(`Valid scopes: ${validScopes.join(', ')}\n`));
        process.exit(1);
      }
      const scope = scopeInput as AnalysisScope;

      // Get or create agent
      const agent = getAnalysisOrchestratorAgent({
        parallelExecution: parallel,
        continueOnError,
        outputFormat: outputFormat === 'json' ? 'json' : 'yaml',
      });

      // Handle status check
      if (statusId !== undefined) {
        output.info(chalk.blue(`\n📊 Analysis Status: ${statusId}\n`));
        try {
          const state = await agent.getStatus(statusId, projectPath);
          output.info(`${chalk.white('Analysis ID:')} ${state.analysisId}`);
          output.info(`${chalk.white('Project ID:')} ${state.projectId}`);
          output.info(`${chalk.white('Status:')} ${formatStatus(state.overallStatus)}`);
          output.info(`${chalk.white('Scope:')} ${state.scope}`);
          output.info(`${chalk.white('Started:')} ${state.startedAt}`);
          output.info(`${chalk.white('Updated:')} ${state.updatedAt}`);

          output.info(chalk.blue('\nStages:'));
          for (const stage of state.stages) {
            const statusIcon = getStatusIcon(stage.status);
            output.info(`  ${statusIcon} ${stage.name}: ${stage.status}`);
            if (stage.error !== null) {
              output.info(chalk.red(`      Error: ${stage.error}`));
            }
          }

          output.info(chalk.blue('\nStatistics:'));
          output.info(`  Total stages: ${String(state.statistics.totalStages)}`);
          output.info(`  Completed: ${String(state.statistics.completedStages)}`);
          output.info(`  Failed: ${String(state.statistics.failedStages)}`);
          output.info(`  Duration: ${String(state.statistics.totalDurationMs)}ms`);
          output.blank();
        } catch (error) {
          output.error(
            `${chalk.red('\n❌ Error:')} ${error instanceof Error ? error.message : String(error)}`
          );
          process.exit(1);
        }
        return;
      }

      // Handle resume
      if (resumeId !== undefined) {
        output.info(chalk.blue(`\n🔄 Resuming Analysis: ${resumeId}\n`));
        try {
          await agent.resume(resumeId, projectPath, true);
          output.info(chalk.green('✓ Session restored\n'));
        } catch (error) {
          output.error(
            `${chalk.red('\n❌ Error:')} ${error instanceof Error ? error.message : String(error)}`
          );
          process.exit(1);
        }
      } else {
        // Start new analysis
        output.info(chalk.blue('\n🔍 AD-SDLC Analysis Pipeline\n'));
        output.info(chalk.dim(`Project: ${projectPath}`));
        output.info(chalk.dim(`Scope: ${scope}`));
        output.info(chalk.dim(`Generate Issues: ${generateIssues ? 'Yes' : 'No'}`));
        output.info(chalk.dim(`Parallel Execution: ${parallel ? 'Yes' : 'No'}`));
        output.blank();

        try {
          const analysisInput = {
            projectPath,
            scope,
            generateIssues,
            ...(projectId !== undefined && { projectId }),
          };
          const session = await agent.startAnalysis(analysisInput);
          output.info(chalk.green(`✓ Analysis session started: ${session.analysisId}\n`));
        } catch (error) {
          output.error(
            `${chalk.red('\n❌ Error:')} ${error instanceof Error ? error.message : String(error)}`
          );
          process.exit(1);
        }
      }

      // Execute the analysis
      output.info(chalk.blue('🚀 Executing analysis pipeline...\n'));

      try {
        const result = await agent.execute();

        // Display results
        output.info(chalk.green('\n✅ Analysis Complete\n'));
        output.info(`${chalk.white('Analysis ID:')} ${result.analysisId}`);
        output.info(`${chalk.white('Project ID:')} ${result.projectId}`);
        output.info(`${chalk.white('Status:')} ${formatResultStatus(result.report.overallStatus)}`);

        output.info(chalk.blue('\nResults:'));
        if (result.report.documentAnalysis.available) {
          output.info(
            `${chalk.green('  ✓ Document Analysis:')} ${result.report.documentAnalysis.summary ?? 'N/A'}`
          );
        }
        if (result.report.codeAnalysis.available) {
          output.info(
            `${chalk.green('  ✓ Code Analysis:')} ${result.report.codeAnalysis.summary ?? 'N/A'}`
          );
        }
        if (result.report.comparison.available) {
          output.info(
            `${chalk.green('  ✓ Comparison:')} ${String(result.report.comparison.totalGaps)} gaps found (${String(result.report.comparison.criticalGaps)} critical)`
          );
        }
        if (result.report.issues.generated) {
          output.info(
            `${chalk.green('  ✓ Issues Generated:')} ${String(result.report.issues.totalIssues)} issues`
          );
        }

        output.info(chalk.blue('\nOutput Files:'));
        output.info(`  Pipeline State: ${result.outputPaths.pipelineState}`);
        output.info(`  Analysis Report: ${result.outputPaths.analysisReport}`);
        if (result.outputPaths.documentInventory !== undefined) {
          output.info(`  Document Inventory: ${result.outputPaths.documentInventory}`);
        }
        if (result.outputPaths.codeInventory !== undefined) {
          output.info(`  Code Inventory: ${result.outputPaths.codeInventory}`);
        }
        if (result.outputPaths.comparisonResult !== undefined) {
          output.info(`  Comparison Result: ${result.outputPaths.comparisonResult}`);
        }
        if (result.outputPaths.generatedIssues !== undefined) {
          output.info(`  Generated Issues: ${result.outputPaths.generatedIssues}`);
        }

        if (result.report.recommendations.length > 0) {
          output.info(chalk.blue('\nRecommendations:'));
          for (const rec of result.report.recommendations) {
            const icon =
              rec.priority === 1
                ? chalk.red('!')
                : rec.priority === 2
                  ? chalk.yellow('⚠')
                  : chalk.dim('ℹ');
            output.info(`  ${icon} ${rec.message}`);
            output.info(chalk.dim(`     Action: ${rec.action}`));
          }
        }

        if (result.warnings.length > 0) {
          output.info(chalk.yellow('\nWarnings:'));
          for (const warning of result.warnings) {
            output.info(chalk.yellow(`  ⚠ ${warning}`));
          }
        }

        output.info(chalk.dim(`\nTotal duration: ${String(result.report.totalDurationMs)}ms\n`));

        // Reset agent after completion
        resetAnalysisOrchestratorAgent();

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        output.error(
          `${chalk.red('\n❌ Analysis failed:')} ${error instanceof Error ? error.message : String(error)}`
        );
        resetAnalysisOrchestratorAgent();
        process.exit(1);
      }
    } catch (error) {
      output.error(
        `${chalk.red('\n❌ Error:')} ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

/**
 * Helper functions for status display
 * @param status - The pipeline stage status string
 * @returns A chalk-colored icon representing the status
 */
function getStatusIcon(status: string): string {
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

function formatStatus(status: string): string {
  switch (status) {
    case 'completed':
      return chalk.green(status);
    case 'running':
      return chalk.blue(status);
    case 'failed':
      return chalk.red(status);
    default:
      return chalk.dim(status);
  }
}

function formatResultStatus(status: string): string {
  switch (status) {
    case 'success':
      return chalk.green(status);
    case 'partial':
      return chalk.yellow(status);
    case 'failed':
      return chalk.red(status);
    default:
      return chalk.dim(status);
  }
}

/**
 * Completion command - Generate shell completion scripts
 */
program
  .command('completion')
  .description('Generate shell completion script')
  .option('-s, --shell <shell>', 'Shell type (bash, zsh, fish)')
  .action((cmdOptions: Record<string, unknown>) => {
    const shellInput = typeof cmdOptions['shell'] === 'string' ? cmdOptions['shell'] : null;

    // Validate shell type
    if (shellInput === null || shellInput.length === 0) {
      output.error(chalk.red('\n❌ Error: Shell type is required'));
      output.info(chalk.dim(`\nSupported shells: ${SUPPORTED_SHELLS.join(', ')}`));
      output.info(chalk.dim('\nUsage: ad-sdlc completion --shell <shell>\n'));
      output.info(chalk.blue('Examples:'));
      output.info(chalk.dim('  ad-sdlc completion --shell bash'));
      output.info(chalk.dim('  ad-sdlc completion --shell zsh'));
      output.info(chalk.dim('  ad-sdlc completion --shell fish\n'));
      process.exit(1);
    }

    if (!SUPPORTED_SHELLS.includes(shellInput as ShellType)) {
      output.error(chalk.red(`\n❌ Error: Unsupported shell: ${shellInput}`));
      output.info(chalk.dim(`\nSupported shells: ${SUPPORTED_SHELLS.join(', ')}\n`));
      process.exit(1);
    }

    const shell = shellInput as ShellType;
    const generator = getCompletionGenerator();
    const result = generator.generate(shell);

    if (!result.success) {
      output.error(
        chalk.red(`\n❌ Error generating completion: ${result.error ?? 'Unknown error'}\n`)
      );
      process.exit(1);
    }

    // Output the completion script
    output.info(result.script);

    // Show installation instructions on stderr so they don't interfere with script output
    output.error(chalk.dim('\n' + result.instructions + '\n'));
  });

/**
 * Telemetry command - Manage telemetry settings
 */
const telemetryCommand = program
  .command('telemetry')
  .description('Manage telemetry settings (opt-in anonymous usage analytics)');

telemetryCommand
  .command('status')
  .description('Show current telemetry status')
  .action(() => {
    const telemetry = getTelemetry();
    const consent = telemetry.getConsentStatus();
    const enabled = telemetry.isEnabled();
    const stats = telemetry.getStats();

    output.info(chalk.blue('\n📊 Telemetry Status\n'));
    output.info(`  Consent: ${formatConsentStatus(consent)}`);
    output.info(`  Enabled: ${enabled ? chalk.green('Yes') : chalk.dim('No')}`);
    output.info(`  Policy Version: ${PRIVACY_POLICY_VERSION}`);

    if (consent === 'granted') {
      output.blank();
      output.info(chalk.dim('Session Statistics:'));
      output.info(chalk.dim(`  Events Recorded: ${String(stats.eventsRecorded)}`));
      output.info(chalk.dim(`  Events Pending: ${String(stats.eventsPending)}`));
      output.info(
        chalk.dim(`  Session Duration: ${String(Math.round(stats.sessionDurationMs / 1000))}s`)
      );
    }

    output.blank();
  });

telemetryCommand
  .command('enable')
  .description('Enable telemetry (requires consent)')
  .option('-y, --yes', 'Automatically accept privacy policy')
  .action((cmdOptions: Record<string, unknown>) => {
    const telemetry = getTelemetry();
    const currentConsent = telemetry.getConsentStatus();
    const autoAccept = cmdOptions['yes'] === true;

    // Show privacy policy if not auto-accepting
    if (!autoAccept && currentConsent !== 'granted') {
      output.info(chalk.blue('\n📋 Privacy Policy\n'));
      output.info(chalk.white(`Version: ${PRIVACY_POLICY.version}`));
      output.info(chalk.dim(`Last Updated: ${PRIVACY_POLICY.lastUpdated}`));
      output.info(chalk.dim(`Retention Period: ${PRIVACY_POLICY.retentionPeriod}`));
      output.blank();

      output.info(chalk.green('Data we collect (anonymous):'));
      for (const item of PRIVACY_POLICY.dataCollected) {
        output.info(chalk.green(`  ✓ ${item}`));
      }
      output.blank();

      output.info(chalk.red('Data we DO NOT collect:'));
      for (const item of PRIVACY_POLICY.dataNotCollected) {
        output.info(chalk.red(`  ✗ ${item}`));
      }
      output.blank();

      output.info(chalk.yellow('To enable telemetry, run:'));
      output.info(chalk.cyan('  ad-sdlc telemetry enable --yes\n'));
      return;
    }

    // Grant consent and enable
    telemetry.setConsent(true);
    output.info(chalk.green('\n✅ Telemetry enabled.\n'));
    output.info(chalk.dim('Thank you for helping improve AD-SDLC!'));
    output.info(chalk.dim('You can disable telemetry anytime with: ad-sdlc telemetry disable\n'));
  });

telemetryCommand
  .command('disable')
  .description('Disable telemetry and revoke consent')
  .action(() => {
    const telemetry = getTelemetry();
    telemetry.revokeConsent();
    output.info(chalk.yellow('\n⚠️  Telemetry disabled.\n'));
    output.info(chalk.dim('Your consent has been revoked and all buffered data has been cleared.'));
    output.info(chalk.dim('You can re-enable telemetry anytime with: ad-sdlc telemetry enable\n'));
  });

telemetryCommand
  .command('policy')
  .description('Display the privacy policy')
  .action(() => {
    output.info(chalk.blue('\n📋 AD-SDLC Telemetry Privacy Policy\n'));
    output.info(chalk.white(`Version: ${PRIVACY_POLICY.version}`));
    output.info(chalk.white(`Last Updated: ${PRIVACY_POLICY.lastUpdated}`));
    output.info(chalk.white(`Retention Period: ${PRIVACY_POLICY.retentionPeriod}`));
    output.blank();

    output.info(chalk.green('Data We Collect (Anonymous Only):'));
    for (const item of PRIVACY_POLICY.dataCollected) {
      output.info(chalk.dim(`  • ${item}`));
    }
    output.blank();

    output.info(chalk.red('Data We DO NOT Collect:'));
    for (const item of PRIVACY_POLICY.dataNotCollected) {
      output.info(chalk.dim(`  • ${item}`));
    }
    output.blank();

    output.info(chalk.blue('Key Points:'));
    output.info(chalk.dim('  • Telemetry is strictly opt-in'));
    output.info(chalk.dim('  • No personal data is ever collected'));
    output.info(chalk.dim('  • You can disable telemetry at any time'));
    output.info(chalk.dim('  • Data is automatically deleted after 90 days'));
    output.blank();
  });

/**
 * Format consent status for display
 * @param status - The telemetry consent status string
 * @returns A chalk-colored consent status label
 */
function formatConsentStatus(status: string): string {
  switch (status) {
    case 'granted':
      return chalk.green('Granted');
    case 'denied':
      return chalk.red('Denied');
    case 'pending':
    default:
      return chalk.yellow('Pending (not set)');
  }
}

/**
 * Run command - Execute the AD-SDLC pipeline
 */
program
  .command('run')
  .description('Execute the AD-SDLC pipeline to generate documents, issues, and implementation')
  .argument('<requirements>', 'Project requirements or description text')
  .option('-m, --mode <mode>', 'Pipeline mode: greenfield | enhancement | import', 'greenfield')
  .option('--stop-after <stage>', 'Stop pipeline after specified stage')
  .option('--project-dir <dir>', 'Target project directory', process.cwd())
  .option('--dry-run', 'Validate pipeline configuration without executing agents', false)
  .option('--resume <session-id>', 'Resume a previously interrupted pipeline session')
  .action(async (requirements: string, cmdOptions: Record<string, unknown>) => {
    const modeInput = typeof cmdOptions['mode'] === 'string' ? cmdOptions['mode'] : 'greenfield';
    const stopAfter =
      typeof cmdOptions['stopAfter'] === 'string' ? cmdOptions['stopAfter'] : undefined;
    const projectDir =
      typeof cmdOptions['projectDir'] === 'string'
        ? resolve(cmdOptions['projectDir'])
        : resolve(process.cwd());
    const dryRun = cmdOptions['dryRun'] === true;
    const resumeSessionId =
      typeof cmdOptions['resume'] === 'string' ? cmdOptions['resume'] : undefined;

    // Validate mode
    const validModes = ['greenfield', 'enhancement', 'import'];
    if (!validModes.includes(modeInput)) {
      output.error(chalk.red(`\n❌ Invalid mode: ${modeInput}`));
      output.info(chalk.dim(`Valid modes: ${validModes.join(', ')}\n`));
      process.exit(1);
    }
    const mode = modeInput as PipelineMode;

    // Check .ad-sdlc/ directory exists
    const exists = configFilesExist();
    if (!exists.workflow && !exists.agents) {
      output.error(chalk.red('\n❌ No AD-SDLC configuration found.'));
      output.info(chalk.dim('Run "ad-sdlc init" to initialize a project first.\n'));
      process.exit(1);
    }

    // Initialize project context
    if (!isProjectInitialized()) {
      try {
        initializeProject(projectDir, { silent: true });
      } catch {
        // Ignore — modules will fallback to process.cwd()
      }
    }

    // Dry-run mode
    if (dryRun) {
      output.info(chalk.blue('\n🔍 Dry Run — Validating pipeline configuration\n'));
      output.info(chalk.dim(`Mode: ${mode}`));
      output.info(chalk.dim(`Project: ${projectDir}`));
      output.info(
        chalk.dim(
          `Requirements: ${requirements.slice(0, 120)}${requirements.length > 120 ? '...' : ''}`
        )
      );
      if (stopAfter !== undefined) {
        output.info(chalk.dim(`Stop after: ${stopAfter}`));
      }
      output.blank();

      try {
        const report = await validateAllConfigs();
        if (report.valid) {
          output.info(chalk.green('✅ Configuration is valid. Pipeline is ready to execute.\n'));
        } else {
          output.info(
            chalk.red(
              `❌ Found ${String(report.totalErrors)} configuration error(s). Fix these before running.\n`
            )
          );
          process.exit(1);
        }
      } catch (error) {
        output.error(
          `${chalk.red('\n❌ Error:')} ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
      return;
    }

    // Display pipeline info
    output.info(chalk.blue('\n🚀 AD-SDLC Pipeline Execution\n'));
    output.info(chalk.dim(`Mode: ${mode}`));
    output.info(chalk.dim(`Project: ${projectDir}`));
    output.info(
      chalk.dim(
        `Requirements: ${requirements.slice(0, 120)}${requirements.length > 120 ? '...' : ''}`
      )
    );
    if (resumeSessionId !== undefined) {
      output.info(chalk.dim(`Resuming session: ${resumeSessionId}`));
    }
    if (stopAfter !== undefined) {
      output.info(chalk.dim(`Stop after: ${stopAfter}`));
    }
    output.blank();

    const agent = getAdsdlcOrchestratorAgent();

    try {
      // Build pipeline request
      const request: PipelineRequest = {
        projectDir,
        userRequest: requirements,
        overrideMode: mode,
        ...(resumeSessionId !== undefined && {
          resumeMode: 'resume' as const,
          resumeSessionId,
        }),
        ...(stopAfter !== undefined && {
          resumeMode: 'start_from' as const,
        }),
      };

      // Start session
      const session = await agent.startSession(request);
      output.info(chalk.green(`✓ Session started: ${session.sessionId}`));
      output.info(chalk.dim(`Pipeline mode: ${session.mode}`));
      output.blank();

      // Execute pipeline
      output.info(chalk.blue('⟳ Executing pipeline stages...\n'));
      const result = await agent.executePipeline(projectDir, requirements);

      // Display results
      output.info(chalk.green('\n✅ Pipeline Complete\n'));
      output.info(`${chalk.white('Pipeline ID:')} ${result.pipelineId}`);
      output.info(`${chalk.white('Project ID:')} ${result.projectId}`);
      output.info(`${chalk.white('Mode:')} ${result.mode}`);
      output.info(`${chalk.white('Status:')} ${formatPipelineStatus(result.overallStatus)}`);

      if (result.stages.length > 0) {
        output.info(chalk.blue('\nStages:'));
        for (const stage of result.stages) {
          const icon = getStatusIcon(stage.status);
          const duration = chalk.dim(`(${String(stage.durationMs)}ms)`);
          output.info(`  ${icon} ${stage.name} ${duration}`);
          if (stage.error !== null) {
            output.info(chalk.red(`      Error: ${stage.error}`));
          }
        }
      }

      if (result.artifacts.length > 0) {
        output.info(chalk.blue('\nArtifacts:'));
        for (const artifact of result.artifacts) {
          output.info(`  ${chalk.dim(artifact)}`);
        }
      }

      if (result.warnings.length > 0) {
        output.info(chalk.yellow('\nWarnings:'));
        for (const warning of result.warnings) {
          output.info(chalk.yellow(`  ⚠ ${warning}`));
        }
      }

      output.info(chalk.dim(`\nTotal duration: ${String(result.durationMs)}ms\n`));

      resetAdsdlcOrchestratorAgent();

      if (result.overallStatus === 'failed') {
        process.exit(1);
      }
    } catch (error) {
      output.error(
        `${chalk.red('\n❌ Pipeline failed:')} ${error instanceof Error ? error.message : String(error)}`
      );
      resetAdsdlcOrchestratorAgent();
      process.exit(1);
    }
  });

/**
 * Format pipeline overall status for display
 * @param status - The pipeline status string
 * @returns A chalk-colored status label
 */
function formatPipelineStatus(status: string): string {
  switch (status) {
    case 'completed':
      return chalk.green(status);
    case 'running':
      return chalk.blue(status);
    case 'partial':
      return chalk.yellow(status);
    case 'failed':
      return chalk.red(status);
    default:
      return chalk.dim(status);
  }
}

// Parse command line arguments
program.parse();
