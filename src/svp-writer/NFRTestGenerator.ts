/**
 * NFRTestGenerator — derives test cases from non-functional requirements.
 *
 * Like {@link TestCaseDeriver}, this is a pure-function module. It maps an
 * NFR category to a test category and verification level:
 *
 * - performance       → Integration / nfr_performance (probe latency, throughput)
 * - security          → Integration / nfr_security    (auth, input validation)
 * - reliability       → System      / nfr_reliability (recovery, retry, failover)
 * - availability      → System      / nfr_reliability (uptime probes)
 * - usability/...     → System      / nfr_reliability (placeholder smoke check)
 *
 * The mapping favours producing *some* test for every NFR rather than dropping
 * categories the SVP does not yet model precisely — this guarantees the
 * traceability matrix has full coverage of the SRS NFR table.
 */

import { type ParsedNFR, type TestCase, type TestCaseCategory, TestLevel } from './types.js';
import type { DerivationContext } from './TestCaseDeriver.js';

/**
 * Generates test cases for the given NFRs, sharing the deriver's id counter.
 * @param nfrs
 * @param context
 */
export function generateNFRTestCases(
  nfrs: readonly ParsedNFR[],
  context: DerivationContext
): TestCase[] {
  const cases: TestCase[] = [];
  for (const nfr of nfrs) {
    cases.push(buildNFRTest(nfr, context));
  }
  return cases;
}

function buildNFRTest(nfr: ParsedNFR, context: DerivationContext): TestCase {
  const { category, level } = mapNFRCategory(nfr);
  const target =
    nfr.target.trim().length > 0 ? nfr.target.trim() : 'no quantitative target specified';

  return {
    id: allocateId(context),
    title: `NFR verification — ${nfr.description.slice(0, 60)}`,
    source: nfr.id,
    category,
    level,
    priority: nfr.priority,
    preconditions: ['Test environment provisioned with production-like load profile'],
    steps: buildSteps(nfr),
    expected: `Measured behaviour satisfies target: ${target}`,
  };
}

function buildSteps(nfr: ParsedNFR): string[] {
  switch (nfr.category) {
    case 'performance':
      return [
        'Provision a workload generator matching the NFR scenario',
        `Drive the system under test until stable, then sample: ${nfr.target || 'baseline metrics'}`,
        'Record p50/p95/p99 latency and throughput',
      ];
    case 'security':
      return [
        `Construct attack vectors covering: ${nfr.description}`,
        'Submit each vector through the public interface',
        'Capture system response and audit log entries',
      ];
    case 'reliability':
    case 'availability':
      return [
        'Inject the failure mode described by the NFR',
        'Allow the system to attempt automatic recovery',
        `Verify recovery succeeds within target: ${nfr.target || 'expected recovery window'}`,
      ];
    default:
      return [
        `Execute the smoke scenario described by NFR ${nfr.id}`,
        'Inspect the resulting system state and observable outputs',
      ];
  }
}

function mapNFRCategory(nfr: ParsedNFR): { category: TestCaseCategory; level: TestLevel } {
  switch (nfr.category) {
    case 'performance':
    case 'scalability':
      return { category: 'nfr_performance', level: TestLevel.Integration };
    case 'security':
      return { category: 'nfr_security', level: TestLevel.Integration };
    case 'reliability':
    case 'availability':
      return { category: 'nfr_reliability', level: TestLevel.System };
    default:
      return { category: 'nfr_reliability', level: TestLevel.System };
  }
}

function allocateId(context: DerivationContext): string {
  const id = `TC-${String(context.nextId).padStart(3, '0')}`;
  context.nextId += 1;
  return id;
}
