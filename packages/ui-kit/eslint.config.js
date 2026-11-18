const base = require('@vaeloom/eslint-config/base');
const react = require('@vaeloom/eslint-config/react');

module.exports = [...base, ...react, { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] }];
