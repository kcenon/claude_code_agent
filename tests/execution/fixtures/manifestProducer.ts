/** Separate process terminates after publication, before scheduler/checkpoint persistence. */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ManifestOrchestrator, pipelineSdk } from './manifestPipeline.js';

const root = process.argv[2];
if (root === undefined) throw new Error('Missing fixture project');
const orchestrator = new ManifestOrchestrator(pipelineSdk());
const session = await orchestrator.startSession({
  projectDir: root,
  userRequest: 'offline crash boundary',
  overrideMode: 'import',
});
const output = await orchestrator.produceWithoutCheckpoint(session);
await writeFile(
  join(root, 'crash-boundary.json'),
  JSON.stringify({ sessionId: session.sessionId, output })
);
process.exit(0);
