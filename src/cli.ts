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
} from './init/index.js';
import type { InitOptions, TechStack, TemplateType } from './init/types.js';
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
import { StatusService } from './status/index.js';
import type { OutputFormat } from './status/types.js';
import { initializeProject, isProjectInitialized } from './utils/index.js';
import { resolve } from 'node:path';
import { getCompletionGenerator, SUPPORTED_SHELLS, type ShellType } from './completion/index.js';
import {
  getTelemetry,
  PRIVACY_POLICY,
  PRIVACY_POLICY_VERSION,
} from './telemetry/index.js';

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
      console.log(chalk.blue('\n🚀 AD-SDLC Project Initialization\n'));

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
          console.log(chalk.yellow('\n⚠️  Initialization cancelled.\n'));
          process.exit(0);
        }
      }

      // Validate prerequisites
      const shouldValidate = cmdOptions['skipValidation'] !== true;
      if (shouldValidate) {
        console.log(chalk.blue('\n🔍 Validating prerequisites...\n'));
        const validator = getPrerequisiteValidator();
        const validation = await validator.validate();

        for (const check of validation.checks) {
          if (check.passed) {
            console.log(chalk.green(`  ✓ ${check.name}`));
          } else if (check.required) {
            console.log(chalk.red(`  ✗ ${check.name}`));
            console.log(chalk.yellow(`    Fix: ${check.fix ?? 'Unknown'}`));
          } else {
            console.log(chalk.yellow(`  ⚠ ${check.name} (optional)`));
            console.log(chalk.dim(`    ${check.fix ?? ''}`));
          }
        }

        if (!validation.valid) {
          console.log(
            chalk.red(
              '\n❌ Prerequisite validation failed. Please fix the required issues above.\n'
            )
          );
          process.exit(1);
        }

        if (validation.warnings > 0) {
          console.log(
            chalk.yellow(
              `\n⚠️  ${String(validation.warnings)} optional check(s) failed. Continuing anyway...\n`
            )
          );
        } else {
          console.log(chalk.green('\n✓ All prerequisites validated.\n'));
        }
      }

      // Initialize project
      console.log(chalk.blue('📁 Creating project structure...\n'));
      const initializer = createProjectInitializer(options);
      const result = await initializer.initialize();

      if (result.success) {
        console.log(chalk.green('\n✅ Project initialized successfully!\n'));
        console.log(chalk.dim('Created files:'));
        for (const file of result.createdFiles.slice(0, 10)) {
          console.log(chalk.dim(`  - ${file}`));
        }
        if (result.createdFiles.length > 10) {
          console.log(chalk.dim(`  ... and ${String(result.createdFiles.length - 10)} more files`));
        }

        console.log(chalk.blue('\n📖 Next steps:\n'));
        console.log(`  1. ${chalk.cyan(`cd ${options.projectName}`)}`);
        console.log(
          `  2. Set up your Claude API key: ${chalk.cyan('export CLAUDE_API_KEY="your-key"')}`
        );
        console.log(`  3. Run AD-SDLC: ${chalk.cyan('npx ad-sdlc run "Your requirements"')}`);
        console.log('');
      } else {
        console.log(chalk.red(`\n❌ Initialization failed: ${result.error ?? 'Unknown error'}\n`));
        process.exit(1);
      }
    } catch (error) {
      console.error(
        chalk.red('\n❌ Error:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

/**
 * Format validation result for CLI output
 */
function formatFileResult(result: FileValidationResult): void {
  const statusIcon = result.valid ? chalk.green('✓') : chalk.red('✗');
  console.log(`${statusIcon} ${result.filePath}`);

  if (!result.valid && result.errors.length > 0) {
    for (const error of result.errors) {
      console.log(chalk.red(`    ❌ ${error.path}: ${error.message}`));
      if (error.suggestion !== undefined && error.suggestion !== '') {
        console.log(chalk.yellow(`       Suggestion: ${error.suggestion}`));
      }
    }
  }
}

/**
 * Format validation report as JSON
 */
function formatReportAsJson(report: ValidationReport): void {
  console.log(JSON.stringify(report, null, 2));
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
      console.log(chalk.blue('\n🔍 Validating configuration...\n'));
      console.log(chalk.dim(`Schema version: ${CONFIG_SCHEMA_VERSION}\n`));
    }

    try {
      // Check if config files exist
      const exists = configFilesExist();
      if (!exists.workflow && !exists.agents) {
        if (isJson) {
          console.log(
            JSON.stringify({
              valid: false,
              error: 'No configuration files found. Run "ad-sdlc init" first.',
              files: [],
              totalErrors: 1,
              timestamp: new Date().toISOString(),
            })
          );
        } else {
          console.log(chalk.yellow('⚠️  No configuration files found.'));
          console.log(chalk.dim('Run "ad-sdlc init" to create a new project.\n'));
        }
        process.exit(1);
      }

      // Validate specific file or all files
      if (filePath !== null && filePath.length > 0) {
        const result = await validateConfigFile(filePath);

        if (isJson) {
          console.log(
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
          console.log('');
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

          console.log('');
          if (report.valid) {
            console.log(chalk.green('✅ All configuration files are valid.\n'));
          } else {
            console.log(
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
          console.log(chalk.blue('👀 Watching for changes... (Press Ctrl+C to stop)\n'));
        }

        const cleanup = watchConfigWithLogging(
          undefined,
          (changedPath) => {
            if (isJson) {
              console.log(
                JSON.stringify({
                  event: 'valid',
                  filePath: changedPath,
                  timestamp: new Date().toISOString(),
                })
              );
            } else {
              console.log(chalk.green(`✓ ${changedPath} - Valid`));
            }
          },
          (changedPath, errors) => {
            if (isJson) {
              console.log(
                JSON.stringify({
                  event: 'invalid',
                  filePath: changedPath,
                  errors,
                  timestamp: new Date().toISOString(),
                })
              );
            } else {
              console.log(chalk.red(`✗ ${changedPath} - Invalid`));
              for (const error of errors) {
                console.log(chalk.red(`    ❌ ${error.path}: ${error.message}`));
              }
            }
          }
        );

        // Handle Ctrl+C
        process.on('SIGINT', () => {
          cleanup();
          if (!isJson) {
            console.log(chalk.dim('\n\nStopped watching.\n'));
          }
          process.exit(0);
        });

        // Keep the process running
        await new Promise(() => {});
      }
    } catch (error) {
      if (isJson) {
        console.log(
          JSON.stringify({
            valid: false,
            error: error instanceof Error ? error.message : String(error),
            files: [],
            totalErrors: 1,
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        console.error(
          chalk.red('\n❌ Error:'),
          error instanceof Error ? error.message : String(error)
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
      console.error(chalk.red(`\n❌ Invalid format: ${formatInput}`));
      console.log(chalk.dim(`Valid formats: ${validFormats.join(', ')}\n`));
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
        console.error(chalk.red(`\n❌ Invalid scope: ${scopeInput}`));
        console.log(chalk.dim(`Valid scopes: ${validScopes.join(', ')}\n`));
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
        console.log(chalk.blue(`\n📊 Analysis Status: ${statusId}\n`));
        try {
          const state = await agent.getStatus(statusId, projectPath);
          console.log(chalk.white('Analysis ID:'), state.analysisId);
          console.log(chalk.white('Project ID:'), state.projectId);
          console.log(chalk.white('Status:'), formatStatus(state.overallStatus));
          console.log(chalk.white('Scope:'), state.scope);
          console.log(chalk.white('Started:'), state.startedAt);
          console.log(chalk.white('Updated:'), state.updatedAt);

          console.log(chalk.blue('\nStages:'));
          for (const stage of state.stages) {
            const statusIcon = getStatusIcon(stage.status);
            console.log(`  ${statusIcon} ${stage.name}: ${stage.status}`);
            if (stage.error !== null) {
              console.log(chalk.red(`      Error: ${stage.error}`));
            }
          }

          console.log(chalk.blue('\nStatistics:'));
          console.log(`  Total stages: ${String(state.statistics.totalStages)}`);
          console.log(`  Completed: ${String(state.statistics.completedStages)}`);
          console.log(`  Failed: ${String(state.statistics.failedStages)}`);
          console.log(`  Duration: ${String(state.statistics.totalDurationMs)}ms`);
          console.log('');
        } catch (error) {
          console.error(
            chalk.red('\n❌ Error:'),
            error instanceof Error ? error.message : String(error)
          );
          process.exit(1);
        }
        return;
      }

      // Handle resume
      if (resumeId !== undefined) {
        console.log(chalk.blue(`\n🔄 Resuming Analysis: ${resumeId}\n`));
        try {
          await agent.resume(resumeId, projectPath, true);
          console.log(chalk.green('✓ Session restored\n'));
        } catch (error) {
          console.error(
            chalk.red('\n❌ Error:'),
            error instanceof Error ? error.message : String(error)
          );
          process.exit(1);
        }
      } else {
        // Start new analysis
        console.log(chalk.blue('\n🔍 AD-SDLC Analysis Pipeline\n'));
        console.log(chalk.dim(`Project: ${projectPath}`));
        console.log(chalk.dim(`Scope: ${scope}`));
        console.log(chalk.dim(`Generate Issues: ${generateIssues ? 'Yes' : 'No'}`));
        console.log(chalk.dim(`Parallel Execution: ${parallel ? 'Yes' : 'No'}`));
        console.log('');

        try {
          const analysisInput = {
            projectPath,
            scope,
            generateIssues,
            ...(projectId !== undefined && { projectId }),
          };
          const session = await agent.startAnalysis(analysisInput);
          console.log(chalk.green(`✓ Analysis session started: ${session.analysisId}\n`));
        } catch (error) {
          console.error(
            chalk.red('\n❌ Error:'),
            error instanceof Error ? error.message : String(error)
          );
          process.exit(1);
        }
      }

      // Execute the analysis
      console.log(chalk.blue('🚀 Executing analysis pipeline...\n'));

      try {
        const result = await agent.execute();

        // Display results
        console.log(chalk.green('\n✅ Analysis Complete\n'));
        console.log(chalk.white('Analysis ID:'), result.analysisId);
        console.log(chalk.white('Project ID:'), result.projectId);
        console.log(chalk.white('Status:'), formatResultStatus(result.report.overallStatus));

        console.log(chalk.blue('\nResults:'));
        if (result.report.documentAnalysis.available) {
          console.log(
            chalk.green('  ✓ Document Analysis:'),
            result.report.documentAnalysis.summary
          );
        }
        if (result.report.codeAnalysis.available) {
          console.log(chalk.green('  ✓ Code Analysis:'), result.report.codeAnalysis.summary);
        }
        if (result.report.comparison.available) {
          console.log(
            chalk.green('  ✓ Comparison:'),
            `${String(result.report.comparison.totalGaps)} gaps found (${String(result.report.comparison.criticalGaps)} critical)`
          );
        }
        if (result.report.issues.generated) {
          console.log(
            chalk.green('  ✓ Issues Generated:'),
            `${String(result.report.issues.totalIssues)} issues`
          );
        }

        console.log(chalk.blue('\nOutput Files:'));
        console.log(`  Pipeline State: ${result.outputPaths.pipelineState}`);
        console.log(`  Analysis Report: ${result.outputPaths.analysisReport}`);
        if (result.outputPaths.documentInventory !== undefined) {
          console.log(`  Document Inventory: ${result.outputPaths.documentInventory}`);
        }
        if (result.outputPaths.codeInventory !== undefined) {
          console.log(`  Code Inventory: ${result.outputPaths.codeInventory}`);
        }
        if (result.outputPaths.comparisonResult !== undefined) {
          console.log(`  Comparison Result: ${result.outputPaths.comparisonResult}`);
        }
        if (result.outputPaths.generatedIssues !== undefined) {
          console.log(`  Generated Issues: ${result.outputPaths.generatedIssues}`);
        }

        if (result.report.recommendations.length > 0) {
          console.log(chalk.blue('\nRecommendations:'));
          for (const rec of result.report.recommendations) {
            const icon =
              rec.priority === 1
                ? chalk.red('!')
                : rec.priority === 2
                  ? chalk.yellow('⚠')
                  : chalk.dim('ℹ');
            console.log(`  ${icon} ${rec.message}`);
            console.log(chalk.dim(`     Action: ${rec.action}`));
          }
        }

        if (result.warnings.length > 0) {
          console.log(chalk.yellow('\nWarnings:'));
          for (const warning of result.warnings) {
            console.log(chalk.yellow(`  ⚠ ${warning}`));
          }
        }

        console.log(chalk.dim(`\nTotal duration: ${String(result.report.totalDurationMs)}ms\n`));

        // Reset agent after completion
        resetAnalysisOrchestratorAgent();

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red('\n❌ Analysis failed:'),
          error instanceof Error ? error.message : String(error)
        );
        resetAnalysisOrchestratorAgent();
        process.exit(1);
      }
    } catch (error) {
      console.error(
        chalk.red('\n❌ Error:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

/**
 * Helper functions for status display
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
      console.error(chalk.red('\n❌ Error: Shell type is required'));
      console.log(chalk.dim(`\nSupported shells: ${SUPPORTED_SHELLS.join(', ')}`));
      console.log(chalk.dim('\nUsage: ad-sdlc completion --shell <shell>\n'));
      console.log(chalk.blue('Examples:'));
      console.log(chalk.dim('  ad-sdlc completion --shell bash'));
      console.log(chalk.dim('  ad-sdlc completion --shell zsh'));
      console.log(chalk.dim('  ad-sdlc completion --shell fish\n'));
      process.exit(1);
    }

    if (!SUPPORTED_SHELLS.includes(shellInput as ShellType)) {
      console.error(chalk.red(`\n❌ Error: Unsupported shell: ${shellInput}`));
      console.log(chalk.dim(`\nSupported shells: ${SUPPORTED_SHELLS.join(', ')}\n`));
      process.exit(1);
    }

    const shell = shellInput as ShellType;
    const generator = getCompletionGenerator();
    const result = generator.generate(shell);

    if (!result.success) {
      console.error(
        chalk.red(`\n❌ Error generating completion: ${result.error ?? 'Unknown error'}\n`)
      );
      process.exit(1);
    }

    // Output the completion script
    console.log(result.script);

    // Show installation instructions on stderr so they don't interfere with script output
    console.error(chalk.dim('\n' + result.instructions + '\n'));
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

    console.log(chalk.blue('\n📊 Telemetry Status\n'));
    console.log(`  Consent: ${formatConsentStatus(consent)}`);
    console.log(`  Enabled: ${enabled ? chalk.green('Yes') : chalk.dim('No')}`);
    console.log(`  Policy Version: ${PRIVACY_POLICY_VERSION}`);

    if (consent === 'granted') {
      console.log('');
      console.log(chalk.dim('Session Statistics:'));
      console.log(chalk.dim(`  Events Recorded: ${String(stats.eventsRecorded)}`));
      console.log(chalk.dim(`  Events Pending: ${String(stats.eventsPending)}`));
      console.log(
        chalk.dim(`  Session Duration: ${String(Math.round(stats.sessionDurationMs / 1000))}s`)
      );
    }

    console.log('');
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
      console.log(chalk.blue('\n📋 Privacy Policy\n'));
      console.log(chalk.white(`Version: ${PRIVACY_POLICY.version}`));
      console.log(chalk.dim(`Last Updated: ${PRIVACY_POLICY.lastUpdated}`));
      console.log(chalk.dim(`Retention Period: ${PRIVACY_POLICY.retentionPeriod}`));
      console.log('');

      console.log(chalk.green('Data we collect (anonymous):'));
      for (const item of PRIVACY_POLICY.dataCollected) {
        console.log(chalk.green(`  ✓ ${item}`));
      }
      console.log('');

      console.log(chalk.red('Data we DO NOT collect:'));
      for (const item of PRIVACY_POLICY.dataNotCollected) {
        console.log(chalk.red(`  ✗ ${item}`));
      }
      console.log('');

      console.log(chalk.yellow('To enable telemetry, run:'));
      console.log(chalk.cyan('  ad-sdlc telemetry enable --yes\n'));
      return;
    }

    // Grant consent and enable
    telemetry.setConsent(true);
    console.log(chalk.green('\n✅ Telemetry enabled.\n'));
    console.log(chalk.dim('Thank you for helping improve AD-SDLC!'));
    console.log(chalk.dim('You can disable telemetry anytime with: ad-sdlc telemetry disable\n'));
  });

telemetryCommand
  .command('disable')
  .description('Disable telemetry and revoke consent')
  .action(() => {
    const telemetry = getTelemetry();
    telemetry.revokeConsent();
    console.log(chalk.yellow('\n⚠️  Telemetry disabled.\n'));
    console.log(chalk.dim('Your consent has been revoked and all buffered data has been cleared.'));
    console.log(chalk.dim('You can re-enable telemetry anytime with: ad-sdlc telemetry enable\n'));
  });

telemetryCommand
  .command('policy')
  .description('Display the privacy policy')
  .action(() => {
    console.log(chalk.blue('\n📋 AD-SDLC Telemetry Privacy Policy\n'));
    console.log(chalk.white(`Version: ${PRIVACY_POLICY.version}`));
    console.log(chalk.white(`Last Updated: ${PRIVACY_POLICY.lastUpdated}`));
    console.log(chalk.white(`Retention Period: ${PRIVACY_POLICY.retentionPeriod}`));
    console.log('');

    console.log(chalk.green('Data We Collect (Anonymous Only):'));
    for (const item of PRIVACY_POLICY.dataCollected) {
      console.log(chalk.dim(`  • ${item}`));
    }
    console.log('');

    console.log(chalk.red('Data We DO NOT Collect:'));
    for (const item of PRIVACY_POLICY.dataNotCollected) {
      console.log(chalk.dim(`  • ${item}`));
    }
    console.log('');

    console.log(chalk.blue('Key Points:'));
    console.log(chalk.dim('  • Telemetry is strictly opt-in'));
    console.log(chalk.dim('  • No personal data is ever collected'));
    console.log(chalk.dim('  • You can disable telemetry at any time'));
    console.log(chalk.dim('  • Data is automatically deleted after 90 days'));
    console.log('');
  });

/**
 * Format consent status for display
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

// Parse command line arguments
program.parse();
