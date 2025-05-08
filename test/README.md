# Test Suite Notes

## TournamentEscrow vs TournamentEscrowV2

The project has migrated from `TournamentEscrow` to `TournamentEscrowV2`. The main differences are:

1. The `tournamentType` parameter has been removed from the contract and all related functions
2. The contract is now upgradeable using the UUPS pattern
3. Entry fee refund functionality has been added
4. Winner positions are now limited to a maximum of 10
5. Auto fee distribution has been removed

## Deprecated Tests

The following test files are deprecated and reference the old `TournamentEscrow` contract which no longer exists:

- `TournamentEscrow.test.js`
- `TournamentEscrow.simple.test.js`
- `TournamentEscrow.failure.test.js`

These tests should be updated to use `TournamentEscrowV2` or removed.

## Current Tests

The following test files are for the current `TournamentEscrowV2` contract:

- `TournamentEscrowV2.basic.test.js`
- `TournamentEscrowV2.cancellation.test.js`
- `TournamentEscrowV2.registration.test.js`
- `TournamentEscrowV2.simple.test.js`
- `TournamentEscrowV2.winners.test.js`

## Running Tests

To run all tests:

```
cd kingdom-tournament
npx hardhat test
```

To run a specific test file:

```
cd kingdom-tournament
npx hardhat test test/TournamentEscrowV2.basic.test.js
```
