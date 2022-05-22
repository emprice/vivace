module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:security-node/recommended'
  ],
  env: {
    browser: true,
    node: true,
    es6: true
  },
  globals: {
    io: true
  },
  plugins: [
    'security-node'
  ],
  rules: {
    curly: ['error', 'all'],
    eqeqeq: 'error',
    quotes: ['error', 'single', { 'allowTemplateLiterals': true }],
    'prefer-arrow-callback': 'error'
  },
  reportUnusedDisableDirectives: true
};

// vim: set ft=javascript:
