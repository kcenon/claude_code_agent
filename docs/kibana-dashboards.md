# Kibana Dashboard Templates

This document provides ready-to-use Kibana dashboard templates for visualizing logs from the AD-SDLC logging system.

## Prerequisites

- Elasticsearch cluster with AD-SDLC logs indexed
- Kibana connected to the Elasticsearch cluster
- Index pattern configured (e.g., `ad-sdlc-logs-*`)

## Index Pattern Setup

Before importing dashboards, create an index pattern in Kibana:

1. Navigate to **Stack Management** → **Index Patterns**
2. Click **Create index pattern**
3. Enter `ad-sdlc-logs-*` as the index pattern name
4. Select `timestamp` as the time field
5. Click **Create index pattern**

## Dashboard Templates

### 1. Overview Dashboard

A high-level view of system activity and health.

**Import this saved object:**

```json
{
  "attributes": {
    "title": "AD-SDLC Overview",
    "hits": 0,
    "description": "High-level overview of AD-SDLC system activity",
    "panelsJSON": "[{\"gridData\":{\"x\":0,\"y\":0,\"w\":24,\"h\":8,\"i\":\"1\"},\"type\":\"lens\",\"title\":\"Log Volume Over Time\",\"embeddableConfig\":{\"attributes\":{\"visualizationType\":\"lnsXY\",\"state\":{\"datasourceStates\":{\"indexpattern\":{\"layers\":{\"layer1\":{\"columns\":{\"col1\":{\"dataType\":\"date\",\"isBucketed\":true,\"label\":\"@timestamp\",\"operationType\":\"date_histogram\",\"params\":{\"interval\":\"auto\"},\"sourceField\":\"timestamp\"},\"col2\":{\"dataType\":\"number\",\"isBucketed\":false,\"label\":\"Count\",\"operationType\":\"count\"}},\"columnOrder\":[\"col1\",\"col2\"],\"incompleteColumns\":{}}}}},\"visualization\":{\"layers\":[{\"layerId\":\"layer1\",\"accessors\":[\"col2\"],\"position\":\"top\",\"seriesType\":\"bar\",\"xAccessor\":\"col1\"}]}}}}},{\"gridData\":{\"x\":24,\"y\":0,\"w\":24,\"h\":8,\"i\":\"2\"},\"type\":\"lens\",\"title\":\"Logs by Level\",\"embeddableConfig\":{\"attributes\":{\"visualizationType\":\"lnsPie\",\"state\":{\"datasourceStates\":{\"indexpattern\":{\"layers\":{\"layer1\":{\"columns\":{\"col1\":{\"dataType\":\"string\",\"isBucketed\":true,\"label\":\"level\",\"operationType\":\"terms\",\"params\":{\"size\":4,\"orderBy\":{\"type\":\"column\",\"columnId\":\"col2\"},\"orderDirection\":\"desc\"},\"sourceField\":\"level\"},\"col2\":{\"dataType\":\"number\",\"isBucketed\":false,\"label\":\"Count\",\"operationType\":\"count\"}},\"columnOrder\":[\"col1\",\"col2\"],\"incompleteColumns\":{}}}}},\"visualization\":{\"layers\":[{\"layerId\":\"layer1\",\"groups\":[\"col1\"],\"metric\":\"col2\"}]}}}}},{\"gridData\":{\"x\":0,\"y\":8,\"w\":48,\"h\":15,\"i\":\"3\"},\"type\":\"discover\",\"title\":\"Recent Logs\",\"embeddableConfig\":{\"columns\":[\"timestamp\",\"level\",\"message\",\"agentId\",\"stage\"],\"sort\":[[\"timestamp\",\"desc\"]]}}]",
    "optionsJSON": "{\"useMargins\":true}",
    "version": 1,
    "timeRestore": true,
    "timeTo": "now",
    "timeFrom": "now-24h",
    "refreshInterval": {
      "pause": false,
      "value": 30000
    }
  },
  "type": "dashboard"
}
```

### 2. Agent Activity Dashboard

Monitor activity across different agents in the pipeline.

**Visualizations included:**

#### Agent Distribution (Pie Chart)

```json
{
  "title": "Agent Distribution",
  "type": "pie",
  "params": {
    "addTooltip": true,
    "addLegend": true,
    "type": "pie"
  },
  "aggs": [
    {
      "id": "1",
      "type": "count",
      "schema": "metric"
    },
    {
      "id": "2",
      "type": "terms",
      "schema": "segment",
      "params": {
        "field": "agentId",
        "size": 10,
        "orderBy": "1"
      }
    }
  ]
}
```

#### Agent Activity Timeline (Line Chart)

```json
{
  "title": "Agent Activity Timeline",
  "type": "line",
  "params": {
    "addTooltip": true,
    "addLegend": true,
    "type": "line"
  },
  "aggs": [
    {
      "id": "1",
      "type": "count",
      "schema": "metric"
    },
    {
      "id": "2",
      "type": "date_histogram",
      "schema": "segment",
      "params": {
        "field": "timestamp",
        "interval": "auto"
      }
    },
    {
      "id": "3",
      "type": "terms",
      "schema": "group",
      "params": {
        "field": "agentId",
        "size": 10
      }
    }
  ]
}
```

### 3. Error Analysis Dashboard

Focus on error logs for debugging and monitoring.

**Error Rate Over Time:**

```json
{
  "title": "Error Rate",
  "type": "line",
  "params": {
    "addTooltip": true,
    "type": "line"
  },
  "aggs": [
    {
      "id": "1",
      "type": "count",
      "schema": "metric"
    },
    {
      "id": "2",
      "type": "date_histogram",
      "schema": "segment",
      "params": {
        "field": "timestamp",
        "interval": "1h"
      }
    },
    {
      "id": "3",
      "type": "filters",
      "schema": "group",
      "params": {
        "filters": [
          {
            "input": { "query": "level:ERROR" },
            "label": "Errors"
          },
          {
            "input": { "query": "level:WARN" },
            "label": "Warnings"
          }
        ]
      }
    }
  ]
}
```

**Top Error Types:**

```json
{
  "title": "Top Error Types",
  "type": "table",
  "params": {
    "perPage": 10
  },
  "aggs": [
    {
      "id": "1",
      "type": "count",
      "schema": "metric"
    },
    {
      "id": "2",
      "type": "terms",
      "schema": "bucket",
      "params": {
        "field": "error.name",
        "size": 10
      }
    },
    {
      "id": "3",
      "type": "terms",
      "schema": "bucket",
      "params": {
        "field": "error.message",
        "size": 5
      }
    }
  ]
}
```

### 4. Pipeline Stage Dashboard

Monitor log activity by pipeline stage.

**Stage Distribution:**

```json
{
  "title": "Logs by Stage",
  "type": "horizontal_bar",
  "params": {
    "addTooltip": true,
    "addLegend": true
  },
  "aggs": [
    {
      "id": "1",
      "type": "count",
      "schema": "metric"
    },
    {
      "id": "2",
      "type": "terms",
      "schema": "segment",
      "params": {
        "field": "stage",
        "size": 20,
        "orderBy": "1",
        "orderDirection": "desc"
      }
    }
  ]
}
```

**Stage Error Rate:**

```json
{
  "title": "Error Rate by Stage",
  "type": "bar",
  "params": {
    "addTooltip": true,
    "addLegend": true
  },
  "aggs": [
    {
      "id": "1",
      "type": "count",
      "schema": "metric"
    },
    {
      "id": "2",
      "type": "terms",
      "schema": "segment",
      "params": {
        "field": "stage",
        "size": 10
      }
    },
    {
      "id": "3",
      "type": "filters",
      "schema": "group",
      "params": {
        "filters": [
          { "input": { "query": "level:INFO" }, "label": "Info" },
          { "input": { "query": "level:WARN" }, "label": "Warn" },
          { "input": { "query": "level:ERROR" }, "label": "Error" }
        ]
      }
    }
  ]
}
```

### 5. Performance Dashboard

Track operation durations and performance metrics.

**Average Duration by Agent:**

```json
{
  "title": "Average Duration by Agent",
  "type": "bar",
  "params": {
    "addTooltip": true,
    "addLegend": true
  },
  "aggs": [
    {
      "id": "1",
      "type": "avg",
      "schema": "metric",
      "params": {
        "field": "durationMs"
      }
    },
    {
      "id": "2",
      "type": "terms",
      "schema": "segment",
      "params": {
        "field": "agentId",
        "size": 10,
        "orderBy": "1",
        "orderDirection": "desc"
      }
    }
  ]
}
```

**Duration Percentiles:**

```json
{
  "title": "Duration Percentiles",
  "type": "line",
  "params": {
    "addTooltip": true,
    "addLegend": true
  },
  "aggs": [
    {
      "id": "1",
      "type": "percentiles",
      "schema": "metric",
      "params": {
        "field": "durationMs",
        "percents": [50, 90, 95, 99]
      }
    },
    {
      "id": "2",
      "type": "date_histogram",
      "schema": "segment",
      "params": {
        "field": "timestamp",
        "interval": "auto"
      }
    }
  ]
}
```

### 6. Distributed Tracing Dashboard

Track request flows using correlation IDs and trace context.

**Trace Overview:**

```json
{
  "title": "Unique Traces",
  "type": "metric",
  "params": {
    "fontSize": 60
  },
  "aggs": [
    {
      "id": "1",
      "type": "cardinality",
      "schema": "metric",
      "params": {
        "field": "traceId"
      }
    }
  ]
}
```

**Correlation Flow (Table):**

Use this saved search to trace a specific correlation ID:

```json
{
  "title": "Correlation Trace",
  "columns": [
    "timestamp",
    "level",
    "agentId",
    "stage",
    "message",
    "spanId",
    "parentSpanId",
    "durationMs"
  ],
  "sort": [["timestamp", "asc"]],
  "query": {
    "query": "correlationId: \"YOUR_CORRELATION_ID\"",
    "language": "kuery"
  }
}
```

## CloudWatch Logs Insights Queries

For CloudWatch, use these Logs Insights queries instead:

### Error Summary

```sql
fields @timestamp, level, message, agentId, stage
| filter level = "ERROR"
| stats count(*) as error_count by agentId, error.name
| sort error_count desc
| limit 20
```

### Agent Activity

```sql
fields @timestamp, agentId, stage, message
| filter agentId != ""
| stats count(*) as log_count by agentId
| sort log_count desc
```

### Performance Analysis

```sql
fields @timestamp, agentId, stage, durationMs
| filter durationMs > 0
| stats avg(durationMs) as avg_duration, max(durationMs) as max_duration, pct(durationMs, 95) as p95 by agentId
| sort avg_duration desc
```

### Trace Investigation

```sql
fields @timestamp, level, agentId, stage, message, traceId, spanId
| filter correlationId = "YOUR_CORRELATION_ID"
| sort @timestamp asc
```

### Log Volume Trend

```sql
fields @timestamp
| stats count(*) as log_count by bin(1h)
| sort @timestamp desc
| limit 24
```

### Error Rate Trend

```sql
fields @timestamp, level
| stats count(*) as total,
        sum(case when level = "ERROR" then 1 else 0 end) as errors,
        sum(case when level = "WARN" then 1 else 0 end) as warnings
        by bin(1h)
| sort @timestamp desc
| limit 24
```

## Importing Dashboards

### Kibana Import Steps

1. Navigate to **Stack Management** → **Saved Objects**
2. Click **Import**
3. Upload the JSON file containing the dashboard
4. Select the index pattern when prompted
5. Click **Import**

### Programmatic Import

```bash
# Using curl to import a dashboard
curl -X POST "http://localhost:5601/api/saved_objects/_import" \
  -H "kbn-xsrf: true" \
  --form file=@dashboard.ndjson
```

## Alerting Rules

### High Error Rate Alert

Create an alert when error rate exceeds threshold:

```json
{
  "rule_type_id": "logs.alert.document.count",
  "name": "High Error Rate",
  "tags": ["ad-sdlc", "errors"],
  "schedule": {
    "interval": "5m"
  },
  "params": {
    "timeField": "timestamp",
    "timeSize": 5,
    "timeUnit": "m",
    "threshold": [100],
    "thresholdComparator": ">",
    "groupBy": "all",
    "criteria": [
      {
        "field": "level",
        "comparator": "equals",
        "value": "ERROR"
      }
    ]
  },
  "actions": [
    {
      "group": "threshold met",
      "id": "your-action-id",
      "params": {
        "message": "High error rate detected: {{context.value}} errors in last 5 minutes"
      }
    }
  ]
}
```

### Agent Health Alert

Alert when an agent stops logging:

```json
{
  "rule_type_id": "logs.alert.document.count",
  "name": "Agent Inactive",
  "tags": ["ad-sdlc", "health"],
  "schedule": {
    "interval": "15m"
  },
  "params": {
    "timeField": "timestamp",
    "timeSize": 15,
    "timeUnit": "m",
    "threshold": [1],
    "thresholdComparator": "<",
    "groupBy": "top",
    "groupByField": "agentId",
    "criteria": []
  },
  "actions": [
    {
      "group": "threshold met",
      "id": "your-action-id",
      "params": {
        "message": "Agent {{context.group}} has been inactive for 15 minutes"
      }
    }
  ]
}
```

## Best Practices

1. **Time Range**: Use appropriate time ranges for your dashboards
   - Real-time monitoring: Last 15 minutes with 10-second refresh
   - Daily review: Last 24 hours
   - Weekly trends: Last 7 days

2. **Index Lifecycle Management**: Configure ILM policies to manage index growth
   ```json
   {
     "policy": {
       "phases": {
         "hot": { "actions": { "rollover": { "max_size": "50gb", "max_age": "1d" } } },
         "warm": { "min_age": "7d", "actions": { "shrink": { "number_of_shards": 1 } } },
         "delete": { "min_age": "30d", "actions": { "delete": {} } }
       }
     }
   }
   ```

3. **Field Mappings**: Ensure proper field types for efficient queries
   - Use `keyword` for exact match fields (level, agentId, stage)
   - Use `text` for full-text search fields (message)
   - Use `date` for timestamp fields
   - Use `long` for numeric fields (durationMs)

4. **Saved Searches**: Create saved searches for common queries
   - "Recent Errors": `level:ERROR`
   - "Slow Operations": `durationMs:>1000`
   - "Agent X Activity": `agentId:"worker-1"`

5. **Space Organization**: Use Kibana Spaces for different environments
   - Production dashboards in "Production" space
   - Development dashboards in "Development" space
