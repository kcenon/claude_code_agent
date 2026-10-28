/**
 * Stage Verification Rules
 *
 * Defines verification rules for each pipeline stage. Rules are grouped into
 * named check sets; `applicability.ts` assigns a check set (or an explicit
 * not-applicable record) to every stage slot of every mode. Rules are
 * filtered by rigor level at runtime.
 *
 * Rule naming convention: VR-{STAGE_ABBREV}-{NNN}
 *   - COL = collection
 *   - PRD = prd_generation / prd_update
 *   - SRS = srs_generation / srs_update
 *   - SDS = sds_generation / sds_update
 *   - ISS = issue_generation
 *   - IRD = issue_reading
 *   - ORC = orchestration
 *   - IMP = implementation
 *   - REG = regression_testing
 *   - VAL = validation-agent
 *   - REV = review
 *   - XDOC = cross-document consistency (every document-producing stage)
 *
 * @module stage-verifier/rules
 */

import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';

import type { VnvRigor } from '../vnv/types.js';
import type { VerificationCheck, VerificationRule } from './types.js';
import { checkCrossDocumentConsistency, DOC_SYNC_POINTS_FILE } from './consistency.js';
import {
  extractIds,
  extractMarkdownHeadings,
  failCheck,
  findArtifact,
  passCheck,
  safeParseJson,
  safeParseYaml,
  safeReadFile,
  skipCheck,
} from './ruleSupport.js';
import {
  implementationRules,
  issueAcceptanceCriteriaRule,
  issueReadingRules,
  orchestrationRules,
  regressionRules,
  reviewRules,
  validationRules,
} from './deliveryRules.js';

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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'collected_info');
      if (artifact === undefined) {
        return failCheck(this, 'No collected_info artifact to validate');
      }
      const content = await safeReadFile(artifact, projectDir);
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'collected_info');
      if (artifact === undefined) {
        return failCheck(this, 'No collected_info artifact to check requirements');
      }
      const content = await safeReadFile(artifact, projectDir);
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'collected_info');
      if (artifact === undefined) {
        return failCheck(this, 'No collected_info artifact to check acceptance criteria');
      }
      const content = await safeReadFile(artifact, projectDir);
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
  {
    checkId: 'VR-COL-INV-001',
    name: 'Investigation completed for non-quick depth',
    category: 'content',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'collected_info');
      if (artifact === undefined) {
        return skipCheck(
          this,
          'No collected_info artifact — investigation check skipped',
          'collected_info artifact is missing'
        );
      }
      const content = await safeReadFile(artifact, projectDir);
      if (content === null) {
        return skipCheck(
          this,
          'Cannot read collected_info — investigation check skipped',
          'collected_info artifact is unreadable'
        );
      }
      const parsed = safeParseYaml(content);
      if (!parsed) {
        return skipCheck(
          this,
          'Cannot parse collected_info — investigation check skipped',
          'collected_info artifact is not valid YAML'
        );
      }

      const investigation = parsed['investigation'] as Record<string, unknown> | undefined;
      if (investigation === undefined) {
        return passCheck(this, 'No investigation metadata — likely quick depth');
      }

      const depth = investigation['depth'] as string | undefined;
      const roundsCompleted = investigation['roundsCompleted'] as number | undefined;

      if (depth !== 'quick' && (roundsCompleted === undefined || roundsCompleted < 1)) {
        return failCheck(
          this,
          `Investigation depth is "${String(depth)}" but no rounds were completed`,
          {
            depth,
            roundsCompleted: roundsCompleted ?? 0,
          }
        );
      }

      return passCheck(
        this,
        `Investigation completed: ${String(roundsCompleted)} round(s) at "${String(depth)}" depth`,
        {
          depth,
          roundsCompleted,
        }
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'PRD') ?? findArtifact(artifacts, 'prd');
      if (artifact === undefined) {
        return failCheck(this, 'No PRD artifact to check sections');
      }
      const content = await safeReadFile(artifact, projectDir);
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'PRD') ?? findArtifact(artifacts, 'prd');
      if (artifact === undefined) {
        return failCheck(this, 'No PRD artifact to check FR identifiers');
      }
      const content = await safeReadFile(artifact, projectDir);
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SRS') ?? findArtifact(artifacts, 'srs');
      if (artifact === undefined) {
        return failCheck(this, 'No SRS artifact to check sections');
      }
      const content = await safeReadFile(artifact, projectDir);
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SRS') ?? findArtifact(artifacts, 'srs');
      if (artifact === undefined) {
        return failCheck(this, 'No SRS artifact to check SF identifiers');
      }
      const content = await safeReadFile(artifact, projectDir);
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
      const srsContent = await safeReadFile(srsArtifact, projectDir);
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
        return skipCheck(
          this,
          'PRD not found for cross-reference check; skipping',
          'PRD is absent',
          {
            frRefsInSrs,
            prdPath,
          }
        );
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SDS') ?? findArtifact(artifacts, 'sds');
      if (artifact === undefined) {
        return failCheck(this, 'No SDS artifact to check sections');
      }
      const content = await safeReadFile(artifact, projectDir);
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'SDS') ?? findArtifact(artifacts, 'sds');
      if (artifact === undefined) {
        return failCheck(this, 'No SDS artifact to check CMP identifiers');
      }
      const content = await safeReadFile(artifact, projectDir);
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
      const sdsContent = await safeReadFile(sdsArtifact, projectDir);
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
        return skipCheck(
          this,
          'SRS not found for cross-reference check; skipping',
          'SRS is absent',
          {
            sfRefsInSds,
            srsPath,
          }
        );
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'issue') ?? findArtifact(artifacts, 'Issue');
      if (artifact === undefined) {
        return failCheck(this, 'No issue list artifact to validate format');
      }
      const content = await safeReadFile(artifact, projectDir);
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
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifact(artifacts, 'issue') ?? findArtifact(artifacts, 'Issue');
      if (artifact === undefined) {
        return failCheck(this, 'No issue list artifact to check entries');
      }
      const content = await safeReadFile(artifact, projectDir);
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
// Cross-document consistency (prd/srs/sds generation and update)
// =============================================================================

/**
 * The run's documents agree at the sync points of `doc-sync-points.yaml`.
 * Only documents this run produced are compared, so a document that a later
 * update stage of the same run rewrites is not compared before it is rewritten.
 */
const crossDocumentConsistencyRule: VerificationRule = {
  checkId: 'VR-XDOC-001',
  name: 'Documents agree at their sync points',
  category: 'consistency',
  minRigor: 'standard',
  severity: 'error',
  async check(_artifacts, projectDir, context): Promise<VerificationCheck> {
    if (context?.options === undefined)
      return skipCheck(
        this,
        'Cross-document consistency check skipped: the caller supplied no V&V options',
        'V&V options not supplied'
      );
    if (!context.options.crossDocumentConsistency)
      return skipCheck(
        this,
        'Cross-document consistency check is turned off',
        'disabled by global.vnv.cross_document_consistency'
      );
    const documents = context.documents ?? {};
    const result = await checkCrossDocumentConsistency(projectDir, documents);
    if (result.violations.length > 0)
      return failCheck(
        this,
        `${String(result.violations.length)} sync point violation(s): ${result.violations
          .map((violation) => violation.description)
          .join('; ')}`,
        { violations: result.violations, documents }
      );
    if ((result.syncPointsEvaluated ?? 0) === 0) {
      const reason = !existsSync(join(projectDir, DOC_SYNC_POINTS_FILE))
        ? `no ${DOC_SYNC_POINTS_FILE} in the project`
        : Object.keys(documents).length < 2
          ? 'fewer than two of the run documents exist yet'
          : 'no sync point lists two of the run documents';
      return skipCheck(this, `No sync point could be compared: ${reason}`, reason, { documents });
    }
    return passCheck(
      this,
      `${String(result.syncPointsEvaluated)} sync point(s) agree across ${Object.keys(documents).join(', ')}`,
      { documents }
    );
  },
};

// =============================================================================
// Named Check Sets
// =============================================================================

/**
 * Named check sets. Each stage slot's disposition in
 * `VERIFICATION_APPLICABILITY` refers to one of these identifiers.
 */
export const VERIFICATION_CHECK_SETS = {
  'collected-info': collectionRules,
  'prd-document': [...prdRules, crossDocumentConsistencyRule],
  'srs-document': [...srsRules, crossDocumentConsistencyRule],
  'sds-document': [...sdsRules, crossDocumentConsistencyRule],
  'generated-issues': [...issueGenerationRules, issueAcceptanceCriteriaRule('VR-ISS-004')],
  'imported-issues': issueReadingRules,
  'work-orders': orchestrationRules,
  'implementation-results': implementationRules,
  'regression-report': regressionRules,
  'validation-report': validationRules,
  'review-result': reviewRules,
} as const satisfies Record<string, readonly VerificationRule[]>;

/** Identifier of a named check set. */
export type VerificationCheckSetId = keyof typeof VERIFICATION_CHECK_SETS;

// =============================================================================
// Stage-to-Rules Mapping
// =============================================================================

/**
 * Master map of stage names to their verification rules.
 *
 * Compatibility view of the applicability inventory: a stage name resolves to
 * the same check set in every mode that contains it. Stages that share the
 * same document type (e.g., prd_generation and prd_update) share the same
 * rule set. Stages with a `not_applicable` disposition have no entry.
 */
export const VERIFICATION_RULES: ReadonlyMap<string, readonly VerificationRule[]> = new Map<
  string,
  readonly VerificationRule[]
>([
  ['collection', VERIFICATION_CHECK_SETS['collected-info']],
  ['prd_generation', VERIFICATION_CHECK_SETS['prd-document']],
  ['prd_update', VERIFICATION_CHECK_SETS['prd-document']],
  ['srs_generation', VERIFICATION_CHECK_SETS['srs-document']],
  ['srs_update', VERIFICATION_CHECK_SETS['srs-document']],
  ['sds_generation', VERIFICATION_CHECK_SETS['sds-document']],
  ['sds_update', VERIFICATION_CHECK_SETS['sds-document']],
  ['issue_generation', VERIFICATION_CHECK_SETS['generated-issues']],
  ['issue_reading', VERIFICATION_CHECK_SETS['imported-issues']],
  ['orchestration', VERIFICATION_CHECK_SETS['work-orders']],
  ['implementation', VERIFICATION_CHECK_SETS['implementation-results']],
  ['regression_testing', VERIFICATION_CHECK_SETS['regression-report']],
  ['validation-agent', VERIFICATION_CHECK_SETS['validation-report']],
  ['review', VERIFICATION_CHECK_SETS['review-result']],
]);
