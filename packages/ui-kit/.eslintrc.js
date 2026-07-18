module.exports = {
  root: true,
  extends: [
    '@vaeloom/eslint-config/base',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['react'],
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
  settings: {
    react: { version: 'detect' },
  },
  ignorePatterns: ['dist', 'coverage', 'node_modules'],
};
