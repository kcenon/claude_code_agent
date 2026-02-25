/**
 * MockBridge - Configurable mock for pipeline stage agent invocations
 *
 * Used in E2E smoke tests to verify orchestrator behavior without
 * invoking real agents. Maps agent types to canned responses.
 */

import type {
  PipelineStageDefinition,
  OrchestratorSession,
} from '../../../src/ad-sdlc-orchestrator/types.js';

/**
 * Response handler: either a static string or a function that receives
 * the stage definition and session to produce a dynamic response.
 */
export type MockResponseHandler =
  | string
  | ((stage: PipelineStageDefinition, session: OrchestratorSession) => string);

/**
 * Map of agent types to their mock responses.
 *
 * An entry whose value is a string returns that string verbatim.
 * An entry whose value is a function is called with (stage, session)
 * and should return the output string.
 */
export type MockResponseMap = Record<string, MockResponseHandler>;

/**
 * Create a mock invokeAgent function that resolves responses from a
 * static mapping. Throws if the agent type has no entry in the map.
 *
 * @param responses - Map of agentType to response (string or function)
 * @returns An async function compatible with the invokeAgent signature
 */
export function createMockInvoker(
  responses: MockResponseMap
): (stage: PipelineStageDefinition, session: OrchestratorSession) => Promise<string> {
  return async (stage, session) => {
    const handler = responses[stage.agentType];
    if (handler === undefined) {
      throw new Error(`MockBridge: no response configured for agent type "${stage.agentType}"`);
    }
    return typeof handler === 'function' ? handler(stage, session) : handler;
  };
}
