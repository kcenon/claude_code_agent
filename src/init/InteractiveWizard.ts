/**
 * Interactive setup wizard for project initialization
 *
 * @packageDocumentation
 */

import * as path from 'path';

import inquirer from 'inquirer';

import type { InitOptions, TechStack, TemplateType } from './types.js';

/**
 * Answers from the interactive wizard prompts
 */
interface WizardAnswers {
  projectName: string;
  description: string;
  githubRepo: string;
  techStack: TechStack;
  template: TemplateType;
}

/**
 * Confirmation prompt answer
 */
interface ConfirmAnswer {
  confirmed: boolean;
}

/**
 * Interactive wizard for gathering project configuration
 */
export class InteractiveWizard {
  /**
   * Run the interactive wizard to gather project configuration
   */
  async run(): Promise<InitOptions> {
    const answers = await inquirer.prompt<WizardAnswers>([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: path.basename(process.cwd()),
        validate: (input: string): boolean | string => {
          if (input.trim().length === 0) {
            return 'Project name is required';
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
            return 'Project name can only contain letters, numbers, hyphens, and underscores';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description (optional):',
        default: '',
      },
      {
        type: 'input',
        name: 'githubRepo',
        message: 'GitHub repository URL (optional):',
        default: '',
        validate: (input: string): boolean | string => {
          if (input.length === 0) return true;
          if (!input.startsWith('https://github.com/')) {
            return 'Please enter a valid GitHub repository URL (https://github.com/...)';
          }
          return true;
        },
      },
      {
        type: 'list',
        name: 'techStack',
        message: 'Primary technology stack:',
        choices: [
          { name: 'TypeScript', value: 'typescript' },
          { name: 'Python', value: 'python' },
          { name: 'Java', value: 'java' },
          { name: 'Go', value: 'go' },
          { name: 'Rust', value: 'rust' },
          { name: 'Other', value: 'other' },
        ],
        default: 'typescript',
      },
      {
        type: 'list',
        name: 'template',
        message: 'Project template:',
        choices: [
          {
            name: 'Minimal - Basic structure with essential features',
            value: 'minimal',
          },
          {
            name: 'Standard - Full setup with token tracking and dashboard',
            value: 'standard',
          },
          {
            name: 'Enterprise - Strict quality gates with audit logging',
            value: 'enterprise',
          },
        ],
        default: 'standard',
      },
    ]);

    return {
      projectName: answers.projectName,
      description: answers.description.length > 0 ? answers.description : undefined,
      githubRepo: answers.githubRepo.length > 0 ? answers.githubRepo : undefined,
      techStack: answers.techStack,
      template: answers.template,
    };
  }

  /**
   * Prompt for confirmation before proceeding
   */
  async confirm(message: string): Promise<boolean> {
    const answer = await inquirer.prompt<ConfirmAnswer>([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: true,
      },
    ]);
    return answer.confirmed;
  }

  /**
   * Display a summary of the configuration and ask for confirmation
   */
  async confirmConfiguration(options: InitOptions): Promise<boolean> {
    console.log('\n📋 Configuration Summary:');
    console.log('─'.repeat(40));
    console.log(`  Project Name:    ${options.projectName}`);
    if (options.description !== undefined && options.description.length > 0) {
      console.log(`  Description:     ${options.description}`);
    }
    if (options.githubRepo !== undefined && options.githubRepo.length > 0) {
      console.log(`  GitHub Repo:     ${options.githubRepo}`);
    }
    console.log(`  Tech Stack:      ${options.techStack}`);
    console.log(`  Template:        ${options.template}`);
    console.log('─'.repeat(40));

    return this.confirm('\nProceed with this configuration?');
  }
}

/**
 * Create and return an InteractiveWizard instance
 */
export function createInteractiveWizard(): InteractiveWizard {
  return new InteractiveWizard();
}
