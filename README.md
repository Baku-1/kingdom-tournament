# Kingdom Tournament Platform

A tournament platform for Ronin blockchain games where users can create tournaments with automatic brackets, enter using their Ronin wallets, report match results, and distribute rewards to winners.

## Features

- Sign in with Ronin Wallet
- Create tournaments with token/NFT rewards
- Automatic bracket generation based on participants
- Match result reporting
- Admin dispute resolution
- Automatic reward distribution to winners
- Position-based rewards
- Entry fees (97.5% to creator, 2.5% to platform)

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Ronin Wallet browser extension
- Metamask (for contract deployment)

## Visual Testing (Frontend Only)

To test the frontend functionality without deploying contracts:

1. Clone the repository:
```bash
git clone https://github.com/yourusername/kingdom-tournament.git
cd kingdom-tournament
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to http://localhost:3003

5. Connect your Ronin wallet using the "Connect Wallet" button

6. Explore the application:
   - Create tournaments
   - View tournament details
   - Register for tournaments
   - View brackets after registration ends
   - Report match results

Note: In visual testing mode, no actual blockchain transactions will be made. The application will use mock data to simulate the blockchain interactions.

## Testnet Deployment

To deploy the contracts to Ronin testnet and test with real blockchain interactions:

### 1. Set up your environment

Create a `.env.local` file in the root directory with the following variables:

```
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_RONIN_RPC_URL=https://saigon-testnet.roninchain.com/rpc
PRIVATE_KEY=your_private_key_here
```

Replace `your_private_key_here` with your Ronin wallet's private key (for contract deployment only).

### 2. Get testnet RON

1. Install the Ronin Wallet browser extension
2. Create or import a wallet
3. Switch to Saigon Testnet in the wallet settings
4. Get testnet RON from the [Ronin Discord](https://discord.gg/roninnetwork) faucet

### 3. Deploy the smart contracts

1. Compile the contracts:
```bash
npx hardhat compile
```

2. Deploy to Ronin testnet:
```bash
npx hardhat run scripts/deploy.js --network roninTestnet
```

3. After deployment, copy the contract address and update it in `src/contracts/TournamentEscrow.ts`:
```typescript
export const TOURNAMENT_ESCROW_ADDRESS = {
  testnet: 'your_deployed_contract_address',
  mainnet: ''
};
```

### 4. Start the frontend application

```bash
npm run dev
# or
yarn dev
```

### 5. Testing the full flow

1. Connect your Ronin wallet to the application
2. Create a tournament with token rewards
   - You'll need testnet tokens in your wallet
   - The contract will lock these tokens as collateral
3. Register for tournaments
   - If entry fees are enabled, you'll need tokens to pay the fee
4. Wait for registration to end
   - Brackets will be automatically generated
5. Report match results
   - Both participants need to report the same result
   - Tournament creator can resolve disputes
6. Claim rewards
   - Winners can claim their rewards after the tournament ends

## Contract Architecture

The main contract is `TournamentEscrow.sol`, which handles:

- Tournament creation and management
- Participant registration
- Winner declaration
- Reward distribution
- Entry fee collection

## Frontend Architecture

The frontend is built with:

- Next.js for the React framework
- Tailwind CSS for styling
- ethers.js for blockchain interactions
- Ronin Wallet connector for wallet integration

## Development Notes

- The bracket generation happens automatically at registration end time
- The number of participants is determined by actual registrations, not a fixed maximum
- Entry fees are split 97.5% to the tournament creator and 2.5% to the platform
- Token addresses are pulled from the Ronin blockchain

## Testing

The project includes comprehensive testing for both the smart contracts and frontend:

### Contract Tests

Run the smart contract tests with:

```bash
npm run test:contract
# or
yarn test:contract
```

These tests verify the functionality of the TournamentEscrow contract, including tournament creation, registration, winner declaration, and reward distribution.

### End-to-End Tests

Run the end-to-end tests with:

```bash
npm run test:e2e
# or
yarn test:e2e
```

Or open the Cypress test runner for interactive testing:

```bash
npm run cypress:open
# or
yarn cypress:open
```

For more detailed testing information, see [TESTING.md](TESTING.md).

## Troubleshooting

### Provider not available

If you encounter a "Provider not available" error:
1. Make sure the Ronin Wallet extension is installed
2. Ensure you're connected to the correct network (testnet for testing)
3. Try refreshing the page and reconnecting your wallet

### Transaction failures

If transactions fail:
1. Check that you have enough RON for gas fees
2. Ensure you have the tokens you're trying to use as rewards
3. Check the browser console for detailed error messages

## License

[MIT](LICENSE)
