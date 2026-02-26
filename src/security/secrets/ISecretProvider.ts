/**
 * ISecretProvider - Interface for secret provider implementations
 *
 * Re-exports from the canonical location at ../secret-provider-types.ts.
 * This file exists for backward compatibility so that internal modules
 * in secrets/ can continue to import from './ISecretProvider.js'.
 *
 * @module security/secrets
 */

export type { ISecretProvider } from '../secret-provider-types.js';
