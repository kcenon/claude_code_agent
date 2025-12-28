/**
 * Verification Utilities for E2E Tests
 *
 * Provides assertion helpers and verification functions
 * for validating pipeline outputs and document traceability.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TestEnvironment } from './test-environment.js';
import type { PipelineResult } from './pipeline-runner.js';

/**
 * Document verification result
 */
export interface DocumentVerification {
  exists: boolean;
  hasContent: boolean;
  contentLength: number;
  hasMetadata: boolean;
  hasTraceability: boolean;
}

/**
 * Traceability verification result
 */
export interface TraceabilityVerification {
  prdToSrs: boolean;
  srsToSds: boolean;
  sdsToIssues: boolean;
  fullChain: boolean;
  brokenLinks: string[];
}

/**
 * Pipeline verification result
 */
export interface PipelineVerification {
  allStagesCompleted: boolean;
  documentsGenerated: {
    collectedInfo: boolean;
    prd: boolean;
    srs: boolean;
    sds: boolean;
  };
  issuesGenerated: boolean;
  issueCount: number;
  traceability: TraceabilityVerification;
  timingWithinBounds: boolean;
}

/**
 * Verify that a document exists and has expected structure
 */
export function verifyDocument(
  env: TestEnvironment,
  projectId: string,
  docType: 'collected-info' | 'prd' | 'srs' | 'sds'
): DocumentVerification {
  let filePath: string;

  if (docType === 'collected-info') {
    filePath = path.join(env.scratchpadPath, 'info', projectId, 'collected_info.yaml');
  } else {
    filePath = path.join(env.scratchpadPath, 'documents', projectId, `${docType}.md`);
  }

  const exists = fs.existsSync(filePath);

  if (!exists) {
    return {
      exists: false,
      hasContent: false,
      contentLength: 0,
      hasMetadata: false,
      hasTraceability: false,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const contentLength = content.length;
  const hasContent = contentLength > 0;

  // Check for metadata indicators
  const hasMetadata =
    docType === 'collected-info'
      ? content.includes('projectId:') && content.includes('schemaVersion:')
      : content.includes('Document ID') || content.includes('documentId');

  // Check for traceability indicators
  const hasTraceability =
    content.includes('Traceability') ||
    content.includes('Source PRD') ||
    content.includes('Source SRS') ||
    content.includes('References');

  return {
    exists,
    hasContent,
    contentLength,
    hasMetadata,
    hasTraceability,
  };
}

/**
 * Verify traceability links between documents
 */
export function verifyTraceability(
  env: TestEnvironment,
  projectId: string
): TraceabilityVerification {
  const brokenLinks: string[] = [];

  // Check PRD to SRS traceability
  const srsPath = path.join(env.scratchpadPath, 'documents', projectId, 'srs.md');
  let prdToSrs = false;
  if (fs.existsSync(srsPath)) {
    const srsContent = fs.readFileSync(srsPath, 'utf-8');
    prdToSrs = srsContent.includes(`PRD-${projectId}`) || srsContent.includes('Source PRD');
    if (!prdToSrs) {
      brokenLinks.push('SRS does not reference PRD');
    }
  } else {
    brokenLinks.push('SRS file not found');
  }

  // Check SRS to SDS traceability
  const sdsPath = path.join(env.scratchpadPath, 'documents', projectId, 'sds.md');
  let srsToSds = false;
  if (fs.existsSync(sdsPath)) {
    const sdsContent = fs.readFileSync(sdsPath, 'utf-8');
    srsToSds = sdsContent.includes(`SRS-${projectId}`) || sdsContent.includes('Source SRS');
    if (!srsToSds) {
      brokenLinks.push('SDS does not reference SRS');
    }
  } else {
    brokenLinks.push('SDS file not found');
  }

  // Check SDS to Issues traceability
  const issuesPath = path.join(env.scratchpadPath, 'issues', projectId, 'issue_list.json');
  let sdsToIssues = false;
  if (fs.existsSync(issuesPath)) {
    const issuesContent = fs.readFileSync(issuesPath, 'utf-8');
    // Issues should reference components from SDS
    sdsToIssues = issuesContent.includes('sourceComponent') || issuesContent.includes('CMP-');
    if (!sdsToIssues) {
      brokenLinks.push('Issues do not reference SDS components');
    }
  }

  const fullChain = prdToSrs && srsToSds && sdsToIssues;

  return {
    prdToSrs,
    srsToSds,
    sdsToIssues,
    fullChain,
    brokenLinks,
  };
}

/**
 * Verify complete pipeline execution
 */
export function verifyPipeline(
  env: TestEnvironment,
  result: PipelineResult,
  expectedTimingMs?: number
): PipelineVerification {
  const projectId = result.projectId;

  // Verify documents generated
  const collectedInfo = verifyDocument(env, projectId, 'collected-info');
  const prd = verifyDocument(env, projectId, 'prd');
  const srs = verifyDocument(env, projectId, 'srs');
  const sds = verifyDocument(env, projectId, 'sds');

  // Verify issues
  const issuesPath = path.join(env.scratchpadPath, 'issues', projectId, 'issue_list.json');
  const issuesGenerated = fs.existsSync(issuesPath);
  let issueCount = 0;
  if (issuesGenerated) {
    const issuesContent = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    issueCount = Array.isArray(issuesContent) ? issuesContent.length : 0;
  }

  // Verify traceability
  const traceability = verifyTraceability(env, projectId);

  // Check timing
  const timingWithinBounds = expectedTimingMs ? result.totalTimeMs <= expectedTimingMs : true;

  return {
    allStagesCompleted: result.success,
    documentsGenerated: {
      collectedInfo: collectedInfo.exists && collectedInfo.hasContent,
      prd: prd.exists && prd.hasContent,
      srs: srs.exists && srs.hasContent,
      sds: sds.exists && sds.hasContent,
    },
    issuesGenerated,
    issueCount,
    traceability,
    timingWithinBounds,
  };
}

/**
 * Verify issue dependencies are valid
 */
export function verifyIssueDependencies(
  env: TestEnvironment,
  projectId: string
): { valid: boolean; errors: string[] } {
  const issuesPath = path.join(env.scratchpadPath, 'issues', projectId, 'issue_list.json');

  if (!fs.existsSync(issuesPath)) {
    return { valid: false, errors: ['Issue list not found'] };
  }

  const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf-8')) as Array<{
    issueId: string;
    dependencies?: { blockedBy?: string[] };
  }>;

  const issueIds = new Set(issues.map((i) => i.issueId));
  const errors: string[] = [];

  for (const issue of issues) {
    const blockedBy = issue.dependencies?.blockedBy ?? [];
    for (const dep of blockedBy) {
      if (!issueIds.has(dep)) {
        errors.push(`Issue ${issue.issueId} depends on non-existent issue ${dep}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Count requirements at each stage
 */
export function countRequirements(
  env: TestEnvironment,
  projectId: string
): {
  collected: number;
  prdFunctional: number;
  srsFeatures: number;
  sdsComponents: number;
  issues: number;
} {
  const result = {
    collected: 0,
    prdFunctional: 0,
    srsFeatures: 0,
    sdsComponents: 0,
    issues: 0,
  };

  // Count from collected info
  const collectedPath = path.join(env.scratchpadPath, 'info', projectId, 'collected_info.yaml');
  if (fs.existsSync(collectedPath)) {
    const content = fs.readFileSync(collectedPath, 'utf-8');
    const matches = content.match(/- id: FR-/g);
    result.collected = matches?.length ?? 0;
  }

  // Count from PRD
  const prdPath = path.join(env.scratchpadPath, 'documents', projectId, 'prd.md');
  if (fs.existsSync(prdPath)) {
    const content = fs.readFileSync(prdPath, 'utf-8');
    const matches = content.match(/FR-\d+/g);
    result.prdFunctional = new Set(matches ?? []).size;
  }

  // Count from SRS
  const srsPath = path.join(env.scratchpadPath, 'documents', projectId, 'srs.md');
  if (fs.existsSync(srsPath)) {
    const content = fs.readFileSync(srsPath, 'utf-8');
    const matches = content.match(/SF-\d+/g);
    result.srsFeatures = new Set(matches ?? []).size;
  }

  // Count from SDS
  const sdsPath = path.join(env.scratchpadPath, 'documents', projectId, 'sds.md');
  if (fs.existsSync(sdsPath)) {
    const content = fs.readFileSync(sdsPath, 'utf-8');
    const matches = content.match(/CMP-\d+/g);
    result.sdsComponents = new Set(matches ?? []).size;
  }

  // Count issues
  const issuesPath = path.join(env.scratchpadPath, 'issues', projectId, 'issue_list.json');
  if (fs.existsSync(issuesPath)) {
    const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    result.issues = Array.isArray(issues) ? issues.length : 0;
  }

  return result;
}
