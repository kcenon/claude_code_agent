import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  describeExecutionEnvironment,
  hasAnthropicApiKey,
  hasRealExecutionEnvironment,
  isClaudeCodeSession,
} from '../../src/execution/env.js';

const CLAUDE_VARS = [
  'CLAUDE_CODE_SESSION',
  'CLAUDE_CODE',
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
] as const;

const ALL_VARS = [...CLAUDE_VARS, 'ANTHROPIC_API_KEY'] as const;

describe('execution/env', () => {
  let snapshot: Record<string, string | undefined>;

  beforeEach(() => {
    snapshot = {};
    for (const key of ALL_VARS) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ALL_VARS) {
      const prev = snapshot[key];
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  });

  describe('isClaudeCodeSession', () => {
    it('returns false when no Claude Code env markers are set', () => {
      expect(isClaudeCodeSession()).toBe(false);
    });

    it('returns true when CLAUDE_CODE_SESSION is set', () => {
      process.env['CLAUDE_CODE_SESSION'] = 'session-123';
      expect(isClaudeCodeSession()).toBe(true);
    });

    it('returns true when CLAUDE_CODE is set', () => {
      process.env['CLAUDE_CODE'] = '1';
      expect(isClaudeCodeSession()).toBe(true);
    });

    it('returns true only when CLAUDECODE equals "1"', () => {
      process.env['CLAUDECODE'] = '1';
      expect(isClaudeCodeSession()).toBe(true);

      process.env['CLAUDECODE'] = '0';
      expect(isClaudeCodeSession()).toBe(false);
    });

    it('returns true when CLAUDE_CODE_ENTRYPOINT is set', () => {
      process.env['CLAUDE_CODE_ENTRYPOINT'] = 'cli';
      expect(isClaudeCodeSession()).toBe(true);
    });

    it('returns false when markers are present but empty', () => {
      process.env['CLAUDE_CODE_SESSION'] = '';
      process.env['CLAUDE_CODE'] = '';
      process.env['CLAUDE_CODE_ENTRYPOINT'] = '';
      expect(isClaudeCodeSession()).toBe(false);
    });
  });

  describe('hasAnthropicApiKey', () => {
    it('returns false when ANTHROPIC_API_KEY is unset', () => {
      expect(hasAnthropicApiKey()).toBe(false);
    });

    it('returns false when ANTHROPIC_API_KEY is empty', () => {
      process.env['ANTHROPIC_API_KEY'] = '';
      expect(hasAnthropicApiKey()).toBe(false);
    });

    it('returns true when ANTHROPIC_API_KEY has a value', () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
      expect(hasAnthropicApiKey()).toBe(true);
    });
  });

  describe('hasRealExecutionEnvironment', () => {
    it('returns false when no markers are present', () => {
      expect(hasRealExecutionEnvironment()).toBe(false);
    });

    it('returns true when only Claude Code session is detected', () => {
      process.env['CLAUDECODE'] = '1';
      expect(hasRealExecutionEnvironment()).toBe(true);
    });

    it('returns true when only ANTHROPIC_API_KEY is set', () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
      expect(hasRealExecutionEnvironment()).toBe(true);
    });

    it('returns true when both are set', () => {
      process.env['CLAUDECODE'] = '1';
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
      expect(hasRealExecutionEnvironment()).toBe(true);
    });
  });

  describe('describeExecutionEnvironment', () => {
    it('returns "none" when no markers are present', () => {
      expect(describeExecutionEnvironment()).toBe('none');
    });

    it('returns "claude-code" when only Claude Code session is detected', () => {
      process.env['CLAUDECODE'] = '1';
      expect(describeExecutionEnvironment()).toBe('claude-code');
    });

    it('returns "anthropic-api" when only ANTHROPIC_API_KEY is set', () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
      expect(describeExecutionEnvironment()).toBe('anthropic-api');
    });

    it('prefers "claude-code" when both markers are present', () => {
      process.env['CLAUDECODE'] = '1';
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
      expect(describeExecutionEnvironment()).toBe('claude-code');
    });
  });
});
