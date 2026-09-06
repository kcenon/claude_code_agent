/** Target-project agent resolution, independent of ambient project discovery. */
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type {
  AgentDefinition,
  McpServerConfigForProcessTransport,
} from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { AgentFrontmatterSchema } from '../agent-validator/schemas.js';
import { parseFrontmatter } from '../agent-validator/validator.js';

const nonemptyString = z.string().refine((value) => value.trim().length > 0, 'Must not be blank');
const stringMap = z.record(z.string(), z.string());
const serverOptions = z.object({
  timeout: z.number().positive().optional(),
  alwaysLoad: z.boolean().optional(),
});
const transportSchema = z
  .union([
    serverOptions.extend({
      type: z.literal('stdio').optional(),
      command: nonemptyString,
      args: z.array(z.string()).optional(),
      env: stringMap.optional(),
    }),
    serverOptions.extend({
      type: z.enum(['http', 'sse']),
      url: z.url(),
      headers: stringMap.optional(),
      tools: z
        .array(
          z.object({
            name: nonemptyString,
            permission_policy: z.enum(['always_allow', 'always_ask', 'always_deny']).optional(),
            org_max_permission: z.enum(['allow', 'ask', 'blocked']).optional(),
          })
        )
        .optional(),
    }),
    z.object({
      type: z.literal('sdk'),
      name: nonemptyString,
      timeout: z.number().positive().optional(),
    }),
  ])
  .transform((server): McpServerConfigForProcessTransport => {
    const common = {
      ...(server.timeout !== undefined ? { timeout: server.timeout } : {}),
      ...('alwaysLoad' in server && server.alwaysLoad !== undefined
        ? { alwaysLoad: server.alwaysLoad }
        : {}),
    };
    if ('command' in server) {
      return {
        ...common,
        ...(server.type !== undefined ? { type: server.type } : {}),
        command: server.command,
        ...(server.args !== undefined ? { args: server.args } : {}),
        ...(server.env !== undefined ? { env: server.env } : {}),
      };
    }
    if (server.type === 'sdk') return { ...common, type: server.type, name: server.name };
    return {
      ...common,
      type: server.type,
      url: server.url,
      ...(server.headers !== undefined ? { headers: server.headers } : {}),
      ...(server.tools !== undefined
        ? {
            tools: server.tools.map((tool) => ({
              name: tool.name,
              ...(tool.permission_policy !== undefined
                ? { permission_policy: tool.permission_policy }
                : {}),
              ...(tool.org_max_permission !== undefined
                ? { org_max_permission: tool.org_max_permission }
                : {}),
            })),
          }
        : {}),
    };
  });

// Reuse AD-SDLC's required metadata rules, retaining optional fields understood
// by the installed SDK. Parsing directly avoids validateAgentFile's ambient
// agents.yaml lookup and reads each definition only once.
const definitionSchema = AgentFrontmatterSchema.extend({
  description: AgentFrontmatterSchema.shape.description.refine(
    (value) => value.trim().length >= 10,
    'Description must contain at least 10 non-padding characters'
  ),
  disallowedTools: z.array(nonemptyString).optional(),
  skills: z.array(nonemptyString).optional(),
  mcpServers: z.array(z.union([nonemptyString, z.record(z.string(), transportSchema)])).optional(),
  criticalSystemReminder_EXPERIMENTAL: nonemptyString.optional(),
  initialPrompt: nonemptyString.optional(),
  maxTurns: z.number().int().positive().optional(),
  background: z.boolean().optional(),
  memory: z.enum(['user', 'project', 'local']).optional(),
  effort: z.union([z.enum(['low', 'medium', 'high', 'xhigh', 'max']), z.number().int()]).optional(),
  permissionMode: z
    .enum(['default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk', 'auto'])
    .optional(),
  observer: nonemptyString.optional(),
  observerMessage: z.string().optional(),
});

/**
 * Load the requested project's installed, possibly customized agent definition.
 * No registry discovery, packaged checksum enforcement, or definition cache.
 * @param projectDir Absolute target project directory.
 * @param agentType Lowercase agent name, validated before constructing its path.
 * @returns The validated official SDK definition, including its Markdown prompt.
 * @throws Error with agent name, attempted path, and validation or I/O details.
 */
export async function resolveProjectAgent(
  projectDir: string,
  agentType: string
): Promise<AgentDefinition> {
  const name = AgentFrontmatterSchema.shape.name.safeParse(agentType);
  if (!name.success) {
    throw new Error(`Invalid agentType ${JSON.stringify(agentType)}: ${name.error.message}`);
  }
  if (typeof projectDir !== 'string' || !isAbsolute(projectDir) || projectDir.includes('\0')) {
    throw new Error(
      `Agent "${agentType}": projectDir must be an absolute directory; received ${JSON.stringify(projectDir)}`
    );
  }
  const definitionPath = join(projectDir, '.claude', 'agents', `${name.data}.md`);
  try {
    if (!(await stat(projectDir)).isDirectory()) throw new Error('projectDir is not a directory');
    const { frontmatter, body } = parseFrontmatter(
      await readFile(definitionPath, 'utf8'),
      definitionPath
    );
    const metadata = definitionSchema.parse(frontmatter);
    if (metadata.name !== agentType) {
      throw new Error(`frontmatter.name must equal "${agentType}"; found "${metadata.name}"`);
    }
    if (body.trim().length === 0) throw new Error('Prompt body must not be empty');
    const definition: AgentDefinition = {
      description: metadata.description,
      tools: metadata.tools,
      model: metadata.model,
      prompt: body,
    };
    if (metadata.disallowedTools !== undefined)
      definition.disallowedTools = metadata.disallowedTools;
    if (metadata.skills !== undefined) definition.skills = metadata.skills;
    if (metadata.mcpServers !== undefined) definition.mcpServers = metadata.mcpServers;
    if (metadata.criticalSystemReminder_EXPERIMENTAL !== undefined)
      definition.criticalSystemReminder_EXPERIMENTAL = metadata.criticalSystemReminder_EXPERIMENTAL;
    if (metadata.initialPrompt !== undefined) definition.initialPrompt = metadata.initialPrompt;
    if (metadata.maxTurns !== undefined) definition.maxTurns = metadata.maxTurns;
    if (metadata.background !== undefined) definition.background = metadata.background;
    if (metadata.memory !== undefined) definition.memory = metadata.memory;
    if (metadata.effort !== undefined) definition.effort = metadata.effort;
    if (metadata.permissionMode !== undefined) definition.permissionMode = metadata.permissionMode;
    if (metadata.observer !== undefined) definition.observer = metadata.observer;
    if (metadata.observerMessage !== undefined)
      definition.observerMessage = metadata.observerMessage;
    return definition;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Agent "${agentType}" at "${definitionPath}": ${detail}`, { cause: error });
  }
}
