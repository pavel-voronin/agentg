import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '**/dist/**',
      'dist-server/**',
      '**/dist-server/**',
      'coverage/**',
      'node_modules/**',
      'packages/**',
      'td-data/**'
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
    files: ['eslint.config.js', 'scripts/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked]
  }
);
