/**
 * Analysis Pipeline Test Fixtures
 *
 * Provides mini codebase fixtures with documents and source code
 * for testing the Analysis Pipeline E2E flow.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Sample PRD document content for testing
 */
export const SAMPLE_PRD_CONTENT = `# Product Requirements Document

## Project: Task Management API

### PRD-001: User Authentication
**Priority**: P0
**Description**: Users must be able to authenticate using email and password.

### PRD-002: Task CRUD Operations
**Priority**: P0
**Description**: Users can create, read, update, and delete tasks.

### PRD-003: Task Assignment
**Priority**: P1
**Description**: Tasks can be assigned to team members.

### PRD-004: Due Date Notifications
**Priority**: P2
**Description**: Users receive notifications for upcoming due dates.
`;

/**
 * Sample SRS document content for testing
 */
export const SAMPLE_SRS_CONTENT = `# Software Requirements Specification

## FR-001: User Authentication
- FR-001.1: System shall accept email and password for login
- FR-001.2: System shall validate email format
- FR-001.3: System shall hash passwords using bcrypt

## FR-002: Task Management
- FR-002.1: System shall allow task creation with title and description
- FR-002.2: System shall support task status (pending, in-progress, completed)
- FR-002.3: System shall allow task deletion by owner

## FR-003: Task Assignment
- FR-003.1: System shall allow assigning tasks to registered users
- FR-003.2: System shall notify assignees via email

## FR-004: Due Date Notifications
- FR-004.1: System shall send email notifications 24 hours before due date
`;

/**
 * Sample SDS document content for testing
 */
export const SAMPLE_SDS_CONTENT = `# Software Design Specification

## Component: AuthService
Implements FR-001 (User Authentication)
- Methods: login(), logout(), validateToken()
- Dependencies: bcrypt, jwt

## Component: TaskService
Implements FR-002 (Task Management)
- Methods: createTask(), getTask(), updateTask(), deleteTask()
- Dependencies: database, validation

## Component: AssignmentService
Implements FR-003 (Task Assignment)
- Methods: assignTask(), getAssignees()
- Dependencies: TaskService, UserService

## Component: NotificationService
Implements FR-004 (Due Date Notifications)
- Methods: scheduleNotification(), sendNotification()
- Dependencies: email-service, scheduler
`;

/**
 * Sample TypeScript source code - Auth module (implemented)
 */
export const SAMPLE_AUTH_CODE = `/**
 * Authentication Service
 * Implements FR-001: User Authentication
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

export class AuthService {
  private readonly jwtSecret: string;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    // FR-001.2: Validate email format
    if (!this.isValidEmail(credentials.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    // FR-001.3: Password validation would use bcrypt
    const isValid = await this.validatePassword(credentials.password);
    if (!isValid) {
      return { success: false, error: 'Invalid credentials' };
    }

    const token = jwt.sign({ email: credentials.email }, this.jwtSecret);
    return { success: true, token };
  }

  logout(): void {
    // Token invalidation logic
  }

  validateToken(token: string): boolean {
    try {
      jwt.verify(token, this.jwtSecret);
      return true;
    } catch {
      return false;
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  }

  private async validatePassword(password: string): Promise<boolean> {
    // Simplified validation
    return password.length >= 8;
  }
}
`;

/**
 * Sample TypeScript source code - Task module (implemented)
 */
export const SAMPLE_TASK_CODE = `/**
 * Task Service
 * Implements FR-002: Task Management
 */

export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  ownerId: string;
}

export class TaskService {
  private tasks: Map<string, Task> = new Map();

  // FR-002.1: Task creation
  createTask(input: CreateTaskInput): Task {
    const task: Task = {
      id: this.generateId(),
      title: input.title,
      description: input.description,
      status: 'pending',
      ownerId: input.ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  // FR-002.2: Status update
  updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    const updated = { ...task, ...updates, updatedAt: new Date() };
    this.tasks.set(id, updated);
    return updated;
  }

  // FR-002.3: Task deletion
  deleteTask(id: string, requesterId: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.ownerId !== requesterId) {
      return false;
    }
    return this.tasks.delete(id);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
`;

/**
 * Sample code that is NOT in documents (orphaned code)
 */
export const SAMPLE_ORPHAN_CODE = `/**
 * Analytics Service
 * Note: This is not documented in PRD/SRS/SDS
 */

export interface AnalyticsEvent {
  eventType: string;
  userId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export class AnalyticsService {
  private events: AnalyticsEvent[] = [];

  trackEvent(event: AnalyticsEvent): void {
    this.events.push(event);
  }

  getEventsByUser(userId: string): AnalyticsEvent[] {
    return this.events.filter(e => e.userId === userId);
  }
}
`;

/**
 * Analysis test fixture configuration
 */
export interface AnalysisTestFixture {
  rootDir: string;
  docsPath: string;
  srcPath: string;
  scratchpadPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a complete analysis test fixture with docs and code
 */
export async function createAnalysisFixture(
  options: {
    name?: string;
    includeGaps?: boolean;
    includeOrphanCode?: boolean;
    emptyDocs?: boolean;
    emptyCode?: boolean;
  } = {}
): Promise<AnalysisTestFixture> {
  const {
    name = 'analysis-e2e',
    includeGaps = false,
    includeOrphanCode = false,
    emptyDocs = false,
    emptyCode = false,
  } = options;

  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const docsPath = path.join(rootDir, 'docs');
  const srcPath = path.join(rootDir, 'src');
  const scratchpadPath = path.join(rootDir, '.ad-sdlc', 'scratchpad');

  // Create directory structure
  fs.mkdirSync(path.join(docsPath, 'prd'), { recursive: true });
  fs.mkdirSync(path.join(docsPath, 'srs'), { recursive: true });
  fs.mkdirSync(path.join(docsPath, 'sds'), { recursive: true });
  fs.mkdirSync(path.join(srcPath, 'auth'), { recursive: true });
  fs.mkdirSync(path.join(srcPath, 'task'), { recursive: true });
  fs.mkdirSync(scratchpadPath, { recursive: true });

  if (!emptyDocs) {
    // Create document files
    fs.writeFileSync(path.join(docsPath, 'prd', 'PRD-001.md'), SAMPLE_PRD_CONTENT);
    fs.writeFileSync(path.join(docsPath, 'srs', 'SRS-001.md'), SAMPLE_SRS_CONTENT);
    fs.writeFileSync(path.join(docsPath, 'sds', 'SDS-001.md'), SAMPLE_SDS_CONTENT);
  }

  if (!emptyCode) {
    // Create source files
    fs.writeFileSync(path.join(srcPath, 'auth', 'AuthService.ts'), SAMPLE_AUTH_CODE);
    fs.writeFileSync(path.join(srcPath, 'task', 'TaskService.ts'), SAMPLE_TASK_CODE);

    // Add orphan code if requested
    if (includeOrphanCode) {
      fs.mkdirSync(path.join(srcPath, 'analytics'), { recursive: true });
      fs.writeFileSync(path.join(srcPath, 'analytics', 'AnalyticsService.ts'), SAMPLE_ORPHAN_CODE);
    }
  }

  // If gaps are requested, we have docs for Assignment and Notification
  // but no corresponding code files - this creates gaps

  const cleanup = async (): Promise<void> => {
    if (fs.existsSync(rootDir)) {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };

  return {
    rootDir,
    docsPath,
    srcPath,
    scratchpadPath,
    cleanup,
  };
}

/**
 * Create a minimal fixture for error testing
 */
export async function createMinimalFixture(
  name: string = 'minimal-test'
): Promise<AnalysisTestFixture> {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const docsPath = path.join(rootDir, 'docs');
  const srcPath = path.join(rootDir, 'src');
  const scratchpadPath = path.join(rootDir, '.ad-sdlc', 'scratchpad');

  fs.mkdirSync(docsPath, { recursive: true });
  fs.mkdirSync(srcPath, { recursive: true });
  fs.mkdirSync(scratchpadPath, { recursive: true });

  const cleanup = async (): Promise<void> => {
    if (fs.existsSync(rootDir)) {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };

  return {
    rootDir,
    docsPath,
    srcPath,
    scratchpadPath,
    cleanup,
  };
}

/**
 * Add a document to the fixture
 */
export function addDocument(
  fixture: AnalysisTestFixture,
  type: 'prd' | 'srs' | 'sds',
  filename: string,
  content: string
): void {
  const dir = path.join(fixture.docsPath, type);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, filename), content);
}

/**
 * Add source code to the fixture
 */
export function addSourceFile(
  fixture: AnalysisTestFixture,
  relativePath: string,
  content: string
): void {
  const fullPath = path.join(fixture.srcPath, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
}
