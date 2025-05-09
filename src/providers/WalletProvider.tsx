'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  ConnectorError,
  ConnectorErrorType,
  requestRoninWalletConnector
} from '@sky-mavis/tanto-connect';
import { contractService } from '@/services/ContractService';

// Define a type for the connector that matches ContractService's requirements
interface RoninConnector {
  provider: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
  };
  connect: () => Promise<{ account: string; chainId: number }>;
  getAccounts: () => Promise<string[]>;
  getChainId: () => Promise<number>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
}

interface WalletContextType {
  connector: RoninConnector | null;
  connectedAddress: string | null;
  userAddresses: string[] | null;
  currentChainId: number | null;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchChain: (chainId: number) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connector, setConnector] = useState<RoninConnector | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [userAddresses, setUserAddresses] = useState<string[] | null>(null);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  // Error state is used in the context value and for error handling
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeConnector = async () => {
      try {
        const newConnector = await requestRoninWalletConnector();
        // Cast to RoninConnector since we know it implements the required interface
        setConnector(newConnector as unknown as RoninConnector);

        // Set the connector in the ContractService
        contractService.setConnector(newConnector as unknown as RoninConnector);

        // Check if already connected
        try {
          const accounts = await newConnector.getAccounts();
          if (accounts && accounts.length > 0) {
            setConnectedAddress(accounts[0]);
            setUserAddresses(accounts);

            // Get current chain
            const chainId = await newConnector.getChainId();
            setCurrentChainId(chainId);
            
            // Set network type based on chain ID
            const isTestnet = chainId === 2021; // 2021 is Ronin testnet chain ID
            console.log('WalletProvider: Network type:', isTestnet ? 'testnet' : 'mainnet', 'Chain ID:', chainId);
            contractService.setNetwork(isTestnet);
          }
        } catch (err) {
          console.error('Error checking connection status:', err);
          // If it's a postMessage error, try to reconnect
          if (err instanceof Error && err.message.includes('postMessage')) {
            console.log('Attempting to reconnect due to postMessage error...');
            // Wait a bit before trying to reconnect
            setTimeout(() => {
              initializeConnector();
            }, 1000);
          }
        }
      } catch (err) {
        if (err instanceof ConnectorError) {
          setError(err.name);
        }
      }
    };

    initializeConnector();
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!connector && error === ConnectorErrorType.PROVIDER_NOT_FOUND) {
        window.open("https://wallet.roninchain.com", "_blank");
        setIsConnecting(false);
        return;
      }

      if (!connector) {
        throw new Error("No connector available");
      }

      try {
        const connectResult = await connector.connect();
        if (connectResult) {
          setConnectedAddress(connectResult.account);
          setCurrentChainId(connectResult.chainId);

          // Update the connector in the ContractService
          contractService.setConnector(connector);
          
          // Set network type based on chain ID
          const isTestnet = connectResult.chainId === 2021; // 2021 is Ronin testnet chain ID
          console.log('WalletProvider: Network type:', isTestnet ? 'testnet' : 'mainnet', 'Chain ID:', connectResult.chainId);
          contractService.setNetwork(isTestnet);
        }

        const accounts = await connector.getAccounts();
        if (accounts) {
          setUserAddresses(accounts);
        }
      } catch (err) {
        // If it's a postMessage error, try to reconnect
        if (err instanceof Error && err.message.includes('postMessage')) {
          console.log('Attempting to reconnect due to postMessage error...');
          // Wait a bit before trying to reconnect
          setTimeout(() => {
            connectWallet();
          }, 1000);
          return;
        }
        throw err;
      }
    } catch (err) {
      console.error("Error connecting wallet:", err);
      setError("Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    if (connector) {
      try {
        connector.disconnect();
      } catch (err) {
        console.error("Error disconnecting wallet:", err);
      }
    }

    setConnectedAddress(null);
    setUserAddresses(null);
    setCurrentChainId(null);
  };

  const switchChain = async (chainId: number) => {
    if (!connector) {
      throw new Error("No connector available");
    }

    try {
      await connector.switchChain(chainId);
      setCurrentChainId(chainId);
    } catch (err) {
      console.error("Error switching chain:", err);
      setError("Failed to switch chain");
    }
  };

  return (
    <WalletContext.Provider
      value={{
        connector,
        connectedAddress,
        userAddresses,
        currentChainId,
        isConnecting,
        error,
        connectWallet,
        disconnectWallet,
        switchChain,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
