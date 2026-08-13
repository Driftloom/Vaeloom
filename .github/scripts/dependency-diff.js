const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const table = ['| Package | Current | Latest | Type |'];
table.push('|---------|---------|--------|------|');
for (const [pkg, info] of Object.entries(data)) {
  table.push(`| ${pkg} | ${info.current} | ${info.latest} | ${info.type} |`);
}
require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, table.join('\n'));
