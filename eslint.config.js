import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '**/dist/**',
      'dist-control-plane/**',
      '**/dist-control-plane/**',
      'dist-server/**',
      '**/dist-server/**',
      'coverage/**',
      'node_modules/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-confusing-void-expression': 'off'
    }
  },
  {
    files: ['packages/**/*.ts'],
    ignores: ['packages/*/src/rpc/trpc.ts', 'packages/*/tests/trpc-test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              message: 'Use the package-local RPC runtime exports instead.',
              name: '@trpc/server'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['eslint.config.js', 'scripts/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked]
  }
);
