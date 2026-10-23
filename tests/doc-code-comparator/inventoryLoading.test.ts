/**
 * DocCodeComparatorAgent inventory loading: missing, unreadable, and invalid
 * inventory files (kcenon/claude_code_agent#973).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DocCodeComparatorAgent } from '../../src/doc-code-comparator/DocCodeComparatorAgent.js';
import {
  CodeInventoryNotFoundError,
  DocumentInventoryNotFoundError,
  InvalidInventoryError,
} from '../../src/doc-code-comparator/errors.js';

type InventoryLoader = {
  loadDocumentInventory(inventoryPath: string): Promise<unknown[]>;
  loadCodeInventory(inventoryPath: string): Promise<unknown[]>;
};

const cannotRemovePermissions = process.platform === 'win32' || process.getuid?.() === 0;

describe('DocCodeComparatorAgent inventory loading', () => {
  let dir: string;
  const agent = new DocCodeComparatorAgent() as unknown as InventoryLoader;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-code-inventory-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const loaders = [
    [
      'document',
      (file: string) => agent.loadDocumentInventory(file),
      DocumentInventoryNotFoundError,
      'current_state:\n  requirements:\n    functional:\n      - id: FR-001\n        title: Login\n',
      [{ id: 'FR-001', name: 'Login', description: '', type: 'requirement', sourceLocation: '' }],
    ],
    [
      'code',
      (file: string) => agent.loadCodeInventory(file),
      CodeInventoryNotFoundError,
      'code_inventory:\n  modules:\n    - name: auth\n      path: src/auth\n',
      [expect.objectContaining({ moduleName: 'auth' })],
    ],
  ] as const;

  describe.each(loaders)('%s inventory', (_kind, load, NotFoundError, yamlText, items) => {
    it('should load the items of a valid inventory', async () => {
      const file = path.join(dir, 'inventory.yaml');
      fs.writeFileSync(file, yamlText);

      expect(await load(file)).toEqual(items);
    });

    it('should report a missing inventory', async () => {
      const file = path.join(dir, 'missing.yaml');

      await expect(load(file)).rejects.toThrow(NotFoundError);
      await expect(load(file)).rejects.toMatchObject({ path: file });
    });

    it('should report an inventory below a regular file as missing', async () => {
      const file = path.join(dir, 'plain.txt');
      fs.writeFileSync(file, 'x');

      await expect(load(path.join(file, 'inventory.yaml'))).rejects.toThrow(NotFoundError);
    });

    it('should report a directory as an invalid inventory', async () => {
      const directory = path.join(dir, 'inventory.yaml');
      fs.mkdirSync(directory);

      await expect(load(directory)).rejects.toThrow(InvalidInventoryError);
    });

    it('should report malformed YAML as an invalid inventory', async () => {
      const file = path.join(dir, 'inventory.yaml');
      fs.writeFileSync(file, 'key: [unclosed');

      await expect(load(file)).rejects.toThrow(InvalidInventoryError);
    });

    it.skipIf(cannotRemovePermissions)(
      'should report an unreadable inventory as invalid',
      async () => {
        const file = path.join(dir, 'inventory.yaml');
        fs.writeFileSync(file, yamlText);
        fs.chmodSync(file, 0o000);

        await expect(load(file)).rejects.toThrow(InvalidInventoryError);
      }
    );
  });
});
