/**
 * LogQueryParser - Structured query language parser for log search
 *
 * Provides a simple but powerful query language for filtering logs.
 *
 * Query syntax:
 * - field:value - Match field equal to value
 * - field:"value with spaces" - Match field with quoted value
 * - time:2024-01-01..2024-01-31 - Time range query
 * - level:error AND agent:worker - Logical AND
 * - level:error OR level:warn - Logical OR
 * - NOT level:debug - Logical NOT
 * - (level:error OR level:warn) AND agent:worker - Grouping with parentheses
 *
 * Supported fields:
 * - level: DEBUG, INFO, WARN, ERROR
 * - agent: Agent name
 * - stage: Pipeline stage
 * - projectId: Project identifier
 * - correlationId: Correlation ID
 * - message: Log message (substring match)
 * - time: Timestamp (ISO format, supports ranges with ..)
 */

import type {
  LogEntry,
  LogQueryField,
  LogQueryCondition,
  LogQueryExpression,
  LogQueryParseResult,
  StructuredLogQueryResult,
} from './types.js';

/**
 * Token types for lexical analysis
 */
type TokenType =
  | 'FIELD'
  | 'VALUE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'LPAREN'
  | 'RPAREN'
  | 'COLON'
  | 'RANGE'
  | 'EOF';

/**
 * Token representation
 */
interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly position: number;
}

/**
 * Valid field names (lowercase for comparison)
 */
const VALID_FIELDS: ReadonlySet<string> = new Set([
  'level',
  'agent',
  'stage',
  'projectid',
  'correlationid',
  'message',
  'time',
]);

/**
 * Map field names to canonical form
 */
const FIELD_CANONICAL: Record<string, LogQueryField> = {
  level: 'level',
  agent: 'agent',
  stage: 'stage',
  projectid: 'projectId',
  correlationid: 'correlationId',
  message: 'message',
  time: 'time',
};

/**
 * Structured query language parser for log search
 */
export class LogQueryParser {
  private tokens: Token[] = [];
  private position = 0;
  private query = '';

  /**
   * Parse a query string into a LogQueryExpression
   */
  public parse(query: string): LogQueryParseResult {
    this.query = query.trim();
    this.position = 0;
    this.tokens = [];

    if (this.query === '') {
      return {
        success: false,
        error: 'Empty query string',
        errorPosition: 0,
      };
    }

    try {
      this.tokenize();
      this.position = 0;
      const expression = this.parseExpression();

      if (this.position < this.tokens.length) {
        const unexpectedToken = this.tokens[this.position];
        if (unexpectedToken !== undefined && unexpectedToken.type !== 'EOF') {
          return {
            success: false,
            error: `Unexpected token: ${unexpectedToken.value}`,
            errorPosition: unexpectedToken.position,
          };
        }
      }

      return {
        success: true,
        expression,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: message,
        errorPosition: this.getCurrentPosition(),
      };
    }
  }

  /**
   * Execute a parsed query against log entries
   */
  public execute(
    expression: LogQueryExpression,
    entries: readonly LogEntry[],
    limit = 100,
    offset = 0
  ): { entries: LogEntry[]; totalCount: number; hasMore: boolean } {
    const filtered = entries.filter((entry) => this.evaluateExpression(expression, entry));
    const totalCount = filtered.length;
    const resultEntries = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return { entries: resultEntries, totalCount, hasMore };
  }

  /**
   * Parse and execute a query string in one step
   */
  public search(
    query: string,
    entries: readonly LogEntry[],
    limit = 100,
    offset = 0
  ): StructuredLogQueryResult {
    const startTime = performance.now();
    const parseResult = this.parse(query);

    if (!parseResult.success || parseResult.expression === undefined) {
      return {
        query,
        expression: { type: 'condition', condition: { field: 'message', value: '' } },
        entries: [],
        totalCount: 0,
        hasMore: false,
        executionTimeMs: performance.now() - startTime,
      };
    }

    const result = this.execute(parseResult.expression, entries, limit, offset);
    const executionTimeMs = performance.now() - startTime;

    return {
      query,
      expression: parseResult.expression,
      entries: result.entries,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      executionTimeMs,
    };
  }

  /**
   * Tokenize the query string
   */
  private tokenize(): void {
    let i = 0;
    const query = this.query;

    while (i < query.length) {
      // Skip whitespace
      while (i < query.length && /\s/.test(query[i] ?? '')) {
        i++;
      }

      if (i >= query.length) break;

      const startPos = i;
      const char = query[i] ?? '';

      // Parentheses
      if (char === '(') {
        this.tokens.push({ type: 'LPAREN', value: '(', position: startPos });
        i++;
        continue;
      }

      if (char === ')') {
        this.tokens.push({ type: 'RPAREN', value: ')', position: startPos });
        i++;
        continue;
      }

      // Range operator
      if (query.substring(i, i + 2) === '..') {
        this.tokens.push({ type: 'RANGE', value: '..', position: startPos });
        i += 2;
        continue;
      }

      // Colon
      if (char === ':') {
        this.tokens.push({ type: 'COLON', value: ':', position: startPos });
        i++;
        continue;
      }

      // Quoted string
      if (char === '"' || char === "'") {
        const quote = char;
        i++;
        let value = '';
        while (i < query.length && query.charAt(i) !== quote) {
          if (query.charAt(i) === '\\' && i + 1 < query.length) {
            i++;
            value += query.charAt(i);
          } else {
            value += query.charAt(i);
          }
          i++;
        }
        if (i < query.length) i++; // Skip closing quote
        this.tokens.push({ type: 'VALUE', value, position: startPos });
        continue;
      }

      // Word (field name, value, or operator)
      let word = '';
      while (
        i < query.length &&
        !/[\s():"]/.test(query.charAt(i)) &&
        query.substring(i, i + 2) !== '..'
      ) {
        // Stop at colon only if word could be a field name or operator
        if (query.charAt(i) === ':' && word.length > 0) {
          const lowerWord = word.toLowerCase();
          if (VALID_FIELDS.has(lowerWord) || ['and', 'or', 'not'].includes(lowerWord)) {
            break; // Stop before colon for field names
          }
        }
        word += query.charAt(i);
        i++;
      }

      if (word.length > 0) {
        const upperWord = word.toUpperCase();
        if (upperWord === 'AND') {
          this.tokens.push({ type: 'AND', value: 'AND', position: startPos });
        } else if (upperWord === 'OR') {
          this.tokens.push({ type: 'OR', value: 'OR', position: startPos });
        } else if (upperWord === 'NOT') {
          this.tokens.push({ type: 'NOT', value: 'NOT', position: startPos });
        } else if (VALID_FIELDS.has(word.toLowerCase())) {
          const canonicalField = FIELD_CANONICAL[word.toLowerCase()] ?? word.toLowerCase();
          this.tokens.push({ type: 'FIELD', value: canonicalField, position: startPos });
        } else {
          this.tokens.push({ type: 'VALUE', value: word, position: startPos });
        }
      }
    }

    this.tokens.push({ type: 'EOF', value: '', position: query.length });
  }

  /**
   * Get current position for error reporting
   */
  private getCurrentPosition(): number {
    const currentToken = this.tokens[this.position];
    return currentToken?.position ?? this.query.length;
  }

  /**
   * Peek at current token
   */
  private peek(): Token {
    return this.tokens[this.position] ?? { type: 'EOF', value: '', position: this.query.length };
  }

  /**
   * Consume current token and advance
   */
  private consume(): Token {
    const token = this.peek();
    this.position++;
    return token;
  }

  /**
   * Parse an expression (handles OR at lowest precedence)
   */
  private parseExpression(): LogQueryExpression {
    return this.parseOr();
  }

  /**
   * Parse OR expressions
   */
  private parseOr(): LogQueryExpression {
    let left = this.parseAnd();

    while (this.peek().type === 'OR') {
      this.consume(); // consume OR
      const right = this.parseAnd();
      left = {
        type: 'compound',
        operator: 'OR',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse AND expressions
   */
  private parseAnd(): LogQueryExpression {
    let left = this.parseNot();

    while (this.peek().type === 'AND') {
      this.consume(); // consume AND
      const right = this.parseNot();
      left = {
        type: 'compound',
        operator: 'AND',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse NOT expressions
   */
  private parseNot(): LogQueryExpression {
    if (this.peek().type === 'NOT') {
      this.consume(); // consume NOT
      const operand = this.parseNot(); // NOT is right-associative
      return {
        type: 'compound',
        operator: 'NOT',
        right: operand,
      };
    }

    return this.parsePrimary();
  }

  /**
   * Parse primary expressions (conditions and parenthesized expressions)
   */
  private parsePrimary(): LogQueryExpression {
    const token = this.peek();

    // Parenthesized expression
    if (token.type === 'LPAREN') {
      this.consume(); // consume (
      const expr = this.parseExpression();
      const closeParen = this.peek();
      if (closeParen.type !== 'RPAREN') {
        throw new Error('Expected closing parenthesis');
      }
      this.consume(); // consume )
      return expr;
    }

    // Field:value condition
    if (token.type === 'FIELD') {
      return this.parseCondition();
    }

    // Bare value (treated as message search)
    if (token.type === 'VALUE') {
      const value = this.consume().value;
      return {
        type: 'condition',
        condition: {
          field: 'message',
          value,
        },
      };
    }

    throw new Error(`Unexpected token: ${token.value || token.type}`);
  }

  /**
   * Parse a field:value condition
   */
  private parseCondition(): LogQueryExpression {
    const fieldToken = this.consume();
    const field = fieldToken.value as LogQueryField;

    const colonToken = this.peek();
    if (colonToken.type !== 'COLON') {
      throw new Error(`Expected ':' after field name '${field}'`);
    }
    this.consume(); // consume :

    const valueToken = this.peek();
    if (valueToken.type !== 'VALUE' && valueToken.type !== 'FIELD') {
      throw new Error(`Expected value after '${field}:'`);
    }
    const value = this.consume().value;

    // Check for range (time:start..end)
    if (this.peek().type === 'RANGE') {
      this.consume(); // consume ..
      const endToken = this.peek();
      if (endToken.type !== 'VALUE' && endToken.type !== 'FIELD') {
        throw new Error(`Expected end value in range for '${field}'`);
      }
      const rangeEnd = this.consume().value;

      return {
        type: 'condition',
        condition: {
          field,
          value,
          rangeEnd,
        },
      };
    }

    return {
      type: 'condition',
      condition: {
        field,
        value,
      },
    };
  }

  /**
   * Evaluate an expression against a log entry
   */
  private evaluateExpression(expression: LogQueryExpression, entry: LogEntry): boolean {
    if (expression.type === 'condition') {
      return this.evaluateCondition(expression.condition, entry);
    }

    // Compound expression
    const { operator, left, right } = expression;

    switch (operator) {
      case 'AND':
        if (left === undefined || right === undefined) return false;
        return this.evaluateExpression(left, entry) && this.evaluateExpression(right, entry);

      case 'OR':
        if (left === undefined || right === undefined) return false;
        return this.evaluateExpression(left, entry) || this.evaluateExpression(right, entry);

      case 'NOT':
        if (right === undefined) return false;
        return !this.evaluateExpression(right, entry);

      default:
        return false;
    }
  }

  /**
   * Evaluate a single condition against a log entry
   */
  private evaluateCondition(condition: LogQueryCondition | undefined, entry: LogEntry): boolean {
    if (condition === undefined) return false;

    const { field, value, negated, rangeEnd } = condition;
    let result: boolean;

    switch (field) {
      case 'level':
        result = entry.level.toLowerCase() === value.toLowerCase();
        break;

      case 'agent':
        result = entry.agent?.toLowerCase() === value.toLowerCase();
        break;

      case 'stage':
        result = entry.stage?.toLowerCase() === value.toLowerCase();
        break;

      case 'projectId':
        result = entry.projectId === value;
        break;

      case 'correlationId':
        result = entry.correlationId === value;
        break;

      case 'message':
        result = entry.message.toLowerCase().includes(value.toLowerCase());
        break;

      case 'time':
        result = this.evaluateTimeCondition(entry.timestamp, value, rangeEnd);
        break;

      default:
        result = false;
    }

    return negated === true ? !result : result;
  }

  /**
   * Evaluate a time condition (supports ranges)
   */
  private evaluateTimeCondition(timestamp: string, start: string, end?: string): boolean {
    const entryTime = new Date(timestamp).getTime();

    // Handle date-only strings (add time component for proper comparison)
    const startTime = this.parseTimeValue(start);
    if (isNaN(startTime)) return false;

    if (end !== undefined) {
      const endTime = this.parseTimeValue(end, true);
      if (isNaN(endTime)) return false;
      return entryTime >= startTime && entryTime <= endTime;
    }

    // Single time value - match the same day
    const startDate = new Date(startTime);
    const entryDate = new Date(entryTime);

    return (
      entryDate.getFullYear() === startDate.getFullYear() &&
      entryDate.getMonth() === startDate.getMonth() &&
      entryDate.getDate() === startDate.getDate()
    );
  }

  /**
   * Parse a time value string to timestamp
   */
  private parseTimeValue(value: string, isEndOfRange = false): number {
    // Try parsing as ISO string first
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // If it's a date-only string (YYYY-MM-DD), set appropriate time
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (isEndOfRange) {
          // End of range: set to end of day
          date.setHours(23, 59, 59, 999);
        } else {
          // Start of range: set to start of day
          date.setHours(0, 0, 0, 0);
        }
      }
      return date.getTime();
    }

    return NaN;
  }
}

/**
 * Create a new LogQueryParser instance
 */
export function createLogQueryParser(): LogQueryParser {
  return new LogQueryParser();
}
