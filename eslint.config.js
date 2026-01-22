import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettierConfig,
  {
    plugins: {
      jsdoc,
    },
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      // JSDoc rules - warn for now, can be upgraded to error later
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          publicOnly: true,
          checkConstructors: false,
        },
      ],
      'jsdoc/require-param': 'warn',
      'jsdoc/require-returns': 'warn',
      'jsdoc/check-param-names': 'warn',
      'jsdoc/check-tag-names': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
      // Prevent direct console usage - use structured logging instead
      // Use Logger for structured logging or CLIOutput for user-facing CLI messages
      // Set to 'warn' initially to allow gradual migration, then upgrade to 'error'
      'no-console': 'warn',
    },
  },
  // Allow console in Logger.ts (fallback when Logger is not initialized)
  {
    files: ['src/logging/Logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts'],
  }
);
