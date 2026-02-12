/**
 * Custom error classes for the init module
 *
 * @packageDocumentation
 */

/**
 * Base error class for initialization errors
 */
export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitError';
    Object.setPrototypeOf(this, InitError.prototype);
  }
}

/**
 * Error thrown when prerequisite validation fails
 */
export class PrerequisiteError extends InitError {
  readonly failedChecks: readonly string[];

  constructor(failedChecks: readonly string[]) {
    const message = `Prerequisite validation failed: ${failedChecks.join(', ')}`;
    super(message);
    this.name = 'PrerequisiteError';
    this.failedChecks = failedChecks;
    Object.setPrototypeOf(this, PrerequisiteError.prototype);
  }
}

/**
 * Error thrown when project directory already exists
 */
export class ProjectExistsError extends InitError {
  readonly projectPath: string;

  constructor(projectPath: string) {
    super(`Project already exists at: ${projectPath}`);
    this.name = 'ProjectExistsError';
    this.projectPath = projectPath;
    Object.setPrototypeOf(this, ProjectExistsError.prototype);
  }
}

/**
 * Error thrown when a template file is not found
 */
export class TemplateNotFoundError extends InitError {
  readonly templateName: string;

  constructor(templateName: string) {
    super(`Template not found: ${templateName}`);
    this.name = 'TemplateNotFoundError';
    this.templateName = templateName;
    Object.setPrototypeOf(this, TemplateNotFoundError.prototype);
  }
}

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends InitError {
  readonly path: string;
  readonly operation: string;

  constructor(path: string, operation: string, cause?: Error) {
    super(`File system error during ${operation} at ${path}: ${cause?.message ?? 'unknown error'}`);
    this.name = 'FileSystemError';
    this.path = path;
    this.operation = operation;
    if (cause) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * Error thrown when GitHub operations fail
 */
export class GitHubError extends InitError {
  readonly operation: string;

  constructor(operation: string, cause?: Error) {
    super(`GitHub operation failed: ${operation} - ${cause?.message ?? 'unknown error'}`);
    this.name = 'GitHubError';
    this.operation = operation;
    if (cause) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, GitHubError.prototype);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends InitError {
  readonly configKey: string;

  constructor(configKey: string, reason: string) {
    super(`Invalid configuration for ${configKey}: ${reason}`);
    this.name = 'ConfigurationError';
    this.configKey = configKey;
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Error thrown when template version is incompatible
 */
export class TemplateVersionError extends InitError {
  readonly sourceVersion: string;
  readonly targetVersion: string;

  constructor(sourceVersion: string, targetVersion: string, reason: string) {
    super(`Template version incompatible: ${sourceVersion} -> ${targetVersion}: ${reason}`);
    this.name = 'TemplateVersionError';
    this.sourceVersion = sourceVersion;
    this.targetVersion = targetVersion;
    Object.setPrototypeOf(this, TemplateVersionError.prototype);
  }
}

/**
 * Error thrown when template migration fails
 */
export class TemplateMigrationError extends InitError {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly step: string;

  constructor(fromVersion: string, toVersion: string, step: string, cause?: Error) {
    super(
      `Template migration failed at step "${step}" (${fromVersion} -> ${toVersion}): ` +
        (cause?.message ?? 'unknown error')
    );
    this.name = 'TemplateMigrationError';
    this.fromVersion = fromVersion;
    this.toVersion = toVersion;
    this.step = step;
    if (cause) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, TemplateMigrationError.prototype);
  }
}
