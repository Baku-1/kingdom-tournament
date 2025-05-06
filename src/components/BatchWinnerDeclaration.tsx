import React, { useState } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { contractService } from '@/services/ContractService';

interface BatchWinnerDeclarationProps {
  tournamentId: string;
  positions: number[];
  onSuccess: () => void;
}

export default function BatchWinnerDeclaration({ tournamentId, positions, onSuccess }: BatchWinnerDeclarationProps) {
  const { connectedAddress } = useWallet();
  const [winners, setWinners] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWinnerChange = (position: number, address: string) => {
    setWinners(prev => ({
      ...prev,
      [position]: address
    }));
  };

  const handleSubmit = async () => {
    if (!connectedAddress) {
      setError('Please connect your wallet first');
      return;
    }

    // Validate all positions have winners
    const missingPositions = positions.filter(pos => !winners[pos]);
    if (missingPositions.length > 0) {
      setError(`Please specify winners for positions: ${missingPositions.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const positionsArray = positions.map(pos => pos);
      const winnersArray = positions.map(pos => winners[pos]);

      await contractService.declareWinners(tournamentId, positionsArray, winnersArray);
      onSuccess();
    } catch (err) {
      console.error('Error declaring winners:', err);
      setError('Failed to declare winners. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 border border-cyber-border-glow rounded-md bg-cyber-bg-medium shadow-cyber-shadow-sm">
      <h3 className="text-lg font-medium mb-4 text-cyber-text-primary">Declare Winners</h3>

      {error && (
        <div className="p-3 mb-4 bg-red-900 bg-opacity-30 text-red-400 border border-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {positions.map(position => (
          <div key={position} className="flex items-center space-x-4">
            <span className="w-24 text-cyber-text-primary">
              {position === 0 ? '1st' :
               position === 1 ? '2nd' :
               position === 2 ? '3rd' :
               `${position + 1}th`} Place
            </span>
            <input
              type="text"
              value={winners[position] || ''}
              onChange={(e) => handleWinnerChange(position, e.target.value)}
              placeholder="Enter winner's address"
              className="flex-1 p-2 border border-cyber-border rounded-md bg-cyber-bg-dark text-cyber-text-primary"
            />
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full mt-4 px-4 py-2 rounded-md ${
            isSubmitting
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyber-primary to-cyber-secondary hover:from-cyber-secondary hover:to-cyber-primary'
          } text-white font-medium shadow-cyber-shadow-sm`}
        >
          {isSubmitting ? 'Declaring Winners...' : 'Declare Winners'}
        </button>
      </div>
    </div>
  );
} 