// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
// import './commands'

// Mock wallet connection
Cypress.on('window:before:load', (win) => {
  win.ethereum = {
    isMetaMask: true,
    request: () => {
      return Promise.resolve(['0x1234567890123456789012345678901234567890']);
    },
    on: () => {},
    removeListener: () => {},
    autoRefreshOnNetworkChange: false,
  };
  
  // Mock Ronin wallet
  win.ronin = {
    provider: {
      request: () => {
        return Promise.resolve(['0x1234567890123456789012345678901234567890']);
      },
      on: () => {},
      removeListener: () => {},
    }
  };
  
  // Mock tournament data
  win.mockTournaments = [
    {
      id: '1',
      name: 'Test Tournament',
      description: 'A test tournament for e2e testing',
      game: 'Axie Infinity',
      creator: '0x1234567890123456789012345678901234567890',
      tournamentType: 'single-elimination',
      currentParticipants: 8,
      participants: Array(8).fill().map((_, i) => ({
        address: `0x${i}234567890123456789012345678901234567890`,
        name: `Player ${i+1}`
      })),
      startDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
      registrationEndDate: new Date(Date.now() + 86400000), // 1 day from now
      status: 'registration',
      rewardType: 'token',
      rewardAmount: '100',
      rewardToken: 'RON',
      rewardDistribution: {
        first: 50,
        second: 30,
        third: 15,
        fourth: 5
      },
      hasEntryFee: true,
      entryFeeAmount: '10',
      entryFeeToken: 'RON',
      brackets: []
    }
  ];
});
