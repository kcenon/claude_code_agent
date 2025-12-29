# Collector Agent Module

The collector module gathers, parses, and structures information from various input sources (text, files, URLs) for downstream document generation agents.

## Overview

The module includes:

- **InputParser** - Parses text, files (.md, .txt, .json, .yaml, .pdf, .docx), and URLs
- **InformationExtractor** - Extracts requirements, constraints, assumptions, and dependencies
- **CollectorAgent** - Main orchestration class for the collection workflow

## Installation

The collector module is included in the main `ad-sdlc` package:

```typescript
import {
  CollectorAgent,
  InputParser,
  InformationExtractor,
} from 'ad-sdlc';
```

## CollectorAgent

Main class that orchestrates the information collection workflow.

### Basic Usage

```typescript
import { CollectorAgent, getCollectorAgent } from 'ad-sdlc';

// Using singleton
const collector = getCollectorAgent();

// Or create new instance
const collector = new CollectorAgent({
  confidenceThreshold: 0.7,
  maxQuestionsPerRound: 5,
  skipClarificationIfConfident: true,
});

// Quick collection from text
const result = await collector.collectFromText(
  'The system must support user authentication. Users should be able to reset passwords.',
  { projectName: 'AuthSystem', projectDescription: 'Authentication service' }
);

console.log(`Collected ${result.stats.functionalRequirements} requirements`);
console.log(`Output: ${result.outputPath}`);

// Quick collection from a single file
const fileResult = await collector.collectFromFile('requirements.md', {
  projectName: 'MyProject',
});

// Quick collection from multiple files
const multiResult = await collector.collectFromFiles(
  ['requirements.md', 'constraints.pdf', 'specs.docx'],
  { projectName: 'MultiSourceProject' }
);

console.log(`Processed ${multiResult.stats.sourcesProcessed} files`);
```

### Session-Based Collection

For more control over the collection process:

```typescript
// Start a new session
await collector.startSession('MyProject');

// Add text input
collector.addTextInput(`
  The system must:
  - Support user login with email/password
  - Allow password reset via email
  - Implement session management
`);

// Add file input
await collector.addFileInput('requirements.md');

// Add URL input
await collector.addUrlInput('https://example.com/specs');

// Process all inputs
const extraction = collector.processInputs();
console.log(`Extracted ${extraction.functionalRequirements.length} requirements`);

// Handle clarification questions
const questions = collector.getPendingQuestions();
for (const question of questions) {
  console.log(`Q: ${question.question}`);
  // In real usage, get answer from user
  collector.answerQuestion(question.id, 'User answer');
}

// Finalize and generate output
const result = await collector.finalize('MyProject', 'Project description');
console.log(`Output saved to: ${result.outputPath}`);
```

### Configuration

```typescript
const collector = new CollectorAgent({
  confidenceThreshold: 0.7,        // Min confidence to skip clarification
  maxQuestionsPerRound: 5,         // Max clarification questions at once
  skipClarificationIfConfident: true,  // Auto-skip if high confidence
  defaultPriority: 'P2',           // Default requirement priority
  detectLanguage: true,            // Enable language detection
  scratchpadBasePath: '.ad-sdlc/scratchpad',  // Output directory
});
```

## InputParser

Handles parsing of various input sources.

### Parse Text

```typescript
import { InputParser } from 'ad-sdlc';

const parser = new InputParser();

// Parse text
const source = parser.parseText('The system must work', 'User requirements');
console.log(source.content);  // 'The system must work'
console.log(source.type);     // 'text'
```

### Parse Files

```typescript
// Parse file (async) - supports .md, .txt, .json, .yaml, .pdf, .docx
const source = await parser.parseFile('requirements.md');

// Parse PDF with text extraction
const pdfSource = await parser.parseFile('specification.pdf');
console.log(pdfSource.content);  // Extracted text from PDF

// Parse DOCX with text extraction
const docxSource = await parser.parseFile('requirements.docx');
console.log(docxSource.content);  // Extracted text from Word document

// Parse file (sync) - NOTE: PDF and DOCX require async parsing
const result = parser.parseFileSync('config.json');
if (result.success) {
  console.log(result.content);
}

// Check supported extensions
InputParser.isExtensionSupported('.md');    // true
InputParser.isExtensionSupported('.pdf');   // true
InputParser.isExtensionSupported('.docx');  // true
InputParser.getSupportedExtensions();       // ['.md', '.txt', '.json', '.yaml', '.pdf', '.docx', ...]

// Check if file type requires async parsing
InputParser.requiresAsyncParsing('.pdf');   // true
InputParser.requiresAsyncParsing('.docx');  // true
InputParser.requiresAsyncParsing('.md');    // false
```

#### Supported File Types

| Extension | Type | Parsing Method | Notes |
|-----------|------|----------------|-------|
| `.md`, `.markdown` | Markdown | Sync/Async | Plain text extraction |
| `.txt`, `.text` | Text | Sync/Async | Plain text |
| `.json` | JSON | Sync/Async | Pretty-printed |
| `.yaml`, `.yml` | YAML | Sync/Async | Normalized format |
| `.pdf` | PDF | Async only | Text extraction via pdf-parse |
| `.docx` | Word | Async only | Text extraction via mammoth |

### Parse URLs

```typescript
// Fetch and parse URL content
const source = await parser.parseUrl('https://example.com/requirements');
console.log(source.title);    // Page title if available
console.log(source.content);  // Processed content
```

### Combine Inputs

```typescript
const source1 = parser.parseText('First requirement');
const source2 = parser.parseText('Second requirement');

const combined = parser.combineInputs([source1, source2]);
console.log(combined.wordCount);          // Total word count
console.log(combined.detectedLanguage);   // 'en' or 'ko'
```

## InformationExtractor

Analyzes text to extract structured information.

### Extract Information

```typescript
import { InformationExtractor, InputParser } from 'ad-sdlc';

const parser = new InputParser();
const extractor = new InformationExtractor();

const source = parser.parseText(`
  Project: TaskManager
  The system must support task creation.
  Users should be able to set due dates.
  Performance: Response time under 100ms.
  We assume users have modern browsers.
`);
const input = parser.combineInputs([source]);

const result = extractor.extract(input);

console.log(`Project: ${result.projectName}`);
console.log(`Functional requirements: ${result.functionalRequirements.length}`);
console.log(`Non-functional requirements: ${result.nonFunctionalRequirements.length}`);
console.log(`Assumptions: ${result.assumptions.length}`);
console.log(`Overall confidence: ${result.overallConfidence}`);
```

### Extracted Data Types

#### Requirements

```typescript
interface ExtractedRequirement {
  id: string;           // 'FR-001' or 'NFR-001'
  title: string;        // Short title
  description: string;  // Full description
  priority: Priority;   // 'P0' | 'P1' | 'P2' | 'P3'
  source: string;       // Source reference
  confidence: number;   // 0.0 - 1.0
  isFunctional: boolean;
  nfrCategory?: 'performance' | 'security' | 'scalability' | 'usability' | 'reliability' | 'maintainability';
  acceptanceCriteria?: string[];  // Extracted acceptance criteria
}
```

#### Acceptance Criteria Extraction

The extractor automatically detects acceptance criteria from:

- **Inline patterns**: "so that", "in order to", "which will/should"
- **Following segment patterns**: Given/When/Then, "verify that", "ensure that"
- **Explicit markers**: "acceptance criteria", "success criteria"

Example:

```typescript
const source = parser.parseText(`
  - Users must be able to login so that they can access their dashboard.
  - The system should support password reset.
    Given a user requests password reset
    When they provide a valid email
    Then they receive a reset link
`);

const result = extractor.extract(parser.combineInputs([source]));
// result.functionalRequirements[0].acceptanceCriteria contains:
// ["Expected outcome: they can access their dashboard"]
```

#### Constraints

```typescript
interface ExtractedConstraint {
  id: string;           // 'CON-001'
  description: string;
  reason?: string;
  type: 'technical' | 'business' | 'regulatory' | 'resource';
  source: string;
  confidence: number;
}
```

#### Assumptions

```typescript
interface ExtractedAssumption {
  id: string;           // 'ASM-001'
  description: string;
  riskIfWrong?: string;
  source: string;
  confidence: number;
}
```

### Configuration

```typescript
const extractor = new InformationExtractor({
  defaultPriority: 'P2',     // Default priority for unclassified requirements
  minConfidence: 0.3,        // Minimum confidence to include extractions
  maxQuestions: 5,           // Max clarification questions to generate (default: 5)
});
```

## Output Format

The collector generates a `collected_info.yaml` file in the scratchpad:

```yaml
schemaVersion: '1.0.0'
projectId: '001'
status: 'completed'
project:
  name: 'MyProject'
  description: 'Project description'
requirements:
  functional:
    - id: 'FR-001'
      title: 'User Authentication'
      description: 'The system must support user authentication'
      priority: 'P0'
      status: 'proposed'
      acceptanceCriteria: []
      dependencies: []
  nonFunctional:
    - id: 'NFR-001'
      category: 'performance'
      title: 'Response Time'
      description: 'Response time under 100ms'
      priority: 'P1'
constraints:
  - id: 'CON-001'
    description: 'Must use PostgreSQL'
    type: 'technical'
assumptions:
  - id: 'ASM-001'
    description: 'Users have modern browsers'
    validated: false
dependencies:
  - name: 'lodash'
    type: 'library'
    required: true
sources:
  - type: 'conversation'
    reference: 'User requirements'
    extractedAt: '2024-01-01T00:00:00.000Z'
createdAt: '2024-01-01T00:00:00.000Z'
updatedAt: '2024-01-01T00:00:00.000Z'
completedAt: '2024-01-01T00:00:00.000Z'
```

## Error Handling

```typescript
import {
  CollectorError,
  InputParseError,
  FileParseError,
  UrlFetchError,
  UnsupportedFileTypeError,
  SessionStateError,
  MissingInformationError,
} from 'ad-sdlc';

try {
  await collector.addFileInput('unknown.xyz');
} catch (error) {
  if (error instanceof UnsupportedFileTypeError) {
    console.log(`Supported types: ${error.supportedTypes.join(', ')}`);
  }
}

try {
  collector.addTextInput('text'); // Without session
} catch (error) {
  if (error instanceof SessionStateError) {
    console.log(`Current state: ${error.currentState}`);
    console.log(`Expected: ${error.expectedState}`);
  }
}
```

## Pipeline Integration

The Collector Agent is the entry point of the AD-SDLC Document Pipeline:

```
User Input → [Collector Agent] → collected_info.yaml → PRD Writer → SRS Writer → ...
```

The `collected_info.yaml` output is consumed by:

1. **PRD Writer Agent** - Generates Product Requirements Document
2. **SRS Writer Agent** - Generates Software Requirements Specification
3. **Analysis Pipeline** - Document-code gap analysis

## Related Modules

- [Issue Generator](./issue-generator.md) - Generates issues from SDS
- [Architecture Generator](./architecture-generator.md) - Generates architecture from SRS
- [State Manager](./state-manager.md) - Manages pipeline state
