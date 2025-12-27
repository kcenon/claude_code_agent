/**
 * Architecture Generator module Zod schemas
 *
 * Validation schemas for SRS parsing and architecture generation.
 */

import { z } from 'zod';

/**
 * Schema version for compatibility tracking
 */
export const ARCHITECTURE_SCHEMA_VERSION = '1.0.0';

/**
 * Priority level schema
 */
export const PrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);

/**
 * Architecture pattern schema
 */
export const ArchitecturePatternSchema = z.enum([
  'hierarchical-multi-agent',
  'pipeline',
  'event-driven',
  'microservices',
  'layered',
  'hexagonal',
  'cqrs',
  'scratchpad',
]);

/**
 * Technology layer schema
 */
export const TechnologyLayerSchema = z.enum([
  'runtime',
  'framework',
  'database',
  'caching',
  'messaging',
  'monitoring',
  'testing',
  'build',
]);

/**
 * NFR category schema
 */
export const NFRCategorySchema = z.enum([
  'performance',
  'scalability',
  'reliability',
  'security',
  'maintainability',
  'usability',
  'availability',
]);

/**
 * Constraint type schema
 */
export const ConstraintTypeSchema = z.enum([
  'technical',
  'business',
  'regulatory',
  'resource',
  'timeline',
]);

/**
 * Diagram type schema
 */
export const DiagramTypeSchema = z.enum([
  'architecture-overview',
  'component-interaction',
  'deployment',
  'sequence',
  'data-flow',
]);

/**
 * SRS use case schema
 */
export const SRSUseCaseSchema = z.object({
  id: z.string().regex(/^UC-\d{3}$/),
  name: z.string().min(1),
  description: z.string(),
  actor: z.string().min(1),
  preconditions: z.array(z.string()),
  mainFlow: z.array(z.string()),
  alternativeFlows: z.array(z.string()),
  postconditions: z.array(z.string()),
});

/**
 * SRS feature schema
 */
export const SRSFeatureSchema = z.object({
  id: z.string().regex(/^SF-\d{3}$/),
  name: z.string().min(1),
  description: z.string(),
  priority: PrioritySchema,
  useCases: z.array(SRSUseCaseSchema),
  nfrs: z.array(z.string()),
});

/**
 * Non-functional requirement schema
 */
export const NonFunctionalRequirementSchema = z.object({
  id: z.string().regex(/^NFR-\d{3}$/),
  category: NFRCategorySchema,
  description: z.string().min(1),
  target: z.string().min(1),
  priority: PrioritySchema,
});

/**
 * Constraint schema
 */
export const ConstraintSchema = z.object({
  id: z.string().regex(/^CON-\d{3}$/),
  type: ConstraintTypeSchema,
  description: z.string().min(1),
  architectureImpact: z.string(),
});

/**
 * SRS metadata schema
 */
export const SRSMetadataSchema = z.object({
  documentId: z.string().regex(/^SRS-\w+$/),
  sourcePRD: z.string().regex(/^PRD-\w+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  status: z.string().min(1),
  productName: z.string().min(1),
});

/**
 * Parsed SRS document schema
 */
export const ParsedSRSSchema = z.object({
  metadata: SRSMetadataSchema,
  features: z.array(SRSFeatureSchema),
  nfrs: z.array(NonFunctionalRequirementSchema),
  constraints: z.array(ConstraintSchema),
  assumptions: z.array(z.string()),
});

/**
 * Pattern recommendation schema
 */
export const PatternRecommendationSchema = z.object({
  pattern: ArchitecturePatternSchema,
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  drawbacks: z.array(z.string()),
});

/**
 * Architectural concern schema
 */
export const ArchitecturalConcernSchema = z.object({
  category: NFRCategorySchema,
  description: z.string().min(1),
  mitigation: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
});

/**
 * Architecture analysis schema
 */
export const ArchitectureAnalysisSchema = z.object({
  primaryPattern: ArchitecturePatternSchema,
  supportingPatterns: z.array(ArchitecturePatternSchema),
  rationale: z.string().min(1),
  recommendations: z.array(PatternRecommendationSchema),
  concerns: z.array(ArchitecturalConcernSchema),
});

/**
 * Technology alternative schema
 */
export const TechnologyAlternativeSchema = z.object({
  name: z.string().min(1),
  reason: z.string().min(1),
});

/**
 * Technology layer entry schema
 */
export const TechnologyLayerEntrySchema = z.object({
  layer: TechnologyLayerSchema,
  technology: z.string().min(1),
  version: z.string().min(1),
  rationale: z.string().min(1),
  alternatives: z.array(TechnologyAlternativeSchema),
});

/**
 * Technology stack schema
 */
export const TechnologyStackSchema = z.object({
  layers: z.array(TechnologyLayerEntrySchema),
  rationale: z.string().min(1),
  compatibilityNotes: z.array(z.string()),
});

/**
 * Component connection schema
 */
export const ComponentConnectionSchema = z.object({
  targetId: z.string().min(1),
  label: z.string(),
  type: z.enum(['sync', 'async', 'event', 'data']),
});

/**
 * Diagram component schema
 */
export const DiagramComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  layer: z.string().min(1),
  type: z.enum(['service', 'controller', 'repository', 'utility', 'external']),
  connections: z.array(ComponentConnectionSchema),
});

/**
 * Mermaid diagram schema
 */
export const MermaidDiagramSchema = z.object({
  type: DiagramTypeSchema,
  title: z.string().min(1),
  code: z.string().min(1),
  description: z.string(),
});

/**
 * Directory entry schema (recursive)
 */
export interface DirectoryEntryType {
  name: string;
  type: 'directory' | 'file';
  description: string;
  children: DirectoryEntryType[];
}

export const DirectoryEntrySchema: z.ZodType<DirectoryEntryType> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    type: z.enum(['directory', 'file']),
    description: z.string(),
    children: z.array(DirectoryEntrySchema),
  })
);

/**
 * Directory structure schema
 */
export const DirectoryStructureSchema = z.object({
  root: z.string().min(1),
  entries: z.array(DirectoryEntrySchema),
  description: z.string(),
});

/**
 * Architecture metadata schema
 */
export const ArchitectureMetadataSchema = z.object({
  sourceSRS: z.string().min(1),
  generatedAt: z.string().datetime(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

/**
 * Complete architecture design schema
 */
export const ArchitectureDesignSchema = z.object({
  analysis: ArchitectureAnalysisSchema,
  technologyStack: TechnologyStackSchema,
  diagrams: z.array(MermaidDiagramSchema),
  directoryStructure: DirectoryStructureSchema,
  metadata: ArchitectureMetadataSchema,
});

/**
 * Architecture generator options schema
 */
export const ArchitectureGeneratorOptionsSchema = z.object({
  defaultPattern: ArchitecturePatternSchema.optional(),
  includeAlternatives: z.boolean().optional(),
  generateAllDiagrams: z.boolean().optional(),
  directoryTemplate: z.string().optional(),
  verbose: z.boolean().optional(),
});
