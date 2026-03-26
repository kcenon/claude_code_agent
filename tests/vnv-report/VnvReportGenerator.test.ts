/**
 * Tests for VnvReportGenerator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VnvReportGenerator } from '../../src/vnv-report/VnvReportGenerator.js';
import type {
  QualityGatesConfig,
  StageVerificationSummary,
  ValidationReportSummary,
  RtmReportData,
  PipelineReportData,
} from '../../src/vnv-report/types.js';
import type { VnvRigor } from '../../src/vnv/types.js';
import type { PipelineMode } from '../../src/ad-sdlc-orchestrator/types.js';

// =============================================================================
// Test helpers
// =============================================================================

function createMockStageVerification(
  overrides: Partial<StageVerificationSummary> = {}
): StageVerificationSummary {
  return {
    stageName: 'collection',
    passed: true,
    rigor: 'standard',
    checks: [
      {
        checkId: 'VR-COL-001',
        name: 'Collected info exists',
        category: 'structure',
        passed: true,
        severity: 'error',
        message: 'Artifact found',
      },
    ],
    warnings: [],
    errors: [],
    timestamp: '2026-01-01T00:00:00.000Z',
    durationMs: 150,
    ...overrides,
  };
}

function createMockValidationReport(
  overrides: Partial<ValidationReportSummary> = {}
): ValidationReportSummary {
  return {
    reportId: 'VR-pipeline-001-1234',
    projectId: 'test-project',
    pipelineId: 'pipeline-001',
    generatedAt: '2026-01-01T00:00:00.000Z',
    overallResult: 'pass',
    rigor: 'standard',
    requirementValidation: {
      totalRequirements: 2,
      implementedRequirements: 2,
      verifiedRequirements: 2,
      unimplementedRequirements: [],
      coveragePercent: 100,
    },
    acceptanceCriteriaValidation: {
      totalCriteria: 3,
      validatedCriteria: 3,
      failedCriteria: [],
      untestedCriteria: [],
      passRate: 100,
    },
    traceabilityValidation: {
      chainComplete: true,
      brokenLinks: [],
      orphanArtifacts: [],
      forwardCoverage: 100,
      backwardCoverage: 100,
    },
    qualityGateResults: {
      allGatesPassed: true,
      gateResults: [
        { gateName: 'build-success', passed: true, details: 'All builds passed' },
        { gateName: 'test-success', passed: true, details: 'All tests passed' },
      ],
    },
    recommendations: [],
    ...overrides,
  };
}

function createMockRtmReportData(overrides: Partial<RtmReportData> = {}): RtmReportData {
  return {
    entries: [
      {
        requirementId: 'FR-001',
        requirementTitle: 'User Authentication',
        features: ['SF-001'],
        useCases: ['UC-001'],
        components: ['CMP-001'],
        issues: ['ISS-001'],
        status: 'verified',
      },
    ],
    coverageMetrics: {
      totalRequirements: 1,
      requirementsWithFeatures: 1,
      requirementsWithComponents: 1,
      requirementsWithIssues: 1,
      requirementsWithImplementations: 1,
      requirementsWithPRs: 1,
      forwardCoveragePercent: 100,
      backwardCoveragePercent: 100,
      acceptanceCriteriaTotal: 1,
      acceptanceCriteriaValidated: 1,
    },
    gaps: [],
    ...overrides,
  };
}

function createMockPipelineResult(overrides: Partial<PipelineReportData> = {}): PipelineReportData {
  return {
    pipelineId: 'pipeline-001',
    mode: 'greenfield',
    overallStatus: 'completed',
    durationMs: 60000,
    ...overrides,
  };
}

function createMockQualityGates(overrides: Partial<QualityGatesConfig> = {}): QualityGatesConfig {
  return {
    document_quality: {
      prd: {
        required_sections: [
          'Introduction',
          'Functional Requirements',
          'Non-Functional Requirements',
        ],
        min_requirements: 1,
      },
      srs: {
        required_sections: ['Introduction', 'Software Features'],
      },
      sds: {
        required_sections: ['Introduction', 'System Architecture', 'Component Design'],
      },
    },
    code_quality: {
      coverage_threshold: 80,
      max_complexity: 10,
    },
    security: {
      no_hardcoded_secrets: true,
      require_input_validation: true,
    },
    ...overrides,
  };
}

// =============================================================================
// VnvReportGenerator
// =============================================================================

describe('VnvReportGenerator', () => {
  let generator: VnvReportGenerator;

  beforeEach(() => {
    generator = new VnvReportGenerator();
  });

  // ===========================================================================
  // generateVnvPlan
  // ===========================================================================

  describe('generateVnvPlan', () => {
    const stages = [
      { name: 'collection', description: 'Collect project information' },
      { name: 'prd_generation', description: 'Generate PRD document' },
      { name: 'srs_generation', description: 'Generate SRS document' },
      { name: 'implementation', description: 'Implement work orders' },
    ];

    it('should produce markdown with V&V Plan header', () => {
      const plan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'standard',
        createMockQualityGates()
      );

      expect(plan).toContain('# V&V Plan');
      expect(plan).toContain('Greenfield Pipeline');
    });

    it('should include pipeline mode and rigor level', () => {
      const plan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'strict',
        createMockQualityGates()
      );

      expect(plan).toContain('**Pipeline Mode**: greenfield');
      expect(plan).toContain('**Rigor Level**: strict');
    });

    it('should include V&V Scope section', () => {
      const plan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'standard',
        createMockQualityGates()
      );

      expect(plan).toContain('## 1. V&V Scope');
      expect(plan).toContain('greenfield');
      expect(plan).toContain('4');
    });

    it('should include Verification Strategy section with stage table', () => {
      const plan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'standard',
        createMockQualityGates()
      );

      expect(plan).toContain('## 2. Verification Strategy');
      expect(plan).toContain('Stage Verification Gates');
      expect(plan).toContain('collection');
      expect(plan).toContain('prd_generation');
    });

    it('should include Validation Strategy section', () => {
      const plan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'standard',
        createMockQualityGates()
      );

      expect(plan).toContain('## 3. Validation Strategy');
      expect(plan).toContain('Acceptance Criteria Validation');
    });

    it('should include Traceability Requirements section', () => {
      const plan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'standard',
        createMockQualityGates()
      );

      expect(plan).toContain('## 4. Traceability Requirements');
      expect(plan).toContain('FR (Functional Requirement)');
    });

    it('should include Quality Gates section', () => {
      const plan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'standard',
        createMockQualityGates()
      );

      expect(plan).toContain('## 5. Quality Gates');
      expect(plan).toContain('Document Quality');
      expect(plan).toContain('Code Quality');
      expect(plan).toContain('Security');
    });

    it('should include V&V Schedule section', () => {
      const plan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'standard',
        createMockQualityGates()
      );

      expect(plan).toContain('## 6. V&V Schedule');
    });

    it('should vary content based on rigor level', () => {
      const strictPlan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'strict',
        createMockQualityGates()
      );
      const minimalPlan = generator.generateVnvPlan(
        'greenfield',
        stages,
        'minimal',
        createMockQualityGates()
      );

      // Strict should mention 100% coverage
      expect(strictPlan).toContain('100%');
      // Minimal should mention traceability not enforced
      expect(minimalPlan).toContain('not enforced');
    });

    it('should handle enhancement pipeline mode', () => {
      const plan = generator.generateVnvPlan(
        'enhancement',
        stages,
        'standard',
        createMockQualityGates()
      );

      expect(plan).toContain('Enhancement Pipeline');
      expect(plan).toContain('enhancement');
    });
  });

  // ===========================================================================
  // generateVnvReport
  // ===========================================================================

  describe('generateVnvReport', () => {
    it('should produce markdown with V&V Report header', () => {
      const report = generator.generateVnvReport(
        [createMockStageVerification()],
        createMockValidationReport(),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('# V&V Report');
      expect(report).toContain('**Pipeline ID**: pipeline-001');
    });

    it('should include Executive Summary section', () => {
      const report = generator.generateVnvReport(
        [createMockStageVerification()],
        createMockValidationReport(),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('## 1. Executive Summary');
      expect(report).toContain('Key Metrics');
    });

    it('should include Stage Verification Results section', () => {
      const sv = createMockStageVerification();
      const report = generator.generateVnvReport(
        [sv],
        createMockValidationReport(),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('## 2. Stage Verification Results');
      expect(report).toContain('collection');
      expect(report).toContain('PASS');
    });

    it('should include Traceability Analysis section', () => {
      const report = generator.generateVnvReport(
        [createMockStageVerification()],
        createMockValidationReport(),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('## 3. Traceability Analysis');
      expect(report).toContain('Coverage Metrics');
    });

    it('should include Acceptance Criteria Validation section', () => {
      const report = generator.generateVnvReport(
        [createMockStageVerification()],
        createMockValidationReport(),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('## 4. Acceptance Criteria Validation');
    });

    it('should include Quality Gate Results section', () => {
      const report = generator.generateVnvReport(
        [createMockStageVerification()],
        createMockValidationReport(),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('## 5. Quality Gate Results');
    });

    it('should include Gaps & Recommendations section', () => {
      const report = generator.generateVnvReport(
        [createMockStageVerification()],
        createMockValidationReport(),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('## 6. Gaps & Recommendations');
    });

    it('should include Conclusion section', () => {
      const report = generator.generateVnvReport(
        [createMockStageVerification()],
        createMockValidationReport(),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('## 7. Conclusion');
    });

    it('should handle FAIL result in conclusion', () => {
      const report = generator.generateVnvReport(
        [createMockStageVerification({ passed: false, errors: ['Check failed'] })],
        createMockValidationReport({ overallResult: 'fail' }),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('**failed**');
      expect(report).toContain('FAIL');
    });

    it('should handle PASS WITH WARNINGS result', () => {
      const report = generator.generateVnvReport(
        [createMockStageVerification()],
        createMockValidationReport({ overallResult: 'pass_with_warnings' }),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('PASS WITH WARNINGS');
      expect(report).toContain('**passed with warnings**');
    });

    it('should show failed check details when stages fail', () => {
      const failedSV = createMockStageVerification({
        passed: false,
        checks: [
          {
            checkId: 'VR-COL-001',
            name: 'Missing artifact',
            category: 'structure',
            passed: false,
            severity: 'error',
            message: 'No collected_info found',
          },
        ],
        errors: ['[VR-COL-001] No collected_info found'],
      });

      const report = generator.generateVnvReport(
        [failedSV],
        createMockValidationReport({ overallResult: 'fail' }),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('Failed Check Details');
      expect(report).toContain('VR-COL-001');
    });

    it('should show RTM gaps when present', () => {
      const rtmData = createMockRtmReportData({
        gaps: [
          {
            type: 'uncovered_requirement',
            severity: 'error',
            affectedIds: ['FR-002'],
            message: 'FR-002 has no mapping',
          },
        ],
      });

      const report = generator.generateVnvReport(
        [createMockStageVerification()],
        createMockValidationReport(),
        rtmData,
        createMockPipelineResult()
      );

      expect(report).toContain('Traceability Gaps');
      expect(report).toContain('FR-002');
    });

    it('should handle empty stage verifications', () => {
      const report = generator.generateVnvReport(
        [],
        createMockValidationReport(),
        createMockRtmReportData(),
        createMockPipelineResult()
      );

      expect(report).toContain('No stage verifications were performed');
    });
  });

  // ===========================================================================
  // generateStageReport
  // ===========================================================================

  describe('generateStageReport', () => {
    it('should produce valid YAML', () => {
      const sv = createMockStageVerification();
      const yamlStr = generator.generateStageReport(sv);

      expect(yamlStr).toContain('stage_verification_report');
      expect(yamlStr).toContain('stage_name: collection');
      expect(yamlStr).toContain('passed: true');
      expect(yamlStr).toContain('rigor: standard');
    });

    it('should include summary with check counts', () => {
      const sv = createMockStageVerification({
        checks: [
          {
            checkId: 'VR-COL-001',
            name: 'Check 1',
            category: 'structure',
            passed: true,
            severity: 'error',
            message: 'OK',
          },
          {
            checkId: 'VR-COL-002',
            name: 'Check 2',
            category: 'structure',
            passed: false,
            severity: 'error',
            message: 'Fail',
          },
        ],
        errors: ['[VR-COL-002] Fail'],
      });
      const yamlStr = generator.generateStageReport(sv);

      expect(yamlStr).toContain('total_checks: 2');
      expect(yamlStr).toContain('passed_checks: 1');
      expect(yamlStr).toContain('failed_checks: 1');
      expect(yamlStr).toContain('error_count: 1');
    });

    it('should include individual check details', () => {
      const sv = createMockStageVerification();
      const yamlStr = generator.generateStageReport(sv);

      expect(yamlStr).toContain('check_id: VR-COL-001');
      expect(yamlStr).toContain('name: Collected info exists');
    });

    it('should include duration and timestamp', () => {
      const sv = createMockStageVerification({
        durationMs: 250,
        timestamp: '2026-03-15T10:00:00.000Z',
      });
      const yamlStr = generator.generateStageReport(sv);

      expect(yamlStr).toContain('duration_ms: 250');
      expect(yamlStr).toContain('2026-03-15');
    });

    it('should include warnings and errors arrays', () => {
      const sv = createMockStageVerification({
        warnings: ['Warning 1', 'Warning 2'],
        errors: ['Error 1'],
      });
      const yamlStr = generator.generateStageReport(sv);

      expect(yamlStr).toContain('Warning 1');
      expect(yamlStr).toContain('Warning 2');
      expect(yamlStr).toContain('Error 1');
    });
  });
});
