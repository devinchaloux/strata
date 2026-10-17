import js from '@eslint/js'
import globals from 'globals'
import tseslint from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  { ...js.configs.recommended, files: ['**/*.{ts,tsx}'] },
  ...tseslint.configs['flat/recommended'].map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      // The plugin's full recommended set (2026-10-16): the rules of hooks,
      // complete effect dependencies, and the checks written for the React
      // Compiler, such as no state set inside an effect and no ref read or
      // written while rendering. docs/decisions.md, "React's Newer Checks On".
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]
