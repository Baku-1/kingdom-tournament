# Testing Guide for Kingdom Tournament Platform

This document provides instructions for running tests on the Kingdom Tournament platform.

## Contract Tests

The contract tests verify the functionality of the TournamentEscrow smart contract, including tournament creation, registration, winner declaration, and reward distribution.

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Hardhat

### Running Contract Tests

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Run the contract tests:
```bash
npm run test:contract
# or
yarn test:contract
```

This will execute the tests in `test/TournamentEscrow.test.js` using Hardhat's testing framework.

### Test Coverage

To generate a test coverage report:

```bash
npx hardhat coverage
```

## End-to-End Tests

The E2E tests verify the frontend functionality and user flows using Cypress.

### Prerequisites

- Node.js (v16+)
- npm or yarn
- A running instance of the frontend application

### Running E2E Tests

1. Start the development server in a separate terminal:
```bash
npm run dev
# or
yarn dev
```

2. Run the E2E tests in headless mode:
```bash
npm run test:e2e
# or
yarn test:e2e
```

3. Alternatively, open the Cypress test runner for interactive testing:
```bash
npm run cypress:open
# or
yarn cypress:open
```

## Test Structure

### Contract Tests

- `test/TournamentEscrow.test.js`: Tests for the TournamentEscrow contract
- `contracts/MockERC20.sol`: Mock ERC20 token for testing

### E2E Tests

- `cypress/e2e/tournament.cy.js`: Tests for tournament creation, registration, and bracket generation
- `cypress/support/e2e.js`: Support file with mock data and utilities
- `cypress/fixtures/tournaments.json`: Sample tournament data for tests

## Manual Testing Checklist

Before deploying to production, perform the following manual tests:

1. **Wallet Connection**
   - [ ] Connect Ronin wallet
   - [ ] Verify wallet address is displayed
   - [ ] Disconnect and reconnect wallet

2. **Tournament Creation**
   - [ ] Create tournament with token rewards
   - [ ] Create tournament with NFT rewards
   - [ ] Create tournament with entry fee
   - [ ] Verify tournament appears in the list

3. **Tournament Registration**
   - [ ] Register for a tournament
   - [ ] Verify registration status
   - [ ] Test registration with entry fee

4. **Bracket Generation**
   - [ ] Verify brackets are generated after registration ends
   - [ ] Test with different numbers of participants (4, 8, 16, etc.)
   - [ ] Verify byes are handled correctly for non-power-of-2 participant counts

5. **Match Reporting**
   - [ ] Report match results
   - [ ] Test dispute resolution
   - [ ] Verify winner advancement to next round

6. **Reward Distribution**
   - [ ] Verify winners can claim rewards
   - [ ] Test reward distribution percentages
   - [ ] Verify entry fee distribution

## Testnet Deployment Testing

After deploying to the Ronin testnet:

1. **Contract Verification**
   - [ ] Verify contract on Ronin Explorer
   - [ ] Check contract functions and events

2. **Transaction Testing**
   - [ ] Test tournament creation with real tokens
   - [ ] Test registration with entry fees
   - [ ] Test reward claiming

3. **Gas Optimization**
   - [ ] Monitor gas usage for all transactions
   - [ ] Identify and optimize high-gas operations

## Troubleshooting

### Contract Test Issues

- If tests fail with "Transaction reverted without a reason", check that you're using the correct token approvals and balances.
- For "Contract not deployed" errors, ensure the contract deployment is awaited properly.

### E2E Test Issues

- If tests fail with "Element not found", check the selectors and ensure the elements are rendered before attempting to interact with them.
- For wallet connection issues, verify that the mock wallet is properly initialized in the support file.

## Continuous Integration

The tests are configured to run in CI/CD pipelines. The workflow includes:

1. Running contract tests
2. Building the frontend
3. Running E2E tests against the built frontend
4. Generating test reports
