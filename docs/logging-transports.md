# Log Transports

The AD-SDLC logging system supports pluggable transport implementations for shipping logs to various destinations. This document describes the available transports and their configuration.

## Overview

Log transports implement the `ILogTransport` interface and handle the actual shipping of log entries to their destinations. The system supports:

- **ConsoleTransport** - Console output with JSON or pretty format
- **FileTransport** - File-based logging with rotation support
- **ElasticsearchTransport** - Elasticsearch for centralized log aggregation
- **CloudWatchTransport** - AWS CloudWatch Logs for cloud-native logging

## Transport Interface

All transports implement the `ILogTransport` interface:

```typescript
interface ILogTransport {
  readonly name: string;
  initialize(): Promise<void>;
  log(entry: TransportLogEntry): Promise<void>;
  flush(): Promise<void>;
  close(): Promise<void>;
  getHealth?(): TransportHealth;
  isReady?(): boolean;
}
```

## ConsoleTransport

Outputs logs to the console with support for JSON and pretty-printed formats.

### Configuration

```typescript
import { ConsoleTransport } from 'ad-sdlc';

const transport = new ConsoleTransport({
  type: 'console',
  format: 'pretty',      // 'json' or 'pretty'
  colors: true,          // Enable ANSI colors
  includeTimestamp: true,
  minLevel: 'INFO',
});

await transport.initialize();
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `'json' \| 'pretty'` | `'pretty'` | Output format |
| `colors` | `boolean` | Auto-detect TTY | Enable ANSI colors |
| `includeTimestamp` | `boolean` | `true` | Include timestamp in pretty format |
| `minLevel` | `LogLevel` | `'DEBUG'` | Minimum log level to output |

## FileTransport

Writes logs to files with support for rotation by size and date.

### Configuration

```typescript
import { FileTransport } from 'ad-sdlc';

const transport = new FileTransport({
  type: 'file',
  path: '.ad-sdlc/logs',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  compress: true,
  datePattern: 'daily',
});

await transport.initialize();
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | Required | Log directory path |
| `maxFileSize` | `number` | `10MB` | Max file size before rotation |
| `maxFiles` | `number` | `5` | Max files to keep |
| `fileNamePattern` | `string` | `'app-%DATE%.jsonl'` | File name pattern |
| `compress` | `boolean` | `false` | Compress rotated files |
| `datePattern` | `string` | - | Date rotation: `'daily'`, `'hourly'` |

## ElasticsearchTransport

Ships logs to Elasticsearch for centralized log aggregation and analysis.

### Installation

The Elasticsearch transport requires the `@elastic/elasticsearch` package:

```bash
npm install @elastic/elasticsearch
```

### Basic Configuration

```typescript
import { ElasticsearchTransport } from 'ad-sdlc';

const transport = new ElasticsearchTransport({
  type: 'elasticsearch',
  nodes: ['http://localhost:9200'],
  indexPrefix: 'app-logs',
});

await transport.initialize();
```

### With Authentication

```typescript
// Username/Password authentication
const transport = new ElasticsearchTransport({
  type: 'elasticsearch',
  nodes: ['https://elasticsearch.example.com:9200'],
  auth: {
    username: 'elastic',
    password: 'changeme',
  },
  tls: true,
});

// API Key authentication
const transport = new ElasticsearchTransport({
  type: 'elasticsearch',
  nodes: ['https://elasticsearch.example.com:9200'],
  auth: {
    apiKey: 'your-api-key',
  },
  tls: true,
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nodes` | `string[]` | Required | Elasticsearch node URLs |
| `auth.username` | `string` | - | Username for basic auth |
| `auth.password` | `string` | - | Password for basic auth |
| `auth.apiKey` | `string` | - | API key for authentication |
| `indexPrefix` | `string` | `'ad-sdlc-logs'` | Index name prefix |
| `indexDatePattern` | `string` | `'YYYY.MM.DD'` | Index date pattern |
| `tls` | `boolean` | `false` | Enable TLS/SSL |
| `caCertPath` | `string` | - | CA certificate path |
| `requestTimeout` | `number` | `30000` | Request timeout in ms |
| `numberOfShards` | `number` | `1` | Index shards |
| `numberOfReplicas` | `number` | `1` | Index replicas |
| `bufferSize` | `number` | `100` | Buffer size before flush |
| `flushIntervalMs` | `number` | `5000` | Auto-flush interval |
| `maxRetries` | `number` | `3` | Max retry attempts |

### Index Naming

The transport creates daily/monthly/weekly indices based on the `indexDatePattern`:

- `YYYY.MM.DD` - Daily indices (default): `app-logs-2024.01.15`
- `YYYY.MM` - Monthly indices: `app-logs-2024.01`
- `YYYY.WW` - Weekly indices: `app-logs-2024.03`

### Index Template

The transport automatically creates an index template with proper field mappings:

```json
{
  "properties": {
    "timestamp": { "type": "date" },
    "level": { "type": "keyword" },
    "message": { "type": "text" },
    "correlationId": { "type": "keyword" },
    "agentId": { "type": "keyword" },
    "traceId": { "type": "keyword" },
    "spanId": { "type": "keyword" },
    "stage": { "type": "keyword" },
    "projectId": { "type": "keyword" },
    "sessionId": { "type": "keyword" },
    "durationMs": { "type": "long" },
    "error": { "type": "object" },
    "context": { "type": "object" }
  }
}
```

### Bulk Indexing

The transport uses Elasticsearch's bulk API for efficient log shipping:

- Logs are buffered until `bufferSize` is reached
- Automatic flush occurs every `flushIntervalMs`
- Failed batches are retried up to `maxRetries` times

## CloudWatchTransport

Ships logs to AWS CloudWatch Logs for cloud-native centralized logging.

### Installation

The CloudWatch transport requires the `@aws-sdk/client-cloudwatch-logs` package:

```bash
npm install @aws-sdk/client-cloudwatch-logs
```

### Basic Configuration

```typescript
import { CloudWatchTransport } from 'ad-sdlc';

const transport = new CloudWatchTransport({
  type: 'cloudwatch',
  region: 'us-east-1',
  logGroupName: '/app/logs',
});

await transport.initialize();
```

### With Explicit Credentials

```typescript
// Explicit credentials
const transport = new CloudWatchTransport({
  type: 'cloudwatch',
  region: 'us-east-1',
  logGroupName: '/app/logs',
  credentials: {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  },
});

// With session token (for temporary credentials)
const transport = new CloudWatchTransport({
  type: 'cloudwatch',
  region: 'us-east-1',
  logGroupName: '/app/logs',
  credentials: {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    sessionToken: 'AQoDYXdzEJr...',
  },
});
```

> **Note:** If credentials are not provided, the transport uses the AWS default credential chain (environment variables, shared credentials file, EC2 instance profile, etc.).

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `region` | `string` | Required | AWS region |
| `logGroupName` | `string` | Required | CloudWatch log group name |
| `logStreamPrefix` | `string` | `'ad-sdlc'` | Log stream name prefix |
| `credentials.accessKeyId` | `string` | - | AWS access key ID |
| `credentials.secretAccessKey` | `string` | - | AWS secret access key |
| `credentials.sessionToken` | `string` | - | AWS session token |
| `createLogGroup` | `boolean` | `true` | Create log group if not exists |
| `retentionInDays` | `number` | `30` | Log retention in days |
| `bufferSize` | `number` | `100` | Buffer size before flush |
| `flushIntervalMs` | `number` | `5000` | Auto-flush interval |
| `maxRetries` | `number` | `3` | Max retry attempts |
| `minLevel` | `LogLevel` | `'DEBUG'` | Minimum log level |

### Log Group and Stream Management

The transport automatically manages CloudWatch resources:

1. **Log Group** - Created automatically if `createLogGroup` is `true`
2. **Log Stream** - Created per session with format: `{prefix}/{hostname}/{timestamp}`
3. **Retention Policy** - Applied based on `retentionInDays`

### Sequence Token Handling

CloudWatch Logs requires sequence tokens for log ordering. The transport handles:

- Initial sequence token acquisition
- Token refresh on `InvalidSequenceTokenException`
- Duplicate data handling with `DataAlreadyAcceptedException`

### Batch Limits

The transport respects AWS CloudWatch Logs limits:

- Maximum 10,000 log events per batch
- Maximum 1,048,576 bytes per batch
- Events are automatically split into multiple batches if needed

### Log Format

Logs are stored as JSON in CloudWatch:

```json
{
  "level": "INFO",
  "message": "Application started",
  "correlationId": "abc-123",
  "agentId": "worker-1",
  "traceId": "trace-xyz",
  "stage": "implementation",
  "context": { "userId": "123" }
}
```

### IAM Permissions

Required IAM permissions for the transport:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:PutRetentionPolicy"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/app/logs*"
    }
  ]
}
```

### Querying Logs

Use CloudWatch Logs Insights to query logs:

```sql
fields @timestamp, level, message, correlationId
| filter level = 'ERROR'
| sort @timestamp desc
| limit 100
```

## Creating Custom Transports

Extend `BaseTransport` to create custom transports:

```typescript
import { BaseTransport, TransportLogEntry } from 'ad-sdlc';

class CustomTransport extends BaseTransport {
  constructor(config: CustomTransportConfig) {
    super('custom', config);
  }

  protected async doInitialize(): Promise<void> {
    // Initialize connection
  }

  protected async doLog(entries: TransportLogEntry[]): Promise<void> {
    // Ship log entries
  }

  protected async doFlush(): Promise<void> {
    // Flush pending logs
  }

  protected async doClose(): Promise<void> {
    // Close connection
  }
}
```

## Log Entry Format

All transports receive entries in the `TransportLogEntry` format:

```typescript
interface TransportLogEntry {
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  context: Record<string, unknown>;
  correlationId?: string;
  agentId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  stage?: string;
  projectId?: string;
  sessionId?: string;
  durationMs?: number;
  error?: ErrorInfo;
  source?: string;
  hostname?: string;
  pid?: number;
}
```

## Health Monitoring

Transports provide health information:

```typescript
const health = transport.getHealth();
console.log(health);
// {
//   state: 'ready',
//   pendingLogs: 5,
//   failedAttempts: 0,
//   totalProcessed: 150,
//   lastLogTime: Date,
// }
```

## Best Practices

1. **Use buffering for remote transports** - Enable batching to reduce network overhead
2. **Configure appropriate flush intervals** - Balance latency vs efficiency
3. **Set minimum log levels per transport** - Console: INFO, File: DEBUG, Elasticsearch: INFO
4. **Monitor transport health** - Track pending logs and failed attempts
5. **Use correlation IDs** - Enable request tracing across services
