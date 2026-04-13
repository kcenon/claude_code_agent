/**
 * LinkCheck — verifies that markdown links to local files resolve.
 *
 * Only links pointing at relative files on disk are validated. External
 * links (http/https/mailto), anchor-only links (`#section`), and links
 * containing template variables (`{var}`, `${var}`) are ignored because they
 * require tooling outside the scope of a local audit.
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { AuditCheck, AuditFinding, CheckResult, LoadedDocument } from '../types.js';

const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Returns `true` when the given link target should be skipped.
 * @param target
 */
function shouldSkip(target: string): boolean {
  if (target.startsWith('#')) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return true;
  if (target.includes('{') || target.includes('}')) return true;
  return false;
}

/**
 * Run the local-link validation across all documents.
 */
export class LinkCheck implements AuditCheck {
  public readonly name = 'link';

  /**
   *
   * @param documents
   */
  public run(documents: readonly LoadedDocument[]): CheckResult {
    const findings: AuditFinding[] = [];

    for (const doc of documents) {
      const docDir = dirname(doc.absolutePath);
      for (let i = 0; i < doc.lines.length; i++) {
        const line = doc.lines[i] ?? '';
        MARKDOWN_LINK.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = MARKDOWN_LINK.exec(line)) !== null) {
          const target = match[2] ?? '';
          if (shouldSkip(target)) continue;

          const targetWithoutAnchor = target.split('#')[0] ?? target;
          if (targetWithoutAnchor.length === 0) continue;

          const absolute = isAbsolute(targetWithoutAnchor)
            ? targetWithoutAnchor
            : resolve(docDir, targetWithoutAnchor);

          if (!existsSync(absolute)) {
            findings.push({
              id: 'link.broken',
              severity: 'warning',
              check: this.name,
              document: doc.relativePath,
              line: i + 1,
              message: `Broken markdown link: "${target}" (resolved to ${absolute}).`,
              suggestion:
                'Update the link target or remove it if the referenced file no longer exists.',
            });
          }
        }
      }
    }

    return { findings };
  }
}
