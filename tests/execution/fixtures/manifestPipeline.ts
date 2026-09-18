import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { AdsdlcOrchestratorAgent } from '../../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { ArtifactValidator } from '../../../src/ad-sdlc-orchestrator/ArtifactValidator.js';
import {
  IMPORT_STAGES,
  type OrchestratorConfig,
  type OrchestratorSession,
} from '../../../src/ad-sdlc-orchestrator/types.js';
import {
  SdkExecutionAdapter,
  type SdkQueryOptions,
} from '../../../src/execution/SdkExecutionAdapter.js';
import type { ExecutionAdapter } from '../../../src/execution/types.js';
import { sdkResult, withQueryLifecycle } from './sdk.js';

export const OUTPUT = 'result notes.md';
class OutputValidator extends ArtifactValidator {
  override getArtifactMap() {
    return [
      {
        stage: 'issue_reading' as const,
        requiredArtifacts: [
          { pathPattern: OUTPUT, description: 'Producer output', required: true },
        ],
      },
    ];
  }
}
export class ManifestOrchestrator extends AdsdlcOrchestratorAgent {
  constructor(
    private readonly adapter: ExecutionAdapter,
    config: OrchestratorConfig = {}
  ) {
    super({ maxRetries: 0, ...config });
  }
  protected override createExecutionAdapter() {
    return this.adapter;
  }
  protected override createArtifactValidator(projectDir: string) {
    return new OutputValidator(projectDir);
  }
  produceWithoutCheckpoint(session: OrchestratorSession) {
    return this.executeViaAdapter(IMPORT_STAGES[0]!, session);
  }
}
export function pipelineSdk(onQuery?: (input: SdkQueryOptions) => void, omitRequired = false) {
  return new SdkExecutionAdapter({
    loader: async () =>
      withQueryLifecycle({
        async *query(input): AsyncGenerator<SDKMessage, void> {
          onQuery?.(input);
          if (input.options?.agent === 'issue-reader' && !omitRequired) {
            const root = input.options.cwd!;
            await writeFile(join(root, OUTPUT), 'durable producer output');
            for (const entry of input.options.hooks?.PostToolUse ?? [])
              for (const callback of entry.hooks)
                await callback(
                  {
                    hook_event_name: 'PostToolUse',
                    session_id: 'sdk-producer',
                    tool_use_id: 'write-result',
                    tool_name: 'Write',
                    tool_input: { file_path: OUTPUT },
                    tool_response: {},
                    cwd: root,
                    transcript_path: join(root, 'transcript'),
                  },
                  'write-result',
                  { signal: input.options.abortController!.signal }
                );
          }
          yield sdkResult({
            session_id: input.options?.agent === 'issue-reader' ? 'sdk-producer' : 'sdk-consumer',
            result: 'status: success',
          });
        },
      }),
  });
}
