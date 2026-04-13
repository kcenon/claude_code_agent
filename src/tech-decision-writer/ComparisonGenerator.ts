/**
 * Comparison Generator
 *
 * Converts a parsed SDS technology stack row into a complete TechDecision
 * object, including default candidates, a weighted evaluation matrix, a
 * recorded decision for the SDS-selected technology, and expected
 * consequences.
 *
 * The generator ships a default criteria set (Performance, Ecosystem,
 * Learning, Maintenance, Cost, Security) with weights summing to 1.0 and
 * a stub alternative catalog keyed by layer. Custom criteria can be passed
 * to the agent at construction time.
 */

import type {
  Candidate,
  Consequences,
  Decision,
  EvaluationCriterion,
  EvaluationMatrix,
  EvaluationMatrixRow,
  ParsedSDSComponentRef,
  ParsedSDSForDecisions,
  ParsedTechStackRow,
  TechDecision,
} from './types.js';
import { InvalidCriteriaError } from './errors.js';
import { slugifyTopic } from './DecisionDetector.js';

/**
 * Default evaluation criteria.
 *
 * Weights sum to 1.0 so every weighted total falls in [1.0, 10.0] and
 * remains comparable across decisions.
 */
export const DEFAULT_CRITERIA: readonly EvaluationCriterion[] = [
  {
    name: 'Performance',
    weight: 0.25,
    description: 'Throughput, latency, and resource efficiency under the expected workload',
  },
  {
    name: 'Ecosystem',
    weight: 0.2,
    description: 'Maturity of libraries, tooling, community, and third-party integrations',
  },
  {
    name: 'Learning',
    weight: 0.15,
    description: 'Learning curve, documentation quality, and team familiarity',
  },
  {
    name: 'Maintenance',
    weight: 0.15,
    description: 'Operational burden, upgrade cadence, and long-term support outlook',
  },
  {
    name: 'Cost',
    weight: 0.15,
    description: 'License fees, hosting cost, and total cost of ownership',
  },
  {
    name: 'Security',
    weight: 0.1,
    description: 'Track record of vulnerabilities, patch cadence, and built-in hardening',
  },
];

const WEIGHT_SUM_TOLERANCE = 0.001;

/**
 * Validate that evaluation criteria weights sum to approximately 1.0.
 *
 * Throws {@link InvalidCriteriaError} when the weights do not sum close
 * enough to one so callers discover configuration mistakes early.
 * @param criteria - Criteria to validate
 */
export function validateCriteria(criteria: readonly EvaluationCriterion[]): void {
  const sum = criteria.reduce((acc, c) => acc + c.weight, 0);
  if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
    throw new InvalidCriteriaError(sum);
  }
}

/**
 * A catalog of fallback candidates keyed by lowercase layer name.
 *
 * Each entry returns a short list of well-known alternatives used when the
 * SDS does not supply an ADR section enumerating competitors. The list
 * intentionally includes the typical SDS writer defaults so the current
 * pick almost always shows up first.
 */
const FALLBACK_CANDIDATES: Readonly<Record<string, readonly Candidate[]>> = {
  runtime: [
    {
      name: 'Node.js',
      category: 'Runtime',
      license: 'MIT',
      maturity: 'Mature',
      description: 'Event-driven JavaScript runtime with a large package ecosystem',
    },
    {
      name: 'Deno',
      category: 'Runtime',
      license: 'MIT',
      maturity: 'Stable',
      description: 'Secure TypeScript-first runtime with built-in tooling',
    },
    {
      name: 'Bun',
      category: 'Runtime',
      license: 'MIT',
      maturity: 'Emerging',
      description: 'Fast JavaScript runtime with bundler, package manager, and test runner',
    },
  ],
  language: [
    {
      name: 'TypeScript',
      category: 'Language',
      license: 'Apache-2.0',
      maturity: 'Mature',
      description: 'Statically typed superset of JavaScript with broad tooling support',
    },
    {
      name: 'JavaScript',
      category: 'Language',
      license: 'N/A',
      maturity: 'Mature',
      description: 'Dynamically typed language with universal runtime support',
    },
    {
      name: 'Go',
      category: 'Language',
      license: 'BSD-3-Clause',
      maturity: 'Mature',
      description: 'Compiled language with built-in concurrency and small runtime',
    },
  ],
  framework: [
    {
      name: 'Express.js',
      category: 'Framework',
      license: 'MIT',
      maturity: 'Mature',
      description: 'Minimal, unopinionated HTTP server framework for Node.js',
    },
    {
      name: 'Fastify',
      category: 'Framework',
      license: 'MIT',
      maturity: 'Stable',
      description: 'Low-overhead web framework with schema-based validation',
    },
    {
      name: 'NestJS',
      category: 'Framework',
      license: 'MIT',
      maturity: 'Stable',
      description: 'Opinionated TypeScript framework with dependency injection',
    },
  ],
  database: [
    {
      name: 'PostgreSQL',
      category: 'Database',
      license: 'PostgreSQL License',
      maturity: 'Mature',
      description: 'Feature-rich relational database with JSON and full-text search',
    },
    {
      name: 'MySQL',
      category: 'Database',
      license: 'GPL-2.0',
      maturity: 'Mature',
      description: 'Widely deployed relational database with a large operational ecosystem',
    },
    {
      name: 'SQLite',
      category: 'Database',
      license: 'Public Domain',
      maturity: 'Mature',
      description: 'Embedded relational database suitable for small deployments',
    },
  ],
  testing: [
    {
      name: 'Vitest',
      category: 'Testing',
      license: 'MIT',
      maturity: 'Stable',
      description: 'Fast Vite-native test runner with TypeScript out of the box',
    },
    {
      name: 'Jest',
      category: 'Testing',
      license: 'MIT',
      maturity: 'Mature',
      description: 'Mature JavaScript testing framework with snapshots and mocks',
    },
    {
      name: 'Mocha',
      category: 'Testing',
      license: 'MIT',
      maturity: 'Mature',
      description: 'Flexible test runner that pairs with assertion libraries like Chai',
    },
  ],
};

/**
 * Placeholder score assigned to every criterion in stub mode.
 *
 * The base score (6) is slightly above neutral, and the selected candidate
 * receives a bonus to guarantee a deterministic winner when scores are tied.
 */
const STUB_BASE_SCORE = 6;
const STUB_SELECTED_BONUS = 2;

/**
 * Build the fallback candidate list for a parsed technology stack row.
 *
 * If the SDS row names a technology that is not in the fallback catalog,
 * the declared technology is added at the front so the resulting matrix
 * always includes the current pick.
 * @param row - Parsed technology stack row
 */
function buildCandidatesForRow(row: ParsedTechStackRow): readonly Candidate[] {
  const layerKey = row.layer.toLowerCase();
  const fallback = FALLBACK_CANDIDATES[layerKey] ?? [];

  const currentPick: Candidate = {
    name: row.technology,
    category: row.layer,
    license: 'See vendor documentation',
    maturity: 'Stable',
    description: row.rationale.length > 0 ? row.rationale : `${row.technology} ${row.version}`,
  };

  if (fallback.length === 0) {
    return [currentPick];
  }

  // Put the SDS-selected technology first, then any fallback entries that
  // are not the same technology. Matching is case-insensitive to tolerate
  // casing differences between the SDS table and the catalog.
  const normalized = row.technology.toLowerCase();
  const alreadyListed = fallback.some((c) => c.name.toLowerCase() === normalized);
  if (alreadyListed) {
    return [
      ...fallback.filter((c) => c.name.toLowerCase() === normalized),
      ...fallback.filter((c) => c.name.toLowerCase() !== normalized),
    ];
  }

  return [currentPick, ...fallback];
}

/**
 * Build an evaluation matrix for the given candidates and criteria.
 *
 * Each candidate receives the stub base score for every criterion, and the
 * selected candidate (first entry) receives an additional bonus. Scores are
 * clamped to the 1-10 range before computing weighted totals.
 * @param candidates - Candidates to score (first entry is the selected pick)
 * @param criteria - Evaluation criteria
 */
function buildMatrix(
  candidates: readonly Candidate[],
  criteria: readonly EvaluationCriterion[]
): EvaluationMatrix {
  const rows: EvaluationMatrixRow[] = [];

  candidates.forEach((candidate, index) => {
    const scores: Record<string, number> = {};
    let weightedTotal = 0;

    for (const criterion of criteria) {
      const rawScore = STUB_BASE_SCORE + (index === 0 ? STUB_SELECTED_BONUS : 0);
      const clamped = Math.max(1, Math.min(10, rawScore));
      scores[criterion.name] = clamped;
      weightedTotal += clamped * criterion.weight;
    }

    rows.push({
      candidate: candidate.name,
      scores,
      weightedTotal: Math.round(weightedTotal * 10) / 10,
    });
  });

  return { criteria, rows };
}

/**
 * Build the decision record for the selected candidate.
 *
 * Uses the SDS rationale when available and falls back to a generic message.
 * @param row - Parsed technology stack row
 */
function buildDecision(row: ParsedTechStackRow): Decision {
  const today = new Date().toISOString().split('T')[0] ?? '';
  const rationale =
    row.rationale.length > 0
      ? row.rationale
      : `${row.technology} is the technology declared in the SDS for the ${row.layer} layer`;

  return {
    selected: row.technology,
    rationale,
    decidedAt: today,
  };
}

/**
 * Build default consequences for a technology decision.
 *
 * Stub entries mirror the SDS rationale and highlight common trade-offs and
 * risks so the generated document is immediately useful without requiring
 * further manual edits.
 * @param row - Parsed technology stack row
 */
function buildConsequences(row: ParsedTechStackRow): Consequences {
  return {
    positive: [
      `Leverages the ${row.layer} strengths of ${row.technology} ${row.version}`.trim(),
      'Aligns with the declared SDS technology stack to keep architecture coherent',
    ],
    negative: [`The team accepts the ${row.technology} learning curve and operational burden`],
    risks: [
      `${row.technology} upstream changes may require follow-up upgrades or migrations`,
      'Licensing or vendor policy shifts should be reviewed on a recurring cadence',
    ],
  };
}

/**
 * Build cross-references to SDS components and SRS NFRs.
 *
 * Each reference is a short label so downstream tooling (index generators,
 * RTM builders) can resolve the IDs back to the source documents.
 * @param sds - Parsed SDS extract
 * @param components - Components to include in references
 */
function buildReferences(
  sds: ParsedSDSForDecisions,
  components: readonly ParsedSDSComponentRef[]
): readonly string[] {
  const refs: string[] = [];
  refs.push(`SDS: ${sds.documentId}`);

  if (components.length > 0) {
    const labels = components.slice(0, 5).map((c) => `${c.id} (${c.name})`);
    refs.push(`Components: ${labels.join(', ')}`);
  }

  if (sds.nfrIds.length > 0) {
    refs.push(`NFRs: ${[...sds.nfrIds].sort().join(', ')}`);
  }

  return refs;
}

/**
 * Generate one TechDecision per technology stack row in the parsed SDS.
 *
 * Numbering starts at 1 and matches the order of the SDS technology stack
 * table. If the SDS has no technology stack, an empty array is returned so
 * callers can emit a warning instead of crashing.
 * @param sds - Parsed SDS extract
 * @param criteria - Evaluation criteria (validated by the caller)
 */
export function generateDecisions(
  sds: ParsedSDSForDecisions,
  criteria: readonly EvaluationCriterion[] = DEFAULT_CRITERIA
): readonly TechDecision[] {
  validateCriteria(criteria);

  const decisions: TechDecision[] = [];

  sds.technologyStack.forEach((row, index) => {
    const number = index + 1;
    const topic = `${row.layer} Selection`;
    const topicSlug = slugifyTopic(`${row.layer}-selection`);

    const candidates = buildCandidatesForRow(row);
    const matrix = buildMatrix(candidates, criteria);
    const decision = buildDecision(row);
    const consequences = buildConsequences(row);
    const references = buildReferences(sds, sds.components);

    const context =
      row.rationale.length > 0
        ? `The ${row.layer} layer for ${sds.productName} needs a technology that satisfies the project constraints described in ${sds.documentId}. ${row.rationale}`
        : `The ${row.layer} layer for ${sds.productName} needs a technology that satisfies the project constraints described in ${sds.documentId}.`;

    decisions.push({
      number,
      topicSlug,
      topic,
      context,
      candidates,
      matrix,
      decision,
      consequences,
      references,
    });
  });

  return decisions;
}
