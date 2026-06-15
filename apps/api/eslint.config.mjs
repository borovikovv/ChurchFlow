import { createBaseConfig } from '@churchflow/config/eslint/base';

export default [
  { ignores: ['scripts/**'] },
  ...createBaseConfig({ tsconfigRootDir: import.meta.dirname })
];
