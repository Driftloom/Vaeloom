const base = require('@vaeloom/eslint-config/base');

module.exports = [...base, { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] }];
