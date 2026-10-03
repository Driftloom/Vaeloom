const { run } = require('node:test');
const { spec } = require('node:test/reporters');
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'dist', 'tests');
if (fs.existsSync(testDir)) {
  const files = fs
    .readdirSync(testDir)
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => path.join(testDir, f));

  const stream = run({ files });
  stream.on('test:fail', () => {
    process.exitCode = 1;
  });
  stream.compose(new spec()).pipe(process.stdout);
}
