import tseslint from 'typescript-eslint';
import { createBaseConfig } from '@churchflow/config/eslint/base';

export default [
  { ignores: ['scripts/**'] },
  ...createBaseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // Тести на CommonJS і поза tsconfig, тож правила з типами до них не застосовні.
    files: ['test/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      parserOptions: { projectService: false, project: null },
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        exports: 'writable',
        Headers: 'readonly',
        module: 'writable',
        process: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-require-imports': 'off',
      // Тестові двійники — це конструктор плюс кілька статичних фабрик, і це нормально.
      '@typescript-eslint/no-extraneous-class': 'off'
    }
  }
];
