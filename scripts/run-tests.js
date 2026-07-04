const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const testDirectory = join(process.cwd(), 'tmp-test', 'tests');
const testFiles = readdirSync(testDirectory)
  .filter((file) => file.endsWith('.test.js'))
  .sort();

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, [join(testDirectory, testFile)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Completed ${testFiles.length} test files.`);
