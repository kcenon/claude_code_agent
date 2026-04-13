import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  UISpecWriterAgent,
  getUISpecWriterAgent,
  resetUISpecWriterAgent,
  UI_SPEC_WRITER_AGENT_ID,
} from '../../src/ui-spec-writer/UISpecWriterAgent.js';
import { SRSNotFoundError, SessionStateError } from '../../src/ui-spec-writer/errors.js';
import { detectScreens, slugifyScreen } from '../../src/ui-spec-writer/ScreenDetector.js';
import { mapFlows, slugifyFlow } from '../../src/ui-spec-writer/FlowMapper.js';
import {
  generateDesignSystem,
  deriveComponents,
} from '../../src/ui-spec-writer/DesignSystemGenerator.js';

describe('UISpecWriterAgent', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'ui-spec-writer', 'test-scratchpad');
  const testDocsPath = path.join(process.cwd(), 'tests', 'ui-spec-writer', 'test-docs');

  const sampleSRS = `---
doc_id: SRS-test-project
title: Test Product
version: 1.0.0
status: Approved
---

# Software Requirements Specification: Test Product

## 2. Software Features

### SF-001: User Authentication

User authentication with login and registration.

### SF-002: Dashboard

Dashboard screen displaying user data and analytics.

### SF-003: Data Export

Export data in CSV and JSON formats.

## 3. Use Cases

### UC-001: Login

**Description**
User logs into the application.

**Actors**
- User

**Preconditions**
- User has a registered account

**Steps**
1. User opens the login page
2. User enters email and password
3. User clicks the login button
4. System validates credentials
5. System displays the dashboard

**Postconditions**
- User is authenticated and sees the dashboard

### UC-002: View Dashboard

**Description**
User views the dashboard with analytics data.

**Actors**
- User

**Steps**
1. User navigates to the dashboard
2. System displays analytics summary
3. User views charts and metrics

**Postconditions**
- User can see their data

### UC-003: Export Data

**Description**
User exports data from the dashboard.

**Actors**
- User

**Preconditions**
- User is authenticated

**Steps**
1. User clicks the export button
2. User selects export format
3. System generates the export file
4. System displays download link

**Postconditions**
- User receives the exported file
`;

  const cliSRS = `---
doc_id: SRS-cli-project
title: CLI Tool
version: 1.0.0
status: Approved
---

# Software Requirements Specification: CLI Tool

This is a command-line tool for data processing.

## 2. Software Features

### SF-001: Data Processing

Command-line data processing pipeline.
`;

  const apiSRS = `---
doc_id: SRS-api-project
title: API Server
version: 1.0.0
status: Approved
---

# Software Requirements Specification: API Server

This is a REST API server for data management.

## 2. Software Features

### SF-001: API Endpoints

REST API endpoints for CRUD operations.
`;

  const librarySRS = `---
doc_id: SRS-lib-project
title: Utils Library
version: 1.0.0
status: Approved
---

# Software Requirements Specification: Utils Library

This is a utility library for string manipulation.

## 2. Software Features

### SF-001: String Utils

SDK for string processing.
`;

  const mobileSRS = `---
doc_id: SRS-mobile-project
title: Mobile App
version: 1.0.0
status: Approved
---

# Software Requirements Specification: Mobile App

This is a mobile app built with React Native for iOS and Android.

## 3. Use Cases

### UC-001: Login

**Description**
User logs into the mobile app.

**Steps**
1. User opens the app
2. User enters credentials
3. User taps login button
`;

  const setupSRS = (projectId: string, content: string = sampleSRS): void => {
    const docsDir = path.join(testBasePath, 'documents', projectId);
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'srs.md'), content, 'utf-8');
  };

  beforeEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
    if (fs.existsSync(testDocsPath)) {
      fs.rmSync(testDocsPath, { recursive: true, force: true });
    }
    resetUISpecWriterAgent();
  });

  afterEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
    if (fs.existsSync(testDocsPath)) {
      fs.rmSync(testDocsPath, { recursive: true, force: true });
    }
    resetUISpecWriterAgent();
  });

  describe('constructor and IAgent interface', () => {
    it('should construct with default config', () => {
      const agent = new UISpecWriterAgent();
      expect(agent.agentId).toBe(UI_SPEC_WRITER_AGENT_ID);
      expect(agent.name).toBe('UI Specification Writer Agent');
    });

    it('should accept custom config overrides', () => {
      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      expect(agent.agentId).toBe(UI_SPEC_WRITER_AGENT_ID);
    });

    it('should initialize and dispose without error', async () => {
      const agent = new UISpecWriterAgent();
      await agent.initialize();
      await agent.initialize(); // idempotent
      expect(agent.getSession()).toBeNull();
      await agent.dispose();
      expect(agent.getSession()).toBeNull();
    });
  });

  describe('singleton', () => {
    it('should return the same instance on repeated calls', () => {
      const a = getUISpecWriterAgent();
      const b = getUISpecWriterAgent();
      expect(a).toBe(b);
    });

    it('should return a fresh instance after reset', () => {
      const a = getUISpecWriterAgent();
      resetUISpecWriterAgent();
      const b = getUISpecWriterAgent();
      expect(a).not.toBe(b);
    });
  });

  describe('startSession', () => {
    it('should create a session when SRS exists', async () => {
      const projectId = 'test-project';
      setupSRS(projectId);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.initialize();

      const session = await agent.startSession(projectId);

      expect(session.projectId).toBe(projectId);
      expect(session.status).toBe('pending');
      expect(session.parsedSRS.documentId).toBe('SRS-test-project');
      expect(session.parsedSRS.productName).toBe('Test Product');
      expect(session.parsedSRS.useCases.length).toBe(3);
      expect(session.parsedSRS.features.length).toBe(3);
      expect(session.skipped).toBe(false);
      expect(session.sessionId).toBeTruthy();
    });

    it('should throw SRSNotFoundError when SRS is missing', async () => {
      const projectId = 'no-srs';
      const docsDir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(docsDir, { recursive: true });

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await expect(agent.startSession(projectId)).rejects.toThrow(SRSNotFoundError);
    });

    it('should add a warning when SRS has no use cases or features', async () => {
      const projectId = 'empty-srs';
      const docsDir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(
        path.join(docsDir, 'srs.md'),
        `---
doc_id: SRS-empty
title: Empty
---
# Software Requirements Specification: Empty

This is a web application with no defined features yet.
`,
        'utf-8'
      );

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession(projectId);
      expect(session.parsedSRS.useCases.length).toBe(0);
      expect(session.parsedSRS.features.length).toBe(0);
      expect(session.warnings).toBeDefined();
      expect(session.warnings?.length).toBeGreaterThan(0);
    });
  });

  describe('auto-skip for non-UI projects', () => {
    it('should auto-skip for CLI projects', async () => {
      const projectId = 'cli-project';
      setupSRS(projectId, cliSRS);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession(projectId);
      expect(session.skipped).toBe(true);
      expect(session.skipReason).toContain('cli');
      expect(session.status).toBe('completed');
    });

    it('should auto-skip for API-only projects', async () => {
      const projectId = 'api-project';
      setupSRS(projectId, apiSRS);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession(projectId);
      expect(session.skipped).toBe(true);
      expect(session.skipReason).toContain('api');
    });

    it('should auto-skip for library projects', async () => {
      const projectId = 'lib-project';
      setupSRS(projectId, librarySRS);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession(projectId);
      expect(session.skipped).toBe(true);
      expect(session.skipReason).toContain('library');
    });

    it('should not skip for web projects', async () => {
      const projectId = 'web-project';
      setupSRS(projectId, sampleSRS);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession(projectId);
      expect(session.skipped).toBe(false);
    });

    it('should not skip for mobile projects', async () => {
      const projectId = 'mobile-project';
      setupSRS(projectId, mobileSRS);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession(projectId);
      expect(session.skipped).toBe(false);
      expect(session.parsedSRS.projectType).toBe('mobile');
    });

    it('should return skipped result from generateFromProject for CLI', async () => {
      const projectId = 'cli-project';
      setupSRS(projectId, cliSRS);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('cli');
      expect(result.screenPaths.length).toBe(0);
      expect(result.flowPaths.length).toBe(0);
    });
  });

  describe('generateFromProject', () => {
    it('should generate screens, flows, and design system', async () => {
      const projectId = 'test-project';
      setupSRS(projectId);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.initialize();

      const result = await agent.generateFromProject(projectId);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.stats.useCasesProcessed).toBe(3);
      expect(result.stats.screensGenerated).toBeGreaterThan(0);
      expect(result.stats.flowsGenerated).toBeGreaterThan(0);
      expect(result.stats.designTokensGenerated).toBeGreaterThan(0);

      // Check that output files were written
      expect(result.screenPaths.length).toBeGreaterThan(0);
      for (const p of result.screenPaths) {
        expect(fs.existsSync(p)).toBe(true);
      }

      expect(result.flowPaths.length).toBeGreaterThan(0);
      for (const p of result.flowPaths) {
        expect(fs.existsSync(p)).toBe(true);
      }

      expect(fs.existsSync(result.designSystemPath)).toBe(true);
      expect(fs.existsSync(result.readmePath)).toBe(true);

      // Verify README content has frontmatter
      const readmeContent = fs.readFileSync(result.readmePath, 'utf-8');
      expect(readmeContent).toContain('---');
      expect(readmeContent).toContain('doc_id: ui-readme');
      expect(readmeContent).toContain('Test Product');
      expect(readmeContent).toContain('SCR-');
      expect(readmeContent).toContain('FLW-');

      // Verify screen files have frontmatter
      const screenContent = fs.readFileSync(result.screenPaths[0] as string, 'utf-8');
      expect(screenContent).toContain('doc_id:');
      expect(screenContent).toContain('version: 1.0.0');
      expect(screenContent).toContain('status: Draft');
      // Verify Data Source column in screen files
      expect(screenContent).toContain('Data Source');

      // Verify flow files have frontmatter
      const flowContent = fs.readFileSync(result.flowPaths[0] as string, 'utf-8');
      expect(flowContent).toContain('doc_id:');
      expect(flowContent).toContain('version: 1.0.0');

      // Verify design system has frontmatter
      const dsContent = fs.readFileSync(result.designSystemPath, 'utf-8');
      expect(dsContent).toContain('doc_id: design-system');
    });

    it('should update session status through lifecycle', async () => {
      const projectId = 'test-project';
      setupSRS(projectId);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.initialize();

      await agent.generateFromProject(projectId);

      const session = agent.getSession();
      expect(session).not.toBeNull();
      expect(session?.status).toBe('completed');
      expect(session?.screens).toBeDefined();
      expect(session?.flows).toBeDefined();
      expect(session?.designSystem).toBeDefined();
    });
  });

  describe('finalize', () => {
    it('should throw SessionStateError when no session', async () => {
      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await expect(agent.finalize()).rejects.toThrow(SessionStateError);
    });

    it('should throw SessionStateError when session not completed', async () => {
      const projectId = 'test-project';
      setupSRS(projectId);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession(projectId);
      // Session is in 'pending' state, not 'completed'
      await expect(agent.finalize()).rejects.toThrow(SessionStateError);
    });

    it('should finalize successfully after generation', async () => {
      const projectId = 'test-project';
      setupSRS(projectId);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.initialize();

      await agent.generateFromProject(projectId);

      // Clean up output files to test that finalize rewrites them
      if (fs.existsSync(testDocsPath)) {
        fs.rmSync(testDocsPath, { recursive: true, force: true });
      }

      const result = await agent.finalize();
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.screenPaths.length).toBeGreaterThan(0);
    });

    it('should return skipped result when session was skipped', async () => {
      const projectId = 'cli-project';
      setupSRS(projectId, cliSRS);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.generateFromProject(projectId);
      const result = await agent.finalize();
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should set session status to failed on generation error', async () => {
      const projectId = 'test-project';
      setupSRS(projectId);

      const agent = new UISpecWriterAgent({
        scratchpadBasePath: testBasePath,
        // Point to a read-only path to trigger write error
        publicDocsPath: '/proc/nonexistent/ui',
      });
      await agent.initialize();

      await expect(agent.generateFromProject(projectId)).rejects.toThrow();

      const session = agent.getSession();
      expect(session?.status).toBe('failed');
      expect(session?.errorMessage).toBeDefined();
    });
  });
});

describe('ScreenDetector', () => {
  describe('slugifyScreen', () => {
    it('should convert title to slug', () => {
      expect(slugifyScreen('User Login')).toBe('user-login');
      expect(slugifyScreen('Dashboard View')).toBe('dashboard-view');
      expect(slugifyScreen('')).toBe('screen');
      expect(slugifyScreen('  Special!@# Characters  ')).toBe('special-characters');
    });
  });

  describe('detectScreens', () => {
    it('should detect screens from use cases', () => {
      const useCases = [
        {
          id: 'UC-001',
          title: 'Login',
          description: 'User logs in',
          actors: ['User'],
          steps: ['User enters email', 'User clicks login button', 'System displays dashboard'],
          preconditions: [],
          postconditions: [],
        },
        {
          id: 'UC-002',
          title: 'View Dashboard',
          description: 'User views dashboard',
          actors: ['User'],
          steps: ['User navigates to dashboard', 'System displays data'],
          preconditions: [],
          postconditions: [],
        },
      ];

      const screens = detectScreens(useCases, []);

      expect(screens.length).toBe(2);
      expect(screens[0]?.id).toBe('SCR-001');
      expect(screens[0]?.relatedUseCases).toContain('UC-001');
      expect(screens[1]?.id).toBe('SCR-002');
    });

    it('should extract UI elements from steps', () => {
      const useCases = [
        {
          id: 'UC-001',
          title: 'Login',
          description: 'Login screen',
          actors: ['User'],
          steps: [
            'User enters email',
            'User enters password',
            'User clicks login button',
            'System displays welcome message',
          ],
          preconditions: [],
          postconditions: [],
        },
      ];

      const screens = detectScreens(useCases, []);
      expect(screens[0]?.elements.length).toBeGreaterThan(0);

      const elementTypes = screens[0]?.elements.map((e) => e.type) ?? [];
      expect(elementTypes).toContain('input');
      expect(elementTypes).toContain('button');
      expect(elementTypes).toContain('display');
    });

    it('should detect screens from UI-facing features', () => {
      const features = [
        {
          id: 'SF-001',
          title: 'Dashboard',
          description: 'A dashboard screen showing analytics data.',
        },
        {
          id: 'SF-002',
          title: 'Data Processing',
          description: 'Backend processing pipeline.',
        },
      ];

      const screens = detectScreens([], features);
      // Only SF-001 should generate a screen (has "screen" keyword)
      expect(screens.length).toBe(1);
      expect(screens[0]?.relatedFeatures).toContain('SF-001');
    });

    it('should return empty array for no input', () => {
      const screens = detectScreens([], []);
      expect(screens.length).toBe(0);
    });

    it('should link navigation targets between screens', () => {
      const useCases = [
        {
          id: 'UC-001',
          title: 'Login',
          description: 'Login',
          actors: ['User'],
          steps: ['Enter credentials', 'Click login'],
          preconditions: [],
          postconditions: [],
        },
        {
          id: 'UC-002',
          title: 'Register',
          description: 'Register',
          actors: ['User'],
          steps: ['Enter details', 'Click register'],
          preconditions: [],
          postconditions: [],
        },
      ];

      const screens = detectScreens(useCases, []);
      expect(screens.length).toBe(2);
      // Sequential flow: first screen navigates to second
      expect(screens[0]?.navigationTargets.length).toBeGreaterThan(0);
    });
  });
});

describe('FlowMapper', () => {
  describe('slugifyFlow', () => {
    it('should convert title to slug', () => {
      expect(slugifyFlow('User Login Flow')).toBe('user-login-flow');
      expect(slugifyFlow('')).toBe('flow');
    });
  });

  describe('mapFlows', () => {
    it('should generate flows from multi-step use cases', () => {
      const useCases = [
        {
          id: 'UC-001',
          title: 'Login',
          description: 'User login flow',
          actors: ['User'],
          steps: ['Enter email', 'Enter password', 'Click login', 'View dashboard'],
          preconditions: ['User has account'],
          postconditions: ['User is authenticated'],
        },
      ];

      const screens = [
        {
          id: 'SCR-001',
          nameSlug: 'login',
          title: 'Login',
          purpose: 'Login screen',
          relatedUseCases: ['UC-001'],
          relatedFeatures: [],
          elements: [],
          navigationTargets: [],
        },
      ];

      const flows = mapFlows(useCases, screens);

      expect(flows.length).toBe(1);
      expect(flows[0]?.id).toBe('FLW-001');
      expect(flows[0]?.relatedUseCases).toContain('UC-001');
      expect(flows[0]?.steps.length).toBeGreaterThan(0);
      expect(flows[0]?.preconditions).toContain('User has account');
      expect(flows[0]?.outcomes).toContain('User is authenticated');
    });

    it('should skip single-step use cases', () => {
      const useCases = [
        {
          id: 'UC-001',
          title: 'Simple Action',
          description: 'One-step action',
          actors: ['User'],
          steps: ['Do something'],
          preconditions: [],
          postconditions: [],
        },
      ];

      const screens = [
        {
          id: 'SCR-001',
          nameSlug: 'screen',
          title: 'Screen',
          purpose: 'Screen',
          relatedUseCases: ['UC-001'],
          relatedFeatures: [],
          elements: [],
          navigationTargets: [],
        },
      ];

      const flows = mapFlows(useCases, screens);
      expect(flows.length).toBe(0);
    });

    it('should return empty array when no screens', () => {
      const useCases = [
        {
          id: 'UC-001',
          title: 'Login',
          description: 'Login',
          actors: ['User'],
          steps: ['Step 1', 'Step 2'],
          preconditions: [],
          postconditions: [],
        },
      ];

      const flows = mapFlows(useCases, []);
      expect(flows.length).toBe(0);
    });
  });
});

describe('DesignSystemGenerator', () => {
  describe('generateDesignSystem', () => {
    it('should generate web design system by default', () => {
      const ds = generateDesignSystem('web', []);
      expect(ds.tokens.length).toBeGreaterThan(0);
      expect(ds.technologyStack).toContain('Web');
      // Should have at least color, spacing, and typography tokens
      const categories = new Set(ds.tokens.map((t) => t.category));
      expect(categories.has('color')).toBe(true);
      expect(categories.has('spacing')).toBe(true);
      expect(categories.has('typography')).toBe(true);
    });

    it('should generate mobile design system', () => {
      const ds = generateDesignSystem('mobile', []);
      expect(ds.technologyStack).toContain('Mobile');
      const values = ds.tokens.map((t) => t.value);
      // Mobile tokens should use dp/sp units
      expect(values.some((v) => v.includes('dp') || v.includes('sp'))).toBe(true);
    });

    it('should generate desktop design system', () => {
      const ds = generateDesignSystem('desktop', []);
      expect(ds.technologyStack).toContain('Desktop');
    });

    it('should always include navigation and appbar components', () => {
      const ds = generateDesignSystem('web', []);
      const names = ds.components.map((c) => c.name);
      expect(names).toContain('AppBar');
      expect(names).toContain('Navigation');
    });
  });

  describe('deriveComponents', () => {
    it('should derive button component from screen elements', () => {
      const screens = [
        {
          id: 'SCR-001',
          nameSlug: 'test',
          title: 'Test',
          purpose: 'Test',
          relatedUseCases: [],
          relatedFeatures: [],
          elements: [
            {
              id: 'btn-1',
              type: 'button',
              label: 'Click',
              dataSource: 'User action',
              behavior: 'Click',
            },
          ],
          navigationTargets: [],
        },
      ];

      const components = deriveComponents(screens);
      const names = components.map((c) => c.name);
      expect(names).toContain('Button');
    });

    it('should derive input component from screen elements', () => {
      const screens = [
        {
          id: 'SCR-001',
          nameSlug: 'test',
          title: 'Test',
          purpose: 'Test',
          relatedUseCases: [],
          relatedFeatures: [],
          elements: [
            {
              id: 'inp-1',
              type: 'input',
              label: 'Email',
              dataSource: 'User input',
              behavior: 'Enter email',
            },
          ],
          navigationTargets: [],
        },
      ];

      const components = deriveComponents(screens);
      const names = components.map((c) => c.name);
      expect(names).toContain('TextInput');
    });
  });
});
