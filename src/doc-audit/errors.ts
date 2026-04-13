/**
 * Doc Audit module error definitions.
 */

/**
 * Base error class for the doc-audit module.
 */
export class DocAuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocAuditError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the project directory does not exist or is not a directory.
 */
export class ProjectDirNotFoundError extends DocAuditError {
  public readonly projectDir: string;

  constructor(projectDir: string) {
    super(`Project directory not found or not a directory: ${projectDir}`);
    this.name = 'ProjectDirNotFoundError';
    this.projectDir = projectDir;
  }
}

/**
 * Thrown when no auditable documents are found in the project directory.
 */
export class NoDocumentsFoundError extends DocAuditError {
  public readonly projectDir: string;

  constructor(projectDir: string) {
    super(
      `No auditable documents found in project directory: ${projectDir}. ` +
        `Expected PRD/SRS/SDS/SDP/TM/SVP/TD/DBS markdown files.`
    );
    this.name = 'NoDocumentsFoundError';
    this.projectDir = projectDir;
  }
}

/**
 * Thrown when writing the audit report to disk fails.
 */
export class AuditReportWriteError extends DocAuditError {
  public readonly outputPath: string;

  constructor(outputPath: string, cause: string) {
    super(`Failed to write audit report to ${outputPath}: ${cause}`);
    this.name = 'AuditReportWriteError';
    this.outputPath = outputPath;
  }
}
