'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  ConnectorError,
  ConnectorErrorType,
  requestRoninWalletConnector
} from '@sky-mavis/tanto-connect';
import { contractService } from '@/services/ContractService';

interface WalletContextType {
  connector: unknown;
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
  const [connector, setConnector] = useState<unknown>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [userAddresses, setUserAddresses] = useState<string[] | null>(null);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  // Error state is used in the context value and for error handling
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeConnector = async () => {
      try {
        const connector = await requestRoninWalletConnector();
        setConnector(connector);

        // Set the connector in the ContractService
        contractService.setConnector(connector);

        // Check if already connected
        try {
          const accounts = await connector.getAccounts();
          if (accounts && accounts.length > 0) {
            setConnectedAddress(accounts[0]);
            setUserAddresses(accounts);

            // Get current chain
            const chainId = await connector.getChainId();
            setCurrentChainId(chainId);
          }
        } catch (error) {
          // Not connected, which is fine
        }
      } catch (error) {
        if (error instanceof ConnectorError) {
          setError(error.name);
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

      const connectResult = await connector?.connect();
      if (connectResult) {
        setConnectedAddress(connectResult.account);
        setCurrentChainId(connectResult.chainId);

        // Update the connector in the ContractService
        contractService.setConnector(connector);
      }

      const accounts = await connector?.getAccounts();
      if (accounts) {
        setUserAddresses(accounts);
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError("Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    if (connector) {
      try {
        connector.disconnect();
      } catch (error) {
        console.error("Error disconnecting wallet:", error);
      }
    }

    setConnectedAddress(null);
    setUserAddresses(null);
    setCurrentChainId(null);
  };

  const switchChain = async (chainId: number) => {
    try {
      await connector?.switchChain(chainId);
      setCurrentChainId(chainId);
    } catch (error) {
      console.error("Error switching chain:", error);
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
