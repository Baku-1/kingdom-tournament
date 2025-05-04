const { execSync } = require('child_process');
const fs = require('fs');

// Run the tests
try {
  console.log('Running tests...');
  const output = execSync('npx hardhat test', { encoding: 'utf8' });
  console.log(output);
  fs.writeFileSync('test-results.txt', output);
  console.log('Tests completed successfully!');
} catch (error) {
  console.error('Tests failed with error:', error.message);
  if (error.stdout) {
    console.log('Test output:', error.stdout);
    fs.writeFileSync('test-results.txt', error.stdout);
  }
  if (error.stderr) {
    console.error('Test errors:', error.stderr);
    fs.writeFileSync('test-errors.txt', error.stderr);
  }
  process.exit(1);
}
