# Templates Directory

This directory contains document templates used by the document generation agents.

## Files

| Template | Used By | Description |
|----------|---------|-------------|
| `prd-template.md` | PRD Writer (CMP-002) | Product Requirements Document template |
| `srs-template.md` | SRS Writer (CMP-003) | Software Requirements Specification template |
| `sds-template.md` | SDS Writer (CMP-004) | Software Design Specification template |
| `issue-template.md` | Issue Generator (CMP-005) | GitHub Issue template |

## Template Structure

Each template includes:
- Standard sections for the document type
- Placeholder variables (e.g., `{project_name}`, `{version}`)
- Formatting guidelines
- Required and optional sections

## Usage

Templates are loaded by agents at runtime. The agent:
1. Reads the template from this directory
2. Fills in content based on input data
3. Writes the completed document to `scratchpad/documents/`

## Customization

Templates can be customized per project:
1. Edit the template files directly
2. Add project-specific sections
3. Modify formatting as needed

Changes take effect on the next document generation run.

## Notes

- Templates should follow Markdown best practices
- Include clear section headers and structure
- Use consistent terminology across templates
