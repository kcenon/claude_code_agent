# Telemetry

The AD-SDLC telemetry system provides opt-in anonymous usage analytics to help improve the tool.

## Overview

The telemetry module implements a privacy-first approach to usage analytics:

- **Explicit Opt-In**: No data is collected without user consent
- **Anonymous Data Only**: No personal or identifying information is collected
- **Easy Control**: Simple CLI commands to enable/disable telemetry
- **Transparency**: Clear documentation of what data is collected

## Quick Start

### Check Telemetry Status

```bash
ad-sdlc telemetry status
```

### Enable Telemetry

```bash
# Show privacy policy first
ad-sdlc telemetry enable

# Accept and enable
ad-sdlc telemetry enable --yes
```

### Disable Telemetry

```bash
ad-sdlc telemetry disable
```

### View Privacy Policy

```bash
ad-sdlc telemetry policy
```

## Privacy Policy

### Data We Collect (Anonymous Only)

When telemetry is enabled, the following anonymous data is collected:

- **Command usage**: Which CLI commands are run (e.g., `init`, `analyze`)
- **Pipeline metrics**: Duration and stage count (no content details)
- **Feature usage patterns**: Which features are used
- **Error types**: Categories of errors (not error messages or stack traces)
- **Platform information**: OS type and Node.js version

### Data We DO NOT Collect

The following data is **never** collected:

- Personal identifying information (name, email, IP address)
- Project names or file paths
- File contents or code
- API keys or credentials
- Error messages or stack traces
- Git repository information
- User-generated content

### Data Retention

- All telemetry data is automatically deleted after **90 days**

## Configuration

### CLI Configuration

Telemetry can be configured via the CLI:

```bash
# Enable with automatic consent
ad-sdlc telemetry enable --yes

# Disable and revoke consent
ad-sdlc telemetry disable
```

### YAML Configuration

Telemetry settings can also be configured in `workflow.yaml`:

```yaml
telemetry:
  enabled: false  # Must be combined with CLI consent
  flush_interval_ms: 60000
  max_buffer_size: 100
  include_debug_events: false
```

> **Note**: The `enabled` setting in YAML only takes effect if the user has granted consent via the CLI.

## Programmatic Usage

### Basic Usage

```typescript
import { getTelemetry } from 'ad-sdlc';

const telemetry = getTelemetry();

// Check consent status
if (telemetry.getConsentStatus() === 'pending') {
  // Show privacy policy to user
  const policy = telemetry.getPrivacyPolicy();
  console.log(policy.dataCollected);
  console.log(policy.dataNotCollected);

  // Set consent based on user choice
  telemetry.setConsent(true);
}

// Record events (only if consent granted)
telemetry.recordCommandExecution('analyze', true, 5000);
```

### Recording Events

```typescript
// Command execution
telemetry.recordCommandExecution('init', true, 1500);

// Pipeline events
telemetry.recordPipelineEvent('started', 'full', 5);
telemetry.recordPipelineEvent('completed', 'full', 5, 30000);
telemetry.recordPipelineEvent('failed', 'full', 5, 15000, 'ValidationError');

// Feature usage
telemetry.recordFeatureUsage('interactive_wizard', 'init');
```

### Consent Management

```typescript
// Check current consent status
const status = telemetry.getConsentStatus(); // 'pending' | 'granted' | 'denied'

// Check if telemetry is active
const isEnabled = telemetry.isEnabled();

// Grant consent
telemetry.setConsent(true);

// Revoke consent (clears all buffered data)
telemetry.revokeConsent();
```

### Statistics

```typescript
const stats = telemetry.getStats();
console.log(stats.eventsRecorded);    // Total events in session
console.log(stats.eventsPending);      // Events waiting to flush
console.log(stats.sessionDurationMs);  // Session duration
```

## API Reference

### Telemetry Class

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseDir` | `string` | `~/.ad-sdlc` | Directory for consent file |
| `config.enabled` | `boolean` | `false` | Enable telemetry (requires consent) |
| `config.flushIntervalMs` | `number` | `60000` | Auto-flush interval |
| `config.maxBufferSize` | `number` | `100` | Max events before flush |
| `autoFlush` | `boolean` | `true` | Enable automatic flushing |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getConsentStatus()` | `ConsentStatus` | Get current consent status |
| `setConsent(granted)` | `ConsentRecord` | Set consent status |
| `revokeConsent()` | `ConsentRecord` | Revoke consent and clear data |
| `getPrivacyPolicy()` | `PrivacyPolicy` | Get privacy policy details |
| `isEnabled()` | `boolean` | Check if telemetry is active |
| `recordEvent(type, props)` | `TelemetryEvent \| null` | Record a telemetry event |
| `recordCommandExecution(...)` | `TelemetryEvent \| null` | Record command execution |
| `recordPipelineEvent(...)` | `TelemetryEvent \| null` | Record pipeline event |
| `recordFeatureUsage(...)` | `TelemetryEvent \| null` | Record feature usage |
| `flush()` | `number` | Flush buffered events |
| `getStats()` | `TelemetryStats` | Get session statistics |
| `shutdown()` | `number` | Shutdown and flush |

### Event Types

| Type | Description |
|------|-------------|
| `command_executed` | CLI command was run |
| `pipeline_started` | Pipeline execution started |
| `pipeline_completed` | Pipeline execution completed |
| `pipeline_failed` | Pipeline execution failed |
| `agent_invoked` | Agent was invoked |
| `error_occurred` | Error occurred |
| `feature_used` | Feature was used |

## Error Handling

The telemetry module defines the following error types:

| Error | Code | Description |
|-------|------|-------------|
| `TelemetryError` | - | Base error class |
| `ConsentRequiredError` | `CONSENT_REQUIRED` | Action requires consent |
| `ConsentStorageError` | `CONSENT_STORAGE_ERROR` | Failed to store consent |
| `InvalidEventError` | `INVALID_EVENT` | Invalid event type |
| `FlushError` | `FLUSH_ERROR` | Failed to flush events |
| `TelemetryDisabledError` | `TELEMETRY_DISABLED` | Telemetry is disabled |

## Best Practices

1. **Always Show Privacy Policy**: Before enabling telemetry, show users what data will be collected
2. **Respect User Choice**: Never enable telemetry without explicit consent
3. **Handle Gracefully**: Telemetry methods return `null` when disabled - no errors
4. **Clean Shutdown**: Call `shutdown()` to flush pending events before exit

## Troubleshooting

### Telemetry Not Recording Events

1. Check consent status: `ad-sdlc telemetry status`
2. Ensure telemetry is enabled in config
3. Verify consent was granted via CLI

### Consent File Issues

The consent file is stored at `~/.ad-sdlc/telemetry-consent.json`. If you encounter issues:

```bash
# Check consent file
cat ~/.ad-sdlc/telemetry-consent.json

# Reset consent
rm ~/.ad-sdlc/telemetry-consent.json
ad-sdlc telemetry enable --yes
```
