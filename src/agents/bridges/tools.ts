/**
 * Bridge Tool Definitions and Executor
 *
 * Defines the tools available to agents during multi-turn conversations
 * via the Anthropic Messages API. Each tool maps to a file system or
 * code search operation, sandboxed within the project directory.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Anthropic tool definition for Messages API */
export interface BridgeToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

/** Result from executing a tool, sent back to the API */
export interface ToolResultBlock {
  readonly type: 'tool_result';
  readonly tool_use_id: string;
  readonly content: string;
  readonly is_error?: boolean;
}

/** Content block types returned by the Messages API */
export interface TextBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface ToolUseBlock {
  readonly type: 'tool_use';
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

export type ContentBlock = TextBlock | ToolUseBlock;

/** Message in the conversation history */
export interface ConversationMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string | readonly (ContentBlock | ToolResultBlock)[];
}

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

const READ_FILE_TOOL: BridgeToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file at the given path relative to the project directory.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the project directory' },
    },
    required: ['path'],
  },
};

const WRITE_FILE_TOOL: BridgeToolDefinition = {
  name: 'write_file',
  description:
    'Write content to a file at the given path relative to the project directory. Creates parent directories if needed.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the project directory' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
};

const LIST_FILES_TOOL: BridgeToolDefinition = {
  name: 'list_files',
  description:
    'List files matching a glob pattern relative to the project directory. Returns matching file paths.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern (e.g., "src/**/*.ts", "*.md")',
      },
    },
    required: ['pattern'],
  },
};

const SEARCH_CODE_TOOL: BridgeToolDefinition = {
  name: 'search_code',
  description:
    'Search for a text pattern in files within the project directory. Returns matching lines with file paths and line numbers.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (plain text or regex)' },
      glob: {
        type: 'string',
        description: 'Optional glob to filter files (e.g., "*.ts")',
      },
    },
    required: ['pattern'],
  },
};

/** All available tool definitions */
export const ALL_TOOL_DEFINITIONS: readonly BridgeToolDefinition[] = [
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  LIST_FILES_TOOL,
  SEARCH_CODE_TOOL,
];

// ---------------------------------------------------------------------------
// Tool Execution
// ---------------------------------------------------------------------------

/**
 * Get tool definitions filtered by allowed tool names.
 */
export function getToolDefinitions(allowedTools?: readonly string[]): BridgeToolDefinition[] {
  if (!allowedTools || allowedTools.length === 0) {
    return [...ALL_TOOL_DEFINITIONS];
  }
  return ALL_TOOL_DEFINITIONS.filter((t) => allowedTools.includes(t.name));
}

/**
 * Execute a tool and return the result string.
 *
 * All file paths are resolved relative to `projectDir` and validated
 * to prevent path traversal.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  projectDir: string
): Promise<string> {
  const asString = (key: string): string => (typeof input[key] === 'string' ? input[key] : '');

  switch (toolName) {
    case 'read_file':
      return executeReadFile(asString('path'), projectDir);
    case 'write_file':
      return executeWriteFile(asString('path'), asString('content'), projectDir);
    case 'list_files':
      return executeListFiles(asString('pattern'), projectDir);
    case 'search_code':
      return executeSearchCode(
        asString('pattern'),
        projectDir,
        typeof input['glob'] === 'string' ? input['glob'] : undefined
      );
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

function resolveSafePath(relativePath: string, projectDir: string): string {
  const resolved = path.resolve(projectDir, relativePath);
  if (!resolved.startsWith(path.resolve(projectDir))) {
    throw new Error(`Path traversal detected: ${relativePath}`);
  }
  return resolved;
}

async function executeReadFile(filePath: string, projectDir: string): Promise<string> {
  const resolved = resolveSafePath(filePath, projectDir);
  const content = await fs.readFile(resolved, 'utf-8');
  // Truncate very large files to avoid token budget exhaustion
  if (content.length > 50_000) {
    return content.slice(0, 50_000) + '\n... (truncated, file too large)';
  }
  return content;
}

async function executeWriteFile(
  filePath: string,
  content: string,
  projectDir: string
): Promise<string> {
  const resolved = resolveSafePath(filePath, projectDir);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, 'utf-8');
  return `File written: ${filePath}`;
}

/**
 * Convert a simple glob pattern to a RegExp.
 * Supports: `*` (any non-slash), `**(slash)` (any directory depth), `?` (single char).
 */
function globToRegex(pattern: string): RegExp {
  let re = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern.charAt(i);
    if (ch === '*' && pattern[i + 1] === '*') {
      // ** matches any path segment(s)
      re += '.*';
      i += 2;
      // Skip trailing slash after **
      if (pattern[i] === '/') i++;
    } else if (ch === '*') {
      re += '[^/]*';
      i++;
    } else if (ch === '?') {
      re += '[^/]';
      i++;
    } else if (ch === '.') {
      re += '\\.';
      i++;
    } else {
      re += ch;
      i++;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * List all files recursively under projectDir, excluding dotfiles,
 * and return paths relative to projectDir.
 */
async function listAllFiles(projectDir: string): Promise<string[]> {
  const entries = await fs.readdir(projectDir, { recursive: true });
  const results: string[] = [];
  for (const entry of entries) {
    const rel = typeof entry === 'string' ? entry : String(entry);
    // Skip dotfiles/directories (segments starting with '.')
    if (rel.split(path.sep).some((seg) => seg.startsWith('.'))) continue;
    // Normalise to forward-slash paths
    const normalised = rel.split(path.sep).join('/');
    const fullPath = path.join(projectDir, rel);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        results.push(normalised);
      }
    } catch {
      // Skip inaccessible entries
    }
  }
  return results;
}

async function executeListFiles(pattern: string, projectDir: string): Promise<string> {
  const allFiles = await listAllFiles(projectDir);
  const regex = globToRegex(pattern);
  const files = allFiles.filter((f) => regex.test(f));

  if (files.length === 0) {
    return 'No files found matching pattern.';
  }
  // Limit output to prevent token budget exhaustion
  const limited = files.slice(0, 200);
  const result = limited.join('\n');
  if (files.length > 200) {
    return result + `\n... (${String(files.length - 200)} more files)`;
  }
  return result;
}

async function executeSearchCode(
  pattern: string,
  projectDir: string,
  fileGlob?: string
): Promise<string> {
  const allFiles = await listAllFiles(projectDir);
  const globRegex = fileGlob !== undefined ? globToRegex(fileGlob) : null;
  const files = globRegex ? allFiles.filter((f) => globRegex.test(f)) : allFiles;

  const regex = new RegExp(pattern, 'gi');
  const matches: string[] = [];
  const maxMatches = 100;

  for (const file of files) {
    if (matches.length >= maxMatches) break;
    try {
      const fullPath = path.join(projectDir, file);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= maxMatches) break;
        const line = lines[i] ?? '';
        if (regex.test(line)) {
          matches.push(`${file}:${String(i + 1)}: ${line.trim()}`);
        }
        // Reset regex lastIndex since we use 'g' flag
        regex.lastIndex = 0;
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (matches.length === 0) {
    return 'No matches found.';
  }
  return matches.join('\n');
}
