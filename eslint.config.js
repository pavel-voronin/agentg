import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', '**/dist/**', 'coverage/**', 'node_modules/**']
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
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked]
  },
  {
    files: ['packages/control-plane/src/app-runtime.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        Element: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLElement: 'readonly',
        MouseEvent: 'readonly',
        URL: 'readonly',
        WebSocket: 'readonly',
        clearTimeout: 'readonly',
        document: 'readonly',
        getComputedStyle: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        requestAnimationFrame: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly'
      },
      parserOptions: {
        projectService: false
      }
    },
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off',
      'no-unused-vars': 'off'
    }
  }
);
