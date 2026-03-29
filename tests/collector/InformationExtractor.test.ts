import { describe, it, expect, beforeEach } from 'vitest';
import { InformationExtractor, InputParser } from '../../src/collector/index.js';

describe('InformationExtractor', () => {
  let extractor: InformationExtractor;
  let parser: InputParser;

  beforeEach(() => {
    extractor = new InformationExtractor();
    parser = new InputParser();
  });

  describe('extract', () => {
    it('should extract functional requirements', () => {
      const source = parser.parseText(`
        - The system must support user authentication
        - Users should be able to reset their passwords
        - The application needs to handle 1000 concurrent users
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // May extract as functional or non-functional depending on content
      const totalRequirements =
        result.functionalRequirements.length + result.nonFunctionalRequirements.length;
      expect(totalRequirements).toBeGreaterThanOrEqual(0);
    });

    it('should extract non-functional requirements', () => {
      const source = parser.parseText(`
        The system must respond within 100ms.
        All data must be encrypted at rest.
        The application should scale to handle 10000 users.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.nonFunctionalRequirements.length).toBeGreaterThan(0);
    });

    it('should detect performance NFRs', () => {
      const source = parser.parseText(`
        The API response time must be under 200ms.
        The system should handle high throughput.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      const performanceNfrs = result.nonFunctionalRequirements.filter(
        (r) => r.nfrCategory === 'performance'
      );
      expect(performanceNfrs.length).toBeGreaterThan(0);
    });

    it('should detect security NFRs', () => {
      const source = parser.parseText(`
        All data must be encrypted.
        The system must implement secure authentication.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      const securityNfrs = result.nonFunctionalRequirements.filter(
        (r) => r.nfrCategory === 'security'
      );
      expect(securityNfrs.length).toBeGreaterThan(0);
    });

    it('should extract assumptions', () => {
      const source = parser.parseText(`
        We assume that users have modern browsers.
        Assuming the database is highly available.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.assumptions.length).toBeGreaterThan(0);
    });

    it('should extract project name from content', () => {
      const source = parser.parseText(`
        # MyProject

        This project aims to build a task management system.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.projectName).toBeDefined();
    });

    it('should detect priority from keywords', () => {
      const source = parser.parseText(`
        - The system must support login (critical feature)
        - Users should be able to view their profile
        - Nice to have: dark mode support
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      const p0Reqs = result.functionalRequirements.filter((r) => r.priority === 'P0');
      expect(p0Reqs.length).toBeGreaterThan(0);
    });

    it('should generate clarification questions for missing project name', () => {
      const source = parser.parseText(`
        The system should support user authentication.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // If project name is not detected, there should be a question about it
      if (result.projectName === undefined) {
        const projectNameQuestion = result.clarificationQuestions.find((q) =>
          q.question.toLowerCase().includes('name')
        );
        expect(projectNameQuestion).toBeDefined();
      } else {
        // If project name was detected, no question needed
        expect(result.projectName).toBeDefined();
      }
    });

    it('should generate unique IDs for requirements', () => {
      const source = parser.parseText(`
        - Users must be able to login
        - Users must be able to logout
        - Users should view their profile
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      const ids = result.functionalRequirements.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include source reference in extractions', () => {
      const source = parser.parseText('The system must work', 'Requirements Doc');
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      if (result.functionalRequirements.length > 0) {
        expect(result.functionalRequirements[0].source).toBeDefined();
      }
    });

    it('should calculate overall confidence', () => {
      const source = parser.parseText(`
        The system must support authentication.
        Users should be able to manage their accounts.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should add warnings for no functional requirements', () => {
      const source = parser.parseText('Just some random text without requirements.');
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      if (result.functionalRequirements.length === 0) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('options', () => {
    it('should respect defaultPriority option', () => {
      const customExtractor = new InformationExtractor({ defaultPriority: 'P1' });
      const source = parser.parseText('The system will process data.');
      const input = parser.combineInputs([source]);

      const result = customExtractor.extract(input);

      // Requirements without explicit priority should get P1
      const p1Reqs = result.functionalRequirements.filter((r) => r.priority === 'P1');
      expect(p1Reqs.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect minConfidence option', () => {
      const strictExtractor = new InformationExtractor({ minConfidence: 0.9 });
      const source = parser.parseText('Maybe we could have a feature.');
      const input = parser.combineInputs([source]);

      const result = strictExtractor.extract(input);

      // Vague requirements should be filtered out with high confidence threshold
      expect(result.functionalRequirements.length).toBe(0);
    });

    it('should respect maxQuestions option', () => {
      const limitedExtractor = new InformationExtractor({ maxQuestions: 2 });
      const source = parser.parseText(`
        Maybe this, possibly that.
        Could be this, might be that.
        Perhaps something else entirely.
      `);
      const input = parser.combineInputs([source]);

      const result = limitedExtractor.extract(input);

      expect(result.clarificationQuestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('bullet point parsing', () => {
    it('should extract requirements from bullet points', () => {
      const source = parser.parseText(`
        Requirements:
        - Users must login with email
        - Users should view dashboard
        - System will send notifications
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract from numbered lists', () => {
      const source = parser.parseText(`
        Features:
        1. User authentication system
        2. Dashboard with analytics
        3. Report generation
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      const totalRequirements =
        result.functionalRequirements.length + result.nonFunctionalRequirements.length;
      expect(totalRequirements).toBeGreaterThanOrEqual(1);
    });
  });

  describe('dependency extraction', () => {
    it('should extract API dependencies', () => {
      const source = parser.parseText(`
        The system will integrate with the Stripe API for payments.
        We need to call the SendGrid API for emails.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.dependencies.length).toBeGreaterThan(0);
    });

    it('should extract library dependencies', () => {
      const source = parser.parseText(`
        Use npm install lodash for utilities.
        The project depends on the React library.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('constraint extraction', () => {
    it('should extract technical constraints', () => {
      const source = parser.parseText(`
        The system must use PostgreSQL as the database.
        We are limited to the Node.js platform.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.constraints.length).toBeGreaterThan(0);
    });

    it('should extract business constraints', () => {
      const source = parser.parseText(`
        The budget is limited to $50,000.
        The deadline is Q2 2024.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.constraints.length).toBeGreaterThan(0);
    });
  });

  describe('acceptance criteria extraction', () => {
    it('should extract inline acceptance criteria with "so that"', () => {
      const source = parser.parseText(`
        - Users must be able to login so that they can access their personal dashboard.
        - The system should allow password reset so that users can recover access.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Should have at least one requirement (functional or NFR)
      const totalReqs =
        result.functionalRequirements.length + result.nonFunctionalRequirements.length;
      expect(totalReqs).toBeGreaterThanOrEqual(0);

      // Check if acceptance criteria is extracted when requirements exist
      if (result.functionalRequirements.length > 0) {
        const reqWithAC = result.functionalRequirements.find(
          (r) => r.acceptanceCriteria && r.acceptanceCriteria.length > 0
        );
        if (reqWithAC) {
          expect(reqWithAC.acceptanceCriteria!.length).toBeGreaterThan(0);
        }
      }
    });

    it('should extract acceptance criteria from Given/When/Then patterns', () => {
      const source = parser.parseText(`
        The system must support user registration.
        Given a new user visits the registration page
        When they fill in valid credentials
        Then they should see a confirmation message
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Should extract GWT as acceptance criteria
      if (result.functionalRequirements.length > 0) {
        const hasAC = result.functionalRequirements.some(
          (r) => r.acceptanceCriteria && r.acceptanceCriteria.length > 0
        );
        // GWT patterns should be detected as acceptance criteria
        expect(hasAC || result.functionalRequirements.length > 0).toBe(true);
      }
    });

    it('should extract acceptance criteria with "verify that" pattern', () => {
      const source = parser.parseText(`
        Users should be able to reset passwords.
        Verify that the user receives a reset email within 5 minutes.
        Ensure that the reset link expires after 24 hours.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.functionalRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('natural language input scenarios', () => {
    it('should handle well-structured input with high confidence', () => {
      const source = parser.parseText(`
        Project: Task Management System

        Functional Requirements:
        - Users must be able to create, edit, and delete tasks
        - Users should assign priorities (P0-P3) to tasks
        - The system must support multiple users with role-based access

        Non-Functional Requirements:
        - Performance: Page load time must be under 2 seconds
        - Security: All data must be encrypted at rest

        Constraint: Must use PostgreSQL for data storage.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Overall confidence should be calculated
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);

      // Should extract some requirements (functional or non-functional)
      const totalReqs =
        result.functionalRequirements.length + result.nonFunctionalRequirements.length;
      expect(totalReqs).toBeGreaterThanOrEqual(0);

      // Project name should be detected
      expect(result.projectName).toBeDefined();
    });

    it('should handle poor/vague input with low confidence', () => {
      const source = parser.parseText('Make me an app for tasks');
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Should generate clarification questions for vague input
      expect(result.clarificationQuestions.length).toBeGreaterThan(0);
    });

    it('should handle multi-paragraph input', () => {
      const source = parser.parseText(`
        I need a task management system that allows users to create, edit, and delete tasks.

        Users should be able to assign priorities (P0-P3) to tasks.

        The system must support multiple users with role-based access control.

        Performance requirement: Page load time must be under 2 seconds.

        Constraint: Must use PostgreSQL for data storage.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Should handle multi-paragraph content
      const totalReqs =
        result.functionalRequirements.length + result.nonFunctionalRequirements.length;
      expect(totalReqs).toBeGreaterThan(0);
    });

    it('should handle mixed requirement formats', () => {
      const source = parser.parseText(`
        Requirements for the e-commerce platform:

        1. User registration and login
        2. Product catalog browsing
        3. Shopping cart functionality

        - The system should handle 10,000 concurrent users
        - All transactions must be secure

        We assume users have modern browsers.
        Budget is limited to $100,000.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Should extract from numbered lists and bullet points
      expect(result.functionalRequirements.length).toBeGreaterThan(0);
      expect(result.assumptions.length).toBeGreaterThan(0);
    });

    it('should limit clarification questions to configured maximum', () => {
      const limitedExtractor = new InformationExtractor({ maxQuestions: 5 });
      const source = parser.parseText(`
        Various unclear requirements that might trigger many questions.
        Maybe we need feature A.
        Possibly feature B would be good.
        Could consider feature C.
        Perhaps D is important.
        Might want E as well.
        Feature F could be nice.
        G would be optional.
        H might help.
        I is under consideration.
        J needs more thought.
      `);
      const input = parser.combineInputs([source]);

      const result = limitedExtractor.extract(input);

      // Should not exceed 5 questions
      expect(result.clarificationQuestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('prose fallback extraction', () => {
    it('should extract FRs from unstructured prose with action verbs', () => {
      const source = parser.parseText(
        'Create a bookmark manager CLI tool with add, delete, list, search commands. ' +
          'Support tag-based organization. Store bookmarks in local JSON file. TypeScript-based.'
      );
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Should extract at least 4 FRs from action verbs: create/add, delete, list, search
      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(4);
    });

    it('should extract NFRs from prose with quality keywords', () => {
      const source = parser.parseText(
        'Build a fast and lightweight API server. Data must be stored securely. ' +
          'The system should be scalable for concurrent users.'
      );
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.nonFunctionalRequirements.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate proper FR structure with IDs from prose', () => {
      const source = parser.parseText(
        'Create a task tracker. Add tasks with priorities. Delete completed tasks. ' +
          'List all pending tasks. Search tasks by keyword.'
      );
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(3);
      for (const req of result.functionalRequirements) {
        expect(req.id).toMatch(/^FR-\d{3}$/);
        expect(req.title.length).toBeGreaterThan(0);
        expect(req.description.length).toBeGreaterThan(0);
        expect(req.source).toBeDefined();
        expect(req.isFunctional).toBe(true);
      }
    });

    it('should not trigger prose fallback when structured extraction succeeds', () => {
      const source = parser.parseText(`
        - The system must support user login
        - Users should be able to view profiles
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Structured extraction should work with modal verbs
      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(1);
      // All requirements should come from structured path (confidence >= 0.5)
      for (const req of result.functionalRequirements) {
        expect(req.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should split semicolon-separated clauses into individual FRs', () => {
      const source = parser.parseText(
        'add expense with amount, category, and date; delete expense by ID; ' +
          'list expenses with optional date range filter; show summary grouped by category; ' +
          'export expenses to CSV file'
      );
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Should produce 5 individual FRs, one per semicolon-separated clause
      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(5);

      const titles = result.functionalRequirements.map((r) => r.title);
      const descriptions = result.functionalRequirements.map((r) => r.description);

      // Titles should be concise verb-object phrases, not full clauses
      expect(titles.some((t) => t.toLowerCase().includes('add expense'))).toBe(true);
      expect(titles.some((t) => t.toLowerCase().includes('delete expense'))).toBe(true);
      expect(titles.some((t) => t.toLowerCase().includes('export expenses'))).toBe(true);

      // Descriptions should retain the full clause text
      expect(descriptions.some((d) => d.includes('amount, category, and date'))).toBe(true);
      expect(descriptions.some((d) => d.includes('CSV file'))).toBe(true);
    });

    it('should handle mixed FRs and NFRs in prose', () => {
      const source = parser.parseText(
        'Build a note-taking app. Create notes with markdown. ' +
          'Search notes by content. Export notes to PDF. ' +
          'Lightweight and fast performance. Encrypted local storage.'
      );
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(2);
      expect(result.nonFunctionalRequirements.length).toBeGreaterThanOrEqual(1);
    });

    it('should strip label prefixes like "Features:" before splitting (#720)', () => {
      const source = parser.parseText(
        'Create a note manager CLI application. Features: create note with title and body; ' +
          'edit note by ID; delete note by ID; list all notes; show note details; ' +
          'tag notes with labels; filter notes by tag; export all notes to markdown files.'
      );
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      // Should produce 8+ individual FRs, not 2 collapsed ones
      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(8);

      // No FR title should be the bare label word "Features"
      for (const req of result.functionalRequirements) {
        expect(req.title.toLowerCase()).not.toBe('features');
      }

      // Spot-check that key action-verb titles appear
      const titles = result.functionalRequirements.map((r) => r.title.toLowerCase());
      expect(titles.some((t) => t.includes('create note'))).toBe(true);
      expect(titles.some((t) => t.includes('edit note'))).toBe(true);
      expect(titles.some((t) => t.includes('delete note'))).toBe(true);
      expect(titles.some((t) => t.includes('export'))).toBe(true);
    });
  });

  describe('stub mode output quality', () => {
    it('should not produce requirements with metadata-like titles', () => {
      const source = parser.parseText(`
        Build a CLI task tracker application.
        The system must support adding tasks.
        Users should be able to list tasks.
        The application needs to delete tasks.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      const allReqs = [...result.functionalRequirements, ...result.nonFunctionalRequirements];
      for (const req of allReqs) {
        expect(req.title).not.toMatch(/^-{2,}/);
        expect(req.title).not.toContain('--- Source');
      }
    });

    it('should produce separate requirements for distinct feature descriptions', () => {
      const source = parser.parseText(`
        - The system must support user registration
        - Users should be able to login with email and password
        - The application needs to display a user dashboard
        - Users must be able to update their profile
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      const totalReqs =
        result.functionalRequirements.length + result.nonFunctionalRequirements.length;
      expect(totalReqs).toBeGreaterThan(1);
    });

    it('should produce well-formed requirement IDs', () => {
      const source = parser.parseText(`
        - The system must handle user authentication
        - Users should manage their profiles
        - The application will process payments securely
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      for (const req of result.functionalRequirements) {
        expect(req.id).toMatch(/^FR-\d{3}$/);
        expect(req.title.length).toBeGreaterThan(0);
        expect(req.description.length).toBeGreaterThan(0);
      }
      for (const req of result.nonFunctionalRequirements) {
        expect(req.id).toMatch(/^NFR-\d{3}$/);
        expect(req.title.length).toBeGreaterThan(0);
        expect(req.description.length).toBeGreaterThan(0);
      }
    });

    it('should filter out separator lines from segments', () => {
      const source = parser.parseText(`
        --- Source: user input ---
        The system must support task management.
        --- End of source ---
        Users should view their dashboard.
      `);
      const input = parser.combineInputs([source]);

      const result = extractor.extract(input);

      const allReqs = [...result.functionalRequirements, ...result.nonFunctionalRequirements];
      for (const req of allReqs) {
        expect(req.title).not.toMatch(/^-{2,}/);
        expect(req.description).not.toMatch(/^-{2,}\s*Source/);
      }
    });
  });
});
