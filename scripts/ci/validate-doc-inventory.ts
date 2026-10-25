#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateDocumentInventory } from '../../src/doc-code-comparator/DocInventoryValidator.js';
import { replaceVerificationCoverageBlock } from '../../src/stage-verifier/applicability.js';
import { replaceApprovalPolicyBlock } from '../../src/ad-sdlc-orchestrator/approvalMatrix.js';

const VERIFICATION_COVERAGE_DOC = join('docs', 'architecture', 'verification-coverage.md');
const APPROVAL_POLICY_DOC = join('docs', 'guides', 'approval-policy.md');

/**
 * Regenerate one generated block of a document.
 * @param root - Repository root
 * @param relativePath - Document path
 * @param replace - Block replacement for the document text
 */
function writeGeneratedBlock(
  root: string,
  relativePath: string,
  replace: (document: string) => string
): void {
  const path = join(root, relativePath);
  const document = readFileSync(path, 'utf8');
  const updated = replace(document);
  if (updated !== document) {
    writeFileSync(path, updated, 'utf8');
    process.stdout.write(`Updated ${relativePath}\n`);
  }
}

/**
 * Regenerate the verification coverage block from VERIFICATION_APPLICABILITY
 * and the approval policy matrix from the approval policy data.
 * @param root - Repository root
 */
function writeVerificationCoverage(root: string): void {
  writeGeneratedBlock(root, VERIFICATION_COVERAGE_DOC, replaceVerificationCoverageBlock);
  writeGeneratedBlock(root, APPROVAL_POLICY_DOC, replaceApprovalPolicyBlock);
}

function main(argv: readonly string[]): number {
  let root = process.cwd();
  let json = false;
  let write = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') {
      json = true;
    } else if (argument === '--write') {
      write = true;
    } else if (argument === '--root') {
      const value = argv[index + 1];
      if (value === undefined) throw new Error('--root requires a path');
      root = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${String(argument)}`);
    }
  }

  if (write) writeVerificationCoverage(root);
  const result = validateDocumentInventory(root);
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.pass) {
    process.stdout.write(
      `Documentation inventory validation passed: ${String(result.metrics.agentDefinitionFiles)} agent definitions, ${String(result.metrics.totalStageSlots)} stage slots, ${String(result.metrics.designComponents)} design components.\n`
    );
  } else {
    process.stderr.write(
      `Documentation inventory validation failed with ${String(result.violations.length)} violation(s):\n`
    );
    for (const violation of result.violations) {
      process.stderr.write(`  ${violation.path}: [${violation.code}] ${violation.message}\n`);
    }
  }

  return result.pass ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Documentation inventory validation failed: ${message}\n`);
  process.exitCode = 1;
}
