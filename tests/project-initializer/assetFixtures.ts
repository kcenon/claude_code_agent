import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ASSET_PACKAGE_ROOT,
  ASSET_MANIFEST_PATH,
  generateAssetManifest,
} from '../../src/project-initializer/AgentAssets.js';

export function write(root: string, file: string, content: string | Buffer): void {
  fs.mkdirSync(dirname(join(root, file)), { recursive: true });
  fs.writeFileSync(join(root, file), content);
}

export function copyBundle(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  for (const kind of ['agents', 'commands']) {
    fs.cpSync(join(ASSET_PACKAGE_ROOT, '.claude', kind), join(root, '.claude', kind), {
      recursive: true,
    });
  }
  for (const file of ['package.json', ASSET_MANIFEST_PATH])
    fs.copyFileSync(join(ASSET_PACKAGE_ROOT, file), join(root, file));
}

export function regenerate(root: string, version = '1.0.0'): void {
  write(
    root,
    ASSET_MANIFEST_PATH,
    JSON.stringify(generateAssetManifest(root, version), null, 2) + '\n'
  );
}

export function snapshot(root: string): Record<string, string> {
  if (!fs.existsSync(root)) return {};
  return Object.fromEntries(
    fs
      .readdirSync(root, { recursive: true, encoding: 'utf8' })
      .sort()
      .map((file) => {
        const path = join(root, file);
        const stat = fs.lstatSync(path);
        return [
          file,
          stat.isDirectory() ? '<directory>' : fs.readFileSync(path).toString('base64'),
        ];
      })
  );
}
