import type {
  SDKAssistantMessage,
  SDKResultSuccess,
  SDKStatusMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function sdkResult(
  overrides: Partial<Omit<SDKResultSuccess, 'usage'>> & {
    usage?: Partial<SDKResultSuccess['usage']>;
  } = {}
): SDKResultSuccess {
  return {
    type: 'result',
    subtype: 'success',
    session_id: 'sdk-session',
    uuid: '00000000-0000-4000-8000-000000000001',
    duration_ms: 0,
    duration_api_ms: 0,
    is_error: false,
    num_turns: 1,
    result: 'ok',
    stop_reason: 'end_turn',
    total_cost_usd: 0,
    modelUsage: {},
    permission_denials: [],
    ...overrides,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
      server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
      service_tier: 'standard',
      inference_geo: 'not_available',
      iterations: [],
      speed: 'standard',
      ...overrides.usage,
    },
  };
}

export function sdkStatus(sessionId: string): SDKStatusMessage {
  return {
    type: 'system',
    subtype: 'status',
    status: null,
    session_id: sessionId,
    uuid: '00000000-0000-4000-8000-000000000002',
  };
}

export function sdkAssistant(sessionId: string): SDKAssistantMessage {
  return {
    type: 'assistant',
    session_id: sessionId,
    uuid: '00000000-0000-4000-8000-000000000003',
    parent_tool_use_id: null,
    message: {
      id: 'msg-offline',
      type: 'message',
      role: 'assistant',
      model: 'sonnet',
      content: [],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: sdkResult().usage,
      container: null,
      context_management: null,
      diagnostics: null,
      stop_details: null,
    },
  };
}

export function agentMarkdown(
  name = 'worker',
  prompt = 'Project-specific worker prompt.',
  tools = ['Read', 'Write'],
  model = 'sonnet'
): string {
  return `---\nname: ${name}\ndescription: Customized ${name} for this project\ntools: [${tools.join(', ')}]\nmodel: ${model}\n---\n${prompt}\n`;
}

export async function installAgent(
  projectDir: string,
  name = 'worker',
  content = agentMarkdown(name)
): Promise<string> {
  const directory = join(projectDir, '.claude', 'agents');
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${name}.md`);
  await writeFile(path, content);
  return path;
}
