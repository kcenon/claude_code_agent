/**
 * Data Design Generator
 *
 * Renders data design artifacts as markdown. Separates rendering concerns
 * from the data modeling logic in {@link DataDesigner}. Produces two
 * outputs from the same set of data models:
 *
 * 1. A full DBS (Database Schema Specification) document body for the
 *    standalone DBS-{projectId}.md file.
 * 2. A compact summary section for inline embedding in the SDS document,
 *    including a cross-reference link to the external DBS file.
 */

import type {
  DataModel,
  DataProperty,
  DataRelationship,
  ParsedSRS,
  ParsedSRSFeature,
} from './types.js';

/**
 * Supported language variants for generated content.
 */
export type DataDesignLanguage = 'en' | 'kr';

/**
 * Options for generating DBS content.
 */
export interface DataDesignGeneratorOptions {
  /** Language variant for the rendered output. Defaults to 'en'. */
  readonly language?: DataDesignLanguage;
}

/**
 * Input required to render a full DBS document body.
 */
export interface FullDBSInput {
  /** Project identifier used for document IDs and cross-references. */
  readonly projectId: string;
  /** Data models to render. */
  readonly models: readonly DataModel[];
  /** Parsed SRS providing feature list for traceability. */
  readonly srs: ParsedSRS;
}

/**
 * Input required to render the SDS inline summary section.
 */
export interface SummaryInput {
  /** Project identifier used to build the cross-reference link. */
  readonly projectId: string;
  /** Data models (only count and top-level names are used). */
  readonly models: readonly DataModel[];
}

/**
 * Renders data design content for both the standalone DBS document and
 * the inline SDS summary section.
 */
export class DataDesignGenerator {
  private readonly language: DataDesignLanguage;

  constructor(options: DataDesignGeneratorOptions = {}) {
    this.language = options.language ?? 'en';
  }

  /**
   * Determine whether a DBS document should be produced.
   * @param models - Candidate data models
   * @returns True if any data requirements exist, false otherwise
   */
  public isApplicable(models: readonly DataModel[]): boolean {
    return models.length > 0;
  }

  /**
   * Generate the full DBS document body (without frontmatter).
   *
   * The caller is responsible for prepending YAML frontmatter via
   * `prependFrontmatter()` from `utilities/frontmatter`.
   *
   * @param input - Full DBS generation input
   * @returns Markdown body for the DBS document
   */
  public generateFullContent(input: FullDBSInput): string {
    const { projectId, models, srs } = input;
    const lines: string[] = [];
    const t = this.language === 'kr' ? KR : EN;

    // Title and metadata
    lines.push(`# ${t.title}: ${srs.productName}`);
    lines.push('');
    lines.push(`| **${t.documentId}** | **${t.sourceSRS}** | **${t.version}** |`);
    lines.push('|-----------------|----------------|-------------|');
    lines.push(`| DBS-${projectId} | ${srs.metadata.documentId} | 1.0.0 |`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 1. Overview
    lines.push(`## 1. ${t.overview}`);
    lines.push('');
    lines.push(t.overviewIntro(models.length));
    lines.push('');
    lines.push(`- **${t.modelCount}:** ${String(models.length)}`);
    lines.push(`- **${t.sourceSRS}:** ${srs.metadata.documentId}`);
    lines.push(`- **${t.sourcePRD}:** ${srs.metadata.sourcePRD}`);
    lines.push('');

    // 2. Full ERD (Mermaid)
    lines.push(`## 2. ${t.erd}`);
    lines.push('');
    lines.push(t.erdIntro);
    lines.push('');
    lines.push('```mermaid');
    lines.push(...this.buildMermaidERD(models));
    lines.push('```');
    lines.push('');

    // 3. Table Definitions
    lines.push(`## 3. ${t.tableDefinitions}`);
    lines.push('');
    for (const model of models) {
      lines.push(...this.renderTableDefinition(model, t));
    }

    // 4. Data Access Patterns
    lines.push(`## 4. ${t.accessPatterns}`);
    lines.push('');
    lines.push(t.accessPatternsIntro);
    lines.push('');
    lines.push(...this.renderAccessPatterns(models, t));

    // 5. Migration Strategy
    lines.push(`## 5. ${t.migration}`);
    lines.push('');
    lines.push(...t.migrationBody);
    lines.push('');

    // 6. SRS Traceability
    lines.push(`## 6. ${t.traceability}`);
    lines.push('');
    lines.push(t.traceabilityIntro);
    lines.push('');
    lines.push(...this.renderTraceability(models, srs.features, t));

    return lines.join('\n');
  }

  /**
   * Generate the inline summary section (SDS Section 4 body).
   *
   * When no data requirements exist, returns a short "not applicable"
   * note. Otherwise returns a compact summary with a cross-reference
   * link to the standalone DBS document.
   *
   * @param input - Summary input
   * @returns Markdown snippet (no heading; the caller provides "## 4. Data Design")
   */
  public generateSummarySection(input: SummaryInput): string {
    const { projectId, models } = input;
    const t = this.language === 'kr' ? KR : EN;
    const lines: string[] = [];

    if (models.length === 0) {
      lines.push(t.notApplicable);
      lines.push('');
      return lines.join('\n');
    }

    lines.push(t.summaryIntro(models.length));
    lines.push('');
    lines.push(`| ${t.model} | ${t.category} | ${t.propertyCount} |`);
    lines.push('|-------|----------|------------|');
    for (const model of models) {
      lines.push(`| ${model.name} | ${model.category} | ${String(model.properties.length)} |`);
    }
    lines.push('');
    lines.push(t.crossReference(projectId));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build Mermaid ERD lines from the data models.
   * @param models - Data models to represent as entities
   * @returns Array of Mermaid ER diagram lines (without fence markers)
   */
  private buildMermaidERD(models: readonly DataModel[]): string[] {
    const lines: string[] = ['erDiagram'];

    for (const model of models) {
      lines.push(`    ${this.sanitizeMermaidId(model.name)} {`);
      for (const prop of model.properties) {
        const typeLabel = this.sanitizeMermaidType(prop.type);
        const reqLabel = prop.required ? 'NOT_NULL' : 'NULLABLE';
        lines.push(`        ${typeLabel} ${prop.name} ${reqLabel}`);
      }
      lines.push('    }');
    }

    for (const model of models) {
      for (const rel of model.relationships) {
        const symbol = this.mermaidRelationSymbol(rel.type);
        lines.push(
          `    ${this.sanitizeMermaidId(model.name)} ${symbol} ${this.sanitizeMermaidId(rel.target)} : "${rel.foreignKey ?? rel.type}"`
        );
      }
    }

    return lines;
  }

  /**
   * Convert a relationship type to its Mermaid ER diagram symbol.
   * @param type - Relationship cardinality
   * @returns Mermaid relationship syntax
   */
  private mermaidRelationSymbol(type: DataRelationship['type']): string {
    switch (type) {
      case 'one-to-one':
        return '||--||';
      case 'one-to-many':
        return '||--o{';
      case 'many-to-many':
        return '}o--o{';
    }
  }

  /**
   * Sanitize an identifier for Mermaid ER diagrams.
   * @param name - Raw identifier
   * @returns Identifier safe for Mermaid syntax
   */
  private sanitizeMermaidId(name: string): string {
    return name.replace(/[^A-Za-z0-9_]/g, '_');
  }

  /**
   * Sanitize a type label for Mermaid ER diagrams.
   * @param type - Raw type string
   * @returns Type safe for Mermaid syntax
   */
  private sanitizeMermaidType(type: string): string {
    return type.replace(/[^A-Za-z0-9_]/g, '_');
  }

  /**
   * Render a complete table definition for a single data model, including
   * columns, indexes, and foreign-key constraints.
   * @param model - Data model to render
   * @param t - Localized labels
   * @returns Array of markdown lines
   */
  private renderTableDefinition(model: DataModel, t: Labels): string[] {
    const lines: string[] = [];
    const tableName = this.toTableName(model.name);

    lines.push(`### 3.${model.id} ${model.name} (\`${tableName}\`)`);
    lines.push('');
    lines.push(`**${t.category}:** ${model.category}`);
    lines.push('');
    lines.push(`**${t.description}:** ${model.description}`);
    lines.push('');
    lines.push(`**${t.sourceComponent}:** ${model.sourceComponent}`);
    lines.push('');

    // Columns
    lines.push(`**${t.columns}:**`);
    lines.push('');
    lines.push(
      `| ${t.column} | ${t.type} | ${t.nullable} | ${t.defaultValue} | ${t.description} |`
    );
    lines.push('|--------|------|----------|---------|-------------|');
    for (const prop of model.properties) {
      lines.push(
        `| ${prop.name} | ${prop.type} | ${prop.required ? 'NO' : 'YES'} | ${this.defaultValueFor(prop)} | ${prop.description ?? ''} |`
      );
    }
    lines.push('');

    // Indexes
    if (model.indexes && model.indexes.length > 0) {
      lines.push(`**${t.indexes}:**`);
      lines.push('');
      lines.push(`| ${t.indexName} | ${t.fields} | ${t.unique} |`);
      lines.push('|------------|--------|--------|');
      for (const idx of model.indexes) {
        lines.push(`| ${idx.name} | ${idx.fields.join(', ')} | ${idx.unique ? 'YES' : 'NO'} |`);
      }
      lines.push('');
    }

    // Foreign keys
    if (model.relationships.length > 0) {
      lines.push(`**${t.foreignKeys}:**`);
      lines.push('');
      for (const rel of model.relationships) {
        const fk = rel.foreignKey ?? '';
        lines.push(`- \`${fk}\` → \`${this.toTableName(rel.target)}\` (${rel.type})`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    return lines;
  }

  /**
   * Render data access pattern hints derived from property names and
   * indexes. Produces one bullet per model.
   * @param models - Data models to analyze
   * @param t - Localized labels
   * @returns Array of markdown lines
   */
  private renderAccessPatterns(models: readonly DataModel[], t: Labels): string[] {
    const lines: string[] = [];

    for (const model of models) {
      const indexedFields = new Set<string>();
      for (const idx of model.indexes ?? []) {
        for (const f of idx.fields) indexedFields.add(f);
      }

      lines.push(`- **${model.name}**: ${t.primaryLookup} \`id\``);
      if (indexedFields.size > 0) {
        const secondary = [...indexedFields].filter((f) => f !== 'id');
        if (secondary.length > 0) {
          lines.push(`  - ${t.secondaryLookup}: ${secondary.map((f) => `\`${f}\``).join(', ')}`);
        }
      }
    }

    lines.push('');
    return lines;
  }

  /**
   * Render the SRS-to-data-model traceability table.
   * @param models - Data models
   * @param features - Parsed SRS features
   * @param t - Localized labels
   * @returns Array of markdown lines
   */
  private renderTraceability(
    models: readonly DataModel[],
    features: readonly ParsedSRSFeature[],
    t: Labels
  ): string[] {
    const lines: string[] = [];
    lines.push(`| ${t.feature} | ${t.component} | ${t.model} |`);
    lines.push('|---------|-----------|-------|');

    const modelsByComponent = new Map<string, DataModel[]>();
    for (const m of models) {
      const list = modelsByComponent.get(m.sourceComponent) ?? [];
      list.push(m);
      modelsByComponent.set(m.sourceComponent, list);
    }

    // Build a feature-component-model view using component.sourceComponent
    // metadata that maps back via model.sourceComponent. Since features do
    // not directly reference components, we show all models under an
    // "unmapped" row and then feature rows listing covered models.
    const featureCoverage = new Map<string, DataModel[]>();
    for (const feature of features) {
      featureCoverage.set(feature.id, []);
    }
    for (const model of models) {
      // Best-effort: attribute each model to the first feature whose ID
      // prefix matches. When no match, leave under "unmapped".
      for (const feature of features) {
        if (model.sourceComponent.includes(feature.id)) {
          featureCoverage.get(feature.id)?.push(model);
          break;
        }
      }
    }

    for (const feature of features) {
      const covered = featureCoverage.get(feature.id) ?? [];
      if (covered.length === 0) {
        lines.push(`| ${feature.id}: ${feature.name} | — | — |`);
      } else {
        for (const model of covered) {
          lines.push(
            `| ${feature.id}: ${feature.name} | ${model.sourceComponent} | ${model.name} |`
          );
        }
      }
    }
    lines.push('');
    return lines;
  }

  /**
   * Convert a PascalCase or camelCase model name to a snake_case table name.
   * @param name - Model name
   * @returns Pluralized snake_case table name
   */
  private toTableName(name: string): string {
    const snake = name
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
    // Simple pluralization: append 's' if not already plural.
    return snake.endsWith('s') ? snake : `${snake}s`;
  }

  /**
   * Derive a default value for a column based on the property type and
   * required flag.
   * @param prop - Data property
   * @returns Default value string for the column definition
   */
  private defaultValueFor(prop: DataProperty): string {
    if (prop.name === 'createdAt' || prop.name === 'updatedAt') {
      return 'CURRENT_TIMESTAMP';
    }
    if (prop.name === 'id') {
      return 'gen_random_uuid()';
    }
    if (!prop.required) {
      return 'NULL';
    }
    return '—';
  }
}

// ============================================================================
// Localization labels
// ============================================================================

interface Labels {
  readonly title: string;
  readonly documentId: string;
  readonly sourceSRS: string;
  readonly sourcePRD: string;
  readonly version: string;
  readonly overview: string;
  readonly overviewIntro: (count: number) => string;
  readonly modelCount: string;
  readonly erd: string;
  readonly erdIntro: string;
  readonly tableDefinitions: string;
  readonly category: string;
  readonly description: string;
  readonly sourceComponent: string;
  readonly columns: string;
  readonly column: string;
  readonly type: string;
  readonly nullable: string;
  readonly defaultValue: string;
  readonly indexes: string;
  readonly indexName: string;
  readonly fields: string;
  readonly unique: string;
  readonly foreignKeys: string;
  readonly accessPatterns: string;
  readonly accessPatternsIntro: string;
  readonly primaryLookup: string;
  readonly secondaryLookup: string;
  readonly migration: string;
  readonly migrationBody: readonly string[];
  readonly traceability: string;
  readonly traceabilityIntro: string;
  readonly feature: string;
  readonly component: string;
  readonly model: string;
  readonly propertyCount: string;
  readonly summaryIntro: (count: number) => string;
  readonly crossReference: (projectId: string) => string;
  readonly notApplicable: string;
}

const EN: Labels = {
  title: 'Database Schema Specification',
  documentId: 'Document ID',
  sourceSRS: 'Source SRS',
  sourcePRD: 'Source PRD',
  version: 'Version',
  overview: 'Overview',
  overviewIntro: (count) =>
    `This Database Schema Specification (DBS) defines the persistent data model supporting the software requirements. It contains ${String(count)} data model(s) with full column definitions, indexes, relationships, and SRS traceability.`,
  modelCount: 'Data models',
  erd: 'Entity Relationship Diagram',
  erdIntro:
    'The following Mermaid ER diagram captures the full set of data entities and their relationships.',
  tableDefinitions: 'Table Definitions',
  category: 'Category',
  description: 'Description',
  sourceComponent: 'Source component',
  columns: 'Columns',
  column: 'Column',
  type: 'Type',
  nullable: 'Nullable',
  defaultValue: 'Default',
  indexes: 'Indexes',
  indexName: 'Index',
  fields: 'Fields',
  unique: 'Unique',
  foreignKeys: 'Foreign Keys',
  accessPatterns: 'Data Access Patterns',
  accessPatternsIntro:
    'Primary and secondary lookup paths derived from generated indexes. These patterns guide query design and caching strategy.',
  primaryLookup: 'primary lookup by',
  secondaryLookup: 'secondary lookup by',
  migration: 'Migration Strategy',
  migrationBody: [
    'Schema changes are rolled out via forward-only, numbered migration scripts.',
    'Each migration must provide an accompanying rollback plan or data backfill script.',
    'Destructive changes (column drops, type narrowing) require a deprecation window of at least one release.',
    'All migrations are verified in the staging environment before production deployment.',
  ],
  traceability: 'SRS Traceability',
  traceabilityIntro:
    'Mapping from SRS feature requirements to the data models that implement them.',
  feature: 'SRS Feature',
  component: 'Component',
  model: 'Data Model',
  propertyCount: 'Properties',
  summaryIntro: (count) =>
    `The persistent data layer consists of ${String(count)} data model(s). The full schema — including ERD, column-level definitions, indexes, foreign keys, and migration strategy — is maintained in the standalone Database Schema Specification (DBS).`,
  crossReference: (projectId) =>
    `> **Cross-reference:** See [DBS-${projectId}](../dbs/DBS-${projectId}.md) for the complete database schema specification.`,
  notApplicable:
    'Data design is not applicable to this project — no data requirements were identified in the SRS.',
};

const KR: Labels = {
  title: '데이터베이스 스키마 명세',
  documentId: '문서 ID',
  sourceSRS: '원본 SRS',
  sourcePRD: '원본 PRD',
  version: '버전',
  overview: '개요',
  overviewIntro: (count) =>
    `본 데이터베이스 스키마 명세(DBS)는 소프트웨어 요구사항을 지원하는 영속 데이터 모델을 정의합니다. 총 ${String(count)}개의 데이터 모델과 전체 컬럼 정의, 인덱스, 관계, SRS 추적성을 포함합니다.`,
  modelCount: '데이터 모델 수',
  erd: '엔티티 관계 다이어그램',
  erdIntro: '다음 Mermaid ER 다이어그램은 전체 데이터 엔티티와 관계를 나타냅니다.',
  tableDefinitions: '테이블 정의',
  category: '범주',
  description: '설명',
  sourceComponent: '원본 컴포넌트',
  columns: '컬럼',
  column: '컬럼',
  type: '자료형',
  nullable: 'Null 허용',
  defaultValue: '기본값',
  indexes: '인덱스',
  indexName: '인덱스',
  fields: '필드',
  unique: '고유',
  foreignKeys: '외래키',
  accessPatterns: '데이터 접근 패턴',
  accessPatternsIntro:
    '생성된 인덱스로부터 도출된 주요 및 보조 조회 경로입니다. 이 패턴들은 쿼리 설계와 캐싱 전략의 지침이 됩니다.',
  primaryLookup: '주요 조회 키',
  secondaryLookup: '보조 조회 키',
  migration: '마이그레이션 전략',
  migrationBody: [
    '스키마 변경은 순방향 전용, 번호가 매겨진 마이그레이션 스크립트로 배포됩니다.',
    '각 마이그레이션은 롤백 계획 또는 데이터 백필 스크립트를 함께 제공해야 합니다.',
    '파괴적 변경(컬럼 삭제, 타입 축소)은 최소 한 릴리스 이상의 지원 중단 기간이 필요합니다.',
    '모든 마이그레이션은 프로덕션 배포 전 스테이징 환경에서 검증됩니다.',
  ],
  traceability: 'SRS 추적성',
  traceabilityIntro: 'SRS 기능 요구사항과 이를 구현하는 데이터 모델 간의 매핑입니다.',
  feature: 'SRS 기능',
  component: '컴포넌트',
  model: '데이터 모델',
  propertyCount: '속성 수',
  summaryIntro: (count) =>
    `영속 데이터 계층은 ${String(count)}개의 데이터 모델로 구성됩니다. ERD, 컬럼 수준 정의, 인덱스, 외래키, 마이그레이션 전략을 포함한 전체 스키마는 독립 문서인 데이터베이스 스키마 명세(DBS)에 관리됩니다.`,
  crossReference: (projectId) =>
    `> **크로스레퍼런스:** 전체 데이터베이스 스키마 명세는 [DBS-${projectId}](../dbs/DBS-${projectId}.md) 문서를 참조하십시오.`,
  notApplicable:
    '본 프로젝트는 데이터 설계 대상이 아닙니다 — SRS에서 데이터 요구사항이 식별되지 않았습니다.',
};
