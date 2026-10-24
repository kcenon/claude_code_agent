#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateDocumentInventory } from '../../src/doc-code-comparator/DocInventoryValidator.js';
import { replaceVerificationCoverageBlock } from '../../src/stage-verifier/applicability.js';

const VERIFICATION_COVERAGE_DOC = join('docs', 'architecture', 'verification-coverage.md');

/**
 * Regenerate the verification coverage block from VERIFICATION_APPLICABILITY.
 * @param root - Repository root
 */
function writeVerificationCoverage(root: string): void {
  const path = join(root, VERIFICATION_COVERAGE_DOC);
  const document = readFileSync(path, 'utf8');
  const updated = replaceVerificationCoverageBlock(document);
  if (updated !== document) {
    writeFileSync(path, updated, 'utf8');
    process.stdout.write(`Updated ${VERIFICATION_COVERAGE_DOC}\n`);
  }
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
