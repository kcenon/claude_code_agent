/**
 * Configuration file watcher
 *
 * Watches configuration files for changes and triggers
 * validation on file modifications.
 *
 * @module config/watcher
 */

import { watch, FSWatcher } from 'node:fs';
import { existsSync } from 'node:fs';
import { ConfigWatchError } from './errors.js';
import { validateConfigFile, getConfigDir, getAllConfigFilePaths } from './loader.js';
import type { WatchOptions, FileChangeCallback } from './types.js';

// ============================================================
// Debounce Utility
// ============================================================

/**
 * Create a debounced function for file path handling
 */
function debounceFilePath(
  fn: (filePath: string) => Promise<void>,
  delay: number
): (filePath: string) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (filePath: string) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      void fn(filePath);
      timeoutId = null;
    }, delay);
  };
}

// ============================================================
// Configuration Watcher
// ============================================================

/**
 * Configuration file watcher
 *
 * Monitors configuration files for changes and triggers
 * validation callbacks when files are modified.
 *
 * @example
 * ```typescript
 * const watcher = new ConfigWatcher();
 *
 * watcher.watch((filePath, result) => {
 *   if (result.success) {
 *     console.log(`${filePath}: Valid`);
 *   } else {
 *     console.error(`${filePath}: Invalid`, result.errors);
 *   }
 * });
 *
 * // Later: stop watching
 * watcher.close();
 * ```
 */
export class ConfigWatcher {
  private watchers: FSWatcher[] = [];
  private isWatching = false;
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.cwd();
  }

  /**
   * Start watching configuration files
   *
   * @param callback - Callback for file changes
   * @param options - Watch options
   */
  watch(callback: FileChangeCallback, options?: WatchOptions): void {
    if (this.isWatching) {
      return;
    }

    const debounceMs = options?.debounceMs ?? 300;
    const validateOnChange = options?.validateOnChange ?? true;
    const onError = options?.onError ?? console.error;

    const configDir = getConfigDir(this.baseDir);

    if (!existsSync(configDir)) {
      throw new ConfigWatchError(
        `Configuration directory not found: ${configDir}`,
        configDir
      );
    }

    const paths = getAllConfigFilePaths(this.baseDir);
    const filePaths = Object.values(paths);

    const debouncedHandler = debounceFilePath(async (filePath: string) => {
      try {
        if (validateOnChange) {
          const result = await validateConfigFile(filePath);
          callback(filePath, result);
        } else {
          callback(filePath, {
            filePath,
            valid: true,
            errors: [],
            schemaVersion: '1.0.0',
          });
        }
      } catch (error) {
        onError(
          new ConfigWatchError(
            `Error processing file change: ${filePath}`,
            filePath,
            error instanceof Error ? error : undefined
          )
        );
      }
    }, debounceMs);

    for (const filePath of filePaths) {
      if (!existsSync(filePath)) {
        continue;
      }

      try {
        const watcher = watch(filePath, (eventType) => {
          if (eventType === 'change') {
            debouncedHandler(filePath);
          }
        });

        watcher.on('error', (error) => {
          onError(
            new ConfigWatchError(
              `Watch error for ${filePath}`,
              filePath,
              error
            )
          );
        });

        this.watchers.push(watcher);
      } catch (error) {
        onError(
          new ConfigWatchError(
            `Failed to watch ${filePath}`,
            filePath,
            error instanceof Error ? error : undefined
          )
        );
      }
    }

    this.isWatching = true;
  }

  /**
   * Stop watching configuration files
   */
  close(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.isWatching = false;
  }

  /**
   * Check if currently watching
   */
  isActive(): boolean {
    return this.isWatching;
  }
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Watch configuration files for changes
 *
 * @param callback - Callback for file changes
 * @param options - Watch options
 * @returns Cleanup function
 *
 * @example
 * ```typescript
 * const cleanup = watchConfigFiles((filePath, result) => {
 *   console.log(`File changed: ${filePath}`);
 *   if (!result.success) {
 *     console.error('Validation errors:', result.errors);
 *   }
 * });
 *
 * // Later: stop watching
 * cleanup();
 * ```
 */
export function watchConfigFiles(
  callback: FileChangeCallback,
  options?: WatchOptions & { baseDir?: string }
): () => void {
  const watcher = new ConfigWatcher(options?.baseDir);
  watcher.watch(callback, options);
  return () => {
    watcher.close();
  };
}

/**
 * Watch and log configuration changes (for CLI)
 *
 * @param baseDir - Base directory for configuration
 * @param onValid - Callback when configuration is valid
 * @param onInvalid - Callback when configuration is invalid
 * @returns Cleanup function
 */
export function watchConfigWithLogging(
  baseDir: string | undefined,
  onValid?: (filePath: string) => void,
  onInvalid?: (filePath: string, errors: readonly { path: string; message: string }[]) => void
): () => void {
  const watcher = new ConfigWatcher(baseDir);
  watcher.watch(
    (filePath, result) => {
      if (result.valid) {
        onValid?.(filePath);
      } else if (result.errors.length > 0) {
        onInvalid?.(filePath, result.errors);
      }
    }
  );
  return () => {
    watcher.close();
  };
}
