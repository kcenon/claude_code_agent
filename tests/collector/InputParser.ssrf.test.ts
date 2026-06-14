/**
 * SSRF protection tests for InputParser.fetchUrlContent — issue #875.
 *
 * All network calls are intercepted via globalThis.fetch mock.
 * No real network requests are made.
 *
 * Tests verify:
 *  1. Direct fetch of 169.254.169.254 is blocked before any network call.
 *  2. A redirect from a benign host to 169.254.169.254 is caught and refused.
 *  3. A redirect from a benign host to 127.0.0.1 is caught and refused.
 *  4. Decimal-IP form (http://2130706433/) is blocked.
 *  5. Each redirect hop is individually re-validated (not only the initial URL).
 *  6. A normal, allowed URL succeeds.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputParser } from '../../src/collector/InputParser.js';

describe('InputParser SSRF protection (#875)', () => {
  let parser: InputParser;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    parser = new InputParser({ followRedirects: true, maxRedirects: 5 });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Helper: build a minimal Response-like object
  // ---------------------------------------------------------------------------
  function makeResponse(
    body: string,
    options: {
      status?: number;
      statusText?: string;
      contentType?: string;
      location?: string;
    } = {}
  ): Response {
    const { status = 200, statusText = 'OK', contentType = 'text/plain', location } = options;
    const headers = new Headers({ 'content-type': contentType });
    if (location !== undefined) headers.set('location', location);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      url: '',
      headers,
      text: async () => body,
      json: async () => JSON.parse(body) as unknown,
      clone: () => makeResponse(body, options),
    } as Response;
  }

  // ---------------------------------------------------------------------------
  // 1. Direct fetch of 169.254.169.254 is blocked (pre-fetch validation)
  // ---------------------------------------------------------------------------
  it('blocks direct fetch of 169.254.169.254 without making a network call', async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    const result = await parser.fetchUrlContent('http://169.254.169.254/latest/meta-data/');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    // Must not have made any real network call
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 2. Redirect from benign host → 169.254.169.254 is refused
  // ---------------------------------------------------------------------------
  it('blocks a redirect chain that leads to 169.254.169.254', async () => {
    globalThis.fetch = vi
      .fn()
      // First request: benign host returns 302 → metadata endpoint
      .mockResolvedValueOnce(
        makeResponse('', {
          status: 302,
          statusText: 'Found',
          location: 'http://169.254.169.254/latest/meta-data/',
        })
      )
      // Second request should NEVER be called — validation must stop the chain
      .mockResolvedValueOnce(makeResponse('SECRET', { contentType: 'text/plain' }));

    const result = await parser.fetchUrlContent('https://safe.example.com/redirect');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    // Fetch should have been called exactly once (for the initial URL)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 3. Redirect from benign host → 127.0.0.1 is refused
  // ---------------------------------------------------------------------------
  it('blocks a redirect chain that leads to 127.0.0.1', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse('', {
          status: 301,
          statusText: 'Moved Permanently',
          location: 'http://127.0.0.1:8080/admin',
        })
      )
      .mockResolvedValueOnce(makeResponse('ADMIN PAGE', { contentType: 'text/html' }));

    const result = await parser.fetchUrlContent('https://safe.example.com/admin-redirect');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 4. Decimal-IP URL form is blocked (http://2130706433/ == 127.0.0.1)
  // ---------------------------------------------------------------------------
  it('blocks decimal IPv4 form http://2130706433/', async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    const result = await parser.fetchUrlContent('http://2130706433/');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 5. Each redirect hop is re-validated, not only the initial URL
  //    Scenario: hop1 (benign) → hop2 (benign) → hop3 (private) — must be
  //    caught at hop3 and not proceed to any further request.
  // ---------------------------------------------------------------------------
  it('re-validates every redirect hop, not just the initial URL', async () => {
    const fetchMock = vi
      .fn()
      // hop 1: benign → hop2
      .mockResolvedValueOnce(
        makeResponse('', {
          status: 302,
          location: 'https://another.example.com/step2',
        })
      )
      // hop 2: benign → private IP (the exploit)
      .mockResolvedValueOnce(
        makeResponse('', {
          status: 302,
          location: 'http://10.0.0.1/internal',
        })
      )
      // hop 3: should NEVER be called
      .mockResolvedValueOnce(makeResponse('INTERNAL DATA', { contentType: 'text/plain' }));

    globalThis.fetch = fetchMock;

    const result = await parser.fetchUrlContent('https://start.example.com/chain');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    // Two fetches were made (hop1 + hop2); hop3 was rejected by validation
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------------
  // 6. A normal, allowed URL succeeds
  // ---------------------------------------------------------------------------
  it('allows a normal public URL and returns its content', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      makeResponse('Hello from example.com', {
        status: 200,
        contentType: 'text/plain',
      })
    );

    const result = await parser.fetchUrlContent('https://example.com/hello');

    expect(result.success).toBe(true);
    expect(result.content).toBe('Hello from example.com');
  });

  // ---------------------------------------------------------------------------
  // Extra: redirect to a public URL (non-private) succeeds
  // ---------------------------------------------------------------------------
  it('allows following redirects to legitimate public URLs', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse('', {
          status: 301,
          location: 'https://www.example.com/final',
        })
      )
      .mockResolvedValueOnce(
        makeResponse('Final destination', {
          status: 200,
          contentType: 'text/plain',
        })
      );

    const result = await parser.fetchUrlContent('https://example.com/moved');

    expect(result.success).toBe(true);
    expect(result.content).toBe('Final destination');
    expect(result.finalUrl).toBe('https://www.example.com/final');
  });

  // ---------------------------------------------------------------------------
  // Extra: too many redirects are rejected
  // ---------------------------------------------------------------------------
  it('rejects redirect chains that exceed maxRedirects', async () => {
    // maxRedirects = 5, so we set up 6 redirect hops
    const parserStrict = new InputParser({ followRedirects: true, maxRedirects: 3 });
    const redirectResponse = (location: string) => makeResponse('', { status: 302, location });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse('https://a.example.com/2'))
      .mockResolvedValueOnce(redirectResponse('https://b.example.com/3'))
      .mockResolvedValueOnce(redirectResponse('https://c.example.com/4'))
      .mockResolvedValueOnce(redirectResponse('https://d.example.com/5'))
      .mockResolvedValueOnce(makeResponse('final', { status: 200, contentType: 'text/plain' }));

    globalThis.fetch = fetchMock;

    const result = await parserStrict.fetchUrlContent('https://start.example.com/1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many redirect/i);
  });
});
