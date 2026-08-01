#!/usr/bin/env tsx

import { resolve } from 'node:path';
import { validateDocumentSymbols } from '../../src/doc-code-comparator/DocSymbolValidator.js';

interface CliOptions {
  readonly root: string;
  readonly config: string;
  readonly json: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let root = process.cwd();
  let config: string | undefined;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') {
      json = true;
    } else if (argument === '--root') {
      const value = argv[index + 1];
      if (value === undefined) throw new Error('--root requires a path');
      root = resolve(value);
      index += 1;
    } else if (argument === '--config') {
      const value = argv[index + 1];
      if (value === undefined) throw new Error('--config requires a path');
      config = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${String(argument)}`);
    }
  }

  return {
    root,
    config: config ?? resolve(root, 'docs', 'doc-symbols.json'),
    json,
  };
}

function main(argv: readonly string[]): number {
  const options = parseArgs(argv);
  const result = validateDocumentSymbols(options.root, options.config);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.pass) {
    process.stdout.write(
      `Documentation symbol validation passed: ${String(result.symbolsChecked)} references in ${String(result.documentsChecked.length)} documents checked against ${String(result.exportedSymbolCount)} exported symbols.\n`
    );
  } else {
    process.stderr.write(
      `Documentation symbol validation failed with ${String(result.violations.length)} unresolved reference(s):\n`
    );
    for (const violation of result.violations) {
      process.stderr.write(
        `  ${violation.document}:${String(violation.line)} ${violation.symbol} (${violation.source})\n`
      );
    }
  }

  return result.pass ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Documentation symbol validation failed: ${message}\n`);
  process.exitCode = 1;
}
