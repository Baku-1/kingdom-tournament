const fs = require('fs');
const solc = require('solc');

// Read the contract source code
const source = fs.readFileSync('./contracts/TournamentEscrowV2.sol', 'utf8');

// Prepare the input for the Solidity compiler
const input = {
  language: 'Solidity',
  sources: {
    'TournamentEscrowV2.sol': {
      content: source
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

// Compile the contract
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
if (output.errors) {
  console.error('Compilation errors:');
  output.errors.forEach(error => {
    console.error(error.formattedMessage);
  });
} else {
  console.log('Contract compiled successfully!');
}
