# Information Collection Directory

This directory stores information collected by the Collector Agent (CMP-001).

## Structure

```
info/{project_id}/
├── collected_info.yaml    # Structured requirements data
└── clarifications.json    # Q&A clarification history
```

## File Descriptions

### collected_info.yaml
Contains structured information extracted from:
- Natural language input
- Uploaded files (.md, .pdf, .docx)
- Web URLs
- Clarification responses

Schema:
```yaml
project_id: "001"
collected_at: "2025-12-27T10:00:00Z"
sources:
  - type: "natural_language"
    content: "..."
  - type: "file"
    path: "requirements.md"
    content: "..."
requirements:
  functional: []
  non_functional: []
constraints: []
```

### clarifications.json
Records the Q&A history during information collection:
```json
{
  "session_id": "sess-123",
  "clarifications": [
    {
      "question": "What is the target platform?",
      "answer": "Web and mobile",
      "timestamp": "2025-12-27T10:05:00Z"
    }
  ]
}
```

## Workflow

1. Collector Agent writes to this directory
2. PRD Writer Agent reads from this directory
3. Data is preserved for audit and reference

## Notes

Project directories are created automatically during collection.
