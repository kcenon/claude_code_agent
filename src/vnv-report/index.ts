/**
 * V&V Report Generator Module
 *
 * Provides the VnvReportGenerator utility class and supporting types
 * for generating V&V Plans, consolidated V&V Reports, and per-stage
 * verification reports in markdown and YAML formats.
 *
 * @module vnv-report
 */

// Types
export type {
  ValidationReportSummary,
  StageVerificationSummary,
  VerificationCheckSummary,
  QualityGatesConfig,
  QualityGateResultEntry,
  FailedCriterionEntry,
  DocumentQualityGateConfig,
  CodeQualityGateConfig,
  SecurityQualityGateConfig,
  RtmReportData,
  PipelineReportData,
} from './types.js';

// Generator
export { VnvReportGenerator } from './VnvReportGenerator.js';
