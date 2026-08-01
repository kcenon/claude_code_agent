/**
 * Cross-checks documentation inventory claims against executable source data.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { load } from 'js-yaml';
import {
  ENHANCEMENT_STAGES,
  GREENFIELD_STAGES,
  IMPORT_STAGES,
} from '../ad-sdlc-orchestrator/types.js';

/** Current inventory derived from source files and pipeline definitions. */
export interface DocInventoryMetrics {
  readonly agentDefinitionFiles: number;
  readonly uniquePipelineAgentTypes: number;
  readonly supportAgentDefinitions: number;
  readonly greenfieldStageSlots: number;
  readonly enhancementStageSlots: number;
  readonly importStageSlots: number;
  readonly totalStageSlots: number;
  readonly historicalCutoverTargets: number;
  readonly functionalRequirements: number;
  readonly softwareFeatures: number;
  readonly designComponents: number;
}

/** One failed inventory invariant. */
export interface DocInventoryViolation {
  readonly code:
    | 'ADR_TREE'
    | 'CONFIG_COUNT'
    | 'DEPENDENCY_VERSION'
    | 'MIRROR_DRIFT'
    | 'MISSING_FILE'
    | 'RUNTIME_INVENTORY';
  readonly message: string;
  readonly path: string;
}

/** Complete inventory validation result. */
export interface DocInventoryValidationResult {
  readonly pass: boolean;
  readonly metrics: DocInventoryMetrics;
  readonly violations: readonly DocInventoryViolation[];
}

interface SyncDocumentPaths {
  readonly path?: string;
  readonly kr_path?: string;
  readonly mirror_path?: string;
  readonly kr_mirror_path?: string;
}

interface SyncPointConfig {
  readonly documents?: Readonly<Record<string, SyncDocumentPaths>>;
  readonly inventory?: {
    readonly expected?: Partial<DocInventoryMetrics>;
  };
}

const RUNTIME_INVENTORY_START = '<!-- generated-runtime-inventory:start -->';
const RUNTIME_INVENTORY_END = '<!-- generated-runtime-inventory:end -->';

/** Validate inventory counts, generated mirrors, the ADR tree, and README versions. */
export class DocInventoryValidator {
  private readonly projectRoot: string;
  private readonly syncConfigPath: string;

  public constructor(projectRoot: string, syncConfigPath = 'doc-sync-points.yaml') {
    this.projectRoot = resolve(projectRoot);
    this.syncConfigPath = resolve(this.projectRoot, syncConfigPath);
  }

  /**
   * Derive inventory metrics from the current checkout.
   * @returns Source-derived documentation inventory metrics.
   */
  public collectMetrics(): DocInventoryMetrics {
    const agentDirectory = join(this.projectRoot, '.claude', 'agents');
    const agentDefinitions = existsSync(agentDirectory)
      ? readdirSync(agentDirectory)
          .filter((filename) => !filename.startsWith('.') && filename.endsWith('.md'))
          .map((filename) => filename.replace(/\.md$/, ''))
      : [];

    const pipelineStages = [...GREENFIELD_STAGES, ...ENHANCEMENT_STAGES, ...IMPORT_STAGES];
    const pipelineAgentTypes = new Set(pipelineStages.map((stage) => stage.agentType));
    const supportDefinitions = agentDefinitions.filter((name) => !pipelineAgentTypes.has(name));
    const changelog = this.readRequiredFile('CHANGELOG.md');
    const historicalCutoverTargets = Number(
      /All\s+(\d+)\s+cutover-target stages/i.exec(changelog)?.[1] ?? Number.NaN
    );

    if (!Number.isFinite(historicalCutoverTargets)) {
      throw new Error('CHANGELOG.md does not declare the historical v0.1 cutover target count');
    }

    return {
      agentDefinitionFiles: agentDefinitions.length,
      uniquePipelineAgentTypes: pipelineAgentTypes.size,
      supportAgentDefinitions: supportDefinitions.length,
      greenfieldStageSlots: GREENFIELD_STAGES.length,
      enhancementStageSlots: ENHANCEMENT_STAGES.length,
      importStageSlots: IMPORT_STAGES.length,
      totalStageSlots: pipelineStages.length,
      historicalCutoverTargets,
      functionalRequirements: this.countDocumentIds('docs/PRD-001-agent-driven-sdlc.md', 'FR'),
      softwareFeatures: this.countDocumentIds('docs/SRS-001-agent-driven-sdlc.md', 'SF'),
      designComponents: this.countDocumentIds('docs/SDS-001-agent-driven-sdlc.md', 'CMP'),
    };
  }

  /**
   * Run all inventory checks.
   * @returns The metrics and any failed invariants.
   */
  public validate(): DocInventoryValidationResult {
    const metrics = this.collectMetrics();
    const config = this.loadSyncConfig();
    const violations: DocInventoryViolation[] = [];

    this.validateConfiguredCounts(config, metrics, violations);
    this.validateMirrors(config, violations);
    this.validateAdrTree(violations);
    this.validateDependencyVersions(violations);
    this.validateRuntimeInventory(metrics, violations);

    violations.sort(
      (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code)
    );
    return { pass: violations.length === 0, metrics, violations };
  }

  /**
   * Render the generated block embedded in docs/architecture/runtime-inventory.md.
   * @param metrics - Source-derived inventory values.
   * @returns The canonical generated Markdown block.
   */
  public static renderRuntimeInventoryBlock(metrics: DocInventoryMetrics): string {
    return [
      RUNTIME_INVENTORY_START,
      '| Axis | Current value | Authoritative source |',
      '| --- | ---: | --- |',
      `| Checked-in agent definition prompts | ${String(metrics.agentDefinitionFiles)} | \`.claude/agents/*.md\` |`,
      `| Unique agent types used by a pipeline | ${String(metrics.uniquePipelineAgentTypes)} | \`PipelineStageDefinition.agentType\` values |`,
      `| Greenfield stage slots | ${String(metrics.greenfieldStageSlots)} | \`GREENFIELD_STAGES\` |`,
      `| Enhancement stage slots | ${String(metrics.enhancementStageSlots)} | \`ENHANCEMENT_STAGES\` |`,
      `| Import stage slots | ${String(metrics.importStageSlots)} | \`IMPORT_STAGES\` |`,
      `| Mode-specific stage slots (sum) | ${String(metrics.totalStageSlots)} | All three stage-definition arrays |`,
      `| Support/delegated agent definitions | ${String(metrics.supportAgentDefinitions)} | Definition prompts not used as a direct pipeline \`agentType\` |`,
      `| v0.1 cutover targets (historical) | ${String(metrics.historicalCutoverTargets)} | \`CHANGELOG.md\` v0.1.0 migration record |`,
      `| Functional requirements | ${String(metrics.functionalRequirements)} | Unique \`FR-*\` IDs in PRD-001 |`,
      `| Software features | ${String(metrics.softwareFeatures)} | Unique \`SF-*\` IDs in SRS-001 |`,
      `| Design components | ${String(metrics.designComponents)} | Unique \`CMP-*\` IDs in SDS-001 |`,
      RUNTIME_INVENTORY_END,
    ].join('\n');
  }

  private loadSyncConfig(): SyncPointConfig {
    if (!existsSync(this.syncConfigPath)) {
      throw new Error(`Cannot find document sync config: ${this.syncConfigPath}`);
    }
    const parsed: unknown = load(readFileSync(this.syncConfigPath, 'utf8'));
    if (parsed === null || typeof parsed !== 'object') {
      throw new Error(`Invalid document sync config: ${this.syncConfigPath}`);
    }
    return parsed;
  }

  private validateConfiguredCounts(
    config: SyncPointConfig,
    metrics: DocInventoryMetrics,
    violations: DocInventoryViolation[]
  ): void {
    const expected = config.inventory?.expected;
    if (expected === undefined) {
      violations.push({
        code: 'CONFIG_COUNT',
        path: this.relativePath(this.syncConfigPath),
        message: 'Missing inventory.expected count map',
      });
      return;
    }

    for (const [key, actual] of Object.entries(metrics) as Array<
      [keyof DocInventoryMetrics, number]
    >) {
      const documented = expected[key];
      if (documented !== actual) {
        violations.push({
          code: 'CONFIG_COUNT',
          path: this.relativePath(this.syncConfigPath),
          message: `${key} is ${String(documented)} in doc-sync-points.yaml but ${String(actual)} in source`,
        });
      }
    }
  }

  private validateMirrors(config: SyncPointConfig, violations: DocInventoryViolation[]): void {
    for (const [documentId, paths] of Object.entries(config.documents ?? {})) {
      this.compareMirror(documentId, paths.path, paths.mirror_path, violations);
      this.compareMirror(documentId, paths.kr_path, paths.kr_mirror_path, violations);
    }
  }

  private compareMirror(
    documentId: string,
    canonicalPath: string | undefined,
    mirrorPath: string | undefined,
    violations: DocInventoryViolation[]
  ): void {
    if (canonicalPath === undefined || mirrorPath === undefined) return;
    const canonical = join(this.projectRoot, canonicalPath);
    const mirror = join(this.projectRoot, mirrorPath);
    if (!existsSync(canonical) || !existsSync(mirror)) {
      violations.push({
        code: 'MISSING_FILE',
        path: !existsSync(canonical) ? canonicalPath : mirrorPath,
        message: `${documentId} canonical document or mirror is missing`,
      });
      return;
    }

    if (
      this.normalizeText(readFileSync(canonical, 'utf8')) !==
      this.normalizeText(readFileSync(mirror, 'utf8'))
    ) {
      violations.push({
        code: 'MIRROR_DRIFT',
        path: mirrorPath,
        message: `${documentId} mirror differs from ${canonicalPath}`,
      });
    }
  }

  private validateAdrTree(violations: DocInventoryViolation[]): void {
    const legacyDirectory = join(this.projectRoot, 'docs', 'architecture', 'decisions');
    if (
      existsSync(legacyDirectory) &&
      readdirSync(legacyDirectory).some((filename) => filename.endsWith('.md'))
    ) {
      violations.push({
        code: 'ADR_TREE',
        path: 'docs/architecture/decisions',
        message: 'Legacy ADR Markdown files remain outside the canonical docs/adr tree',
      });
    }

    const canonicalDirectory = join(this.projectRoot, 'docs', 'adr');
    if (!existsSync(canonicalDirectory)) {
      violations.push({
        code: 'ADR_TREE',
        path: 'docs/adr',
        message: 'Canonical ADR directory is missing',
      });
      return;
    }

    const ids = new Set<string>();
    const readme = this.readRequiredFile('docs/adr/README.md');
    for (const filename of readdirSync(canonicalDirectory).filter((entry) =>
      entry.startsWith('ADR-')
    )) {
      const match = /^ADR-(\d{4})-.+\.md$/.exec(filename);
      if (match === null) {
        violations.push({
          code: 'ADR_TREE',
          path: join('docs', 'adr', filename),
          message: 'ADR filenames must use the canonical four-digit form',
        });
        continue;
      }
      const id = match[1];
      if (id === undefined) continue;
      if (ids.has(id)) {
        violations.push({
          code: 'ADR_TREE',
          path: join('docs', 'adr', filename),
          message: `Duplicate canonical ADR id ${id}`,
        });
      }
      ids.add(id);
      if (!readme.includes(`(${filename})`)) {
        violations.push({
          code: 'ADR_TREE',
          path: 'docs/adr/README.md',
          message: `${filename} is missing from the ADR index`,
        });
      }
    }
  }

  private validateDependencyVersions(violations: DocInventoryViolation[]): void {
    const packageJson = JSON.parse(this.readRequiredFile('package.json')) as {
      readonly dependencies?: Readonly<Record<string, string>>;
      readonly devDependencies?: Readonly<Record<string, string>>;
    };
    const versions = { ...packageJson.devDependencies, ...packageJson.dependencies };
    const tables = [
      {
        path: 'README.md',
        section: /### Dependencies([\s\S]*?)Optional integrations/,
        label: 'README dependency table',
      },
      {
        path: 'docs/architecture/overview.md',
        section: /### Core Dependencies([\s\S]*?)### External Integrations/,
        label: 'architecture dependency tables',
      },
    ] as const;

    for (const table of tables) {
      const document = this.readRequiredFile(table.path);
      const dependencySection = table.section.exec(document)?.[1];
      if (dependencySection === undefined) {
        violations.push({
          code: 'DEPENDENCY_VERSION',
          path: table.path,
          message: `Cannot find the ${table.label}`,
        });
        continue;
      }

      const documentedVersions = this.extractDependencyVersions(dependencySection);
      for (const [dependency, documented] of documentedVersions) {
        const actual = versions[dependency];
        if (actual !== undefined && documented !== actual) {
          violations.push({
            code: 'DEPENDENCY_VERSION',
            path: table.path,
            message: `${dependency} is documented as ${documented} but package.json declares ${actual}`,
          });
        }
      }

      if (!documentedVersions.has('@anthropic-ai/claude-agent-sdk')) {
        violations.push({
          code: 'DEPENDENCY_VERSION',
          path: table.path,
          message: `${table.label} must include @anthropic-ai/claude-agent-sdk`,
        });
      }
    }
  }

  private extractDependencyVersions(markdown: string): ReadonlyMap<string, string> {
    const versions = new Map<string, string>();
    const row = /^\|\s*`([^`]+)`\s*\|\s*`?([^\s|`]+)`?\s*\|/gm;
    let match: RegExpExecArray | null;
    while ((match = row.exec(markdown)) !== null) {
      const dependency = match[1];
      const documented = match[2];
      if (dependency !== undefined && documented !== undefined) {
        versions.set(dependency, documented);
      }
    }
    return versions;
  }

  private validateRuntimeInventory(
    metrics: DocInventoryMetrics,
    violations: DocInventoryViolation[]
  ): void {
    const path = 'docs/architecture/runtime-inventory.md';
    const document = this.readRequiredFile(path);
    const expectedBlock = DocInventoryValidator.renderRuntimeInventoryBlock(metrics);
    if (
      !this.normalizeRuntimeInventoryBlock(document).includes(
        this.normalizeRuntimeInventoryBlock(expectedBlock)
      )
    ) {
      violations.push({
        code: 'RUNTIME_INVENTORY',
        path,
        message: 'Generated runtime inventory block does not match source-derived metrics',
      });
    }
  }

  private countDocumentIds(path: string, prefix: string): number {
    const matches = this.readRequiredFile(path).match(new RegExp(`${prefix}-\\d{3}`, 'g')) ?? [];
    return new Set(matches).size;
  }

  private readRequiredFile(path: string): string {
    const absolutePath = join(this.projectRoot, path);
    if (!existsSync(absolutePath))
      throw new Error(`Required documentation file is missing: ${path}`);
    return readFileSync(absolutePath, 'utf8');
  }

  private relativePath(path: string): string {
    return relative(this.projectRoot, path).replaceAll('\\', '/');
  }

  private normalizeText(value: string): string {
    return value.replaceAll('\r\n', '\n');
  }

  private normalizeRuntimeInventoryBlock(value: string): string {
    return this.normalizeText(value)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        if (!line.startsWith('|')) return line;
        return line
          .split('|')
          .map((cell) => {
            const trimmed = cell.trim().replace(/\s+/g, ' ');
            if (!/^:?-+:?$/.test(trimmed)) return trimmed;
            return `${trimmed.startsWith(':') ? ':' : ''}---${trimmed.endsWith(':') ? ':' : ''}`;
          })
          .join('|');
      })
      .join('\n');
  }
}

/**
 * Validate the repository using doc-sync-points.yaml.
 * @param projectRoot - Repository root to validate.
 * @returns The inventory validation result.
 */
export function validateDocumentInventory(projectRoot: string): DocInventoryValidationResult {
  return new DocInventoryValidator(projectRoot).validate();
}
