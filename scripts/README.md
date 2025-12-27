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

## Notes

- Scripts should be run from the project root directory
- All scripts use bash and require standard Unix tools
- Scripts follow the [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
