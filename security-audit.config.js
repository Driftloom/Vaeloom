module.exports = {
  allowedAdvisories: [],
  excludedPaths: [
    '**/node_modules/**',
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/generated/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/*.min.*',
  ],
  alert: {
    email: {
      enabled: true,
      recipients: ['security@vaeloom.dev'],
      smtp: {
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: true,
      },
    },
    severityThreshold: 'high',
  },
};
