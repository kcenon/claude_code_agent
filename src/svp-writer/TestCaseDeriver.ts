/**
 * TestCaseDeriver — derives test cases from parsed SRS use cases.
 *
 * This is a pure-function module: it takes a {@link ParsedUseCase} and returns
 * an array of {@link TestCase}s without any I/O. The derivation rules are:
 *
 * 1. Each use case yields **one happy-path System test** from its main flow.
 * 2. Each alternative flow yields **one Integration test**.
 * 3. Each precondition yields **one precondition-violation Unit test**.
 *
 * Test case IDs are allocated by the caller via {@link DerivationContext}
 * so a single monotonic counter can be shared across multiple use cases.
 */

import { type ParsedUseCase, type TestCase, type TestCasePriority, TestLevel } from './types.js';

/**
 * Mutable counter passed by the caller. The deriver mutates `nextId` so the
 * caller observes the updated value after the call.
 */
export interface DerivationContext {
  /** Next available test case sequence number (1-based). */
  nextId: number;
  /** Default priority assigned to derived tests. Defaults to "P1". */
  readonly defaultPriority?: TestCasePriority;
}

/**
 * Derives test cases for a single use case.
 *
 * The returned array preserves a stable order: [happy-path,
 * ...alternative-flow tests, ...precondition tests]. Callers may rely on
 * this ordering when rendering grouped sections of the SVP document.
 *
 * @param uc - Parsed use case
 * @param context - Mutable derivation context (id allocator)
 * @returns Test cases derived from the use case (never empty for a valid UC)
 */
export function deriveTestCasesForUseCase(
  uc: ParsedUseCase,
  context: DerivationContext
): TestCase[] {
  const priority: TestCasePriority = context.defaultPriority ?? 'P1';
  const cases: TestCase[] = [];

  cases.push(buildHappyPathTest(uc, context, priority));

  uc.alternativeFlows.forEach((flow, index) => {
    cases.push(buildAlternativeFlowTest(uc, flow, index, context, priority));
  });

  uc.preconditions.forEach((precondition, index) => {
    cases.push(buildPreconditionViolationTest(uc, precondition, index, context, priority));
  });

  return cases;
}

/**
 * Derives test cases for an array of use cases, sharing a single id counter.
 * @param useCases
 * @param context
 */
export function deriveTestCasesForUseCases(
  useCases: readonly ParsedUseCase[],
  context: DerivationContext
): TestCase[] {
  const result: TestCase[] = [];
  for (const uc of useCases) {
    result.push(...deriveTestCasesForUseCase(uc, context));
  }
  return result;
}

function buildHappyPathTest(
  uc: ParsedUseCase,
  context: DerivationContext,
  priority: TestCasePriority
): TestCase {
  const steps = uc.mainFlow.length > 0 ? [...uc.mainFlow] : [`Execute ${uc.title} main scenario`];

  const expected =
    uc.postconditions.length > 0
      ? uc.postconditions.join('; ')
      : `Use case "${uc.title}" completes successfully`;

  return {
    id: allocateId(context),
    title: `${uc.title} — happy path`,
    source: uc.id,
    category: 'happy_path',
    level: TestLevel.System,
    priority,
    preconditions: [...uc.preconditions],
    steps,
    expected,
  };
}

function buildAlternativeFlowTest(
  uc: ParsedUseCase,
  flow: string,
  index: number,
  context: DerivationContext,
  priority: TestCasePriority
): TestCase {
  return {
    id: allocateId(context),
    title: `${uc.title} — alt #${String(index + 1)}`,
    source: uc.id,
    category: 'alternative',
    level: TestLevel.Integration,
    priority,
    preconditions: [...uc.preconditions],
    steps: [`Trigger alternative flow: ${flow}`],
    expected: `System handles "${flow}" gracefully without entering invalid state`,
  };
}

function buildPreconditionViolationTest(
  uc: ParsedUseCase,
  precondition: string,
  index: number,
  context: DerivationContext,
  priority: TestCasePriority
): TestCase {
  return {
    id: allocateId(context),
    title: `${uc.title} — precondition #${String(index + 1)} violated`,
    source: uc.id,
    category: 'precondition_failure',
    level: TestLevel.Unit,
    priority,
    preconditions: [],
    steps: [
      `Set up state where precondition is NOT satisfied: ${precondition}`,
      `Invoke the entry point of ${uc.title}`,
    ],
    expected: 'System rejects the request and reports a precondition violation',
  };
}

function allocateId(context: DerivationContext): string {
  const id = `TC-${String(context.nextId).padStart(3, '0')}`;
  context.nextId += 1;
  return id;
}
