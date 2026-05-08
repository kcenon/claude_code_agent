---
description: Run the documentation audit script
---

Run the AD-SDLC documentation audit to detect documentation-code drift,
broken anchors, and stale cross-references.

Steps:

1. From the project root, execute `npm run audit:docs`.
2. The script (`scripts/audit-docs.ts`) walks the `docs/` tree and any
   markdown files referenced by `doc-sync-points.yaml`.
3. Report the printed summary back to the user. Non-zero exit means at
   least one drift or broken-reference finding was raised.
4. If findings exist, suggest opening a follow-up issue or running the
   relevant analyze stage to regenerate stale documents.
