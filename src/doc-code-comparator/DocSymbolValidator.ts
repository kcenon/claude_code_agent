/**
 * Conservative documentation-to-code symbol validation.
 *
 * The validator intentionally scans only a curated set of live API documents
 * plus the Decision section of accepted ADRs. Historical design material and
 * superseded ADRs are not treated as descriptions of the current API.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Node, Project, ScriptKind, ScriptTarget, SyntaxKind, type SourceFile } from 'ts-morph';

/** Configuration stored in docs/doc-symbols.json. */
export interface DocSymbolConfig {
  readonly liveApiDocuments: readonly string[];
  readonly excludedDocuments: readonly string[];
  readonly ignoredSymbols: readonly string[];
}

/** One unresolved symbol found in current documentation. */
export interface DocSymbolViolation {
  readonly document: string;
  readonly line: number;
  readonly symbol: string;
  readonly source: 'typescript-fence' | 'accepted-adr-decision';
}

/** Complete validation result. */
export interface DocSymbolValidationResult {
  readonly pass: boolean;
  readonly exportedSymbolCount: number;
  readonly documentsChecked: readonly string[];
  readonly symbolsChecked: number;
  readonly violations: readonly DocSymbolViolation[];
}

interface SymbolReference {
  readonly symbol: string;
  readonly line: number;
  readonly source: DocSymbolViolation['source'];
}

interface TypeScriptFence {
  readonly code: string;
  readonly startLine: number;
}

const TYPESCRIPT_FENCE = /^\s*```(?:ts|typescript)\s*$([\s\S]*?)^\s*```\s*$/gim;
const HISTORICAL_ESCAPE = /<!--\s*historical:\s*([^>]+?)\s*-->/gi;
const ADR_FILE = /^ADR-\d{4}-.+\.md$/;

/**
 * Validate current API references in Markdown against exported declarations in
 * src/. This is deliberately narrower than a prose linter: it validates
 * syntactic symbol references, not arbitrary capitalized words.
 */
export class DocSymbolValidator {
  private readonly projectRoot: string;
  private readonly config: DocSymbolConfig;
  private readonly ignoredSymbols: ReadonlySet<string>;

  public constructor(projectRoot: string, config: DocSymbolConfig) {
    this.projectRoot = resolve(projectRoot);
    this.config = config;
    this.ignoredSymbols = new Set(config.ignoredSymbols);
  }

  /**
   * Load and validate the JSON configuration file.
   * @param configPath - Absolute or working-directory-relative config path.
   * @returns The validated symbol-gate configuration.
   */
  public static loadConfig(configPath: string): DocSymbolConfig {
    const raw: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
    if (raw === null || typeof raw !== 'object') {
      throw new Error(`Invalid doc-symbol configuration: ${configPath}`);
    }

    const candidate = raw as Partial<DocSymbolConfig>;
    for (const key of ['liveApiDocuments', 'excludedDocuments', 'ignoredSymbols'] as const) {
      const value = candidate[key];
      if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
        throw new Error(`Invalid doc-symbol configuration field: ${key}`);
      }
    }

    return {
      liveApiDocuments: candidate.liveApiDocuments as readonly string[],
      excludedDocuments: candidate.excludedDocuments as readonly string[],
      ignoredSymbols: candidate.ignoredSymbols as readonly string[],
    };
  }

  /**
   * Run the configured validation.
   * @returns Export inventory, checked documents, and unresolved references.
   */
  public validate(): DocSymbolValidationResult {
    const exportedSymbols = this.collectExportedSymbols();
    const documents = this.resolveDocuments();
    const violations: DocSymbolViolation[] = [];
    let symbolsChecked = 0;

    for (const document of documents) {
      const absolutePath = join(this.projectRoot, document);
      const markdown = readFileSync(absolutePath, 'utf8');
      const historicalSymbols = this.extractHistoricalSymbols(markdown);
      const references = this.collectReferences(document, markdown);

      for (const reference of references) {
        if (this.shouldIgnore(reference.symbol, historicalSymbols)) continue;
        symbolsChecked += 1;
        if (!exportedSymbols.has(reference.symbol)) {
          violations.push({ document, ...reference });
        }
      }
    }

    violations.sort(
      (left, right) =>
        left.document.localeCompare(right.document) ||
        left.line - right.line ||
        left.symbol.localeCompare(right.symbol)
    );

    return {
      pass: violations.length === 0,
      exportedSymbolCount: exportedSymbols.size,
      documentsChecked: documents,
      symbolsChecked,
      violations,
    };
  }

  private collectExportedSymbols(): ReadonlySet<string> {
    const tsconfigPath = join(this.projectRoot, 'tsconfig.json');
    if (!existsSync(tsconfigPath)) {
      throw new Error(`Cannot find tsconfig.json under ${this.projectRoot}`);
    }

    const project = new Project({ tsConfigFilePath: tsconfigPath });
    const symbols = new Set<string>();

    for (const sourceFile of project.getSourceFiles()) {
      for (const name of sourceFile.getExportedDeclarations().keys()) {
        if (name !== 'default') symbols.add(name);
      }
    }

    return symbols;
  }

  private resolveDocuments(): readonly string[] {
    const excluded = new Set(this.config.excludedDocuments.map((path) => this.normalizePath(path)));
    const documents = new Set<string>();

    for (const configuredPath of this.config.liveApiDocuments) {
      const normalized = this.normalizePath(configuredPath);
      if (excluded.has(normalized)) continue;
      if (!existsSync(join(this.projectRoot, normalized))) {
        throw new Error(`Configured live API document does not exist: ${normalized}`);
      }
      documents.add(normalized);
    }

    const adrDirectory = join(this.projectRoot, 'docs', 'adr');
    if (existsSync(adrDirectory)) {
      for (const filename of readdirSync(adrDirectory)) {
        if (!ADR_FILE.test(filename)) continue;
        const document = this.normalizePath(join('docs', 'adr', filename));
        if (excluded.has(document)) continue;
        const markdown = readFileSync(join(this.projectRoot, document), 'utf8');
        if (this.isAcceptedAdr(markdown)) documents.add(document);
      }
    }

    return [...documents].sort();
  }

  private collectReferences(document: string, markdown: string): readonly SymbolReference[] {
    const references: SymbolReference[] = [];
    const acceptedAdr = document.startsWith('docs/adr/') && this.isAcceptedAdr(markdown);
    const decision = acceptedAdr ? this.extractAdrDecision(markdown) : null;

    for (const fence of this.extractTypeScriptFences(
      acceptedAdr && decision !== null ? decision.text : markdown
    )) {
      const offset = acceptedAdr && decision !== null ? decision.startLine - 1 : 0;
      references.push(
        ...this.collectTypeScriptReferences(fence.code, fence.startLine + offset).map((entry) => ({
          ...entry,
          source: acceptedAdr ? ('accepted-adr-decision' as const) : ('typescript-fence' as const),
        }))
      );
    }

    if (acceptedAdr && decision !== null) {
      references.push(...this.collectInlineDecisionReferences(decision.text, decision.startLine));
    }

    const deduplicated = new Map<string, SymbolReference>();
    for (const reference of references) {
      deduplicated.set(
        `${String(reference.line)}:${reference.symbol}:${reference.source}`,
        reference
      );
    }
    return [...deduplicated.values()];
  }

  private collectTypeScriptReferences(
    code: string,
    startLine: number
  ): readonly Omit<SymbolReference, 'source'>[] {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { target: ScriptTarget.ES2022 },
    });
    const sourceFile = project.createSourceFile('documentation-snippet.ts', code, {
      overwrite: true,
      scriptKind: ScriptKind.TS,
    });
    const localSymbols = this.collectLocalSymbols(sourceFile);
    const references: Array<Omit<SymbolReference, 'source'>> = [];

    const addReference = (symbol: string | undefined, line: number): void => {
      if (symbol === undefined || localSymbols.has(symbol)) return;
      references.push({ symbol, line: startLine + line - 1 });
    };

    for (const declaration of sourceFile.getImportDeclarations()) {
      const moduleName = declaration.getModuleSpecifierValue();
      const internal = this.isInternalModule(moduleName);

      const defaultImport = declaration.getDefaultImport();
      if (defaultImport !== undefined) {
        if (internal) addReference(defaultImport.getText(), defaultImport.getStartLineNumber());
        else localSymbols.add(defaultImport.getText());
      }

      const namespaceImport = declaration.getNamespaceImport();
      if (namespaceImport !== undefined) localSymbols.add(namespaceImport.getText());

      for (const namedImport of declaration.getNamedImports()) {
        const localName = namedImport.getAliasNode()?.getText() ?? namedImport.getName();
        if (internal) {
          addReference(namedImport.getName(), namedImport.getNameNode().getStartLineNumber());
        }
        localSymbols.add(localName);
      }
    }

    for (const expression of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      addReference(
        this.getRootIdentifier(expression.getExpression()),
        expression.getExpression().getStartLineNumber()
      );
    }

    for (const typeReference of sourceFile.getDescendantsOfKind(SyntaxKind.TypeReference)) {
      addReference(
        this.getRootIdentifier(typeReference.getTypeName()),
        typeReference.getTypeName().getStartLineNumber()
      );
    }

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expression = call.getExpression();
      const symbol = this.getRootIdentifier(expression);
      if (symbol !== undefined && /^[A-Z]/.test(symbol)) {
        addReference(symbol, expression.getStartLineNumber());
      }
    }

    return references;
  }

  private collectLocalSymbols(sourceFile: SourceFile): Set<string> {
    const symbols = new Set<string>();

    const addName = (name: string | undefined): void => {
      if (name !== undefined) symbols.add(name);
    };

    for (const declaration of sourceFile.getVariableDeclarations()) {
      for (const identifier of declaration
        .getNameNode()
        .getDescendantsOfKind(SyntaxKind.Identifier)) {
        addName(identifier.getText());
      }
      if (Node.isIdentifier(declaration.getNameNode())) addName(declaration.getName());
    }
    for (const declaration of sourceFile.getFunctions()) addName(declaration.getName());
    for (const declaration of sourceFile.getClasses()) addName(declaration.getName());
    for (const declaration of sourceFile.getInterfaces()) addName(declaration.getName());
    for (const declaration of sourceFile.getTypeAliases()) addName(declaration.getName());
    for (const declaration of sourceFile.getEnums()) addName(declaration.getName());
    for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.TypeParameter)) {
      addName(declaration.getName());
    }

    for (const parameter of sourceFile.getDescendantsOfKind(SyntaxKind.Parameter)) {
      for (const identifier of parameter
        .getNameNode()
        .getDescendantsOfKind(SyntaxKind.Identifier)) {
        addName(identifier.getText());
      }
      if (Node.isIdentifier(parameter.getNameNode())) addName(parameter.getName());
    }

    return symbols;
  }

  private collectInlineDecisionReferences(
    decision: string,
    startLine: number
  ): readonly SymbolReference[] {
    const withoutFences = decision.replace(TYPESCRIPT_FENCE, (match) =>
      '\n'.repeat(this.lineCount(match) - 1)
    );
    const references: SymbolReference[] = [];
    const inlineCode = /`([^`\r\n]+)`/g;
    let match: RegExpExecArray | null;

    while ((match = inlineCode.exec(withoutFences)) !== null) {
      const value = match[1]?.trim();
      if (
        value === undefined ||
        value.includes('/') ||
        value.includes(' ') ||
        value.includes(':')
      ) {
        continue;
      }

      const rawRoot = value.replace(/\(\)$/, '').split('.')[0];
      if (rawRoot === undefined) continue;
      const root = rawRoot.replace(/<.*>$/, '');
      const isAllCapsToken = /^[A-Z][A-Z0-9_]*$/.test(root);
      const isSymbol =
        (!isAllCapsToken && /^[A-Z_$][\w$]*$/.test(root)) ||
        (!isAllCapsToken && /\(\)$/.test(value));
      if (!isSymbol) continue;

      const line = startLine + this.lineCount(withoutFences.slice(0, match.index)) - 1;
      references.push({ symbol: root, line, source: 'accepted-adr-decision' });
    }

    return references;
  }

  private extractTypeScriptFences(markdown: string): readonly TypeScriptFence[] {
    const fences: TypeScriptFence[] = [];
    TYPESCRIPT_FENCE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = TYPESCRIPT_FENCE.exec(markdown)) !== null) {
      const code = match[1];
      if (code === undefined) continue;
      fences.push({
        code: code.replace(/^\r?\n/, ''),
        startLine: this.lineCount(markdown.slice(0, match.index)) + 1,
      });
    }

    return fences;
  }

  private extractHistoricalSymbols(markdown: string): ReadonlySet<string> {
    const symbols = new Set<string>();
    HISTORICAL_ESCAPE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = HISTORICAL_ESCAPE.exec(markdown)) !== null) {
      const payload = match[1] ?? '';
      for (const symbol of payload.match(/[A-Za-z_$][\w$]*/g) ?? []) symbols.add(symbol);
    }

    return symbols;
  }

  private extractAdrDecision(
    markdown: string
  ): { readonly text: string; readonly startLine: number } | null {
    const heading = /^## Decision\s*$/im.exec(markdown);
    if (heading === null) return null;
    const contentStart = heading.index + heading[0].length;
    const remainder = markdown.slice(contentStart);
    const nextHeading = /^## (?!#)/m.exec(remainder);
    const text = nextHeading === null ? remainder : remainder.slice(0, nextHeading.index);
    return { text, startLine: this.lineCount(markdown.slice(0, contentStart)) };
  }

  private isAcceptedAdr(markdown: string): boolean {
    const statusHeading = /^## Status\s*$/im.exec(markdown);
    if (statusHeading !== null) {
      const remainder = markdown.slice(statusHeading.index + statusHeading[0].length);
      const nextHeading = /^## (?!#)/m.exec(remainder);
      const status = nextHeading === null ? remainder : remainder.slice(0, nextHeading.index);
      return /\bAccepted\b/i.test(status) && !/\b(?:Superseded|Proposed|Rejected)\b/i.test(status);
    }

    const inlineStatus = /^\*\*Status\*\*:\s*([^\r\n]+)/im.exec(markdown)?.[1] ?? '';
    return (
      /\bAccepted\b/i.test(inlineStatus) &&
      !/\b(?:Superseded|Proposed|Rejected)\b/i.test(inlineStatus)
    );
  }

  private getRootIdentifier(node: Node): string | undefined {
    if (Node.isIdentifier(node)) return node.getText();
    if (Node.isPropertyAccessExpression(node)) return this.getRootIdentifier(node.getExpression());
    if (Node.isQualifiedName(node)) return this.getRootIdentifier(node.getLeft());
    return undefined;
  }

  private shouldIgnore(symbol: string, historicalSymbols: ReadonlySet<string>): boolean {
    return this.ignoredSymbols.has(symbol) || historicalSymbols.has(symbol);
  }

  private isInternalModule(moduleName: string): boolean {
    return (
      moduleName === 'ad-sdlc' ||
      moduleName.startsWith('ad-sdlc/') ||
      moduleName.startsWith('@ad-sdlc/') ||
      /^(?:\.\.\/)+src(?:\/|$)/.test(moduleName) ||
      moduleName.startsWith('./src/')
    );
  }

  private normalizePath(path: string): string {
    return relative(this.projectRoot, resolve(this.projectRoot, path)).replaceAll('\\', '/');
  }

  private lineCount(value: string): number {
    return value.split(/\r?\n/).length;
  }
}

/**
 * Convenience helper for callers that use the repository's default config.
 * @param projectRoot - Repository root to validate.
 * @param configPath - Optional symbol-gate config path.
 * @returns The documentation symbol validation result.
 */
export function validateDocumentSymbols(
  projectRoot: string,
  configPath: string = join(projectRoot, 'docs', 'doc-symbols.json')
): DocSymbolValidationResult {
  const config = DocSymbolValidator.loadConfig(resolve(configPath));
  return new DocSymbolValidator(projectRoot, config).validate();
}
