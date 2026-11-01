/**
 * Stage output contracts against the agent definitions.
 *
 * `stageArtifactContext` turns each stage's required artifacts into the outputs
 * `ArtifactAttempt` insists on, and the SDK runs the agent from its checked-in
 * definition. A stage fails when its agent follows that definition to a path the
 * contract does not name. Offline pipeline tests cannot see this, because their
 * scripted SDK writes the contract paths directly, so these tests compare the
 * two texts. They do not show that a live agent finishes its stage.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ArtifactValidator } from '../../src/ad-sdlc-orchestrator/ArtifactValidator.js';
import { stageArtifactContext } from '../../src/ad-sdlc-orchestrator/stageManifests.js';
import {
  ENHANCEMENT_STAGES,
  GREENFIELD_STAGES,
  IMPORT_STAGES,
} from '../../src/ad-sdlc-orchestrator/types.js';
import type {
  OrchestratorSession,
  PipelineMode,
  PipelineStageDefinition,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { ASSET_PACKAGE_ROOT } from '../../src/project-initializer/AgentAssets.js';
import { VERIFICATION_CHECK_SETS } from '../../src/stage-verifier/rules.js';

const SCRATCHPAD = '.ad-sdlc/scratchpad';
const PROJECT_DIR = '/project';

const GRAPHS: readonly (readonly [PipelineMode, readonly PipelineStageDefinition[]])[] = [
  ['greenfield', GREENFIELD_STAGES],
  ['enhancement', ENHANCEMENT_STAGES],
  ['import', IMPORT_STAGES],
];

/** Scratchpad inputs that no stage of these modes writes, and why that is correct. */
const INPUTS_FROM_OUTSIDE_THE_GRAPH: Readonly<Record<string, readonly PipelineMode[]>> = {
  // The change request is user input; the file form is optional.
  [`${SCRATCHPAD}/requests/*/change_request.yaml`]: ['enhancement'],
  // Import has no SRS: the imported issues state the acceptance criteria.
  [`${SCRATCHPAD}/documents/*/srs.md`]: ['import'],
  // Only Enhancement runs regression testing.
  [`${SCRATCHPAD}/regression/*/regression_report.yaml`]: ['greenfield', 'import'],
  // Only Enhancement updates the SDS; Greenfield generates it and has no update result.
  [`${SCRATCHPAD}/documents/*/sds_update_result.yaml`]: ['greenfield'],
  // No definition writes it. The PRD names it too, so it is not removed here.
  [`${SCRATCHPAD}/progress/*/worker_status.yaml`]: ['greenfield', 'enhancement', 'import'],
};

interface DocumentedPaths {
  readonly inputs: ReadonlySet<string>;
  readonly outputs: ReadonlySet<string>;
}

/**
 * Read the paths a definition documents, with its project placeholder written
 * as the contract's `*`. Only the input and output sections count: a path that
 * appears as an input or in an output schema example is not an output. Code
 * fences are tracked only inside those sections, because several definitions
 * nest fences elsewhere and would invert a file-wide count.
 * @param definition - Agent definition text
 * @returns Documented input and output paths
 */
function documentedPaths(definition: string): DocumentedPaths {
  const inputs = new Set<string>();
  const outputs = new Set<string>();
  const add = (target: Set<string> | undefined, path: string): void => {
    target?.add(path.replace(/\{project_?[iI]d\}/gu, '*'));
  };
  let target: Set<string> | undefined;
  let inFileLocations = false;
  let inFence = false;
  for (const line of definition.split(/\r?\n/u)) {
    const heading = /^## (.*)$/u.exec(line)?.[1];
    if (heading !== undefined && !inFence) {
      inFileLocations = heading === 'File Locations';
      if (/^Input(?: Location| Specification)?$/u.test(heading)) target = inputs;
      else if (/^Output(?: Location| Specification)?$/u.test(heading)) target = outputs;
      else target = undefined;
    } else if (target !== undefined || inFileLocations) {
      if (line.trimStart().startsWith('```')) inFence = !inFence;
      else if (inFileLocations) {
        if (/^input:/iu.test(line)) target = inputs;
        if (/^output:/iu.test(line)) target = outputs;
        const entry = /^\s*- (\.ad-sdlc\/\S+)/u.exec(line)?.[1];
        if (entry !== undefined) add(target, entry);
      } else if (!inFence) {
        for (const [, path] of line.matchAll(/`([^`]+)`/gu)) add(target, path!);
      }
    }
  }
  return { inputs, outputs };
}

function definitionOf(agentType: string): string {
  return readFileSync(join(ASSET_PACKAGE_ROOT, '.claude/agents', `${agentType}.md`), 'utf8');
}

function dependenciesOf(
  stage: PipelineStageDefinition,
  stages: readonly PipelineStageDefinition[]
): PipelineStageDefinition[] {
  const direct = stages.filter((candidate) => stage.dependsOn.includes(candidate.name));
  return [...direct, ...direct.flatMap((dependency) => dependenciesOf(dependency, stages))];
}

/**
 * The required outputs each stage of each mode prints to its agent.
 * @returns One `[mode, stage, agent, pattern, kind]` case per required output
 */
function contractCases(): (readonly [PipelineMode, string, string, string, string])[] {
  return GRAPHS.flatMap(([mode, stages]) => {
    const validator = new ArtifactValidator(PROJECT_DIR);
    const session = {
      sessionId: 'contract-test',
      mode,
      projectDir: PROJECT_DIR,
      scratchpadDir: `${PROJECT_DIR}/${SCRATCHPAD}`,
      stageResults: [],
    } as unknown as OrchestratorSession;
    return validator.getArtifactMap(mode).flatMap((entry) => {
      const stage = stages.find((candidate) => candidate.name === entry.stage);
      if (stage === undefined) throw new Error(`${mode} contract names no stage: ${entry.stage}`);
      return stageArtifactContext(stage, session, validator).requiredOutputs.map(
        (output) => [mode, stage.name, stage.agentType, output.pattern, output.kind] as const
      );
    });
  });
}

describe('stage output contracts', () => {
  const cases = contractCases();

  it('covers every mode', () => {
    expect(new Set(cases.map(([mode]) => mode))).toEqual(new Set(GRAPHS.map(([mode]) => mode)));
  });

  it.each(cases)('%s/%s: %s documents %s as an output', (_mode, _stage, agent, pattern, kind) => {
    const { outputs } = documentedPaths(definitionOf(agent));
    if (kind === 'directory')
      expect([...outputs].some((output) => output.startsWith(`${pattern}/`))).toBe(true);
    else expect([...outputs]).toContain(pattern);
  });

  const stageCases = GRAPHS.flatMap(([mode, stages]) =>
    stages.map((stage) => [mode, stage.name, stage.agentType, stage, stages] as const)
  );

  it.each(stageCases)(
    '%s/%s: %s reads only what it or an earlier stage writes',
    (mode, _stage, agent, stage, stages) => {
      const { inputs, outputs } = documentedPaths(definitionOf(agent));
      const written = [
        ...outputs,
        ...dependenciesOf(stage, stages).flatMap((dependency) => [
          ...documentedPaths(definitionOf(dependency.agentType)).outputs,
        ]),
      ];
      const unwritten = [...inputs].filter(
        (input) =>
          input.startsWith(`${SCRATCHPAD}/`) &&
          !(input.endsWith('/')
            ? written.some((output) => output.startsWith(input))
            : written.includes(input)) &&
          INPUTS_FROM_OUTSIDE_THE_GRAPH[input]?.includes(mode) !== true
      );
      expect(unwritten).toEqual([]);
    }
  );

  it('does not make the validation agent depend on an RTM', () => {
    const definition = definitionOf('validation-agent');
    expect(definition).not.toContain('rtm.yaml');
    expect(definition).not.toContain('RTM not found');
    expect(definition).toContain('A missing RTM is not a failure');
    expect(definition).toContain('In Import a missing PRD, SRS, or SDS is expected');
    expect(definition).toContain('NEVER alter');
  });

  it('asks the issue generator only for acceptance criteria a test can verify', () => {
    const definition = definitionOf('issue-generator');
    expect(definition).not.toContain('Documentation updated');
    expect(definition).toContain('verifiable by a test');
  });

  it('limits Enhancement issues to the components the SDS update lists', () => {
    const definition = definitionOf('issue-generator');
    const updater = definitionOf('sds-updater');
    const result = `${SCRATCHPAD}/documents/*/sds_update_result.yaml`;
    expect([...documentedPaths(definition).inputs]).toContain(result);
    expect([...documentedPaths(updater).outputs]).toContain(result);
    for (const list of ['components_added', 'components_modified']) {
      expect(definition).toContain(`changes.${list}`);
      expect(updater).toContain(`${list}:`);
    }
    expect(definition).toContain('leave every other component alone');
    // Greenfield keeps the rule, and it no longer applies unconditionally.
    expect(definition).toContain('**Without that file** (Greenfield)');
    expect(definition).not.toContain('Identify all components');
    expect(definition).not.toMatch(/^- Every SDS component must generate at least one issue$/mu);
  });

  it('gives the doc-code comparison one output name', () => {
    expect(definitionOf('doc-code-comparator')).not.toContain('gap_analysis');
  });
});

/**
 * The `## ` headings of the template a writer definition documents: the numbered
 * ones after its "Template Structure" heading, up to the definition's next own
 * heading. Code fences are not tracked, because the SDS template closes its outer
 * fence early around an inner one.
 * @param definition - Agent definition text
 * @returns Template headings
 */
function templateHeadings(definition: string): string[] {
  const lines = definition.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^## .*Template Structure$/u.test(line));
  const headings: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^## \d+\. /u.test(line)) headings.push(line);
    else if (line.startsWith('## ')) break;
  }
  return start === -1 ? [] : headings;
}

describe('writer templates against the required section checks', () => {
  const cases = [
    ['prd-writer', 'prd-document', 'VR-PRD-002', 'docs/prd/PRD-demo.md', '## 1. Executive Summary'],
    ['srs-writer', 'srs-document', 'VR-SRS-002', 'docs/srs/SRS-demo.md', '## 3. System Features'],
    ['sds-writer', 'sds-document', 'VR-SDS-002', 'docs/sds/SDS-demo.md', '## 3. Component Design'],
  ] as const;

  it.each(cases)(
    '%s: a document with the headings of its template passes the section check',
    async (agent, checkSet, checkId, path, heading) => {
      const headings = templateHeadings(definitionOf(agent));
      expect(headings).toContain(heading);
      const rule = VERIFICATION_CHECK_SETS[checkSet].find(
        (candidate) => candidate.checkId === checkId
      );
      const project = mkdtempSync(join(tmpdir(), 'writer-template-'));
      try {
        mkdirSync(dirname(join(project, path)), { recursive: true });
        writeFileSync(join(project, path), `# ${agent}\n\n${headings.join('\n\nContent.\n\n')}\n`);
        const check = await rule?.check([path], project);
        expect(check?.message).not.toContain('missing required sections');
        expect(check).toMatchObject({ checkId, passed: true });
      } finally {
        rmSync(project, { recursive: true, force: true });
      }
    }
  );

  it('reads only the template, not the headings of the definition around it', () => {
    expect(
      templateHeadings(
        [
          '## Role',
          '## PRD Template Structure',
          '````markdown',
          '## 1. Executive Summary',
          '````',
          '## 2. Outside the fence',
          '## CRITICAL: Tool Usage',
          '## 3. After the template',
        ].join('\n')
      )
    ).toEqual(['## 1. Executive Summary', '## 2. Outside the fence']);
    expect(templateHeadings('## Role\n## 1. Not a template\n')).toEqual([]);
  });
});

describe('documentedPaths', () => {
  it('does not count an input or an output schema example as an output', () => {
    const paths = documentedPaths(
      [
        '## Output Structure',
        '```yaml',
        "rtm_source: '.ad-sdlc/scratchpad/vnv/{projectId}/rtm.yaml'",
        '```',
        '## Input Location',
        '- RTM: `.ad-sdlc/scratchpad/vnv/{projectId}/rtm.yaml`',
        '## Output Location',
        '- Report: `.ad-sdlc/scratchpad/vnv/{projectId}/validation-report.yaml`',
      ].join('\r\n')
    );
    expect([...paths.inputs]).toEqual(['.ad-sdlc/scratchpad/vnv/*/rtm.yaml']);
    expect([...paths.outputs]).toEqual(['.ad-sdlc/scratchpad/vnv/*/validation-report.yaml']);
  });

  it('finds a section after unbalanced fences and skips fenced examples inside it', () => {
    const paths = documentedPaths(
      [
        '## Template',
        '````markdown',
        '```',
        '````',
        '## Output Specification',
        '| Report | `.ad-sdlc/scratchpad/issues/{project_id}/issue_list.json` |',
        '```yaml',
        'path: `.ad-sdlc/scratchpad/not/an/output.yaml`',
        '## Not a heading',
        '```',
      ].join('\n')
    );
    expect([...paths.outputs]).toEqual(['.ad-sdlc/scratchpad/issues/*/issue_list.json']);
  });

  it('reads the Input and Output lists of a File Locations block', () => {
    const paths = documentedPaths(
      [
        '## File Locations',
        '```yaml',
        'Input:',
        '  - .ad-sdlc/scratchpad/issues/{project_id}/issue_list.json',
        'Output:',
        '  - .ad-sdlc/scratchpad/progress/{project_id}/progress_report.md (updated)',
        '  - Source code files in src/',
        '```',
      ].join('\n')
    );
    expect([...paths.inputs]).toEqual(['.ad-sdlc/scratchpad/issues/*/issue_list.json']);
    expect([...paths.outputs]).toEqual(['.ad-sdlc/scratchpad/progress/*/progress_report.md']);
  });
});
