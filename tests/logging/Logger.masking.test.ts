import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, resetLogger } from '../../src/logging/Logger.js';

describe('Logger Slack webhook masking', () => {
  let logger: Logger;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    logger = new Logger({
      transports: [{ type: 'console', format: 'json' }],
      enableMasking: true,
    });
    await logger.initialize();
  });

  afterEach(async () => {
    await logger.close();
    resetLogger();
    vi.restoreAllMocks();
  });

  it.each([
    [
      'Webhook: https://hooks.slack.com/services/T0001/B0002/abcDEF123, done',
      'Webhook: ***REDACTED***, done',
    ],
    [
      'Posting tohttps://hooks.slack.com/services/T0001/B0002/abcDEF123',
      'Posting to***REDACTED***',
    ],
    [
      'proxy https://evil.example/?u=https://hooks.slack.com/services/T1/B2/c3.',
      'proxy https://evil.example/?u=***REDACTED***.',
    ],
  ])('should mask a Slack webhook URL anywhere in %j', (message, expected) => {
    const logSpy = vi.spyOn(console, 'log');

    logger.info(message);

    const output = logSpy.mock.calls[0]?.[0] as string;
    expect((JSON.parse(output) as { message: string }).message).toBe(expected);
  });
});
