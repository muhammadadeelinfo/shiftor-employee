const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/**', 'tmp-test/**', 'ios/**', 'android/**'],
  },
  {
    rules: {
      // Expo 54 enables experimental React Compiler rules. The app has not opted
      // into compilation yet, so migrate these patterns separately from CI lint.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', 'scripts/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'expo/no-dynamic-env-var': 'off',
    },
  },
]);
