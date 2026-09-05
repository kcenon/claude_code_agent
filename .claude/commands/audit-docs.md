---
description: Audit generated documents for structure, links, and requirements traceability
argument-hint: '[--project-dir <dir>] [--output <dir>]'
---

1. From the intended project root, execute the installed packaged entry:
   `ad-sdlc audit-docs --project-dir .`. For another root, pass its concrete,
   quoted absolute directory as `--project-dir`.
2. The auditor reads generated documents in the root (`prd.md`, `srs.md`, etc.)
   or the latest numeric `.ad-sdlc/scratchpad/documents/<id>/` directory. It checks
   document frontmatter, sections, cross-references, requirement traceability,
   orphan features, Mermaid syntax patterns, and local links. It does not
   compare implementation code against documentation or scan arbitrary docs trees.
3. JSON and Markdown reports are written to `.ad-sdlc/audit/` under that project
   by default. `--output <dir>` is resolved relative to the project directory.
   Report the summary and paths. A nonzero exit signals errors or a failed audit
   invocation; finding no supported documents is an error.
4. Suggest correcting findings or regenerating affected documents. This offline
   command needs no API key, plugin, repository script, project npm script, or
   TypeScript development tool.
