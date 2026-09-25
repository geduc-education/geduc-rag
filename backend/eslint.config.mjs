// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Convenção de wiring dos módulos RAG (herdada do rag-api): tokens e
    // factories agrupados em `export namespace X_PROVIDERS { ... }`.
    files: ['src/modules/**/*.providers.ts'],
    rules: { '@typescript-eslint/no-namespace': 'off' },
  },
  {
    // Adapters in-memory/mock do RAG implementam contratos async que a infra
    // real (banco, vector store, provider) vai cumprir com I/O de verdade.
    files: ['src/modules/**/infra/**/*.ts'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
  {
    // `expect(mock.metodo).toHaveBeenCalled()` é o padrão de asserção dos specs.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
);
