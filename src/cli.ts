#!/usr/bin/env node

/**
 * AD-SDLC CLI Entry Point
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
          console.log(JSON.stringify({
            valid: false,
            error: 'No configuration files found. Run "ad-sdlc init" first.',
            files: [],
            totalErrors: 1,
            timestamp: new Date().toISOString(),
          }));
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
          console.log(JSON.stringify({
            valid: result.valid,
            files: [result],
            totalErrors: result.errors.length,
            timestamp: new Date().toISOString(),
          }, null, 2));
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
            console.log(chalk.red(`❌ Found ${String(report.totalErrors)} error(s). Fix these issues and try again.\n`));
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
              console.log(JSON.stringify({ event: 'valid', filePath: changedPath, timestamp: new Date().toISOString() }));
            } else {
              console.log(chalk.green(`✓ ${changedPath} - Valid`));
            }
          },
          (changedPath, errors) => {
            if (isJson) {
              console.log(JSON.stringify({ event: 'invalid', filePath: changedPath, errors, timestamp: new Date().toISOString() }));
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
        console.log(JSON.stringify({
          valid: false,
          error: error instanceof Error ? error.message : String(error),
          files: [],
          totalErrors: 1,
          timestamp: new Date().toISOString(),
        }));
      } else {
        console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
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
  .action(() => {
    console.log(chalk.blue('\n📊 Pipeline Status\n'));

    // TODO: Implement status display
    console.log(chalk.yellow('⚠️  Status display not yet implemented.\n'));
  });

// Parse command line arguments
program.parse();
