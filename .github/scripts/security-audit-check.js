const config = require('../../security-audit.config.js');
const { execSync } = require('child_process');
const audit = JSON.parse(execSync('pnpm audit --json').toString());
const advisories = audit.advisories || {};
const allowed = config.allowedAdvisories || [];
const violations = Object.entries(advisories)
  .filter(([id]) => !allowed.includes(id))
  .map(([id, adv]) => `- ${adv.module_name}@${adv.vulnerable_versions}: ${adv.overview}`);
if (violations.length > 0) {
  console.log('SECURITY VIOLATIONS:', JSON.stringify(violations, null, 2));
  process.exit(1);
}
console.log('No unapproved vulnerabilities found.');
