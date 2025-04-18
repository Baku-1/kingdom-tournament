import React, { useState, useEffect } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { contractService } from '@/services/ContractService';
import { ethers } from 'ethers';

interface ClaimRewardProps {
  tournamentId: string;
  onSuccess: () => void;
}

export default function ClaimReward({ tournamentId, onSuccess }: ClaimRewardProps) {
  const { connectedAddress, connectWallet } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [positions, setPositions] = useState<{
    position: number;
    rewardAmount: string;
    claimed: boolean;
    isWinner: boolean;
  }[]>([]);
  const [claimingPosition, setClaimingPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPositions = async () => {
      if (!connectedAddress) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // In a real implementation, we would fetch position data from the contract
        // For now, we'll use mock data
        // await contractService.connect();
        // const tournamentInfo = await contractService.getTournamentInfo(tournamentId);
        
        // Mock data for demonstration
        const mockPositions = [
          {
            position: 0,
            rewardAmount: '70',
            claimed: false,
            isWinner: true
          },
          {
            position: 1,
            rewardAmount: '20',
            claimed: false,
            isWinner: false
          },
          {
            position: 2,
            rewardAmount: '10',
            claimed: true,
            isWinner: false
          }
        ];
        
        setPositions(mockPositions);
      } catch (error) {
        console.error('Error fetching positions:', error);
        setError('Failed to load reward positions. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPositions();
  }, [tournamentId, connectedAddress]);

  const handleClaim = async (position: number) => {
    if (!connectedAddress) {
      setError('Please connect your wallet first');
      return;
    }
    
    try {
      setClaimingPosition(position);
      setError(null);
      
      // In a real implementation, we would claim the reward from the contract
      // await contractService.connect();
      // await contractService.claimReward(tournamentId, position);
      
      // Simulate successful claim
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update local state
      setPositions(positions.map(p => 
        p.position === position ? { ...p, claimed: true } : p
      ));
      
      onSuccess();
    } catch (error) {
      console.error('Error claiming reward:', error);
      setError('Failed to claim reward. Please try again.');
    } finally {
      setClaimingPosition(null);
    }
  };

  if (!connectedAddress) {
    return (
      <div className="p-4 border border-gray-200 rounded-md">
        <h3 className="text-lg font-medium mb-4">Claim Tournament Rewards</h3>
        <p className="mb-4">Connect your wallet to check and claim rewards</p>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          onClick={connectWallet}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 border border-gray-200 rounded-md">
        <h3 className="text-lg font-medium mb-4">Claim Tournament Rewards</h3>
        <p>Loading reward information...</p>
      </div>
    );
  }

  const claimablePositions = positions.filter(p => p.isWinner && !p.claimed);

  return (
    <div className="p-4 border border-gray-200 rounded-md">
      <h3 className="text-lg font-medium mb-4">Claim Tournament Rewards</h3>
      
      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {claimablePositions.length === 0 ? (
        <p>You don't have any rewards to claim for this tournament.</p>
      ) : (
        <div className="space-y-4">
          <p>You have the following rewards available to claim:</p>
          
          {positions.map(position => (
            <div 
              key={position.position}
              className={`p-3 border rounded-md ${position.isWinner ? 'border-green-200' : 'border-gray-200'}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">
                    {position.position === 0 ? '1st' : 
                     position.position === 1 ? '2nd' : 
                     position.position === 2 ? '3rd' : 
                     `${position.position + 1}th`} Place
                  </span>
                  <p className="text-sm text-gray-600">
                    Reward: {position.rewardAmount} RON
                  </p>
                </div>
                
                {position.isWinner && (
                  position.claimed ? (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md text-sm">
                      Claimed
                    </span>
                  ) : (
                    <button
                      className={`px-3 py-1 bg-green-500 text-white rounded-md text-sm ${
                        claimingPosition === position.position ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'
                      }`}
                      onClick={() => handleClaim(position.position)}
                      disabled={claimingPosition !== null}
                    >
                      {claimingPosition === position.position ? 'Claiming...' : 'Claim'}
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
