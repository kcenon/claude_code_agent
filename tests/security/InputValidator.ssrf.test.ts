/**
 * SSRF hardening tests for InputValidator.
 *
 * Verifies that the additional IP-form blocklist entries introduced in
 * the fix for issue #875 are correctly rejected, while legitimate public
 * URLs continue to pass.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import { InputValidator } from '../../src/security/InputValidator.js';
import { InvalidUrlError } from '../../src/security/errors.js';

describe('InputValidator SSRF hardening (#875)', () => {
  let validator: InputValidator;
  const basePath = path.join(os.tmpdir(), 'ssrf-validator-test');

  beforeEach(() => {
    // Allow both http: and https: so we can test more URL forms.
    validator = new InputValidator({
      basePath,
      allowedProtocols: ['http:', 'https:'],
      blockInternalUrls: true,
    });
  });

  // -------------------------------------------------------------------------
  // Link-local / cloud-metadata (169.254.0.0/16)
  // -------------------------------------------------------------------------
  describe('link-local / cloud-metadata 169.254.x.x', () => {
    it('should block 169.254.169.254 (AWS metadata endpoint)', () => {
      expect(() => validator.validateUrl('http://169.254.169.254/')).toThrow(InvalidUrlError);
    });

    it('should block 169.254.0.1', () => {
      expect(() => validator.validateUrl('http://169.254.0.1/')).toThrow(InvalidUrlError);
    });

    it('should block 169.254.255.255', () => {
      expect(() => validator.validateUrl('https://169.254.255.255/')).toThrow(InvalidUrlError);
    });
  });

  // -------------------------------------------------------------------------
  // Decimal (single-component) IPv4
  // -------------------------------------------------------------------------
  describe('decimal IPv4', () => {
    it('should block 2130706433 (== 127.0.0.1)', () => {
      expect(() => validator.validateUrl('http://2130706433/')).toThrow(InvalidUrlError);
    });

    it('should block 167772161 (== 10.0.0.1)', () => {
      expect(() => validator.validateUrl('http://167772161/')).toThrow(InvalidUrlError);
    });

    it('should block 2851995649 (== 169.254.169.1)', () => {
      // 169*2^24 + 254*2^16 + 169*2^8 + 1 = 2851995649
      expect(() => validator.validateUrl('http://2851995649/')).toThrow(InvalidUrlError);
    });
  });

  // -------------------------------------------------------------------------
  // Hex IPv4
  // -------------------------------------------------------------------------
  describe('hex IPv4', () => {
    it('should block 0x7f000001 (== 127.0.0.1)', () => {
      expect(() => validator.validateUrl('http://0x7f000001/')).toThrow(InvalidUrlError);
    });

    it('should block 0xA9FEA9FE (== 169.254.169.254)', () => {
      expect(() => validator.validateUrl('http://0xA9FEA9FE/')).toThrow(InvalidUrlError);
    });
  });

  // -------------------------------------------------------------------------
  // Octal-segment IPv4
  // -------------------------------------------------------------------------
  describe('octal-segment IPv4', () => {
    it('should block 0177.0.0.1 (== 127.0.0.1)', () => {
      expect(() => validator.validateUrl('http://0177.0.0.1/')).toThrow(InvalidUrlError);
    });

    it('should block 0251.0376.0251.0376 (== 169.254.169.254)', () => {
      expect(() => validator.validateUrl('http://0251.0376.0251.0376/')).toThrow(InvalidUrlError);
    });
  });

  // -------------------------------------------------------------------------
  // IPv4-mapped IPv6
  //
  // Node.js URL.hostname normalises these to hex-group form and strips the
  // embedded IPv4 dotted notation, e.g.:
  //   [::ffff:127.0.0.1]       → bare hostname  ::ffff:7f00:1
  //   [::ffff:169.254.169.254] → bare hostname  ::ffff:a9fe:a9fe
  // Both the original URL forms and the normalised hex forms are blocked via
  // the "^::ffff:" pattern match applied to the bare (bracket-stripped) hostname.
  // -------------------------------------------------------------------------
  describe('IPv4-mapped IPv6', () => {
    it('should block [::ffff:127.0.0.1] (normalised to ::ffff:7f00:1 by URL parser)', () => {
      expect(() => validator.validateUrl('http://[::ffff:127.0.0.1]/')).toThrow(InvalidUrlError);
    });

    it('should block [::ffff:7f00:1] (direct hex form for 127.0.0.1)', () => {
      expect(() => validator.validateUrl('http://[::ffff:7f00:1]/')).toThrow(InvalidUrlError);
    });

    it('should block [::ffff:169.254.169.254] (cloud-metadata, normalised to ::ffff:a9fe:a9fe)', () => {
      expect(() => validator.validateUrl('http://[::ffff:169.254.169.254]/')).toThrow(
        InvalidUrlError
      );
    });

    it('should block [::ffff:a9fe:a9fe] (direct hex form for 169.254.169.254)', () => {
      expect(() => validator.validateUrl('http://[::ffff:a9fe:a9fe]/')).toThrow(InvalidUrlError);
    });
  });

  // -------------------------------------------------------------------------
  // Existing private ranges still blocked
  // -------------------------------------------------------------------------
  describe('existing private/loopback ranges', () => {
    it('should block localhost', () => {
      expect(() => validator.validateUrl('http://localhost/')).toThrow(InvalidUrlError);
    });

    it('should block 127.0.0.1', () => {
      expect(() => validator.validateUrl('http://127.0.0.1/')).toThrow(InvalidUrlError);
    });

    it('should block 10.0.0.1', () => {
      expect(() => validator.validateUrl('http://10.0.0.1/')).toThrow(InvalidUrlError);
    });

    it('should block 192.168.1.1', () => {
      expect(() => validator.validateUrl('http://192.168.1.1/')).toThrow(InvalidUrlError);
    });

    it('should block 172.16.0.1', () => {
      expect(() => validator.validateUrl('http://172.16.0.1/')).toThrow(InvalidUrlError);
    });
  });

  // -------------------------------------------------------------------------
  // Legitimate public URLs must still pass
  // -------------------------------------------------------------------------
  describe('legitimate public URLs', () => {
    it('should allow https://example.com', () => {
      expect(() => validator.validateUrl('https://example.com/')).not.toThrow();
    });

    it('should allow https://github.com', () => {
      expect(() =>
        validator.validateUrl('https://github.com/kcenon/claude_code_agent')
      ).not.toThrow();
    });

    it('should allow http://93.184.216.34 (example.com public IP)', () => {
      // 93.184.216.34 is not in any reserved range
      expect(() => validator.validateUrl('http://93.184.216.34/')).not.toThrow();
    });
  });
});
