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

        // Connect to the contract
        await contractService.connect();

        // Get tournament info to determine number of positions
        const tournamentInfo = await contractService.getTournamentInfo(tournamentId);
        const positionCount = tournamentInfo.positionCount;

        // Fetch position details for each position
        const positionDetails = [];
        for (let i = 0; i < positionCount; i++) {
          try {
            const positionInfo = await contractService.getPositionInfo(tournamentId, i);

            // Check if the connected user is the winner for this position
            const isWinner = positionInfo.winner.toLowerCase() === connectedAddress.toLowerCase();

            positionDetails.push({
              position: i,
              rewardAmount: positionInfo.rewardAmount,
              claimed: positionInfo.claimed,
              isWinner: isWinner
            });
          } catch (positionError) {
            console.error(`Error fetching position ${i}:`, positionError);
          }
        }

        setPositions(positionDetails);
      } catch (error) {
        console.error('Error fetching positions:', error);
        setError('Failed to load reward positions. Please try again.');

        // Fallback to mock data for development/testing
        if (tournamentId === '1') { // Only use mock data for the mock tournament
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
          setError(null);
        }
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

      // For mock tournament, simulate successful claim
      if (tournamentId === '1') {
        // Simulate delay for better UX
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update local state
        setPositions(positions.map(p =>
          p.position === position ? { ...p, claimed: true } : p
        ));

        onSuccess();
        return;
      }

      // For real tournaments, interact with the contract
      await contractService.connect();

      // Claim the reward from the contract
      await contractService.claimReward(tournamentId, position);

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
      <div className="p-4 border border-cyber-border-glow rounded-md bg-cyber-bg-medium shadow-cyber-shadow-sm">
        <h3 className="text-lg font-medium mb-4 text-cyber-text-primary">Claim Tournament Rewards</h3>
        <p className="mb-4 text-cyber-text-secondary">Connect your wallet to check and claim rewards</p>
        <button
          className="bg-gradient-to-r from-cyber-primary to-cyber-secondary hover:from-cyber-secondary hover:to-cyber-primary text-white font-bold py-2 px-4 rounded shadow-cyber-shadow-sm"
          onClick={connectWallet}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 border border-cyber-border-glow rounded-md bg-cyber-bg-medium shadow-cyber-shadow-sm">
        <h3 className="text-lg font-medium mb-4 text-cyber-text-primary">Claim Tournament Rewards</h3>
        <div className="flex items-center space-x-2 text-cyber-text-secondary">
          <div className="animate-spin h-5 w-5 border-2 border-cyber-primary border-t-transparent rounded-full"></div>
          <p>Loading reward information...</p>
        </div>
      </div>
    );
  }

  const claimablePositions = positions.filter(p => p.isWinner && !p.claimed);

  return (
    <div className="p-4 border border-cyber-border-glow rounded-md bg-cyber-bg-medium shadow-cyber-shadow-sm">
      <h3 className="text-lg font-medium mb-4 text-cyber-text-primary">Claim Tournament Rewards</h3>

      {error && (
        <div className="p-3 mb-4 bg-red-900 bg-opacity-30 text-red-400 border border-red-700 rounded-md">
          {error}
        </div>
      )}

      {claimablePositions.length === 0 ? (
        <p className="text-cyber-text-secondary">You don't have any rewards to claim for this tournament.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-cyber-text-primary">You have the following rewards available to claim:</p>

          {positions.map(position => (
            <div
              key={position.position}
              className={`p-3 border rounded-md ${
                position.isWinner
                  ? position.claimed
                    ? 'border-gray-600 bg-cyber-bg-dark'
                    : 'border-cyber-accent bg-cyber-bg-dark bg-opacity-50 shadow-[0_0_8px_rgba(255,204,0,0.3)]'
                  : 'border-gray-700 bg-cyber-bg-dark bg-opacity-30'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className={`font-medium ${
                    position.position === 0
                      ? 'text-cyber-accent'
                      : position.position === 1
                        ? 'text-cyber-secondary'
                        : 'text-cyber-text-primary'
                  }`}>
                    {position.position === 0 ? '1st' :
                     position.position === 1 ? '2nd' :
                     position.position === 2 ? '3rd' :
                     `${position.position + 1}th`} Place
                  </span>
                  <p className="text-sm text-cyber-text-secondary">
                    Reward: {position.rewardAmount} RON
                  </p>
                </div>

                {position.isWinner && (
                  position.claimed ? (
                    <span className="px-3 py-1 bg-gray-800 text-gray-400 rounded-md text-sm border border-gray-700">
                      Claimed
                    </span>
                  ) : (
                    <button
                      className={`px-3 py-1 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-white rounded-md text-sm shadow-cyber-shadow-sm ${
                        claimingPosition === position.position
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:from-cyber-secondary hover:to-cyber-primary'
                      }`}
                      onClick={() => handleClaim(position.position)}
                      disabled={claimingPosition !== null}
                    >
                      {claimingPosition === position.position ? (
                        <span className="flex items-center">
                          <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                          Claiming...
                        </span>
                      ) : 'Claim Reward'}
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
