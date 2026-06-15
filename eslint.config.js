import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  // `.claude/worktrees/*` holds nested git worktrees (full repo copies with their own
  // tsconfigs); linting into them confuses TS-ESLint's root detection. Never lint them.
  { ignores: ['dist', 'node_modules', 'coverage', 'test-results', 'playwright-report', '.claude'] },

  // Application source (browser).
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Keep the rules that catch real bugs (rules-of-hooks, exhaustive-deps).
      ...reactHooks.configs['recommended-latest'].rules,
      // ...but the fetch-on-mount pattern (an async effect that setStates after an
      // await) is intentional here and trips this newer perf-lint as a false positive.
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Node-side files: configs, Playwright E2E, Supabase edge functions.
  {
    files: ['*.{ts,js}', 'tests/**/*.ts', 'supabase/functions/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.browser },
    },
  },
)
