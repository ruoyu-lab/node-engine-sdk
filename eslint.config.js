import js from '@eslint/js'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      '**/dist/**',
      'coverage/**',
      'node_modules/**',
      'packed/**',
      '.playwright-cli/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginVue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,ts,tsx,vue}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-useless-catch': 'error',
      'no-useless-rename': 'error',
      'object-shorthand': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: [
      'packages/**/*.{ts,tsx}',
      'playground/**/*.ts',
      'playground-react/**/*.{ts,tsx}',
      'playground-shared/**/*.ts',
      '**/*.vue',
    ],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: [
      'packages/*/src/**/*.{ts,tsx,vue}',
      'playground/src/**/*.{ts,vue}',
      'playground-react/src/**/*.{ts,tsx}',
      'playground-shared/src/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    },
  },
  {
    files: [
      'packages/vue/src/**/*.{ts,vue}',
      'packages/react/src/**/*.{ts,tsx}',
      'playground/src/**/*.{ts,vue}',
      'playground-react/src/**/*.{ts,tsx}',
      'playground-shared/src/**/*.ts',
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // The hook rules without the React Compiler rule set: the adapter supports React 18.3+ without
    // the compiler and hands latest-prop getters to framework-neutral core objects.
    files: ['packages/react/**/*.{ts,tsx}', 'playground-react/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', '**/config/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
]
