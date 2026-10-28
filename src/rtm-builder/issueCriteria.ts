/**
 * Acceptance criteria stated in an issue.
 *
 * Issues state criteria either as a structured list (`acceptance_criteria`)
 * or as a markdown list under an "Acceptance Criteria" heading in the body,
 * the format IssueTransformer, LocalIssueWriter, and GitHub issue templates
 * produce. Each criterion gets an identifier: the `AC-NNN` prefix the text
 * gives, or its 1-based position in the list (`AC-001`, `AC-002`, ...).
 * Workers report evidence against these identifiers.
 *
 * @module rtm-builder/issueCriteria
 */

/** One acceptance criterion stated in an issue. */
export interface IssueCriterion {
  /** Identifier within the issue (AC-NNN) */
  readonly id: string;
  /** Criterion text; the identifier when the issue gives no text */
  readonly description: string;
}

const EXPLICIT_ID = /^(AC-\d+)\s*[:\-–]\s*(.*)$/iu;
const LIST_ITEM = /^(?:[-*+]|\d+\.)\s+\S/u;
const LIST_MARKER = /^(?:[-*+]|\d+\.)\s+/u;
const CHECKBOX = /^\[[ xX]\]\s*/u;

/**
 * Normalize an acceptance criterion identifier so `ac-1` and `AC-001` match.
 * @param id - Identifier as written
 * @returns `AC-NNN` with at least three digits, or the trimmed upper-case input
 */
export function normalizeCriterionId(id: string): string {
  const match = /^AC-0*(\d+)$/iu.exec(id.trim());
  return match === null ? id.trim().toUpperCase() : `AC-${(match[1] ?? '0').padStart(3, '0')}`;
}

/**
 * Build a criterion from list text, using an explicit `AC-NNN` prefix when present.
 * @param text - Criterion text without list or checkbox markers
 * @param position - 1-based position in the list
 * @returns Criterion
 */
function criterionFromText(text: string, position: number): IssueCriterion {
  const explicit = EXPLICIT_ID.exec(text);
  const id = normalizeCriterionId(explicit?.[1] ?? `AC-${String(position)}`);
  const description = (explicit === null ? text : (explicit[2] ?? '')).trim();
  return { id, description: description === '' ? id : description };
}

/**
 * Criteria from a structured list of strings or `{ id, description }` objects.
 * @param list - Structured criteria
 * @returns Criteria in list order
 */
function structuredCriteria(list: readonly unknown[]): IssueCriterion[] {
  return list.map((item, index) => {
    if (typeof item === 'string') return criterionFromText(item.trim(), index + 1);
    const record =
      typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
    const rawId = record['id'];
    const text = record['description'] ?? record['text'] ?? record['criterion'];
    const id = normalizeCriterionId(
      typeof rawId === 'string' && rawId.trim() !== '' ? rawId : `AC-${String(index + 1)}`
    );
    return {
      id,
      description: typeof text === 'string' && text.trim() !== '' ? text.trim() : id,
    };
  });
}

/**
 * Criteria listed under an "Acceptance Criteria" heading of a markdown body.
 * A heading is a `#` line or a line wrapped in `**`.
 * @param body - Issue body
 * @returns Criteria in list order
 */
function bodyCriteria(body: string): IssueCriterion[] {
  const criteria: IssueCriterion[] = [];
  let inSection = false;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const isHeading = line.startsWith('#') || (line.startsWith('**') && line.endsWith('**'));
    if (isHeading) {
      inSection = line.toLowerCase().includes('acceptance criteria');
      continue;
    }
    if (inSection && LIST_ITEM.test(line))
      criteria.push(
        criterionFromText(line.replace(LIST_MARKER, '').replace(CHECKBOX, ''), criteria.length + 1)
      );
  }
  return criteria;
}

/**
 * Acceptance criteria an issue states. A non-empty structured list wins over
 * the body.
 * @param issue - Issue entry from an issue list
 * @returns Criteria in stated order; empty when the issue states none
 */
export function issueAcceptanceCriteria(
  issue: Readonly<Record<string, unknown>>
): IssueCriterion[] {
  for (const key of ['acceptance_criteria', 'acceptanceCriteria']) {
    const list = issue[key];
    if (Array.isArray(list) && list.length > 0) return structuredCriteria(list);
  }
  const body = issue['body'] ?? issue['description'];
  return typeof body === 'string' ? bodyCriteria(body) : [];
}
