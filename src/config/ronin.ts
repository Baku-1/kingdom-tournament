// Ronin blockchain configuration
export const SUPPORTED_CHAINS = [
  {
    id: 2020,
    name: 'Ronin Mainnet',
    network: 'ronin',
    nativeCurrency: {
      name: 'RON',
      symbol: 'RON',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ['https://api.roninchain.com/rpc'],
      },
      public: {
        http: ['https://api.roninchain.com/rpc'],
      },
    },
    blockExplorers: {
      default: {
        name: 'Ronin Explorer',
        url: 'https://app.roninchain.com',
      },
    },
  },
  {
    id: 2021,
    name: 'Ronin Testnet (Saigon)',
    network: 'ronin-testnet',
    nativeCurrency: {
      name: 'RON',
      symbol: 'RON',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ['https://saigon-api.roninchain.com/rpc'],
      },
      public: {
        http: ['https://saigon-api.roninchain.com/rpc'],
      },
    },
    blockExplorers: {
      default: {
        name: 'Ronin Explorer (Saigon)',
        url: 'https://saigon-app.roninchain.com',
      },
    },
  },
];

// List of supported games on Ronin blockchain
export const SUPPORTED_GAMES = [
  {
    id: 'axie-infinity',
    name: 'Axie Infinity',
    image: '/games/axie-infinity.png',
  },
  {
    id: 'ronin-rumble',
    name: 'Ronin Rumble',
    image: '/games/ronin-rumble.png',
  },
  {
    id: 'admirals',
    name: 'Moshi Admirals',
    image: '/games/moshi-admiral.png',
  },
  {
    id: 'neotrade',
    name: 'NeoTrades',
    image: '/games/neotrade.png',
  },
  {
    id: 'other',
    name: 'Other',
    image: '/games/other.png',
  },
];

// Tournament types
export const TOURNAMENT_TYPES = [
  {
    id: 'single-elimination',
    name: 'Single Elimination',
    description: 'Players are eliminated after a single loss',
  },
  {
    id: 'double-elimination',
    name: 'Double Elimination',
    description: 'Players are eliminated after two losses',
  },
];

// Match states
export const MATCH_STATES = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  DISPUTED: 'DISPUTED',
};

// Participant states
export const PARTICIPANT_STATES = {
  REGISTERED: 'REGISTERED',
  CHECKED_IN: 'CHECKED_IN',
  PLAYING: 'PLAYING',
  ELIMINATED: 'ELIMINATED',
  WINNER: 'WINNER',
};
