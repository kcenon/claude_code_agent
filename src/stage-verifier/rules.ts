/**
 * Stage Verification Rules
 *
 * Defines verification rules for each pipeline stage. Rules are organized
 * by stage name and filtered by rigor level at runtime.
 *
 * Rule naming convention: VR-{STAGE_ABBREV}-{NNN}
 *   - COL = collection
 *   - PRD = prd_generation / prd_update
 *   - SRS = srs_generation / srs_update
 *   - SDS = sds_generation / sds_update
 *   - ISS = issue_generation
 *   - IMP = implementation
 *   - REV = review
 *
 * @module stage-verifier/rules
 */

import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import * as yaml from 'js-yaml';

import type { VnvRigor } from '../vnv/types.js';
import type { VerificationCheck, VerificationRule } from './types.js';

// =============================================================================
// Rigor Helpers
// =============================================================================

/**
 * Numeric ordering of rigor levels for comparison.
 * Higher numbers represent stricter rigor.
 */
const RIGOR_ORDER: Record<VnvRigor, number> = {
  minimal: 0,
  standard: 1,
  strict: 2,
};

/**
 * Determine whether a rule should execute given the current rigor level.
 *
 * A rule runs when the current rigor is greater than or equal to the
 * rule's minimum rigor threshold.
 *
 * @param ruleRigor - Minimum rigor for the rule
 * @param currentRigor - Active rigor level for this pipeline run
 * @returns True if the rule should execute
 */
export function shouldRunRule(ruleRigor: VnvRigor, currentRigor: VnvRigor): boolean {
  return RIGOR_ORDER[currentRigor] >= RIGOR_ORDER[ruleRigor];
}

// =============================================================================
// File Reading Helpers
// =============================================================================

/**
 * Safely read file contents as a UTF-8 string.
 *
 * @param filePath - Absolute or relative file path
 * @returns File contents or null if the file does not exist or cannot be read
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Find an artifact matching a given substring in its path.
 *
 * @param artifacts - List of artifact file paths
 * @param pattern - Substring to match against file paths
 * @returns First matching artifact path or undefined
 */
function findArtifact(artifacts: readonly string[], pattern: string): string | undefined {
  return artifacts.find((a) => a.includes(pattern));
}

/**
 * Parse YAML content safely.
 *
 * @param content - YAML string
 * @returns Parsed object or null on parse failure
 */
function safeParseYaml(content: string): Record<string, unknown> | null {
  try {
    const parsed = yaml.load(content);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse JSON content safely.
 *
 * @param content - JSON string
 * @returns Parsed value or null on parse failure
 */
function safeParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Extract markdown headings from content.
 *
 * @param content - Markdown text
 * @returns Array of heading strings (without the `#` prefix)
 */
function extractMarkdownHeadings(content: string): string[] {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const heading = match[1];
    if (heading !== undefined) {
      headings.push(heading.trim());
    }
  }
  return headings;
}

/**
 * Extract IDs matching a pattern from text content.
 *
 * @param content - Text to search
 * @param pattern - Regex pattern with at least one capture group
 * @returns Array of matched ID strings
 */
function extractIds(content: string, pattern: RegExp): string[] {
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  const globalPattern = new RegExp(pattern.source, 'g');
  while ((match = globalPattern.exec(content)) !== null) {
    ids.push(match[0]);
  }
  return [...new Set(ids)];
}

/**
 * Create a passing VerificationCheck.
 * @param rule
 * @param message
 * @param details
 */
function passCheck(
  rule: Pick<VerificationRule, 'checkId' | 'name' | 'category' | 'severity'>,
  message: string,
  details?: Record<string, unknown>
): VerificationCheck {
  const result: VerificationCheck = {
    checkId: rule.checkId,
    name: rule.name,
    category: rule.category,
    passed: true,
    severity: rule.severity,
    message,
  };
  if (details !== undefined) {
    return { ...result, details };
  }
  return result;
}

/**
 * Create a failing VerificationCheck.
 * @param rule
 * @param message
 * @param details
 */
function failCheck(
  rule: Pick<VerificationRule, 'checkId' | 'name' | 'category' | 'severity'>,
  message: string,
  details?: Record<string, unknown>
): VerificationCheck {
  const result: VerificationCheck = {
    checkId: rule.checkId,
    name: rule.name,
    category: rule.category,
    passed: false,
    severity: rule.severity,
    message,
  };
  if (details !== undefined) {
    return { ...result, details };
  }
  return result;
}

// =============================================================================
// Collection Stage Rules
// =============================================================================

const collectionRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-COL-001',
    name: 'Collected info artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'collected_info');
      if (artifact === undefined) {
        return Promise.resolve(failCheck(this, 'No collected_info artifact found in stage output'));
      }
      return Promise.resolve(passCheck(this, `Collected info artifact found: ${artifact}`));
    },
  },
  {
    checkId: 'VR-COL-002',
    name: 'Collected info is valid YAML',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'collected_info');
      if (artifact === undefined) {
        return failCheck(this, 'No collected_info artifact to validate');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read collected_info file: ${artifact}`);
      }
      const parsed = safeParseYaml(content);
      if (!parsed) {
        return failCheck(this, 'collected_info is not valid YAML');
      }
      return passCheck(this, 'collected_info is valid YAML');
    },
  },
  {
    checkId: 'VR-COL-003',
    name: 'Functional requirements present',
    category: 'content',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'collected_info');
      if (artifact === undefined) {
        return failCheck(this, 'No collected_info artifact to check requirements');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read collected_info file: ${artifact}`);
      }
      const parsed = safeParseYaml(content);
      if (!parsed) {
        return failCheck(this, 'Cannot parse collected_info YAML');
      }

      // Navigate to requirements.functional
      const requirements = parsed['requirements'] as Record<string, unknown> | undefined;
      const functional = requirements?.['functional'];
      if (!Array.isArray(functional) || functional.length === 0) {
        return failCheck(this, 'No functional requirements found in collected_info', {
          requirementsFound: 0,
        });
      }

      return passCheck(this, `Found ${String(functional.length)} functional requirement(s)`, {
        requirementsFound: functional.length,
      });
    },
  },
  {
    checkId: 'VR-COL-004',
    name: 'Acceptance criteria exist',
    category: 'content',
    minRigor: 'strict',
    severity: 'warning',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'collected_info');
      if (artifact === undefined) {
        return failCheck(this, 'No collected_info artifact to check acceptance criteria');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read collected_info file: ${artifact}`);
      }
      const parsed = safeParseYaml(content);
      if (!parsed) {
        return failCheck(this, 'Cannot parse collected_info YAML');
      }

      const requirements = parsed['requirements'] as Record<string, unknown> | undefined;
      const functional = requirements?.['functional'];
      if (!Array.isArray(functional)) {
        return failCheck(this, 'No functional requirements to check for acceptance criteria');
      }

      const withCriteria = functional.filter((req: Record<string, unknown>) => {
        const criteria = req['acceptanceCriteria'] ?? req['acceptance_criteria'];
        return Array.isArray(criteria) && criteria.length > 0;
      });

      if (withCriteria.length === 0) {
        return failCheck(this, 'No functional requirements have acceptance criteria', {
          totalRequirements: functional.length,
          withCriteria: 0,
        });
      }

      return passCheck(
        this,
        `${String(withCriteria.length)}/${String(functional.length)} requirements have acceptance criteria`,
        { totalRequirements: functional.length, withCriteria: withCriteria.length }
      );
    },
  },
];

// =============================================================================
// PRD Stage Rules (prd_generation + prd_update)
// =============================================================================

const PRD_REQUIRED_SECTIONS = [
  'Introduction',
  'Functional Requirements',
  'Non-Functional Requirements',
];

const prdRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-PRD-001',
    name: 'PRD artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'PRD') ?? findArtifact(artifacts, 'prd');
      if (artifact === undefined) {
        return Promise.resolve(failCheck(this, 'No PRD artifact found in stage output'));
      }
      return Promise.resolve(passCheck(this, `PRD artifact found: ${artifact}`));
    },
  },
  {
    checkId: 'VR-PRD-002',
    name: 'PRD has required sections',
    category: 'content',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'PRD') ?? findArtifact(artifacts, 'prd');
      if (artifact === undefined) {
        return failCheck(this, 'No PRD artifact to check sections');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read PRD file: ${artifact}`);
      }

      const headings = extractMarkdownHeadings(content);
      const headingsLower = headings.map((h) => h.toLowerCase());
      const missing = PRD_REQUIRED_SECTIONS.filter(
        (section) => !headingsLower.some((h) => h.includes(section.toLowerCase()))
      );

      if (missing.length > 0) {
        return failCheck(this, `PRD missing required sections: ${missing.join(', ')}`, {
          missingSections: missing,
          foundHeadings: headings,
        });
      }

      return passCheck(this, 'PRD contains all required sections', {
        requiredSections: PRD_REQUIRED_SECTIONS,
      });
    },
  },
  {
    checkId: 'VR-PRD-003',
    name: 'PRD has FR-XXX identifiers',
    category: 'traceability',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'PRD') ?? findArtifact(artifacts, 'prd');
      if (artifact === undefined) {
        return failCheck(this, 'No PRD artifact to check FR identifiers');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read PRD file: ${artifact}`);
      }

      const frIds = extractIds(content, /FR-\d{3}/);
      if (frIds.length === 0) {
        return failCheck(this, 'No FR-XXX identifiers found in PRD', { frCount: 0 });
      }

      return passCheck(this, `Found ${String(frIds.length)} FR identifier(s) in PRD`, {
        frCount: frIds.length,
        frIds,
      });
    },
  },
];

// =============================================================================
// SRS Stage Rules (srs_generation + srs_update)
// =============================================================================

const SRS_REQUIRED_SECTIONS = ['Introduction', 'Software Features'];

const srsRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-SRS-001',
    name: 'SRS artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SRS') ?? findArtifact(artifacts, 'srs');
      if (artifact === undefined) {
        return Promise.resolve(failCheck(this, 'No SRS artifact found in stage output'));
      }
      return Promise.resolve(passCheck(this, `SRS artifact found: ${artifact}`));
    },
  },
  {
    checkId: 'VR-SRS-002',
    name: 'SRS has required sections',
    category: 'content',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SRS') ?? findArtifact(artifacts, 'srs');
      if (artifact === undefined) {
        return failCheck(this, 'No SRS artifact to check sections');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read SRS file: ${artifact}`);
      }

      const headings = extractMarkdownHeadings(content);
      const headingsLower = headings.map((h) => h.toLowerCase());
      const missing = SRS_REQUIRED_SECTIONS.filter(
        (section) => !headingsLower.some((h) => h.includes(section.toLowerCase()))
      );

      if (missing.length > 0) {
        return failCheck(this, `SRS missing required sections: ${missing.join(', ')}`, {
          missingSections: missing,
          foundHeadings: headings,
        });
      }

      return passCheck(this, 'SRS contains all required sections', {
        requiredSections: SRS_REQUIRED_SECTIONS,
      });
    },
  },
  {
    checkId: 'VR-SRS-003',
    name: 'SRS has SF-XXX identifiers',
    category: 'traceability',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SRS') ?? findArtifact(artifacts, 'srs');
      if (artifact === undefined) {
        return failCheck(this, 'No SRS artifact to check SF identifiers');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read SRS file: ${artifact}`);
      }

      const sfIds = extractIds(content, /SF-\d{3}/);
      if (sfIds.length === 0) {
        return failCheck(this, 'No SF-XXX identifiers found in SRS', { sfCount: 0 });
      }

      return passCheck(this, `Found ${String(sfIds.length)} SF identifier(s) in SRS`, {
        sfCount: sfIds.length,
        sfIds,
      });
    },
  },
  {
    checkId: 'VR-SRS-004',
    name: 'SRS SF references valid FR IDs',
    category: 'traceability',
    minRigor: 'strict',
    severity: 'warning',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const srsArtifact = findArtifact(artifacts, 'SRS') ?? findArtifact(artifacts, 'srs');
      if (srsArtifact === undefined) {
        return failCheck(this, 'No SRS artifact to validate FR references');
      }
      const srsContent = await safeReadFile(srsArtifact);
      if (srsContent === null) {
        return failCheck(this, `Cannot read SRS file: ${srsArtifact}`);
      }

      // Extract FR references from SRS
      const frRefsInSrs = extractIds(srsContent, /FR-\d{3}/);
      if (frRefsInSrs.length === 0) {
        return passCheck(this, 'No FR references found in SRS to validate');
      }

      // Try to find PRD to cross-check
      const prdPath = join(projectDir, 'docs', 'PRD.md');
      const prdContent = await safeReadFile(prdPath);
      if (prdContent === null) {
        return passCheck(this, 'PRD not found for cross-reference check; skipping', {
          frRefsInSrs,
          prdPath,
        });
      }

      const frIdsInPrd = extractIds(prdContent, /FR-\d{3}/);
      const orphanRefs = frRefsInSrs.filter((ref) => !frIdsInPrd.includes(ref));

      if (orphanRefs.length > 0) {
        return failCheck(
          this,
          `SRS references ${String(orphanRefs.length)} FR ID(s) not found in PRD: ${orphanRefs.join(', ')}`,
          { orphanRefs, frIdsInPrd, frRefsInSrs }
        );
      }

      return passCheck(this, 'All FR references in SRS are valid', {
        frRefsInSrs,
        frIdsInPrd,
      });
    },
  },
];

// =============================================================================
// SDS Stage Rules (sds_generation + sds_update)
// =============================================================================

const SDS_REQUIRED_SECTIONS = ['Introduction', 'System Architecture', 'Component Design'];

const sdsRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-SDS-001',
    name: 'SDS artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SDS') ?? findArtifact(artifacts, 'sds');
      if (artifact === undefined) {
        return Promise.resolve(failCheck(this, 'No SDS artifact found in stage output'));
      }
      return Promise.resolve(passCheck(this, `SDS artifact found: ${artifact}`));
    },
  },
  {
    checkId: 'VR-SDS-002',
    name: 'SDS has required sections',
    category: 'content',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SDS') ?? findArtifact(artifacts, 'sds');
      if (artifact === undefined) {
        return failCheck(this, 'No SDS artifact to check sections');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read SDS file: ${artifact}`);
      }

      const headings = extractMarkdownHeadings(content);
      const headingsLower = headings.map((h) => h.toLowerCase());
      const missing = SDS_REQUIRED_SECTIONS.filter(
        (section) => !headingsLower.some((h) => h.includes(section.toLowerCase()))
      );

      if (missing.length > 0) {
        return failCheck(this, `SDS missing required sections: ${missing.join(', ')}`, {
          missingSections: missing,
          foundHeadings: headings,
        });
      }

      return passCheck(this, 'SDS contains all required sections', {
        requiredSections: SDS_REQUIRED_SECTIONS,
      });
    },
  },
  {
    checkId: 'VR-SDS-003',
    name: 'SDS has CMP-XXX identifiers',
    category: 'traceability',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SDS') ?? findArtifact(artifacts, 'sds');
      if (artifact === undefined) {
        return failCheck(this, 'No SDS artifact to check CMP identifiers');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read SDS file: ${artifact}`);
      }

      const cmpIds = extractIds(content, /CMP-\d{3}/);
      if (cmpIds.length === 0) {
        return failCheck(this, 'No CMP-XXX identifiers found in SDS', { cmpCount: 0 });
      }

      return passCheck(this, `Found ${String(cmpIds.length)} CMP identifier(s) in SDS`, {
        cmpCount: cmpIds.length,
        cmpIds,
      });
    },
  },
  {
    checkId: 'VR-SDS-004',
    name: 'SDS CMP references valid SF IDs',
    category: 'traceability',
    minRigor: 'strict',
    severity: 'warning',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const sdsArtifact = findArtifact(artifacts, 'SDS') ?? findArtifact(artifacts, 'sds');
      if (sdsArtifact === undefined) {
        return failCheck(this, 'No SDS artifact to validate SF references');
      }
      const sdsContent = await safeReadFile(sdsArtifact);
      if (sdsContent === null) {
        return failCheck(this, `Cannot read SDS file: ${sdsArtifact}`);
      }

      // Extract SF references from SDS
      const sfRefsInSds = extractIds(sdsContent, /SF-\d{3}/);
      if (sfRefsInSds.length === 0) {
        return passCheck(this, 'No SF references found in SDS to validate');
      }

      // Try to find SRS to cross-check
      const srsPath = join(projectDir, 'docs', 'SRS.md');
      const srsContent = await safeReadFile(srsPath);
      if (srsContent === null) {
        return passCheck(this, 'SRS not found for cross-reference check; skipping', {
          sfRefsInSds,
          srsPath,
        });
      }

      const sfIdsInSrs = extractIds(srsContent, /SF-\d{3}/);
      const orphanRefs = sfRefsInSds.filter((ref) => !sfIdsInSrs.includes(ref));

      if (orphanRefs.length > 0) {
        return failCheck(
          this,
          `SDS references ${String(orphanRefs.length)} SF ID(s) not found in SRS: ${orphanRefs.join(', ')}`,
          { orphanRefs, sfIdsInSrs, sfRefsInSds }
        );
      }

      return passCheck(this, 'All SF references in SDS are valid', {
        sfRefsInSds,
        sfIdsInSrs,
      });
    },
  },
];

// =============================================================================
// Issue Generation Stage Rules
// =============================================================================

const issueGenerationRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-ISS-001',
    name: 'Issue list artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'issue') ?? findArtifact(artifacts, 'Issue');
      if (artifact === undefined) {
        return Promise.resolve(failCheck(this, 'No issue list artifact found in stage output'));
      }
      return Promise.resolve(passCheck(this, `Issue list artifact found: ${artifact}`));
    },
  },
  {
    checkId: 'VR-ISS-002',
    name: 'Issue list is valid JSON or YAML',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'issue') ?? findArtifact(artifacts, 'Issue');
      if (artifact === undefined) {
        return failCheck(this, 'No issue list artifact to validate format');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read issue list file: ${artifact}`);
      }

      const ext = extname(artifact).toLowerCase();
      if (ext === '.json') {
        const parsed = safeParseJson(content);
        if (parsed === null) {
          return failCheck(this, 'Issue list is not valid JSON');
        }
        return passCheck(this, 'Issue list is valid JSON');
      }

      if (ext === '.yaml' || ext === '.yml') {
        const parsed = safeParseYaml(content);
        if (!parsed) {
          return failCheck(this, 'Issue list is not valid YAML');
        }
        return passCheck(this, 'Issue list is valid YAML');
      }

      // Try JSON first, then YAML
      const jsonParsed = safeParseJson(content);
      if (jsonParsed !== null) {
        return passCheck(this, 'Issue list is valid JSON');
      }
      const yamlParsed = safeParseYaml(content);
      if (yamlParsed) {
        return passCheck(this, 'Issue list is valid YAML');
      }

      return failCheck(this, 'Issue list is neither valid JSON nor YAML');
    },
  },
  {
    checkId: 'VR-ISS-003',
    name: 'Issue list contains entries',
    category: 'content',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'issue') ?? findArtifact(artifacts, 'Issue');
      if (artifact === undefined) {
        return failCheck(this, 'No issue list artifact to check entries');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read issue list file: ${artifact}`);
      }

      // Try to parse and check for array or issues property
      let data: unknown = safeParseJson(content);
      if (data === null) {
        data = safeParseYaml(content);
      }
      if (data === null) {
        return failCheck(this, 'Cannot parse issue list to check entries');
      }

      let issueCount = 0;
      if (Array.isArray(data)) {
        issueCount = data.length;
      } else if (typeof data === 'object') {
        const record = data as Record<string, unknown>;
        const issues = record['issues'] ?? record['items'];
        if (Array.isArray(issues)) {
          issueCount = issues.length;
        }
      }

      if (issueCount === 0) {
        return failCheck(this, 'Issue list contains no entries', { issueCount: 0 });
      }

      return passCheck(this, `Issue list contains ${String(issueCount)} entry/entries`, {
        issueCount,
      });
    },
  },
];

// =============================================================================
// Implementation Stage Rules
// =============================================================================

const implementationRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-IMP-001',
    name: 'Implementation result artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const artifact =
        findArtifact(artifacts, 'implementation_result') ??
        findArtifact(artifacts, 'implementation-result') ??
        findArtifact(artifacts, 'ImplementationResult');
      if (artifact === undefined) {
        return Promise.resolve(
          failCheck(this, 'No implementation result artifact found in stage output')
        );
      }
      return Promise.resolve(passCheck(this, `Implementation result artifact found: ${artifact}`));
    },
  },
  {
    checkId: 'VR-IMP-002',
    name: 'Implementation result is valid',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact =
        findArtifact(artifacts, 'implementation_result') ??
        findArtifact(artifacts, 'implementation-result') ??
        findArtifact(artifacts, 'ImplementationResult');
      if (artifact === undefined) {
        return failCheck(this, 'No implementation result artifact to validate');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read implementation result file: ${artifact}`);
      }

      // Try YAML first, then JSON
      let data: unknown = safeParseYaml(content);
      if (data === null) {
        data = safeParseJson(content);
      }
      if (data === null) {
        return failCheck(this, 'Implementation result is neither valid YAML nor JSON');
      }

      return passCheck(this, 'Implementation result is a valid data file');
    },
  },
  {
    checkId: 'VR-IMP-003',
    name: 'Tests passed',
    category: 'quality',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact =
        findArtifact(artifacts, 'implementation_result') ??
        findArtifact(artifacts, 'implementation-result') ??
        findArtifact(artifacts, 'ImplementationResult');
      if (artifact === undefined) {
        return failCheck(this, 'No implementation result to check test status');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read implementation result file: ${artifact}`);
      }

      let data: unknown = safeParseYaml(content);
      if (data === null) {
        data = safeParseJson(content);
      }
      if (data === null || typeof data !== 'object') {
        return failCheck(this, 'Cannot parse implementation result to check tests');
      }

      const record = data as Record<string, unknown>;
      const testsPassed = record['testsPassed'] ?? record['tests_passed'];

      if (testsPassed === undefined) {
        return passCheck(this, 'No testsPassed field found; skipping check', {
          note: 'Field may not be present in all result formats',
        });
      }

      if (testsPassed !== true) {
        return failCheck(this, 'Implementation tests did not pass', {
          testsPassed,
        });
      }

      return passCheck(this, 'Implementation tests passed');
    },
  },
  {
    checkId: 'VR-IMP-004',
    name: 'Build passed',
    category: 'quality',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact =
        findArtifact(artifacts, 'implementation_result') ??
        findArtifact(artifacts, 'implementation-result') ??
        findArtifact(artifacts, 'ImplementationResult');
      if (artifact === undefined) {
        return failCheck(this, 'No implementation result to check build status');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read implementation result file: ${artifact}`);
      }

      let data: unknown = safeParseYaml(content);
      if (data === null) {
        data = safeParseJson(content);
      }
      if (data === null || typeof data !== 'object') {
        return failCheck(this, 'Cannot parse implementation result to check build');
      }

      const record = data as Record<string, unknown>;
      const buildPassed = record['buildPassed'] ?? record['build_passed'];

      if (buildPassed === undefined) {
        return passCheck(this, 'No buildPassed field found; skipping check', {
          note: 'Field may not be present in all result formats',
        });
      }

      if (buildPassed !== true) {
        return failCheck(this, 'Implementation build did not pass', {
          buildPassed,
        });
      }

      return passCheck(this, 'Implementation build passed');
    },
  },
  {
    checkId: 'VR-IMP-005',
    name: 'Lint passed',
    category: 'quality',
    minRigor: 'strict',
    severity: 'warning',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact =
        findArtifact(artifacts, 'implementation_result') ??
        findArtifact(artifacts, 'implementation-result') ??
        findArtifact(artifacts, 'ImplementationResult');
      if (artifact === undefined) {
        return failCheck(this, 'No implementation result to check lint status');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read implementation result file: ${artifact}`);
      }

      let data: unknown = safeParseYaml(content);
      if (data === null) {
        data = safeParseJson(content);
      }
      if (data === null || typeof data !== 'object') {
        return failCheck(this, 'Cannot parse implementation result to check lint');
      }

      const record = data as Record<string, unknown>;
      const lintPassed = record['lintPassed'] ?? record['lint_passed'];

      if (lintPassed === undefined) {
        return passCheck(this, 'No lintPassed field found; skipping check', {
          note: 'Field may not be present in all result formats',
        });
      }

      if (lintPassed !== true) {
        return failCheck(this, 'Implementation lint did not pass', {
          lintPassed,
        });
      }

      return passCheck(this, 'Implementation lint passed');
    },
  },
];

// =============================================================================
// Review Stage Rules
// =============================================================================

const reviewRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-REV-001',
    name: 'Review result artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const artifact =
        findArtifact(artifacts, 'review_result') ??
        findArtifact(artifacts, 'review-result') ??
        findArtifact(artifacts, 'PRReviewResult') ??
        findArtifact(artifacts, 'pr_review');
      if (artifact === undefined) {
        return Promise.resolve(failCheck(this, 'No review result artifact found in stage output'));
      }
      return Promise.resolve(passCheck(this, `Review result artifact found: ${artifact}`));
    },
  },
  {
    checkId: 'VR-REV-002',
    name: 'Review result is valid',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact =
        findArtifact(artifacts, 'review_result') ??
        findArtifact(artifacts, 'review-result') ??
        findArtifact(artifacts, 'PRReviewResult') ??
        findArtifact(artifacts, 'pr_review');
      if (artifact === undefined) {
        return failCheck(this, 'No review result artifact to validate');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read review result file: ${artifact}`);
      }

      let data: unknown = safeParseYaml(content);
      if (data === null) {
        data = safeParseJson(content);
      }
      if (data === null) {
        return failCheck(this, 'Review result is neither valid YAML nor JSON');
      }

      return passCheck(this, 'Review result is a valid data file');
    },
  },
  {
    checkId: 'VR-REV-003',
    name: 'Review decision present',
    category: 'content',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts): Promise<VerificationCheck> {
      const artifact =
        findArtifact(artifacts, 'review_result') ??
        findArtifact(artifacts, 'review-result') ??
        findArtifact(artifacts, 'PRReviewResult') ??
        findArtifact(artifacts, 'pr_review');
      if (artifact === undefined) {
        return failCheck(this, 'No review result to check decision');
      }
      const content = await safeReadFile(artifact);
      if (content === null) {
        return failCheck(this, `Cannot read review result file: ${artifact}`);
      }

      let data: unknown = safeParseYaml(content);
      if (data === null) {
        data = safeParseJson(content);
      }
      if (data === null || typeof data !== 'object') {
        return failCheck(this, 'Cannot parse review result to check decision');
      }

      const record = data as Record<string, unknown>;
      const decision = record['decision'] ?? record['reviewDecision'];

      if (decision === undefined) {
        return failCheck(this, 'No decision field found in review result');
      }

      const validDecisions = ['approve', 'request_changes', 'reject'];
      if (typeof decision !== 'string' || !validDecisions.includes(decision)) {
        const decisionStr = typeof decision === 'string' ? decision : JSON.stringify(decision);
        return failCheck(this, `Invalid review decision: ${decisionStr}`, {
          decision,
          validDecisions,
        });
      }

      return passCheck(this, `Review decision: ${decision}`, { decision });
    },
  },
];

// =============================================================================
// Stage-to-Rules Mapping
// =============================================================================

/**
 * Master map of stage names to their verification rules.
 *
 * Stages that share the same document type (e.g., prd_generation and prd_update)
 * share the same rule set.
 */
export const VERIFICATION_RULES: ReadonlyMap<string, readonly VerificationRule[]> = new Map<
  string,
  readonly VerificationRule[]
>([
  ['collection', collectionRules],
  ['prd_generation', prdRules],
  ['prd_update', prdRules],
  ['srs_generation', srsRules],
  ['srs_update', srsRules],
  ['sds_generation', sdsRules],
  ['sds_update', sdsRules],
  ['issue_generation', issueGenerationRules],
  ['implementation', implementationRules],
  ['review', reviewRules],
]);
