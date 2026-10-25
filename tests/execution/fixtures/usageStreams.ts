/**
 * Recorded SDK message sequences for usage, turn, and tool-use counting (#956).
 *
 * Each sequence is what `query()` of the installed `@anthropic-ai/claude-agent-sdk`
 * yields for one execution, typed against its `SDKMessage` union so
 * `npm run test:sdk-contract` catches SDK drift. Shapes follow the SDK's
 * streaming behavior: while a response streams, the CLI emits one assistant
 * message per content block, and those messages share `message.id`. Values
 * are synthetic; no paid SDK call produced them.
 *
 * Hand-computed expectations are next to each sequence.
 */
import type {
  ModelUsage,
  SDKAssistantMessage,
  SDKMessage,
  SDKResultError,
  SDKResultMessage,
  SDKResultSuccess,
  SDKSystemMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';

export const SESSION = '5b0c9e2e-0d4f-4c1e-9a43-2f1b7c3d9e10';
export const MODEL = 'claude-sonnet-4-5';
export const HELPER_MODEL = 'claude-haiku-4-5';
export const CLAUDE_CODE_VERSION = '2.1.0';

type Usage = SDKAssistantMessage['message']['usage'];
type Block = SDKAssistantMessage['message']['content'][number];

let uuid = 0;
const nextUuid = (): `${string}-${string}-${string}-${string}-${string}` =>
  `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`;

/** Assistant or result usage with nullable cache fields, as the Messages API reports it. */
export function usage(
  input: number,
  output: number,
  cacheRead: number | null,
  cacheCreation: number | null
): Usage {
  return {
    input_tokens: input,
    output_tokens: output,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheCreation,
    cache_creation: null,
    server_tool_use: null,
    service_tier: 'standard',
    inference_geo: null,
    iterations: null,
    speed: null,
  };
}

/** `system/init`: model and Claude Code version of the session. */
export function init(sessionId = SESSION, model = MODEL): SDKSystemMessage {
  return {
    type: 'system',
    subtype: 'init',
    apiKeySource: 'none',
    claude_code_version: CLAUDE_CODE_VERSION,
    cwd: '/workspace/project',
    tools: ['Read', 'Write', 'Bash', 'Grep'],
    mcp_servers: [],
    model,
    permissionMode: 'default',
    slash_commands: [],
    output_style: 'default',
    skills: [],
    plugins: [],
    uuid: nextUuid(),
    session_id: sessionId,
  };
}

export const text = (value: string): Block => ({ type: 'text', text: value, citations: null });

export const toolUse = (id: string, name: string, input: Record<string, unknown> = {}): Block => ({
  type: 'tool_use',
  id,
  name,
  input,
});

/** One assistant message (or one streamed block of it). */
export function assistant(
  id: string,
  content: readonly Block[],
  messageUsage: Usage = usage(0, 0, 0, 0),
  options: { parentToolUseId?: string; model?: string; final?: boolean } = {}
): SDKAssistantMessage {
  return {
    type: 'assistant',
    session_id: SESSION,
    uuid: nextUuid(),
    parent_tool_use_id: options.parentToolUseId ?? null,
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model: options.model ?? MODEL,
      content: [...content],
      stop_reason: options.final === true ? 'end_turn' : null,
      stop_sequence: null,
      usage: messageUsage,
      container: null,
      context_management: null,
      diagnostics: null,
      stop_details: null,
    },
  };
}

/** Tool results returned to the model. */
export function toolResults(...ids: string[]): SDKUserMessage {
  return {
    type: 'user',
    session_id: SESSION,
    uuid: nextUuid(),
    parent_tool_use_id: null,
    message: {
      role: 'user',
      content: ids.map((id) => ({ type: 'tool_result', tool_use_id: id, content: 'ok' })),
    },
  };
}

const modelUsage = (
  input: number,
  output: number,
  cacheRead: number,
  cacheCreation: number
): ModelUsage => ({
  inputTokens: input,
  outputTokens: output,
  cacheReadInputTokens: cacheRead,
  cacheCreationInputTokens: cacheCreation,
  webSearchRequests: 0,
  costUSD: 0,
  contextWindow: 200000,
  maxOutputTokens: 64000,
});

/** Successful result message. */
export function success(
  numTurns: number,
  resultUsage: Usage,
  models: Record<string, ModelUsage> = {}
): SDKResultSuccess {
  return {
    type: 'result',
    subtype: 'success',
    session_id: SESSION,
    uuid: nextUuid(),
    duration_ms: 4200,
    duration_api_ms: 3900,
    is_error: false,
    num_turns: numTurns,
    result: 'status: success',
    stop_reason: 'end_turn',
    total_cost_usd: 0,
    usage: { ...usage(0, 0, 0, 0), ...resultUsage } as SDKResultSuccess['usage'],
    modelUsage: models,
    permission_denials: [],
  };
}

/** Error result message. */
export function failure(
  subtype: SDKResultError['subtype'],
  numTurns: number,
  resultUsage: Usage,
  errors: string[]
): SDKResultError {
  return {
    type: 'result',
    subtype,
    session_id: SESSION,
    uuid: nextUuid(),
    duration_ms: 1800,
    duration_api_ms: 1500,
    is_error: true,
    num_turns: numTurns,
    stop_reason: null,
    total_cost_usd: 0,
    usage: { ...usage(0, 0, 0, 0), ...resultUsage } as SDKResultError['usage'],
    modelUsage: {},
    permission_denials: [],
    errors,
  };
}

/**
 * Success: init, a streamed message (text block, then a Read tool_use with
 * updated usage), a Write tool_use, a final text, and a result whose
 * `modelUsage` covers a helper model as well.
 *
 * Expected: usage source `result` from `modelUsage`: input 1650 + 90 = 1740,
 * output 235 + 12 = 247, cache read 4300 + 0, cache creation 800 + 0;
 * turnCount 3; toolUseCount 2 (Read 1, Write 1); models [haiku, sonnet].
 * Legacy: toolCallCount max(3 messages, 3 turns) = 3; tokenUsage from the
 * main-loop `usage`: input 1650, output 235, cache 4300 + 800 = 5100.
 */
export const SUCCESS_STREAM: readonly SDKMessage[] = [
  init(),
  assistant('msg_s1', [text('Reading the work order.')], usage(1200, 40, 0, 800)),
  assistant(
    'msg_s1',
    [toolUse('toolu_s1', 'Read', { file_path: 'src/app.ts' })],
    usage(1200, 85, 0, 800)
  ),
  toolResults('toolu_s1'),
  assistant(
    'msg_s2',
    [toolUse('toolu_s2', 'Write', { file_path: 'src/app.ts' })],
    usage(300, 120, 2000, 0)
  ),
  toolResults('toolu_s2'),
  assistant('msg_s3', [text('Done.')], usage(150, 30, 2300, 0), { final: true }),
  success(3, usage(1650, 235, 4300, 800), {
    [MODEL]: modelUsage(1650, 235, 4300, 800),
    [HELPER_MODEL]: modelUsage(90, 12, 0, 0),
  }),
];

/**
 * Multiple tool uses: message `msg_m1` streams three tool_use blocks as three
 * assistant messages and re-emits the Grep block once; message `msg_m2`
 * carries two tool_use blocks in one content array.
 *
 * Expected: toolUseCount 5 (Read 2, Grep 1, Bash 1, mcp__github__create_issue 1);
 * turnCount 3. Legacy toolCallCount stays max(3 messages, 3 turns) = 3, which is
 * why it cannot count tool invocations.
 */
export const MULTI_TOOL_STREAM: readonly SDKMessage[] = [
  init(),
  assistant('msg_m1', [toolUse('toolu_m1', 'Read', { file_path: 'a.ts' })], usage(500, 20, 0, 0)),
  assistant('msg_m1', [toolUse('toolu_m2', 'Grep', { pattern: 'login' })], usage(500, 40, 0, 0)),
  assistant('msg_m1', [toolUse('toolu_m3', 'Read', { file_path: 'b.ts' })], usage(500, 60, 0, 0)),
  assistant('msg_m1', [toolUse('toolu_m2', 'Grep', { pattern: 'login' })], usage(500, 60, 0, 0)),
  toolResults('toolu_m1', 'toolu_m2', 'toolu_m3'),
  assistant(
    'msg_m2',
    [
      text('Opening the issue and running the tests.'),
      toolUse('toolu_m4', 'mcp__github__create_issue', { title: 'Follow-up' }),
      toolUse('toolu_m5', 'Bash', { command: 'npm test' }),
    ],
    usage(700, 90, 500, 0)
  ),
  toolResults('toolu_m4', 'toolu_m5'),
  assistant('msg_m3', [text('All done.')], usage(200, 15, 1200, 0), { final: true }),
  success(3, usage(1400, 165, 1700, 0)),
];

/**
 * Partial failure: two tool rounds consume tokens, then the SDK ends with an
 * `error_during_execution` result carrying zeroed usage (the SDK writes
 * zeroed usage on crash results).
 *
 * Expected: usage source `partial` from the assistant messages: input
 * 900 + 200 = 1100, output 60 + 45 = 105, cache read 0 + 1300 = 1300, cache
 * creation 400 + 0 = 400; turnCount 2; toolUseCount 2. Legacy tokenUsage keeps
 * the partial totals (input 1100, output 105, cache 1700) instead of zeros.
 */
export const PARTIAL_FAILURE_STREAM: readonly SDKMessage[] = [
  init(),
  assistant(
    'msg_f1',
    [toolUse('toolu_f1', 'Read', { file_path: 'src/db.ts' })],
    usage(900, 60, 0, 400)
  ),
  toolResults('toolu_f1'),
  assistant(
    'msg_f2',
    [toolUse('toolu_f2', 'Bash', { command: 'npm run migrate' })],
    usage(200, 45, 1300, 0)
  ),
  toolResults('toolu_f2'),
  failure('error_during_execution', 2, usage(0, 0, 0, 0), ['API Error: 529 overloaded']),
];

/**
 * Failure with measured usage: the turn limit stops the execution and the
 * result reports what it used. Expected: usage source `result`: input 2400,
 * output 310, cache read 900, cache creation 0; turnCount 4; toolUseCount 1.
 */
export const MAX_TURNS_STREAM: readonly SDKMessage[] = [
  init(),
  assistant('msg_t1', [toolUse('toolu_t1', 'Read')], usage(600, 80, 300, 0)),
  toolResults('toolu_t1'),
  failure('error_max_turns', 4, usage(2400, 310, 900, 0), ['Reached maximum number of turns (4)']),
];

/**
 * Cancellation mid-stream: one message streams a text block and then a Bash
 * tool_use with updated usage; the stream then waits until it is aborted. The
 * API did not report cache counts for this message (null).
 *
 * Expected: usage source `partial`: input 700, output 55 (the latest usage of
 * `msg_c1`), cache read null, cache creation null (unknown, not 0); turnCount
 * null (no result); toolUseCount 1.
 */
export const CANCELLED_STREAM: readonly SDKMessage[] = [
  init(),
  assistant('msg_c1', [text('Running the migration.')], usage(700, 20, null, null)),
  assistant(
    'msg_c1',
    [toolUse('toolu_c1', 'Bash', { command: 'npm run migrate' })],
    usage(700, 55, null, null)
  ),
];

/**
 * A result without usage (an older or third-party producer that omits
 * `usage` and `modelUsage`). Expected: every token field null with source
 * `none`; turnCount 1; toolUseCount 0.
 */
export const NO_USAGE_STREAM: readonly SDKMessage[] = [
  init(),
  (() => {
    const { usage: _usage, modelUsage: _models, ...result } = success(1, usage(0, 0, 0, 0));
    return result as unknown as SDKResultMessage;
  })(),
];
