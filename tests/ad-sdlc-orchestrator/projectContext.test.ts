import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { dump } from 'js-yaml';
import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { PipelineCheckpointManager } from '../../src/ad-sdlc-orchestrator/PipelineCheckpointManager.js';
import {
  IMPORT_STAGES,
  LOCAL_AGENT_SUBSTITUTIONS,
  type OrchestratorSession,
  type PipelineStageDefinition,
  type StageResult,
} from '../../src/ad-sdlc-orchestrator/types.js';
import {
  SdkExecutionAdapter,
  type ExecutionAdapter,
  type SdkQueryOptions,
  type StageExecutionRequest,
} from '../../src/execution/index.js';
import { agentMarkdown, installAgent, sdkResult } from '../execution/fixtures/sdk.js';

class ProbeOrchestrator extends AdsdlcOrchestratorAgent {
  constructor(private readonly adapter: ExecutionAdapter) {
    super({ maxRetries: 0 });
  }
  protected override createExecutionAdapter(): ExecutionAdapter {
    return this.adapter;
  }
  request(stage: PipelineStageDefinition, session: OrchestratorSession): StageExecutionRequest {
    return this.buildStageExecutionRequest(stage, session);
  }
}

let projectDir: string;
beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'orchestrator-context-'));
});
afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

function capturingAdapter(calls: SdkQueryOptions[]): SdkExecutionAdapter {
  return new SdkExecutionAdapter({
    loader: async () => ({
      async *query(input) {
        calls.push(input);
        yield sdkResult();
      },
    }),
  });
}

describe('orchestrator project and agent context at the SDK boundary', () => {
  it('normalizes the root and executes real local-mode substitutions through the project resolver', async () => {
    for (const stage of IMPORT_STAGES) {
      const name = LOCAL_AGENT_SUBSTITUTIONS[stage.agentType] ?? stage.agentType;
      await installAgent(
        projectDir,
        name,
        agentMarkdown(name, `${name} customized for this project`)
      );
    }
    const calls: SdkQueryOptions[] = [];
    const orchestrator = new ProbeOrchestrator(capturingAdapter(calls));
    try {
      const session = await orchestrator.startSession({
        projectDir: relative(process.cwd(), projectDir),
        userRequest: 'Import local work',
        overrideMode: 'import',
        localMode: true,
      });
      expect(session.projectDir).toBe(projectDir);
      await orchestrator.executePipeline(projectDir, 'Import local work');
      expect(calls.map((call) => call.options?.agent)).toEqual([
        'local-issue-reader',
        'controller',
        'worker',
        'validation-agent',
        'local-reviewer',
      ]);
      for (const call of calls) {
        expect(call.options?.cwd).toBe(projectDir);
        const name = call.options?.agent;
        expect(name).toBeDefined();
        expect(call.options?.agents?.[name!]?.prompt).toBe(`${name} customized for this project\n`);
      }
      expect(calls[1]?.prompt).toContain('### issue_reading');
    } finally {
      await orchestrator.dispose();
    }
  });

  it.each(['checkpoint', 'legacy-checkpoint', 'session-only'] as const)(
    'resumes %s in the selected project and consumes the SDK resume ID once',
    async (mode) => {
      await installAgent(projectDir, 'worker');
      await installAgent(projectDir, 'local-reviewer');
      const sessionId = 'resume-project-test';
      const scratchpadDir = join(projectDir, '.ad-sdlc', 'scratchpad');
      await mkdir(join(scratchpadDir, 'pipeline'), { recursive: true });
      const priorResults: StageResult[] = [
        {
          name: 'issue_reading',
          agentType: 'local-issue-reader',
          status: 'completed',
          durationMs: 1,
          output: 'Imported local issue content',
          artifacts: [],
          error: null,
          retryCount: 0,
        },
      ];
      await writeFile(
        join(scratchpadDir, 'pipeline', `${sessionId}.yaml`),
        dump({
          pipelineId: sessionId,
          projectDir: 'stale-launch-directory',
          mode: 'import',
          userRequest: 'Continue local work',
          localMode: true,
          stages: priorResults,
        })
      );
      if (mode !== 'session-only') {
        const filename = await new PipelineCheckpointManager().saveCheckpoint(
          sessionId,
          'import',
          '/stale/project',
          'Continue local work',
          scratchpadDir,
          priorResults,
          ['issue_reading'],
          mode === 'checkpoint' ? 'sdk-resume-id' : undefined
        );
        if (mode === 'legacy-checkpoint') {
          await writeFile(
            join(scratchpadDir, 'pipeline', 'checkpoints', filename),
            dump({
              version: 1,
              sessionId,
              projectDir: 'stale-project',
              mode: 'import',
              userRequest: 'Continue local work',
              createdAt: new Date().toISOString(),
              completedStageResults: priorResults,
              completedStageNames: ['issue_reading'],
            })
          );
        }
      }
      const calls: SdkQueryOptions[] = [];
      const adapter = capturingAdapter(calls);
      const orchestrator = new ProbeOrchestrator(adapter);
      try {
        const session = await orchestrator.startSession({
          projectDir: relative(process.cwd(), projectDir),
          userRequest: 'Resume',
          resumeSessionId: sessionId,
        });
        expect(session.projectDir).toBe(projectDir);
        expect(session.scratchpadDir).toBe(scratchpadDir);
        const first = orchestrator.request(
          { ...IMPORT_STAGES[2]!, maxTurns: 7, permissionMode: 'plan' },
          session
        );
        const second = orchestrator.request(
          { ...IMPORT_STAGES[4]!, agentType: 'local-reviewer' },
          session
        );
        expect(first.projectDir).toBe(projectDir);
        expect(second.projectDir).toBe(projectDir);
        expect(first.resume).toBe(mode === 'checkpoint' ? 'sdk-resume-id' : undefined);
        expect(second).not.toHaveProperty('resume');
        expect((await adapter.execute(first)).status).toBe('success');
        expect((await adapter.execute(second)).status).toBe('success');
        expect(calls[0]?.options).toMatchObject({
          cwd: projectDir,
          agent: 'worker',
          maxTurns: 7,
          permissionMode: 'plan',
          skills: [...(IMPORT_STAGES[2]!.skills ?? [])],
        });
        expect(calls[0]?.options?.resume).toBe(mode === 'checkpoint' ? 'sdk-resume-id' : undefined);
        expect(calls[1]?.options).toMatchObject({
          cwd: projectDir,
          agent: 'local-reviewer',
          mcpServers: IMPORT_STAGES[4]!.mcpServers,
        });
        expect(calls[1]?.options).not.toHaveProperty('resume');
        expect(calls[0]?.prompt).toContain('Imported local issue content');
        expect(calls[0]?.prompt).toContain('Continue local work');
      } finally {
        await adapter.dispose();
        await orchestrator.dispose();
      }
    }
  );
});
