# Scripts Directory

This directory contains utility scripts for the AD-SDLC system.

## Available Scripts

### init-project.sh

Initializes the project directory structure for a new AD-SDLC project.

**Usage:**

```bash
./scripts/init-project.sh [project_id]
```

**Examples:**

```bash
# Initialize with default project ID (001)
./scripts/init-project.sh

# Initialize with custom project ID
./scripts/init-project.sh my-project
./scripts/init-project.sh 002
```

**What it creates:**

- Scratchpad directories for the project
- Placeholder files (.gitkeep) for empty directories
- Project-specific subdirectories

### readme_lint.py

Checks `README.md` against the README policy shared by the kcenon repositories
(ported from `kcenon/common_system`). It reports:

- a missing title, or no `Status: active|maintenance|experimental` line after it within the first 20 lines
- no link labelled with the `package.json` version after the title within the first 20 lines; the link targets `package.json` or the release tag of that version
- promotional qualifiers such as "production-ready", "comprehensive", "robust", "seamless", or "100%"
- figures (speed-up factors, timings, rates, allocation counts, percentages, test pass counts) without an adjacent source marker, and measurement tables, which belong in benchmark documentation
- badges that are not this repository's GitHub Actions workflow badges, or whose workflow file does not exist
- more than 300 lines, or more than 1.0 qualifier/figure lines per 100 lines

A figure that must stay in README carries a marker on the same line or on an
adjacent blank line, pointing to a local Markdown section with the measurement
date and environment:

```markdown
<!-- source: docs/BENCHMARKS.md#recorded-run (2026-09-12, Ubuntu / GCC) -->
```

The script uses only the Python standard library and exits non-zero on any
finding. The Documentation Audit workflow (`.github/workflows/doc-audit.yml`)
runs its unit tests and the lint.

**Usage:**

```bash
python3 scripts/readme_lint.py README.md
python3 -m unittest discover -s scripts/tests -p 'test_readme_lint.py'
```

## Notes

- Scripts should be run from the project root directory
- The shell scripts use bash and require standard Unix tools
- Shell scripts follow the [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
