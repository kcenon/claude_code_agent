/** Deterministic source asset manifest generation and validation. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSET_PACKAGE_ROOT,
  ASSET_MANIFEST_PATH,
  generateAssetManifest,
  loadAssetBundle,
} from '../src/project-initializer/AgentAssets.js';

const manifestPath = join(ASSET_PACKAGE_ROOT, ASSET_MANIFEST_PATH);
if (process.argv.includes('--write')) {
  const versionIndex = process.argv.indexOf('--bundle-version');
  const version =
    versionIndex >= 0
      ? process.argv[versionIndex + 1]
      : (JSON.parse(readFileSync(manifestPath, 'utf8')) as { bundleVersion: string }).bundleVersion;
  if (version === undefined) throw new Error('--bundle-version requires a version');
  writeFileSync(
    manifestPath,
    `${JSON.stringify(generateAssetManifest(ASSET_PACKAGE_ROOT, version), null, 2)}\n`
  );
}
const bundle = loadAssetBundle();
process.stdout.write(
  `Validated ${bundle.assets.length} assets, bundle ${bundle.manifest.bundleVersion}, package ${bundle.packageVersion}\n`
);
