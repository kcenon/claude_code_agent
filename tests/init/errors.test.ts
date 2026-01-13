/**
 * Tests for init module error classes
 */

import { describe, expect, it } from 'vitest';

import {
  ConfigurationError,
  FileSystemError,
  GitHubError,
  InitError,
  PrerequisiteError,
  ProjectExistsError,
  TemplateMigrationError,
  TemplateNotFoundError,
  TemplateVersionError,
} from '../../src/init/errors.js';

describe('Init Errors', () => {
  describe('InitError', () => {
    it('should create with message', () => {
      const error = new InitError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('InitError');
    });

    it('should be instance of Error', () => {
      const error = new InitError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InitError);
    });
  });

  describe('PrerequisiteError', () => {
    it('should create with failed checks list', () => {
      const failedChecks = ['Node.js', 'Git'];
      const error = new PrerequisiteError(failedChecks);
      expect(error.message).toContain('Node.js');
      expect(error.message).toContain('Git');
      expect(error.failedChecks).toEqual(failedChecks);
      expect(error.name).toBe('PrerequisiteError');
    });

    it('should be instance of InitError', () => {
      const error = new PrerequisiteError(['check1']);
      expect(error).toBeInstanceOf(InitError);
      expect(error).toBeInstanceOf(PrerequisiteError);
    });
  });

  describe('ProjectExistsError', () => {
    it('should create with project path', () => {
      const path = '/path/to/project';
      const error = new ProjectExistsError(path);
      expect(error.message).toContain(path);
      expect(error.projectPath).toBe(path);
      expect(error.name).toBe('ProjectExistsError');
    });

    it('should be instance of InitError', () => {
      const error = new ProjectExistsError('/test');
      expect(error).toBeInstanceOf(InitError);
      expect(error).toBeInstanceOf(ProjectExistsError);
    });
  });

  describe('TemplateNotFoundError', () => {
    it('should create with template name', () => {
      const templateName = 'custom-template';
      const error = new TemplateNotFoundError(templateName);
      expect(error.message).toContain(templateName);
      expect(error.templateName).toBe(templateName);
      expect(error.name).toBe('TemplateNotFoundError');
    });

    it('should be instance of InitError', () => {
      const error = new TemplateNotFoundError('test');
      expect(error).toBeInstanceOf(InitError);
      expect(error).toBeInstanceOf(TemplateNotFoundError);
    });
  });

  describe('FileSystemError', () => {
    it('should create with path and operation', () => {
      const path = '/path/to/file';
      const operation = 'write';
      const error = new FileSystemError(path, operation);
      expect(error.message).toContain(path);
      expect(error.message).toContain(operation);
      expect(error.path).toBe(path);
      expect(error.operation).toBe(operation);
      expect(error.name).toBe('FileSystemError');
    });

    it('should include cause error message', () => {
      const cause = new Error('Permission denied');
      const error = new FileSystemError('/test', 'read', cause);
      expect(error.message).toContain('Permission denied');
      expect(error.cause).toBe(cause);
    });

    it('should be instance of InitError', () => {
      const error = new FileSystemError('/test', 'read');
      expect(error).toBeInstanceOf(InitError);
      expect(error).toBeInstanceOf(FileSystemError);
    });
  });

  describe('GitHubError', () => {
    it('should create with operation', () => {
      const operation = 'create issue';
      const error = new GitHubError(operation);
      expect(error.message).toContain(operation);
      expect(error.operation).toBe(operation);
      expect(error.name).toBe('GitHubError');
    });

    it('should include cause error message', () => {
      const cause = new Error('API rate limit');
      const error = new GitHubError('fetch', cause);
      expect(error.message).toContain('API rate limit');
      expect(error.cause).toBe(cause);
    });

    it('should be instance of InitError', () => {
      const error = new GitHubError('test');
      expect(error).toBeInstanceOf(InitError);
      expect(error).toBeInstanceOf(GitHubError);
    });
  });

  describe('ConfigurationError', () => {
    it('should create with config key and reason', () => {
      const configKey = 'template';
      const reason = 'invalid value';
      const error = new ConfigurationError(configKey, reason);
      expect(error.message).toContain(configKey);
      expect(error.message).toContain(reason);
      expect(error.configKey).toBe(configKey);
      expect(error.name).toBe('ConfigurationError');
    });

    it('should be instance of InitError', () => {
      const error = new ConfigurationError('key', 'reason');
      expect(error).toBeInstanceOf(InitError);
      expect(error).toBeInstanceOf(ConfigurationError);
    });
  });

  describe('TemplateVersionError', () => {
    it('should create with source and target versions', () => {
      const sourceVersion = '1.0.0';
      const targetVersion = '2.0.0';
      const reason = 'major version mismatch';
      const error = new TemplateVersionError(sourceVersion, targetVersion, reason);
      expect(error.message).toContain(sourceVersion);
      expect(error.message).toContain(targetVersion);
      expect(error.message).toContain(reason);
      expect(error.sourceVersion).toBe(sourceVersion);
      expect(error.targetVersion).toBe(targetVersion);
      expect(error.name).toBe('TemplateVersionError');
    });

    it('should be instance of InitError', () => {
      const error = new TemplateVersionError('1.0.0', '2.0.0', 'test');
      expect(error).toBeInstanceOf(InitError);
      expect(error).toBeInstanceOf(TemplateVersionError);
    });
  });

  describe('TemplateMigrationError', () => {
    it('should create with version and step info', () => {
      const fromVersion = '1.0.0';
      const toVersion = '1.1.0';
      const step = 'add-feature-x';
      const error = new TemplateMigrationError(fromVersion, toVersion, step);
      expect(error.message).toContain(fromVersion);
      expect(error.message).toContain(toVersion);
      expect(error.message).toContain(step);
      expect(error.fromVersion).toBe(fromVersion);
      expect(error.toVersion).toBe(toVersion);
      expect(error.step).toBe(step);
      expect(error.name).toBe('TemplateMigrationError');
    });

    it('should include cause error message', () => {
      const cause = new Error('Migration script failed');
      const error = new TemplateMigrationError('1.0.0', '1.1.0', 'step1', cause);
      expect(error.message).toContain('Migration script failed');
      expect(error.cause).toBe(cause);
    });

    it('should be instance of InitError', () => {
      const error = new TemplateMigrationError('1.0.0', '1.1.0', 'step');
      expect(error).toBeInstanceOf(InitError);
      expect(error).toBeInstanceOf(TemplateMigrationError);
    });
  });
});
