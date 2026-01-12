# Secret Management

This document describes the pluggable secret management system in AD-SDLC.

## Overview

The secret management system provides a unified interface for retrieving secrets from multiple backends:

- **Local Provider**: Environment variables (default fallback)
- **AWS Secrets Manager**: AWS cloud secret storage
- **HashiCorp Vault**: Enterprise secret management
- **Azure Key Vault**: Azure cloud secret storage

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ProviderSecretManager                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Circuit Breaker (per provider)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                             │                               │
│  ┌──────────┬──────────┬──────────┬──────────┐            │
│  │ AWS      │ Vault    │ Azure    │ Local    │            │
│  │ Provider │ Provider │ Provider │ Provider │            │
│  └──────────┴──────────┴──────────┴──────────┘            │
│                             │                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Environment Variable Fallback           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Basic Usage with Local Provider

```typescript
import { LocalProvider, ProviderSecretManager } from './src/security/secrets';

// Create manager with env fallback
const manager = new ProviderSecretManager({ envFallback: true });

// Add local provider
const localProvider = new LocalProvider({ type: 'local' });
await manager.addProvider(localProvider);

// Get secrets
const apiKey = await manager.getSecretOrThrow('api/key');
// Retrieves from process.env.API_KEY

// Shutdown when done
await manager.shutdown();
```

### Using Multiple Providers

```typescript
import {
  ProviderSecretManager,
  AWSSecretsManagerProvider,
  LocalProvider,
} from './src/security/secrets';

const manager = new ProviderSecretManager({ envFallback: true });

// AWS provider (highest priority)
const awsProvider = new AWSSecretsManagerProvider({
  type: 'aws-secrets-manager',
  region: 'us-east-1',
  prefix: 'myapp', // Secrets stored as myapp/secret-name
});
await manager.addProvider(awsProvider);

// Local fallback
const localProvider = new LocalProvider({ type: 'local' });
await manager.addProvider(localProvider);

// Retrieval tries AWS first, then local, then env vars
const dbPassword = await manager.getSecret('database/password');
```

### Using Factory with Configuration

```typescript
import { SecretProviderFactory } from './src/security/secrets';

const factory = new SecretProviderFactory();

const manager = await factory.createManager({
  envFallback: true,
  providers: [
    {
      type: 'aws-secrets-manager',
      enabled: process.env.USE_AWS === 'true',
      region: '${AWS_REGION:-us-east-1}',
      prefix: 'myapp',
    },
    {
      type: 'vault',
      enabled: process.env.USE_VAULT === 'true',
      endpoint: '${VAULT_ADDR}',
      token: '${VAULT_TOKEN}',
      secretsPath: 'secret/data/myapp',
    },
    {
      type: 'local',
      enabled: true, // Always enabled as fallback
    },
  ],
});
```

## Provider Configuration

### Local Provider

Reads secrets from environment variables.

```typescript
const provider = new LocalProvider({
  type: 'local',
  envPrefix: 'APP_', // Optional: prepend to env var names
  cacheTTL: 300000,  // Cache for 5 minutes (default)
});
```

Secret name to env var conversion:
- `github/token` → `GITHUB_TOKEN` (or `APP_GITHUB_TOKEN` with prefix)
- `database.password` → `DATABASE_PASSWORD`
- `api-key` → `API_KEY`

### AWS Secrets Manager Provider

```typescript
const provider = new AWSSecretsManagerProvider({
  type: 'aws-secrets-manager',
  region: 'us-east-1',
  prefix: 'myapp',           // Optional: prefix for secret names
  cacheTTL: 300000,          // Cache for 5 minutes (default)
  healthCheckSecret: 'health', // Optional: specific secret for health check

  // Optional: explicit credentials (uses IAM role if not provided)
  credentials: {
    accessKeyId: 'AKIA...',
    secretAccessKey: '...',
    sessionToken: '...',     // Optional: for temporary credentials
  },
});
```

### HashiCorp Vault Provider

```typescript
const provider = new VaultProvider({
  type: 'vault',
  endpoint: 'https://vault.example.com:8200',
  namespace: 'myorg',        // Optional: Vault Enterprise namespace
  secretsPath: 'secret/data/myapp', // KV v2 path
  cacheTTL: 300000,

  // Token authentication
  token: 'hvs.xxx',

  // OR AppRole authentication
  appRole: {
    roleId: 'role-id',
    secretId: 'secret-id',
  },
});
```

### Azure Key Vault Provider

```typescript
const provider = new AzureKeyVaultProvider({
  type: 'azure-keyvault',
  vaultUrl: 'https://myvault.vault.azure.net',
  cacheTTL: 300000,

  // Use managed identity (recommended for Azure environments)
  useManagedIdentity: true,

  // OR service principal authentication
  tenantId: 'tenant-id',
  clientId: 'client-id',
  clientSecret: 'client-secret',
});
```

## Features

### Secret Caching

All providers cache retrieved secrets to reduce API calls:

```typescript
// First call: fetches from provider
const secret1 = await manager.getSecret('api/key');

// Second call: returns cached value
const secret2 = await manager.getSecret('api/key');

// Force cache refresh
provider.clearCache();
const secret3 = await manager.getSecret('api/key'); // Fetches again
```

### Circuit Breaker

The manager includes a circuit breaker to handle provider failures:

```typescript
// After 5 consecutive failures, circuit opens
// Provider is skipped for 30 seconds
// After 30 seconds, circuit enters half-open state
// 3 successful calls close the circuit

// Check circuit breaker status
const health = await manager.getHealth();
console.log(health.providers[0].circuitBreaker.state);
// 'closed' | 'open' | 'half-open'

// Manually reset circuit breaker
manager.resetCircuitBreaker('aws-secrets-manager');
```

### Environment Variable Fallback

When `envFallback: true`, the manager tries environment variables as a last resort:

```typescript
const manager = new ProviderSecretManager({ envFallback: true });

// If not found in any provider, tries:
// process.env.DATABASE_PASSWORD
const password = await manager.getSecret('database/password');
```

### Secret Metadata

Get full secret information including metadata:

```typescript
const secret = await manager.getSecretWithMetadata('api/key');
console.log(secret);
// {
//   value: 'secret-value',
//   version: 'v1',
//   expiresAt: Date,
//   metadata: {
//     arn: 'arn:aws:secretsmanager:...',
//     createdDate: '2024-01-01T00:00:00Z',
//   }
// }
```

### Health Monitoring

Check the health of all providers:

```typescript
const health = await manager.getHealth();
console.log(health);
// {
//   healthy: true,
//   providers: [
//     {
//       name: 'aws-secrets-manager',
//       healthy: true,
//       circuitBreaker: { state: 'closed', failureCount: 0, ... }
//     },
//     ...
//   ]
// }
```

## Configuration File

Example YAML configuration:

```yaml
# .ad-sdlc/config.yaml
secrets:
  envFallback: true
  defaultCacheTTL: 300000

  providers:
    # AWS Secrets Manager
    - type: aws-secrets-manager
      enabled: ${USE_AWS_SECRETS:-false}
      region: ${AWS_REGION:-us-east-1}
      prefix: ad-sdlc
      cacheTTL: 300000

    # HashiCorp Vault
    - type: vault
      enabled: ${USE_VAULT:-false}
      endpoint: ${VAULT_ADDR}
      secretsPath: secret/data/ad-sdlc
      appRole:
        roleId: ${VAULT_ROLE_ID}
        secretId: ${VAULT_SECRET_ID}

    # Azure Key Vault
    - type: azure-keyvault
      enabled: ${USE_AZURE_KEYVAULT:-false}
      vaultUrl: ${AZURE_KEYVAULT_URL}
      useManagedIdentity: true

    # Local (environment variables)
    - type: local
      enabled: true
```

## Security Best Practices

1. **Use IAM roles** instead of hardcoded credentials when possible
2. **Enable secret rotation** in your cloud provider
3. **Set appropriate cache TTLs** based on rotation frequency
4. **Use circuit breakers** to handle provider outages gracefully
5. **Never log secret values** - use the `mask()` method for logs
6. **Limit secret access** using least privilege principle

## Dependencies

Install required dependencies based on which providers you use:

```bash
# AWS Secrets Manager
npm install @aws-sdk/client-secrets-manager

# HashiCorp Vault
npm install node-vault

# Azure Key Vault
npm install @azure/keyvault-secrets @azure/identity
```

## Migration from Environment Variables

To migrate from direct environment variable usage:

1. Add secrets to your cloud provider
2. Configure the appropriate provider
3. Update code to use `ProviderSecretManager`
4. Keep `envFallback: true` during transition
5. Remove environment variables once migration is verified
