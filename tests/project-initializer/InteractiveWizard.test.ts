/**
 * Tests for the interactive init wizard questions and confirmation summary.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const prompt = vi.hoisted(() => vi.fn());
vi.mock('inquirer', () => ({ default: { prompt } }));

import type { CLIOutput } from '../../src/cli/index.js';
import { InteractiveWizard } from '../../src/project-initializer/InteractiveWizard.js';

describe('InteractiveWizard', () => {
  beforeEach(() => {
    prompt.mockReset();
  });

  it('asks only for settings that init uses, without a repository URL or a tech stack', async () => {
    prompt.mockResolvedValueOnce({
      projectName: 'demo',
      description: '',
      template: 'standard',
    });
    const wizard = new InteractiveWizard({ summary: vi.fn() } as unknown as CLIOutput);

    const options = await wizard.run();

    const questions = prompt.mock.calls[0]?.[0] as ReadonlyArray<{ name: string }>;
    expect(questions.map((question) => question.name)).toEqual([
      'projectName',
      'description',
      'template',
    ]);
    expect(options).toEqual({ projectName: 'demo', description: undefined, template: 'standard' });
  });

  it('leaves the deprecated repository and tech stack out of the confirmation summary', async () => {
    prompt.mockResolvedValueOnce({ confirmed: true });
    const summary = vi.fn();
    const wizard = new InteractiveWizard({ summary } as unknown as CLIOutput);

    const confirmed = await wizard.confirmConfiguration({
      projectName: 'demo',
      githubRepo: 'https://github.com/user/demo',
      techStack: 'python',
      template: 'standard',
    });

    expect(confirmed).toBe(true);
    expect(summary).toHaveBeenCalledWith('Configuration Summary', {
      'Project Name': 'demo',
      Template: 'standard',
    });
  });
});
