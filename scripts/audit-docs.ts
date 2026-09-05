#!/usr/bin/env tsx
/** Compatible repository wrapper; implementation ships in the npm package. */
import { runAuditDocs } from '../src/doc-audit/cli.js';
process.exitCode = runAuditDocs(process.argv.slice(2));
