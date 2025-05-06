import React, { useState, useEffect } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { contractService } from '@/services/ContractService';

export default function PlatformFeeManager() {
  const { connectedAddress } = useWallet();
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fees, setFees] = useState<{
    ron: string;
    tokens: Array<{ address: string; symbol: string; amount: string }>;
  }>({
    ron: '0',
    tokens: []
  });

  const fetchFees = async () => {
    try {
      const platformFees = await contractService.getPlatformFees();
      setFees(platformFees);
    } catch (err) {
      console.error('Error fetching platform fees:', err);
      setError('Failed to fetch platform fees');
    }
  };

  useEffect(() => {
    const checkOwnership = async () => {
      if (!connectedAddress) return;

      try {
        setIsLoading(true);
        const isContractOwner = await contractService.isOwner(connectedAddress);
        setIsOwner(isContractOwner);
        
        if (isContractOwner) {
          await fetchFees();
        }
      } catch (err) {
        console.error('Error checking ownership:', err);
        setError('Failed to check ownership status');
      } finally {
        setIsLoading(false);
      }
    };

    checkOwnership();
  }, [connectedAddress]);

  const handleWithdrawFees = async (tokenAddress?: string) => {
    if (!connectedAddress || !isOwner) {
      setError('Only the platform owner can withdraw fees');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (tokenAddress) {
        await contractService.withdrawTokenFees(tokenAddress);
      } else {
        await contractService.withdrawRonFees();
      }
      
      // Refresh fees after withdrawal
      await fetchFees();
    } catch (err) {
      console.error('Error withdrawing fees:', err);
      setError('Failed to withdraw fees. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOwner) {
    return null;
  }

  return (
    <div className="p-4 border border-cyber-border-glow rounded-md bg-cyber-bg-medium shadow-cyber-shadow-sm">
      <h3 className="text-lg font-medium mb-4 text-cyber-text-primary">Platform Fee Management</h3>

      {error && (
        <div className="p-3 mb-4 bg-red-900 bg-opacity-30 text-red-400 border border-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="p-3 border border-cyber-border rounded-md">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium text-cyber-text-primary">RON Fees</h4>
              <p className="text-sm text-cyber-text-secondary">{fees.ron} RON</p>
            </div>
            <button
              onClick={() => handleWithdrawFees()}
              disabled={isLoading || fees.ron === '0'}
              className={`px-4 py-2 rounded-md ${
                isLoading || fees.ron === '0'
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyber-primary to-cyber-secondary hover:from-cyber-secondary hover:to-cyber-primary'
              } text-white font-medium shadow-cyber-shadow-sm`}
            >
              {isLoading ? 'Withdrawing...' : 'Withdraw'}
            </button>
          </div>
        </div>

        {fees.tokens.map(token => (
          <div key={token.address} className="p-3 border border-cyber-border rounded-md">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-cyber-text-primary">{token.symbol} Fees</h4>
                <p className="text-sm text-cyber-text-secondary">{token.amount} {token.symbol}</p>
              </div>
              <button
                onClick={() => handleWithdrawFees(token.address)}
                disabled={isLoading || token.amount === '0'}
                className={`px-4 py-2 rounded-md ${
                  isLoading || token.amount === '0'
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyber-primary to-cyber-secondary hover:from-cyber-secondary hover:to-cyber-primary'
                } text-white font-medium shadow-cyber-shadow-sm`}
              >
                {isLoading ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 