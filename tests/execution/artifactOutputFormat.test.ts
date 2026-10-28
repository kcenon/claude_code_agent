import { describe, expect, it } from 'vitest';
import { ARTIFACT_OUTPUT_FORMAT } from '../../src/execution/artifacts/schemas.js';

describe('ARTIFACT_OUTPUT_FORMAT', () => {
  // The Claude Code CLI rejects a --json-schema that declares the 2020-12
  // meta-schema ("no schema with key or ref"), which failed every stage with
  // an artifact context against the real SDK (found by the #955 live lane).
  it('declares the draft-07 meta-schema the Claude Code CLI validates against', () => {
    const schema = ARTIFACT_OUTPUT_FORMAT.schema as Record<string, unknown>;
    expect(schema['$schema']).toBe('http://json-schema.org/draft-07/schema#');
    expect(JSON.stringify(schema)).not.toContain('2020-12');
  });

  it('still describes the artifact output contract', () => {
    const schema = ARTIFACT_OUTPUT_FORMAT.schema as {
      type: string;
      required: string[];
      additionalProperties: boolean;
      properties: Record<string, unknown>;
    };
    expect(ARTIFACT_OUTPUT_FORMAT.type).toBe('json_schema');
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['schemaVersion', 'artifacts']);
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties)).toEqual(['schemaVersion', 'artifacts']);
  });
});
