# PRD Writer Module

The PRD Writer module generates Product Requirements Documents (PRD) from collected information gathered by the Collector Agent.

## Overview

This module provides:
- **Gap Analysis**: Identifies missing information in collected data
- **Consistency Checking**: Validates requirement conflicts, duplicates, and priority balance
- **Quality Metrics**: Calculates completeness, consistency, and clarity scores
- **Template-based Generation**: Creates PRD using standardized templates
- **Template-less Generation**: Fallback generation without template files

## Architecture

```
PRDWriterAgent
    ├── GapAnalyzer              # Identifies missing information
    ├── ConsistencyChecker       # Validates requirements consistency
    ├── QualityMetricsCalculator # Calculates quality scores
    └── TemplateProcessor        # Handles PRD template processing
```

## Usage

### Basic Usage

```typescript
import { PRDWriterAgent } from './prd-writer';
import type { CollectedInfo } from './scratchpad';

// Create agent
const agent = new PRDWriterAgent({
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  publicDocsPath: 'docs/prd',
  failOnCriticalGaps: false,
});

// Generate PRD from project ID
const result = await agent.generateFromProject('001');

// Or generate directly from collected info
const collectedInfo: CollectedInfo = { /* ... */ };
const result = await agent.generateFromCollectedInfo(collectedInfo);
```

### Step-by-Step Usage

```typescript
// Start session
await agent.startSession('001');

// Analyze gaps
const gapAnalysis = agent.analyzeGaps();
console.log(`Found ${gapAnalysis.totalGaps} gaps`);
console.log(`Completeness score: ${gapAnalysis.completenessScore}`);

// Check consistency
const consistencyCheck = agent.checkConsistency();
console.log(`Is consistent: ${consistencyCheck.isConsistent}`);

// Calculate quality metrics
const qualityMetrics = agent.calculateQualityMetrics();
console.log(`Completeness: ${qualityMetrics.completeness}`);
console.log(`Consistency: ${qualityMetrics.consistency}`);
console.log(`Clarity: ${qualityMetrics.clarity}`);
console.log(`Overall: ${qualityMetrics.overall}`);

// Generate PRD
const generatedPRD = agent.generate();

// Finalize and save
const result = await agent.finalize();
```

### Singleton Access

```typescript
import { getPRDWriterAgent, resetPRDWriterAgent } from './prd-writer';

// Get or create singleton instance
const agent = getPRDWriterAgent({
  failOnCriticalGaps: true,
});

// Reset singleton (useful for testing)
resetPRDWriterAgent();
```

## Components

### GapAnalyzer

Analyzes collected information to identify missing or incomplete data.

```typescript
import { GapAnalyzer } from './prd-writer';

const analyzer = new GapAnalyzer({
  minFunctionalRequirements: 1,
  minAcceptanceCriteria: 1,
  requireUserStories: false,
  requireNFRMetrics: true,
});

const result = analyzer.analyze(collectedInfo);
// result.totalGaps
// result.criticalGaps
// result.majorGaps
// result.completenessScore
```

Gap severities:
- **critical**: Blocks PRD generation
- **major**: Should be addressed before finalizing
- **minor**: Nice to have but not blocking
- **info**: Informational only

### ConsistencyChecker

Validates requirements for conflicts and consistency issues.

```typescript
import { ConsistencyChecker } from './prd-writer';

const checker = new ConsistencyChecker({
  maxP0Percentage: 30,
  minLowPriorityPercentage: 20,
  checkBidirectionalDeps: true,
  duplicateSimilarityThreshold: 0.8,
});

const result = checker.check(collectedInfo);
// result.isConsistent
// result.issues
// result.priorityDistribution
// result.dependencyAnalysis
```

Detected issues:
- Duplicate requirements (by title/description similarity)
- Circular dependencies
- Missing bidirectional dependencies
- Conflicting requirements (performance vs security)
- Unbalanced priority distribution

### QualityMetricsCalculator

Calculates comprehensive quality metrics for the PRD, including completeness, consistency, and clarity scores.

```typescript
import { QualityMetricsCalculator } from './prd-writer';

const calculator = new QualityMetricsCalculator({
  completenessWeight: 0.4,
  consistencyWeight: 0.35,
  clarityWeight: 0.25,
  maxSentenceLength: 40,
  maxPassiveVoicePercentage: 30,
});

// Basic calculation
const metrics = calculator.calculate(collectedInfo, gapAnalysis, consistencyCheck);
// metrics.completeness (0.0 - 1.0)
// metrics.consistency (0.0 - 1.0)
// metrics.clarity (0.0 - 1.0)
// metrics.overall (weighted average)

// Detailed calculation with clarity analysis
const detailed = calculator.calculateDetailed(collectedInfo, gapAnalysis, consistencyCheck);
// detailed.clarityAnalysis.issues (array of clarity issues)
// detailed.clarityAnalysis.averageSentenceLength
// detailed.clarityAnalysis.passiveVoicePercentage
// detailed.clarityAnalysis.ambiguousTermCount
```

Quality scores:
- **completeness**: Based on gap analysis (0.0 - 1.0)
- **consistency**: Based on consistency check issues (0.0 - 1.0)
- **clarity**: Based on text analysis (0.0 - 1.0)
- **overall**: Weighted average of all scores

Clarity analysis detects:
- Ambiguous terms (e.g., "some", "fast", "user-friendly", "etc")
- Long sentences (exceeding max length)
- Passive voice usage
- Vague references (e.g., "it is", "this should")

### TemplateProcessor

Processes PRD templates and generates content.

```typescript
import { TemplateProcessor } from './prd-writer';

const processor = new TemplateProcessor({
  templatePath: '.ad-sdlc/templates/prd-template.md',
  removeUnsubstituted: false,
});

// With template
const result = processor.process(collectedInfo, metadata);

// Without template (fallback)
const content = processor.generateWithoutTemplate(collectedInfo, metadata);
```

## Configuration

### PRDWriterAgentConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scratchpadBasePath` | string | `.ad-sdlc/scratchpad` | Base path for scratchpad files |
| `templatePath` | string | `.ad-sdlc/templates/prd-template.md` | Path to PRD template |
| `failOnCriticalGaps` | boolean | `false` | Throw error on critical gaps |
| `autoSuggestPriorities` | boolean | `true` | Auto-suggest requirement priorities |
| `publicDocsPath` | string | `docs/prd` | Output path for public PRD files |
| `includeGapAnalysis` | boolean | `true` | Include gap analysis in output |

## Error Handling

The module provides specific error classes:

```typescript
import {
  PRDWriterError,
  CollectedInfoNotFoundError,
  TemplateNotFoundError,
  CriticalGapsError,
  ConsistencyError,
  SessionStateError,
  GenerationError,
  FileWriteError,
} from './prd-writer';

try {
  await agent.generateFromProject('001');
} catch (error) {
  if (error instanceof CriticalGapsError) {
    console.log(`Critical gaps: ${error.gapDescriptions.join(', ')}`);
  }
}
```

## Output

### Generated PRD Structure

The generated PRD follows this structure:
1. Executive Summary
2. Problem Statement
3. Goals & Success Metrics
4. User Personas
5. Functional Requirements
6. Non-Functional Requirements
7. Constraints & Assumptions
8. Dependencies
9. Timeline & Milestones
10. Risks & Mitigations
11. Out of Scope
12. Appendix

### PRDGenerationResult

```typescript
interface PRDGenerationResult {
  success: boolean;
  projectId: string;
  scratchpadPath: string;
  publicPath: string;
  generatedPRD: GeneratedPRD;
  stats: PRDGenerationStats;
}
```

## Testing

Run tests with:
```bash
npm test -- --run tests/prd-writer/
```

Run with coverage:
```bash
npm test -- --run --coverage tests/prd-writer/
```

Module achieves >90% line coverage.
