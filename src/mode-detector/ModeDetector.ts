/**
 * Mode Detector - Pipeline Mode Detection Logic
 *
 * Automatically determines whether to use the Greenfield or Enhancement
 * pipeline based on project state (existing documents, codebase, user input).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { randomUUID } from 'crypto';

import type {
  ModeDetectorConfig,
  ModeDetectionSession,
  ModeDetectionResult,
  DetectionEvidence,
  DocumentEvidence,
  CodebaseEvidence,
  KeywordEvidence,
  UserOverride,
  DetectionScores,
  PipelineMode,
  ConfidenceLevel,
  DetectionStats,
} from './types.js';

import { DEFAULT_MODE_DETECTOR_CONFIG } from './types.js';

import {
  ProjectNotFoundError,
  NoActiveSessionError,
  InvalidSessionStateError,
  OutputWriteError,
} from './errors.js';

/**
 * Mode Detector Agent
 *
 * Analyzes project state to determine the appropriate pipeline mode.
 */
export class ModeDetector {
  private readonly config: Required<ModeDetectorConfig>;
  private session: ModeDetectionSession | null = null;

  constructor(config: ModeDetectorConfig = {}) {
    this.config = {
      ...DEFAULT_MODE_DETECTOR_CONFIG,
      ...config,
      keywords: {
        ...DEFAULT_MODE_DETECTOR_CONFIG.keywords,
        ...config.keywords,
      },
      weights: {
        ...DEFAULT_MODE_DETECTOR_CONFIG.weights,
        ...config.weights,
      },
      thresholds: {
        ...DEFAULT_MODE_DETECTOR_CONFIG.thresholds,
        ...config.thresholds,
      },
    };
  }

  /**
   * Start a new detection session
   * @param projectId
   * @param rootPath
   * @param userInput
   */
  public startSession(
    projectId: string,
    rootPath: string,
    userInput: string = ''
  ): ModeDetectionSession {
    const now = new Date().toISOString();

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'detecting',
      rootPath,
      userInput,
      result: null,
      startedAt: now,
      updatedAt: now,
      errors: [],
    };

    return this.session;
  }

  /**
   * Get current session
   */
  public getSession(): ModeDetectionSession | null {
    return this.session;
  }

  /**
   * Detect pipeline mode for the current session
   * @param userOverrideMode
   */
  public detect(userOverrideMode?: PipelineMode): Promise<ModeDetectionResult> {
    try {
      const session = this.ensureSession();

      if (session.status !== 'detecting') {
        return Promise.reject(new InvalidSessionStateError(session.status, 'detecting'));
      }

      const startTime = Date.now();
      const stats: DetectionStats = {
        documentCheckTimeMs: 0,
        codebaseCheckTimeMs: 0,
        keywordAnalysisTimeMs: 0,
        totalTimeMs: 0,
      };

      // Validate project path exists
      if (!fs.existsSync(session.rootPath)) {
        throw new ProjectNotFoundError(session.rootPath);
      }

      // Collect evidence
      const docStart = Date.now();
      const documentEvidence = this.checkDocuments(session.rootPath);
      (stats as { documentCheckTimeMs: number }).documentCheckTimeMs = Date.now() - docStart;

      const codeStart = Date.now();
      const codebaseEvidence = this.checkCodebase(session.rootPath);
      (stats as { codebaseCheckTimeMs: number }).codebaseCheckTimeMs = Date.now() - codeStart;

      const keywordStart = Date.now();
      const keywordEvidence = this.analyzeKeywords(session.userInput);
      (stats as { keywordAnalysisTimeMs: number }).keywordAnalysisTimeMs =
        Date.now() - keywordStart;

      const userOverride: UserOverride = {
        specified: userOverrideMode !== undefined,
        mode: userOverrideMode,
      };

      const evidence: DetectionEvidence = {
        documents: documentEvidence,
        codebase: codebaseEvidence,
        keywords: keywordEvidence,
        userOverride,
      };

      // Calculate scores
      const scores = this.calculateScores(evidence);

      // Determine mode and confidence
      const { mode, confidence, confidenceLevel } = this.determineMode(evidence, scores);

      // Generate reasoning
      const reasoning = this.generateReasoning(evidence, scores, mode);

      // Generate recommendations
      const recommendations = this.generateRecommendations(evidence, mode);

      const result: ModeDetectionResult = {
        selectedMode: mode,
        confidence,
        confidenceLevel,
        evidence,
        scores,
        reasoning,
        recommendations,
      };

      // Update session
      this.session = {
        ...session,
        status: 'completed',
        result,
        updatedAt: new Date().toISOString(),
      };

      // Save result to scratchpad
      this.saveResult(session.rootPath, session.projectId, result);

      (stats as { totalTimeMs: number }).totalTimeMs = Date.now() - startTime;

      return Promise.resolve(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.session) {
        this.session = {
          ...this.session,
          status: 'failed',
          updatedAt: new Date().toISOString(),
          errors: [...this.session.errors, errorMessage],
        };
      }

      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Check for existing documentation
   * @param rootPath
   */
  private checkDocuments(rootPath: string): DocumentEvidence {
    const docsPath = path.join(rootPath, this.config.docsBasePath);

    const prdPath = path.join(docsPath, 'prd');
    const srsPath = path.join(docsPath, 'srs');
    const sdsPath = path.join(docsPath, 'sds');

    const prdExists = this.hasMarkdownFiles(prdPath);
    const srsExists = this.hasMarkdownFiles(srsPath);
    const sdsExists = this.hasMarkdownFiles(sdsPath);

    let totalCount = 0;
    if (prdExists) totalCount++;
    if (srsExists) totalCount++;
    if (sdsExists) totalCount++;

    return {
      prd: prdExists,
      srs: srsExists,
      sds: sdsExists,
      totalCount,
    };
  }

  /**
   * Check if directory has markdown files
   * @param dirPath
   */
  private hasMarkdownFiles(dirPath: string): boolean {
    if (!fs.existsSync(dirPath)) {
      return false;
    }

    try {
      const files = fs.readdirSync(dirPath);
      return files.some((file) => file.endsWith('.md'));
    } catch {
      return false;
    }
  }

  /**
   * Check for existing codebase
   * @param rootPath
   */
  private checkCodebase(rootPath: string): CodebaseEvidence {
    const sourcePatterns = ['src', 'lib', 'app', 'packages', 'modules'];
    const testPatterns = ['test', 'tests', '__tests__', 'spec'];
    const buildFiles = [
      'package.json',
      'build.gradle',
      'pom.xml',
      'CMakeLists.txt',
      'Makefile',
      'Cargo.toml',
      'go.mod',
      'setup.py',
      'pyproject.toml',
    ];

    let sourceFileCount = 0;
    let linesOfCode = 0;
    let hasTests = false;
    let hasBuildSystem = false;

    // Check for build system
    for (const buildFile of buildFiles) {
      if (fs.existsSync(path.join(rootPath, buildFile))) {
        hasBuildSystem = true;
        break;
      }
    }

    // Check for source directories
    for (const pattern of sourcePatterns) {
      const srcPath = path.join(rootPath, pattern);
      if (fs.existsSync(srcPath)) {
        const { files, lines } = this.countSourceFiles(srcPath);
        sourceFileCount += files;
        linesOfCode += lines;
      }
    }

    // Check for test directories
    for (const pattern of testPatterns) {
      const testPath = path.join(rootPath, pattern);
      if (fs.existsSync(testPath)) {
        const { files } = this.countSourceFiles(testPath);
        if (files > 0) {
          hasTests = true;
          break;
        }
      }
    }

    return {
      exists: sourceFileCount >= this.config.thresholds.minSourceFiles,
      sourceFileCount,
      linesOfCode,
      hasTests,
      hasBuildSystem,
    };
  }

  /**
   * Count source files and lines in a directory
   * @param dirPath
   */
  private countSourceFiles(dirPath: string): { files: number; lines: number } {
    const extensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.java',
      '.kt',
      '.go',
      '.rs',
      '.cpp',
      '.c',
      '.h',
      '.cs',
      '.rb',
      '.php',
      '.swift',
    ];

    let files = 0;
    let lines = 0;

    const scan = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip common non-source directories
          if (
            entry.isDirectory() &&
            !['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.venv'].includes(
              entry.name
            )
          ) {
            scan(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files++;
              try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                lines += content.split('\n').length;
              } catch {
                // Skip files that can't be read
              }
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };

    scan(dirPath);
    return { files, lines };
  }

  /**
   * Analyze user input for keywords
   * @param userInput
   */
  private analyzeKeywords(userInput: string): KeywordEvidence {
    const input = userInput.toLowerCase();
    const greenfieldKeywords: string[] = [];
    const enhancementKeywords: string[] = [];

    for (const keyword of this.config.keywords.greenfieldKeywords) {
      if (input.includes(keyword.toLowerCase())) {
        greenfieldKeywords.push(keyword);
      }
    }

    for (const keyword of this.config.keywords.enhancementKeywords) {
      if (input.includes(keyword.toLowerCase())) {
        enhancementKeywords.push(keyword);
      }
    }

    // Calculate signal strength (-1.0 to 1.0)
    // Negative = greenfield, Positive = enhancement
    const greenfieldScore = greenfieldKeywords.length;
    const enhancementScore = enhancementKeywords.length;
    const total = greenfieldScore + enhancementScore;

    let signalStrength = 0;
    if (total > 0) {
      signalStrength = (enhancementScore - greenfieldScore) / total;
    }

    return {
      greenfieldKeywords,
      enhancementKeywords,
      signalStrength,
    };
  }

  /**
   * Calculate detection scores
   * @param evidence
   */
  private calculateScores(evidence: DetectionEvidence): DetectionScores {
    // Document score (0.0 = no docs, 1.0 = all docs present)
    const documentScore = evidence.documents.totalCount / 3;

    // Codebase score (composite of multiple factors)
    let codebaseScore = 0;
    if (evidence.codebase.exists) {
      codebaseScore += 0.5;
    }
    if (evidence.codebase.linesOfCode >= this.config.thresholds.minLinesOfCode) {
      codebaseScore += 0.2;
    }
    if (evidence.codebase.hasTests) {
      codebaseScore += 0.15;
    }
    if (evidence.codebase.hasBuildSystem) {
      codebaseScore += 0.15;
    }

    // Keyword score (convert -1.0 to 1.0 range to 0.0 to 1.0)
    const keywordScore = (evidence.keywords.signalStrength + 1) / 2;

    // Calculate weighted final score
    const { documents, codebase, keywords } = this.config.weights;
    const totalWeight = documents + codebase + keywords;

    const finalScore =
      (documentScore * documents + codebaseScore * codebase + keywordScore * keywords) /
      totalWeight;

    return {
      documentScore,
      codebaseScore,
      keywordScore,
      finalScore,
    };
  }

  /**
   * Determine mode and confidence from evidence and scores
   * @param evidence
   * @param scores
   */
  private determineMode(
    evidence: DetectionEvidence,
    scores: DetectionScores
  ): { mode: PipelineMode; confidence: number; confidenceLevel: ConfidenceLevel } {
    // User override takes precedence
    if (evidence.userOverride.specified && evidence.userOverride.mode) {
      return {
        mode: evidence.userOverride.mode,
        confidence: 1.0,
        confidenceLevel: 'high',
      };
    }

    // Pure greenfield case (no docs, no code)
    if (!evidence.documents.totalCount && !evidence.codebase.exists) {
      return {
        mode: 'greenfield',
        confidence: 1.0,
        confidenceLevel: 'high',
      };
    }

    // Has existing docs - enhancement mode (even without code)
    if (evidence.documents.totalCount > 0) {
      const docConfidence = 0.7 + (evidence.documents.totalCount / 3) * 0.25;
      return {
        mode: 'enhancement',
        confidence: Math.min(1.0, docConfidence),
        confidenceLevel: docConfidence >= 0.8 ? 'high' : 'medium',
      };
    }

    // Has existing codebase - enhancement mode (even without docs)
    if (evidence.codebase.exists) {
      let codeConfidence = 0.6;
      if (evidence.codebase.hasTests) codeConfidence += 0.1;
      if (evidence.codebase.hasBuildSystem) codeConfidence += 0.1;
      if (evidence.codebase.linesOfCode >= this.config.thresholds.minLinesOfCode) {
        codeConfidence += 0.1;
      }
      return {
        mode: 'enhancement',
        confidence: Math.min(1.0, codeConfidence),
        confidenceLevel: codeConfidence >= 0.8 ? 'high' : 'medium',
      };
    }

    // Use score-based decision for edge cases
    const { enhancementThreshold, greenfieldThreshold } = this.config.thresholds;

    let mode: PipelineMode;
    let confidence: number;

    if (scores.finalScore >= enhancementThreshold) {
      mode = 'enhancement';
      // Confidence based on how far above threshold
      confidence =
        0.5 + ((scores.finalScore - enhancementThreshold) / (1 - enhancementThreshold)) * 0.5;
    } else if (scores.finalScore <= greenfieldThreshold) {
      mode = 'greenfield';
      // Confidence based on how far below threshold
      confidence = 0.5 + ((greenfieldThreshold - scores.finalScore) / greenfieldThreshold) * 0.5;
    } else {
      // In the uncertain zone - default to enhancement but with lower confidence
      mode = 'enhancement';
      confidence = 0.5;
    }

    // Clamp confidence
    confidence = Math.min(1.0, Math.max(0.0, confidence));

    // Determine confidence level
    let confidenceLevel: ConfidenceLevel;
    if (confidence >= 0.8) {
      confidenceLevel = 'high';
    } else if (confidence >= 0.5) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    return { mode, confidence, confidenceLevel };
  }

  /**
   * Generate human-readable reasoning
   * @param evidence
   * @param scores
   * @param mode
   */
  private generateReasoning(
    evidence: DetectionEvidence,
    scores: DetectionScores,
    mode: PipelineMode
  ): string {
    const reasons: string[] = [];

    // User override
    if (evidence.userOverride.specified) {
      return `User explicitly selected ${mode} mode.`;
    }

    // Document evidence
    if (evidence.documents.totalCount === 0) {
      reasons.push('No existing PRD/SRS/SDS documents found');
    } else {
      const docs: string[] = [];
      if (evidence.documents.prd) docs.push('PRD');
      if (evidence.documents.srs) docs.push('SRS');
      if (evidence.documents.sds) docs.push('SDS');
      reasons.push(`Found existing documents: ${docs.join(', ')}`);
    }

    // Codebase evidence
    if (evidence.codebase.exists) {
      reasons.push(
        `Found existing codebase with ${String(evidence.codebase.sourceFileCount)} source files ` +
          `(${String(evidence.codebase.linesOfCode)} lines of code)`
      );
      if (evidence.codebase.hasTests) {
        reasons.push('Test suite detected');
      }
      if (evidence.codebase.hasBuildSystem) {
        reasons.push('Build system detected');
      }
    } else {
      reasons.push('No substantial codebase found');
    }

    // Keyword evidence
    if (evidence.keywords.greenfieldKeywords.length > 0) {
      reasons.push(
        `Greenfield keywords detected: "${evidence.keywords.greenfieldKeywords.join('", "')}"`
      );
    }
    if (evidence.keywords.enhancementKeywords.length > 0) {
      reasons.push(
        `Enhancement keywords detected: "${evidence.keywords.enhancementKeywords.join('", "')}"`
      );
    }

    // Final decision
    const scorePercent = (scores.finalScore * 100).toFixed(1);
    reasons.push(`Final score: ${scorePercent}% → ${mode.toUpperCase()} mode selected`);

    return reasons.join('. ') + '.';
  }

  /**
   * Generate recommendations
   * @param evidence
   * @param mode
   */
  private generateRecommendations(evidence: DetectionEvidence, mode: PipelineMode): string[] {
    const recommendations: string[] = [];

    if (mode === 'greenfield') {
      recommendations.push('Starting fresh with full document generation (PRD → SRS → SDS)');
      if (evidence.codebase.sourceFileCount > 0) {
        recommendations.push(
          'Note: Some source files exist. Consider using enhancement mode if you want to preserve them.'
        );
      }
    } else {
      recommendations.push('Using enhancement pipeline for incremental updates');

      if (!evidence.documents.prd) {
        recommendations.push('Consider creating a PRD document to improve traceability');
      }
      if (!evidence.documents.srs) {
        recommendations.push('Consider creating an SRS document to formalize requirements');
      }
      if (!evidence.documents.sds) {
        recommendations.push('Consider creating an SDS document for technical specifications');
      }
      if (!evidence.codebase.hasTests) {
        recommendations.push('Consider adding tests to enable regression testing');
      }
    }

    return recommendations;
  }

  /**
   * Save detection result to scratchpad
   * @param rootPath
   * @param projectId
   * @param result
   */
  private saveResult(rootPath: string, projectId: string, result: ModeDetectionResult): void {
    const scratchpadPath = path.join(rootPath, this.config.scratchpadBasePath, 'mode_detection');

    try {
      // Ensure directory exists
      fs.mkdirSync(scratchpadPath, { recursive: true });

      // Write result
      const outputPath = path.join(scratchpadPath, `${projectId}_mode_detection_result.yaml`);
      const yamlContent = yaml.dump({
        detection_result: {
          selected_mode: result.selectedMode,
          confidence: result.confidence,
          confidence_level: result.confidenceLevel,
          evidence: {
            documents_found: {
              prd: result.evidence.documents.prd,
              srs: result.evidence.documents.srs,
              sds: result.evidence.documents.sds,
            },
            codebase_found: result.evidence.codebase.exists,
            source_file_count: result.evidence.codebase.sourceFileCount,
            lines_of_code: result.evidence.codebase.linesOfCode,
            has_tests: result.evidence.codebase.hasTests,
            has_build_system: result.evidence.codebase.hasBuildSystem,
            user_keywords: [
              ...result.evidence.keywords.greenfieldKeywords,
              ...result.evidence.keywords.enhancementKeywords,
            ],
            user_override: result.evidence.userOverride.specified,
          },
          scores: {
            document_score: result.scores.documentScore,
            codebase_score: result.scores.codebaseScore,
            keyword_score: result.scores.keywordScore,
            final_score: result.scores.finalScore,
          },
          reasoning: result.reasoning,
          recommendations: result.recommendations,
        },
      });

      fs.writeFileSync(outputPath, yamlContent, 'utf-8');
    } catch (error) {
      throw new OutputWriteError(
        scratchpadPath,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Ensure session exists
   */
  private ensureSession(): ModeDetectionSession {
    if (!this.session) {
      throw new NoActiveSessionError();
    }
    return this.session;
  }
}

// Singleton instance
let instance: ModeDetector | null = null;

/**
 * Get the singleton Mode Detector instance
 * @param config
 */
export function getModeDetector(config?: ModeDetectorConfig): ModeDetector {
  if (instance === null) {
    instance = new ModeDetector(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetModeDetector(): void {
  instance = null;
}
