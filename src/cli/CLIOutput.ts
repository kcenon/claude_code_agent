/**
 * CLIOutput - User-facing output utility for CLI commands
 *
 * This class provides methods for displaying user-facing messages in the CLI.
 * It is intentionally separate from structured logging to allow:
 * - User-friendly output formatting
 * - Direct control over stdout/stderr streams
 * - Consistent CLI output patterns
 *
 * Use this class for user-facing output in CLI commands.
 * Use Logger for internal application logging and observability.
 *
 * @module cli
 */

export interface CLIOutputOptions {
  /** Write stream for standard output (defaults to process.stdout) */
  readonly stdout?: NodeJS.WriteStream;
  /** Write stream for standard error (defaults to process.stderr) */
  readonly stderr?: NodeJS.WriteStream;
}

/**
 * CLIOutput - Utility class for user-facing CLI output
 *
 * @example
 * ```typescript
 * const output = new CLIOutput();
 *
 * output.info('Operation completed successfully');
 * output.warn('File may be outdated');
 * output.error('Failed to connect');
 *
 * output.summary('Project Configuration', {
 *   'Name': 'my-project',
 *   'Template': 'standard',
 * });
 * ```
 */
export class CLIOutput {
  private readonly stdout: NodeJS.WriteStream;
  private readonly stderr: NodeJS.WriteStream;

  constructor(options: CLIOutputOptions = {}) {
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
  }

  /**
   * Write an info message to stdout
   */
  info(message: string): void {
    this.stdout.write(`${message}\n`);
  }

  /**
   * Write a warning message to stderr
   */
  warn(message: string): void {
    this.stderr.write(`${message}\n`);
  }

  /**
   * Write an error message to stderr
   */
  error(message: string): void {
    this.stderr.write(`${message}\n`);
  }

  /**
   * Write a blank line to stdout
   */
  blank(): void {
    this.stdout.write('\n');
  }

  /**
   * Display a summary with title and key-value pairs
   */
  summary(title: string, data: Record<string, string>): void {
    this.stdout.write(`\n${title}:\n`);
    this.stdout.write('─'.repeat(40) + '\n');
    for (const [key, value] of Object.entries(data)) {
      this.stdout.write(`  ${key}: ${value}\n`);
    }
    this.stdout.write('─'.repeat(40) + '\n');
  }

  /**
   * Display a formatted table
   */
  table(headers: readonly string[], rows: readonly (readonly string[])[]): void {
    if (headers.length === 0) {
      return;
    }

    // Calculate column widths
    const widths = headers.map((header, index) => {
      const columnValues = rows.map((row) => row[index] ?? '');
      return Math.max(header.length, ...columnValues.map((v) => v.length));
    });

    // Format header row
    const headerCells: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const width = widths[i];
      if (header !== undefined && width !== undefined) {
        headerCells.push(header.padEnd(width));
      }
    }
    const headerRow = headerCells.join(' │ ');
    const separator = widths.map((w) => '─'.repeat(w)).join('─┼─');

    this.stdout.write(`${headerRow}\n`);
    this.stdout.write(`${separator}\n`);

    // Format data rows
    for (const row of rows) {
      const rowCells: string[] = [];
      for (let i = 0; i < headers.length; i++) {
        const cell = row[i] ?? '';
        const width = widths[i];
        if (width !== undefined) {
          rowCells.push(cell.padEnd(width));
        }
      }
      this.stdout.write(`${rowCells.join(' │ ')}\n`);
    }
  }

  /**
   * Display a progress indicator message
   */
  progress(message: string): void {
    this.stdout.write(`${message}...\n`);
  }

  /**
   * Display a success message with checkmark
   */
  success(message: string): void {
    this.stdout.write(`✓ ${message}\n`);
  }

  /**
   * Display a failure message with cross mark
   */
  failure(message: string): void {
    this.stderr.write(`✗ ${message}\n`);
  }

  /**
   * Display a divider line
   */
  divider(length: number = 40): void {
    this.stdout.write('─'.repeat(length) + '\n');
  }

  /**
   * Display an indented message
   */
  indent(message: string, level: number = 1): void {
    const spaces = '  '.repeat(level);
    this.stdout.write(`${spaces}${message}\n`);
  }

  /**
   * Write raw output to stdout without newline
   */
  raw(content: string): void {
    this.stdout.write(content);
  }

  /**
   * Write JSON formatted output
   */
  json(data: unknown): void {
    this.stdout.write(JSON.stringify(data, null, 2) + '\n');
  }
}

// Singleton instance
let instance: CLIOutput | null = null;

/**
 * Get or create the global CLIOutput instance
 */
export function getCLIOutput(options?: CLIOutputOptions): CLIOutput {
  if (instance === null) {
    instance = new CLIOutput(options);
  }
  return instance;
}

/**
 * Reset the global CLIOutput instance (for testing)
 */
export function resetCLIOutput(): void {
  instance = null;
}
