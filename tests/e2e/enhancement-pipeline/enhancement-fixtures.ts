/**
 * Enhancement Pipeline Test Fixtures
 *
 * Provides project fixtures with existing documents and source code
 * for testing the Enhancement Pipeline E2E flow.
 *
 * These fixtures simulate existing projects that need incremental updates
 * rather than greenfield document generation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Sample existing PRD document for enhancement testing
 */
export const EXISTING_PRD_CONTENT = `# Product Requirements Document

## Project: E-Commerce Platform (v2.0)

## Functional Requirements

### FR-001: User Authentication
**Priority**: P0
**Status**: Implemented
**Description**: Users can authenticate using email/password or OAuth providers.
**Acceptance Criteria**:
- Users can log in with email and password
- Users can log in with OAuth providers

### FR-002: Product Catalog
**Priority**: P0
**Status**: Implemented
**Description**: Display products with categories, search, and filtering.
**Acceptance Criteria**:
- Products are displayed with pagination
- Users can filter by category

### FR-003: Shopping Cart
**Priority**: P0
**Status**: Implemented
**Description**: Users can add/remove items, update quantities, and save cart.
**Acceptance Criteria**:
- Users can add items to cart
- Users can remove items from cart

### FR-004: Order Processing
**Priority**: P1
**Status**: In Progress
**Description**: Process orders with payment integration and confirmation.
**Acceptance Criteria**:
- Users can create orders from cart
- Users receive order confirmation
`;

/**
 * Sample existing SRS document for enhancement testing
 */
export const EXISTING_SRS_CONTENT = `# Software Requirements Specification

## FR-001: User Authentication
- FR-001.1: Support email/password authentication
- FR-001.2: Support OAuth (Google, GitHub)
- FR-001.3: Implement session management with JWT

## FR-002: Product Catalog
- FR-002.1: Display product listings with pagination
- FR-002.2: Support category filtering
- FR-002.3: Implement full-text search

## FR-003: Shopping Cart
- FR-003.1: Add/remove items from cart
- FR-003.2: Persist cart for logged-in users
- FR-003.3: Calculate totals with tax

## FR-004: Order Processing
- FR-004.1: Create orders from cart
- FR-004.2: Integrate payment gateway
- FR-004.3: Send order confirmation emails
`;

/**
 * Sample existing SDS document for enhancement testing
 */
export const EXISTING_SDS_CONTENT = `# Software Design Specification

## Component: AuthService
Implements FR-001 (User Authentication)
- Location: src/services/auth/
- Methods: login(), logout(), refreshToken(), oauthCallback()
- Dependencies: bcrypt, jsonwebtoken, passport

## Component: ProductService
Implements FR-002 (Product Catalog)
- Location: src/services/product/
- Methods: listProducts(), getProduct(), searchProducts()
- Dependencies: elasticsearch, database

## Component: CartService
Implements FR-003 (Shopping Cart)
- Location: src/services/cart/
- Methods: addItem(), removeItem(), getCart(), updateQuantity()
- Dependencies: redis, database

## Component: OrderService
Implements FR-004 (Order Processing)
- Location: src/services/order/
- Methods: createOrder(), processPayment(), confirmOrder()
- Dependencies: stripe, email-service
`;

/**
 * Sample existing source code - Auth module
 */
export const EXISTING_AUTH_CODE = `/**
 * Authentication Service
 * Implements FR-001: User Authentication
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export class AuthService {
  private readonly jwtSecret: string;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  async login(email: string, password: string): Promise<string | null> {
    // FR-001.1: Email/password authentication
    const user = await this.findUserByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    return jwt.sign({ userId: user.id }, this.jwtSecret, { expiresIn: '24h' });
  }

  logout(token: string): void {
    // Token blacklisting would be implemented here
  }

  refreshToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      return jwt.sign({ userId: decoded.userId }, this.jwtSecret, { expiresIn: '24h' });
    } catch {
      return null;
    }
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    // Database lookup would be here
    return null;
  }
}
`;

/**
 * Sample existing source code - Product module
 */
export const EXISTING_PRODUCT_CODE = `/**
 * Product Service
 * Implements FR-002: Product Catalog
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
}

export interface ProductFilter {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export class ProductService {
  private products: Map<string, Product> = new Map();

  // FR-002.1: Product listings
  listProducts(page: number, limit: number): Product[] {
    const all = Array.from(this.products.values());
    const start = (page - 1) * limit;
    return all.slice(start, start + limit);
  }

  getProduct(id: string): Product | undefined {
    return this.products.get(id);
  }

  // FR-002.2: Category filtering
  filterProducts(filter: ProductFilter): Product[] {
    return Array.from(this.products.values()).filter(p => {
      if (filter.category && p.category !== filter.category) return false;
      if (filter.minPrice && p.price < filter.minPrice) return false;
      if (filter.maxPrice && p.price > filter.maxPrice) return false;
      if (filter.inStock !== undefined && p.inStock !== filter.inStock) return false;
      return true;
    });
  }

  // FR-002.3: Search
  searchProducts(query: string): Product[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.products.values()).filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
    );
  }
}
`;

/**
 * Sample existing source code - Cart module
 */
export const EXISTING_CART_CODE = `/**
 * Cart Service
 * Implements FR-003: Shopping Cart
 */

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

export class CartService {
  private carts: Map<string, Cart> = new Map();

  // FR-003.1: Add/remove items
  addItem(userId: string, productId: string, quantity: number, price: number): Cart {
    let cart = this.carts.get(userId);
    if (!cart) {
      cart = { userId, items: [], createdAt: new Date(), updatedAt: new Date() };
    }

    const existing = cart.items.find(i => i.productId === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity, price });
    }

    cart.updatedAt = new Date();
    this.carts.set(userId, cart);
    return cart;
  }

  removeItem(userId: string, productId: string): Cart | undefined {
    const cart = this.carts.get(userId);
    if (!cart) return undefined;

    cart.items = cart.items.filter(i => i.productId !== productId);
    cart.updatedAt = new Date();
    return cart;
  }

  // FR-003.2: Get cart
  getCart(userId: string): Cart | undefined {
    return this.carts.get(userId);
  }

  // FR-003.3: Calculate total
  getTotal(userId: string): number {
    const cart = this.carts.get(userId);
    if (!cart) return 0;

    return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}
`;

/**
 * Sample existing source code - Order module
 */
export const EXISTING_ORDER_CODE = `/**
 * Order Service
 * Implements FR-004: Order Processing
 */

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: Date;
}

export class OrderService {
  private orders: Map<string, Order> = new Map();

  // FR-004.1: Create order from cart
  createOrder(userId: string, items: OrderItem[]): Order {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order: Order = {
      id: this.generateId(),
      userId,
      items,
      total,
      status: 'pending',
      createdAt: new Date(),
    };
    this.orders.set(order.id, order);
    return order;
  }

  // FR-004.2: Process payment
  async processPayment(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.status = 'processing';
    // Payment integration would be here
    return true;
  }

  // FR-004.3: Confirm order
  confirmOrder(orderId: string): Order | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;

    order.status = 'completed';
    return order;
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
`;

/**
 * Sample existing source code - User module
 */
export const EXISTING_USER_CODE = `/**
 * User Service
 * Implements user management functionality
 */

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  private users: Map<string, UserProfile> = new Map();

  createUser(email: string, name: string): UserProfile {
    const user: UserProfile = {
      id: this.generateId(),
      email,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  getUser(userId: string): UserProfile | undefined {
    return this.users.get(userId);
  }

  updateUser(userId: string, updates: Partial<UserProfile>): UserProfile | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const updated = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(userId, updated);
    return updated;
  }

  deleteUser(userId: string): boolean {
    return this.users.delete(userId);
  }

  findByEmail(email: string): UserProfile | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
`;

/**
 * Sample test file for existing project
 */
export const EXISTING_TEST_CODE = `/**
 * Auth Service Tests
 */

import { describe, it, expect } from 'vitest';
import { AuthService } from '../services/auth/AuthService';

describe('AuthService', () => {
  const service = new AuthService('test-secret');

  it('should return null for invalid credentials', async () => {
    const result = await service.login('invalid@email.com', 'wrongpassword');
    expect(result).toBeNull();
  });

  it('should refresh a valid token', () => {
    // Mock implementation
    expect(true).toBe(true);
  });
});
`;

/**
 * Enhancement test fixture configuration
 */
export interface EnhancementTestFixture {
  rootDir: string;
  docsPath: string;
  srcPath: string;
  testsPath: string;
  scratchpadPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Feature request for testing simple feature addition
 */
export const SIMPLE_FEATURE_REQUEST = `Add a wishlist feature that allows users to save products for later.
The wishlist should:
- Allow adding/removing products
- Persist across sessions
- Show product availability status
`;

/**
 * Requirement modification request for testing
 */
export const REQUIREMENT_MODIFICATION_REQUEST = `Update the session timeout from 24 hours to 1 hour for security compliance.
Also add session activity tracking to extend timeout on user activity.
`;

/**
 * Multi-component change request for testing
 */
export const MULTI_COMPONENT_CHANGE_REQUEST = `Implement a product recommendation system that:
- Analyzes user browsing history
- Suggests products based on cart contents
- Integrates with product catalog search
- Shows recommendations on cart page
`;

/**
 * Create a complete enhancement test fixture with existing docs and code
 */
export async function createEnhancementFixture(
  options: {
    name?: string;
    includeTests?: boolean;
    partialDocs?: boolean;
    partialCode?: boolean;
  } = {}
): Promise<EnhancementTestFixture> {
  const {
    name = 'enhancement-e2e',
    includeTests = true,
    partialDocs = false,
    partialCode = false,
  } = options;

  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const docsPath = path.join(rootDir, 'docs');
  const srcPath = path.join(rootDir, 'src');
  const testsPath = path.join(rootDir, 'tests');
  const scratchpadPath = path.join(rootDir, '.ad-sdlc', 'scratchpad');

  // Create directory structure
  fs.mkdirSync(path.join(docsPath, 'prd'), { recursive: true });
  fs.mkdirSync(path.join(docsPath, 'srs'), { recursive: true });
  fs.mkdirSync(path.join(docsPath, 'sds'), { recursive: true });
  fs.mkdirSync(path.join(srcPath, 'services', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(srcPath, 'services', 'product'), { recursive: true });
  fs.mkdirSync(path.join(srcPath, 'services', 'cart'), { recursive: true });
  fs.mkdirSync(scratchpadPath, { recursive: true });

  // Create document files
  fs.writeFileSync(path.join(docsPath, 'prd', 'PRD-001.md'), EXISTING_PRD_CONTENT);
  if (!partialDocs) {
    fs.writeFileSync(path.join(docsPath, 'srs', 'SRS-001.md'), EXISTING_SRS_CONTENT);
    fs.writeFileSync(path.join(docsPath, 'sds', 'SDS-001.md'), EXISTING_SDS_CONTENT);
  }

  // Create source files (directly in src for ModeDetector to find)
  // ModeDetector requires minSourceFiles >= 5 to detect codebase.exists = true
  fs.writeFileSync(
    path.join(srcPath, 'AuthService.ts'),
    EXISTING_AUTH_CODE
  );
  if (!partialCode) {
    fs.writeFileSync(
      path.join(srcPath, 'ProductService.ts'),
      EXISTING_PRODUCT_CODE
    );
    fs.writeFileSync(
      path.join(srcPath, 'CartService.ts'),
      EXISTING_CART_CODE
    );
    fs.writeFileSync(
      path.join(srcPath, 'OrderService.ts'),
      EXISTING_ORDER_CODE
    );
    fs.writeFileSync(
      path.join(srcPath, 'UserService.ts'),
      EXISTING_USER_CODE
    );
  }

  // Create test files if requested
  if (includeTests) {
    fs.mkdirSync(testsPath, { recursive: true });
    fs.writeFileSync(path.join(testsPath, 'auth.test.ts'), EXISTING_TEST_CODE);
  }

  // Create package.json for build system detection
  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify(
      {
        name: 'e-commerce-platform',
        version: '2.0.0',
        scripts: {
          test: 'vitest',
          build: 'tsc',
        },
      },
      null,
      2
    )
  );

  const cleanup = async (): Promise<void> => {
    if (fs.existsSync(rootDir)) {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };

  return {
    rootDir,
    docsPath,
    srcPath,
    testsPath,
    scratchpadPath,
    cleanup,
  };
}

/**
 * Create a greenfield fixture (no existing docs or code)
 */
export async function createGreenfieldFixture(
  name: string = 'greenfield-test'
): Promise<EnhancementTestFixture> {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const docsPath = path.join(rootDir, 'docs');
  const srcPath = path.join(rootDir, 'src');
  const testsPath = path.join(rootDir, 'tests');
  const scratchpadPath = path.join(rootDir, '.ad-sdlc', 'scratchpad');

  // Create minimal directory structure
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
    testsPath,
    scratchpadPath,
    cleanup,
  };
}

/**
 * Create a fixture with only codebase (no docs)
 */
export async function createCodeOnlyFixture(
  name: string = 'code-only-test'
): Promise<EnhancementTestFixture> {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const docsPath = path.join(rootDir, 'docs');
  const srcPath = path.join(rootDir, 'src');
  const testsPath = path.join(rootDir, 'tests');
  const scratchpadPath = path.join(rootDir, '.ad-sdlc', 'scratchpad');

  // Create directory structure without docs
  fs.mkdirSync(docsPath, { recursive: true });
  fs.mkdirSync(srcPath, { recursive: true });
  fs.mkdirSync(testsPath, { recursive: true });
  fs.mkdirSync(scratchpadPath, { recursive: true });

  // Create source files only (need >= 5 files for ModeDetector to detect codebase)
  fs.writeFileSync(path.join(srcPath, 'AuthService.ts'), EXISTING_AUTH_CODE);
  fs.writeFileSync(path.join(srcPath, 'ProductService.ts'), EXISTING_PRODUCT_CODE);
  fs.writeFileSync(path.join(srcPath, 'CartService.ts'), EXISTING_CART_CODE);
  fs.writeFileSync(path.join(srcPath, 'OrderService.ts'), EXISTING_ORDER_CODE);
  fs.writeFileSync(path.join(srcPath, 'UserService.ts'), EXISTING_USER_CODE);
  fs.writeFileSync(path.join(testsPath, 'auth.test.ts'), EXISTING_TEST_CODE);

  // Create package.json for build system detection
  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify({ name: 'code-only-project', version: '1.0.0' }, null, 2)
  );

  const cleanup = async (): Promise<void> => {
    if (fs.existsSync(rootDir)) {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };

  return {
    rootDir,
    docsPath,
    srcPath,
    testsPath,
    scratchpadPath,
    cleanup,
  };
}

/**
 * Add a document to the fixture
 */
export function addDocument(
  fixture: EnhancementTestFixture,
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
  fixture: EnhancementTestFixture,
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

/**
 * Add test file to the fixture
 */
export function addTestFile(
  fixture: EnhancementTestFixture,
  filename: string,
  content: string
): void {
  if (!fs.existsSync(fixture.testsPath)) {
    fs.mkdirSync(fixture.testsPath, { recursive: true });
  }
  fs.writeFileSync(path.join(fixture.testsPath, filename), content);
}
