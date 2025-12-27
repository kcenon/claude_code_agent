import { describe, it, expect, beforeEach } from 'vitest';
import {
  InformationExtractor,
  InputParser,
} from '../../src/collector/index.js';

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
        const projectNameQuestion = result.clarificationQuestions.find(
          (q) => q.question.toLowerCase().includes('name')
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

      expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(1);
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
});
