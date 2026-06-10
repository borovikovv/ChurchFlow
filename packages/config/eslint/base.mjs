import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export const createBaseConfig = ({ tsconfigRootDir = process.cwd() } = {}) =>
  tseslint.config(
    {
      ignores: ['dist/**', '.next/**', 'node_modules/**', 'eslint.config.mjs']
    },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir
        }
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error'
      }
    }
  );

export default createBaseConfig();
