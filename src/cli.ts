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
 * Validate command - Validate configuration files
 */
program
  .command('validate')
  .description('Validate AD-SDLC configuration files')
  .option('-f, --file <path>', 'Validate a specific file')
  .action((cmdOptions: Record<string, unknown>) => {
    console.log(chalk.blue('\n🔍 Validating configuration...\n'));

    const filePath = typeof cmdOptions['file'] === 'string' ? cmdOptions['file'] : null;
    if (filePath !== null && filePath.length > 0) {
      console.log(chalk.dim(`Validating: ${filePath}`));
    } else {
      console.log(chalk.dim('Validating all configuration files...'));
    }

    // TODO: Implement configuration validation (Issue #68)
    console.log(chalk.yellow('\n⚠️  Configuration validation not yet implemented.\n'));
    console.log(chalk.dim('This feature will be available after Issue #68 is completed.\n'));
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
