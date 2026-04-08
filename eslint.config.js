/* eslint-env node */
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
]);
