import { ethers } from 'ethers';

// Helper function to ensure addresses are checksummed
function toChecksumAddress(address: string): string {
  return ethers.getAddress(address);
}

// Token addresses for Saigon testnet
export const SAIGON_TOKEN_ADDRESSES = {
  AXS: toChecksumAddress('0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44'),
  SLP: toChecksumAddress('0x2C89bbc92BD86F80c154c6Bead4B1C3bB0C4b911'),
  USDC: toChecksumAddress('0x0b7007c13325c48911f73a2dad5fa5dcbf808adc'),
};

// Token addresses for Ronin mainnet
export const RONIN_TOKEN_ADDRESSES = {
  AXS: toChecksumAddress('0x97a9107c1793bc407d6f527b77e7fff4d812bece'),
  SLP: toChecksumAddress('0xa8754b9fa15fc18bb59458815510e40a12cd2014'),
  USDC: toChecksumAddress('0x0b7007c13325c48911f73a2dad5fa5dcbf808adc'),
};

// Get token addresses based on network
export function getTokenAddresses(isTestnet: boolean) {
  return isTestnet ? SAIGON_TOKEN_ADDRESSES : RONIN_TOKEN_ADDRESSES;
} 