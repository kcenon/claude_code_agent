/**
 * SDSUpdaterAgent API section lookup: the endpoint path is matched literally
 * inside the section heading expression (kcenon/claude_code_agent#973).
 */

import { describe, it, expect } from 'vitest';
import { SDSUpdaterAgent } from '../../src/sds-updater/SDSUpdaterAgent.js';
import { APINotFoundError } from '../../src/sds-updater/errors.js';
import type { ItemModification, ParsedSDS } from '../../src/sds-updater/types.js';

type ApiModifier = {
  modifyAPI(
    content: string,
    endpoint: string,
    modifications: readonly ItemModification[],
    parsedSDS: ParsedSDS
  ): { content: string; modified: Array<{ field: string; oldValue: string; newValue: string }> };
};

const agent = new SDSUpdaterAgent() as unknown as ApiModifier;

/**
 * SDS interface section with one API heading per endpoint.
 * @param endpoints - `METHOD /path` strings in document order
 * @returns SDS markdown
 */
function sds(...endpoints: string[]): string {
  const sections = endpoints.map(
    (endpoint) => `#### ${endpoint}\n**Component**: CMP-001\n**Added**: 2024-01-01\n`
  );
  return `## 5. Interface Design\n\n${sections.join('\n')}\n## 6. Security Design\n`;
}

/**
 * Change the component of one endpoint.
 * @param content - SDS markdown
 * @param endpoint - `METHOD /path` of the API to modify
 * @returns Updated markdown and the recorded modifications
 */
function modifyComponent(content: string, endpoint: string) {
  const [method, apiPath] = endpoint.split(' ');
  const parsed = { path: 'sds.md', apis: [{ method, endpoint: apiPath }] } as unknown as ParsedSDS;
  return agent.modifyAPI(content, endpoint, [{ field: 'Component', newValue: 'CMP-002' }], parsed);
}

describe('SDSUpdaterAgent.modifyAPI', () => {
  it.each(['GET /api/v1/users/:id', 'GET /api/v1/users/{id}', 'POST /api/v1/auth/login'])(
    'should modify the section of %s',
    (endpoint) => {
      const { content, modified } = modifyComponent(sds('GET /api/v1/health', endpoint), endpoint);

      expect(content).toContain(`#### ${endpoint} [MODIFIED]\n**Component**: CMP-002\n`);
      expect(content).toContain('#### GET /api/v1/health\n**Component**: CMP-001\n');
      expect(modified).toEqual([
        { endpoint, field: 'Component', oldValue: 'CMP-001', newValue: 'CMP-002' },
      ]);
    }
  );

  it('should report a missing section', () => {
    expect(() => modifyComponent(sds('GET /api/v1/health'), 'GET /api/v1/users')).toThrow(
      APINotFoundError
    );
  });

  it.each([
    'GET /api/items?sort=name',
    'GET /api/(legacy)/items',
    'GET /api/files/*',
    'GET /api/a+b',
    'GET /api/$metadata',
    'GET /api/path\\segment',
  ])('should match the regular expression characters of %s literally', (endpoint) => {
    const { content } = modifyComponent(sds('GET /api/v1/health', endpoint), endpoint);

    expect(content).toContain(`#### ${endpoint} [MODIFIED]\n**Component**: CMP-002\n`);
  });

  it('should not let a dot in the path match another character', () => {
    const { content } = modifyComponent(
      sds('GET /api/v1x0/items', 'GET /api/v1.0/items'),
      'GET /api/v1.0/items'
    );

    expect(content).toContain('#### GET /api/v1x0/items\n**Component**: CMP-001\n');
    expect(content).toContain('#### GET /api/v1.0/items [MODIFIED]\n**Component**: CMP-002\n');
  });
});
