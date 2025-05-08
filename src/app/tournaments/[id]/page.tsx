'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { useParams } from 'next/navigation';
import { SUPPORTED_GAMES } from '@/config/ronin';
import { contractService } from '@/services/ContractService';
import ClaimReward from '@/components/ClaimReward';
import BracketGenerator from '@/components/BracketGenerator';
import TournamentBracketView from '@/components/TournamentBracketView';
import {
  Bracket,
  Match,
  Participant,
  TournamentType,
  updateBracketsWithResult,
  isTournamentComplete,
  getTournamentChampion
} from '@/utils/bracketUtils';
import { Tournament } from '@/types/tournament';

// Mock tournament data (would be fetched from API/blockchain in a real app)
const MOCK_TOURNAMENT = {
  id: '1',
  name: 'Axie Infinity Championship',
  description: 'Compete in the ultimate Axie Infinity tournament for RON tokens! This tournament will test your skills and strategy in Axie Infinity battles. The top players will earn RON tokens as rewards.',
  game: 'axie-infinity',
  creator: '0x1234567890abcdef1234567890abcdef12345678',
  tournamentType: 'single-elimination' as TournamentType,
  maxParticipants: 16,
  currentParticipants: 8,
  participants: [
    { address: '0x1111111111111111111111111111111111111111', name: 'Player 1' },
    { address: '0x2222222222222222222222222222222222222222', name: 'Player 2' },
    { address: '0x3333333333333333333333333333333333333333', name: 'Player 3' },
    { address: '0x4444444444444444444444444444444444444444', name: 'Player 4' },
    { address: '0x5555555555555555555555555555555555555555', name: 'Player 5' },
    { address: '0x6666666666666666666666666666666666666666', name: 'Player 6' },
    { address: '0x7777777777777777777777777777777777777777', name: 'Player 7' },
    { address: '0x8888888888888888888888888888888888888888', name: 'Player 8' },
  ],
  startDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
  registrationEndDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
  status: 'registration',
  rewardType: 'token',
  rewardAmount: '1000',
  rewardToken: 'RON',
  rewardDistribution: {
    first: 70,
    second: 20,
    third: 10,
    fourth: 0,
  },
  // Entry fee data
  hasEntryFee: true,
  entryFeeAmount: '10',
  entryFeeToken: 'RON',
  // Mock bracket data
  brackets: [
    {
      round: 1,
      bracketType: 'winners',
      matches: [
        {
          id: 101,
          round: 1,
          position: 0,
          player1: { address: '0x1111111111111111111111111111111111111111', name: 'Player 1' },
          player2: { address: '0x2222222222222222222222222222222222222222', name: 'Player 2' },
          winner: null,
          loser: null,
          status: 'pending',
          bracketType: 'winners',
          matchType: 'normal',
        },
        {
          id: 102,
          round: 1,
          position: 1,
          player1: { address: '0x3333333333333333333333333333333333333333', name: 'Player 3' },
          player2: { address: '0x4444444444444444444444444444444444444444', name: 'Player 4' },
          winner: null,
          loser: null,
          status: 'pending',
          bracketType: 'winners',
          matchType: 'normal',
        },
        {
          id: 103,
          round: 1,
          position: 2,
          player1: { address: '0x5555555555555555555555555555555555555555', name: 'Player 5' },
          player2: { address: '0x6666666666666666666666666666666666666666', name: 'Player 6' },
          winner: null,
          loser: null,
          status: 'pending',
          bracketType: 'winners',
          matchType: 'normal',
        },
        {
          id: 104,
          round: 1,
          position: 3,
          player1: { address: '0x7777777777777777777777777777777777777777', name: 'Player 7' },
          player2: { address: '0x8888888888888888888888888888888888888888', name: 'Player 8' },
          winner: null,
          loser: null,
          status: 'pending',
          bracketType: 'winners',
          matchType: 'normal',
        },
      ],
    },
    {
      round: 2,
      bracketType: 'winners',
      matches: [
        {
          id: 201,
          round: 2,
          position: 0,
          player1: null,
          player2: null,
          winner: null,
          loser: null,
          status: 'pending',
          bracketType: 'winners',
          matchType: 'normal',
        },
        {
          id: 202,
          round: 2,
          position: 1,
          player1: null,
          player2: null,
          winner: null,
          loser: null,
          status: 'pending',
          bracketType: 'winners',
          matchType: 'normal',
        },
      ],
    },
    {
      round: 3,
      bracketType: 'winners',
      matches: [
        {
          id: 301,
          round: 3,
          position: 0,
          player1: null,
          player2: null,
          winner: null,
          loser: null,
          status: 'pending',
          bracketType: 'winners',
          matchType: 'finals',
        },
      ],
    },
  ],
};

// Helper component for displaying details
function SimpleDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function TournamentDetail() {
  const params = useParams();
  const tournamentId = params?.id as string;
  const { connectedAddress, connectWallet } = useWallet();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', message: '', type: '' });

  const [tournament, setTournament] = useState<Tournament>(MOCK_TOURNAMENT as Tournament);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [reportedWinner, setReportedWinner] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'brackets' | 'participants' | 'admin'>('brackets');

  // Simple toast function
  const displayToast = (title: string, message: string, type: string) => {
    setToastMessage({ title, message, type });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  // Fetch tournament data from contract
  useEffect(() => {
    const fetchTournamentData = async () => {
      try {
        if (!tournamentId) return;

        setIsLoading(true);

        // For development/testing, we can use the mock data
        // Comment out the next lines and uncomment the contract calls when ready for production

        // Mock data for development
        //const mockTournamentData = MOCK_TOURNAMENT;

        // Fetch tournament data from the contract
        const tournamentData = await contractService.getTournamentInfo(tournamentId);

        // Format the data to match our Tournament type
        const formattedTournament: Tournament = {
          id: tournamentData.id,
          name: tournamentData.name,
          description: tournamentData.description,
          game: tournamentData.gameId,
          creator: tournamentData.creator,
          tournamentType: tournamentData.tournamentType as TournamentType,
          maxParticipants: tournamentData.maxParticipants,
          currentParticipants: tournamentData.participantCount,
          participants: [] as Participant[], // Explicitly type as Participant[]
          startDate: tournamentData.startDate,
          registrationEndDate: tournamentData.registrationEndDate,
          status: new Date() < tournamentData.registrationEndDate ? 'registration' :
                 new Date() < tournamentData.startDate ? 'active' : 'completed',
          rewardType: tournamentData.rewardType as 'token' | 'nft',
          rewardAmount: tournamentData.totalRewardAmount,
          rewardToken: tournamentData.rewardTokenAddress === '0x0000000000000000000000000000000000000000' ? 'RON' : 'Token',
          rewardDistribution: {
            first: 0,
            second: 0,
            third: 0,
            fourth: 0,
          },
          hasEntryFee: tournamentData.hasEntryFee,
          entryFeeAmount: tournamentData.entryFeeAmount,
          entryFeeToken: tournamentData.entryFeeTokenAddress === '0x0000000000000000000000000000000000000000' ? 'RON' : 'Token',
          entryFeeTokenAddress: tournamentData.entryFeeTokenAddress,
          brackets: [], // Will be generated based on participants
        };

        // Check if the connected user is registered
        if (connectedAddress) {
          const isUserRegistered = await contractService.isParticipantRegistered(tournamentId, connectedAddress);
          setIsRegistered(isUserRegistered);

          // Check if user is creator
          setIsCreator(formattedTournament.creator.toLowerCase() === connectedAddress.toLowerCase());
        }

        // Calculate reward distribution based on position reward amounts
        if (tournamentData.positionRewardAmounts.length > 0) {
          const totalReward = tournamentData.positionRewardAmounts.reduce((sum: number, amount: string) => sum + parseFloat(amount), 0);
          if (totalReward > 0) {
            if (tournamentData.positionRewardAmounts.length >= 1) {
              formattedTournament.rewardDistribution.first = Math.round(parseFloat(tournamentData.positionRewardAmounts[0]) / totalReward * 100);
            }
            if (tournamentData.positionRewardAmounts.length >= 2) {
              formattedTournament.rewardDistribution.second = Math.round(parseFloat(tournamentData.positionRewardAmounts[1]) / totalReward * 100);
            }
            if (tournamentData.positionRewardAmounts.length >= 3) {
              formattedTournament.rewardDistribution.third = Math.round(parseFloat(tournamentData.positionRewardAmounts[2]) / totalReward * 100);
            }
            if (tournamentData.positionRewardAmounts.length >= 4) {
              formattedTournament.rewardDistribution.fourth = Math.round(parseFloat(tournamentData.positionRewardAmounts[3]) / totalReward * 100);
            }
          }
        }

        // Fetch participants using events (more efficient)
        try {
          if (contractService.provider) {
            const participants = await contractService.getParticipantsFromEvents(tournamentId, contractService.provider);
            formattedTournament.participants = participants;

            // Check if the connected user is registered
            if (connectedAddress) {
              const isUserRegistered = participants.some(
                (p) => p.address.toLowerCase() === connectedAddress.toLowerCase()
              );
              setIsRegistered(isUserRegistered);

              // Check if user is creator
              setIsCreator(formattedTournament.creator.toLowerCase() === connectedAddress.toLowerCase());
            }
          }
        } catch (participantError) {
          console.error('Error fetching participants:', participantError);

          // Fallback: Check if the current user is registered
          if (connectedAddress) {
            try {
              const isUserRegistered = await contractService.isParticipantRegistered(tournamentId, connectedAddress);
              setIsRegistered(isUserRegistered);

              // If registered, add to participants list
              if (isUserRegistered) {
                formattedTournament.participants.push({
                  address: connectedAddress,
                  name: `Player ${formattedTournament.participants.length + 1}`
                });
              }
            } catch (error) {
              console.error('Error checking if user is registered:', error);
            }
          }
        }

        setTournament(formattedTournament as Tournament);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching tournament data:', error);
        displayToast(
          'Error',
          'Failed to load tournament data. Please try again.',
          'error'
        );
        setIsLoading(false);
      }
    };

    fetchTournamentData();
  }, [tournamentId, connectedAddress]);

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registration':
        return 'bg-blue-500';
      case 'active':
        return 'bg-green-500';
      case 'completed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get game info
  const getGameInfo = (gameId: string) => {
    return SUPPORTED_GAMES.find((game) => game.id === gameId) || {
      id: gameId,
      name: 'Unknown Game',
      image: '/games/other.png',
    };
  };

  // Handle tournament registration
  const handleRegister = async () => {
    if (!connectedAddress) {
      displayToast(
        'Wallet not connected',
        'Please connect your Ronin wallet to register',
        'error'
      );
      return;
    }

    try {
      // Connect to wallet
      await contractService.connect();

      // Handle entry fee if required
      if (tournament.hasEntryFee) {
        displayToast(
          'Processing payment',
          `Sending ${tournament.entryFeeAmount} ${tournament.entryFeeToken} entry fee...`,
          'info'
        );

        // Register with entry fee
        // The contract handles the fee distribution (97.5% to creator, 2.5% to platform)
        await contractService.registerWithEntryFee(
          tournamentId,
          tournament.entryFeeTokenAddress || '0x0000000000000000000000000000000000000000',
          tournament.entryFeeAmount
        );
      } else {
        // No entry fee, just register
        await contractService.registerForTournament(tournamentId);
      }

      // Update local state to reflect registration
      setTournament({
        ...tournament,
        currentParticipants: tournament.currentParticipants + 1,
        participants: [
          ...tournament.participants,
          { address: connectedAddress, name: `Player ${tournament.currentParticipants + 1}` },
        ],
      });

      setIsRegistered(true);

      displayToast(
        'Registration successful!',
        tournament.hasEntryFee
          ? `You have successfully registered for the tournament. Entry fee of ${tournament.entryFeeAmount} ${tournament.entryFeeToken} has been processed.`
          : 'You have successfully registered for the tournament',
        'success'
      );
    } catch (error) {
      console.error('Error registering for tournament:', error);
      displayToast(
        'Error',
        'Failed to register for tournament. Please try again.',
        'error'
      );
    }
  };

  // Determine final positions based on tournament results
  const determineFinalPositions = (
    brackets: Bracket[],
    tournamentType: TournamentType
  ): Record<string, Participant | null> => {
    const positions: Record<string, Participant | null> = {
      '0': null, // 1st place
      '1': null, // 2nd place
      '2': null, // 3rd place
      '3': null  // 4th place (if applicable)
    };

    // Get the champion (1st place)
    positions['0'] = getTournamentChampion(brackets, tournamentType);

    if (tournamentType === 'single-elimination') {
      // In single elimination:
      // - 2nd place is the loser of the final match
      // - 3rd place would require a 3rd place match (not implemented)

      // Find the finals bracket (highest round in winners bracket)
      const finalsBracket = brackets.find(b =>
        b.bracketType === 'winners' &&
        b.round === Math.max(...brackets.filter(b => b.bracketType === 'winners').map(b => b.round))
      );

      if (finalsBracket && finalsBracket.matches.length > 0) {
        const finalMatch = finalsBracket.matches[0];
        if (finalMatch.status === 'completed' && finalMatch.loser) {
          positions['1'] = finalMatch.loser; // 2nd place
        }

        // For 3rd and 4th places, we need to find the losers of the semifinal matches
        const semifinalsBracket = brackets.find(b =>
          b.bracketType === 'winners' &&
          b.round === Math.max(...brackets.filter(b => b.bracketType === 'winners').map(b => b.round)) - 1
        );

        if (semifinalsBracket && semifinalsBracket.matches.length >= 2) {
          // Find the semifinal match that didn't produce the 2nd place player
          const semifinalMatches = semifinalsBracket.matches.filter(m =>
            m.status === 'completed' && m.loser && m.loser.address !== positions['1']?.address
          );

          if (semifinalMatches.length > 0) {
            positions['2'] = semifinalMatches[0].loser; // 3rd place
          }

          if (semifinalMatches.length > 1) {
            positions['3'] = semifinalMatches[1].loser; // 4th place
          }
        }
      }
    } else {
      // Double elimination:
      // - 1st place is the champion
      // - 2nd place is the loser of the grand finals (or finals if no grand finals)
      // - 3rd place is the loser of the losers bracket final

      // Find the finals bracket
      const finalsBracket = brackets.find(b => b.bracketType === 'finals');

      if (finalsBracket) {
        // Check for grand finals match first
        const grandFinalsMatch = finalsBracket.matches.find(m => m.matchType === 'grand_finals');
        if (grandFinalsMatch && grandFinalsMatch.status === 'completed' && grandFinalsMatch.loser) {
          positions['1'] = grandFinalsMatch.loser; // 2nd place from grand finals
        } else {
          // If no grand finals, check regular finals
          const finalsMatch = finalsBracket.matches.find(m => m.matchType === 'finals');
          if (finalsMatch && finalsMatch.status === 'completed' && finalsMatch.loser) {
            positions['1'] = finalsMatch.loser; // 2nd place from finals
          }
        }
      }

      // Find the losers bracket final
      const losersBrackets = brackets.filter(b => b.bracketType === 'losers');
      if (losersBrackets.length > 0) {
        const losersFinalBracket = losersBrackets.find(b =>
          b.round === Math.max(...losersBrackets.map(b => b.round))
        );

        if (losersFinalBracket && losersFinalBracket.matches.length > 0) {
          const losersFinalMatch = losersFinalBracket.matches[0];
          if (losersFinalMatch.status === 'completed' && losersFinalMatch.loser) {
            positions['2'] = losersFinalMatch.loser; // 3rd place
          }
        }
      }
    }

    return positions;
  };

  // Count pending matches that need reporting
  const getPendingMatchesCount = (): number => {
    if (!tournament.brackets) return 0;

    let count = 0;
    tournament.brackets.forEach(bracket => {
      bracket.matches.forEach(match => {
        // Only count matches that have both players assigned and are pending
        if (match.player1 && match.player2 && match.status === 'pending') {
          count++;
        }
      });
    });

    return count;
  };

  // Handle match result reporting
  const handleReportMatch = (match: Match) => {
    console.log(`Reporting match ${match.id} - Player1: ${match.player1?.name || 'None'}, Player2: ${match.player2?.name || 'None'}`);

    setSelectedMatch(match);
    setReportedWinner('');
    setIsReportModalOpen(true);

    // Show a toast to guide the user
    displayToast(
      'Report Match Result',
      'Select the winner of this match to update the tournament bracket.',
      'info'
    );
  };

  // Submit match result
  const submitMatchResult = async () => {
    if (!reportedWinner || !selectedMatch) {
      displayToast(
        'Error',
        'Please select a winner',
        'error'
      );
      return;
    }

    try {
      console.log(`Submitting result for match ${selectedMatch.id} - Winner: ${reportedWinner}`);

      // Get winner address
      const winnerAddress = reportedWinner === 'player1'
        ? selectedMatch.player1?.address
        : selectedMatch.player2?.address;

      if (!winnerAddress) {
        throw new Error('Winner address not found');
      }

      console.log(`Winner address: ${winnerAddress}`);
      console.log(`Tournament type: ${tournament.tournamentType}`);

      // Log the current state of the brackets before updating
      console.log('Current brackets state:');
      tournament.brackets.forEach(bracket => {
        console.log(`Bracket type: ${bracket.bracketType}, Round: ${bracket.round}, Matches: ${bracket.matches.length}`);
      });

      // Update brackets with the match result
      const updatedBrackets = updateBracketsWithResult(
        tournament.brackets,
        selectedMatch.id,
        winnerAddress,
        tournament.tournamentType as TournamentType
      );

      // If this is a real tournament (not mock data), interact with the contract
      if (tournament.id !== '1') { // Check if not using mock data
        try {
          await contractService.connect();

          // Declare the winner for this match position
          await contractService.declareWinner(tournamentId, selectedMatch.position, winnerAddress);

          displayToast(
            'Winner Declared',
            `Winner has been declared on the blockchain`,
            'success'
          );
        } catch (contractError) {
          console.error('Error declaring winner on contract:', contractError);
          displayToast(
            'Contract Error',
            'Failed to declare winner on the blockchain. UI has been updated locally only.',
            'error'
          );
        }
      }

      // Log the updated brackets state
      console.log('Updated brackets state:');
      updatedBrackets.forEach(bracket => {
        console.log(`Bracket type: ${bracket.bracketType}, Round: ${bracket.round}, Matches: ${bracket.matches.length}`);

        // Log details of each match in the bracket
        bracket.matches.forEach(match => {
          console.log(`  Match ${match.id}: Player1: ${match.player1?.name || 'None'}, Player2: ${match.player2?.name || 'None'}, Winner: ${match.winner?.name || 'None'}, Status: ${match.status}`);
        });
      });

      // Add detailed logging for Match 5 to diagnose the issue
      const match5 = updatedBrackets.flatMap(b => b.matches).find(m => m.id === 5);
      if (match5) {
        console.log('Match 5 details after update:');
        console.log(`  Status: ${match5.status}`);
        console.log(`  Player1: ${match5.player1?.name || 'None'}`);
        console.log(`  Player2: ${match5.player2?.name || 'None'}`);
        console.log(`  Winner: ${match5.winner?.name || 'None'}`);
      }

      // Update tournament state with a timestamp to force a complete re-render
      setTimeout(() => {
        setTournament(prevTournament => ({
          ...prevTournament,
          brackets: updatedBrackets,
          lastUpdated: Date.now() // Add a timestamp to force React to detect the change
        }));
      }, 50);

      // Check if tournament is complete
      const isComplete = isTournamentComplete(updatedBrackets, tournament.tournamentType as TournamentType);
      if (isComplete) {
        const champion = getTournamentChampion(updatedBrackets, tournament.tournamentType as TournamentType);
        if (champion) {
          // Update tournament status to completed
          setTournament({
            ...tournament,
            brackets: updatedBrackets,
            status: 'completed' as const
          });

          // If this is a real tournament (not mock data), finalize on the contract
          if (tournament.id !== '1' && champion) { // Check if not using mock data
            try {
              await contractService.connect();

              // Get all final positions
              const positions = determineFinalPositions(updatedBrackets, tournament.tournamentType as TournamentType);

              // Convert positions to a record of position -> address for the finalize method
              const winnersByPosition: Record<string, string> = {};
              for (const [position, participant] of Object.entries(positions)) {
                if (participant) {
                  winnersByPosition[position] = participant.address;
                }
              }

              // Finalize the tournament by declaring all winners at once
              await contractService.finalizeTournament(tournamentId, winnersByPosition);

              displayToast(
                'Tournament Finalized',
                `All winners have been declared on the blockchain`,
                'success'
              );
            } catch (finalizeError) {
              console.error('Error finalizing tournament on contract:', finalizeError);
              displayToast(
                'Finalization Error',
                'Failed to finalize all winners on the blockchain.',
                'error'
              );
            }
          }

          displayToast(
            'Tournament Completed',
            `The tournament has been completed! ${champion.name} is the champion.`,
            'success'
          );
        }
      }

      setIsReportModalOpen(false);

      displayToast(
        'Result reported',
        'Match result has been successfully reported',
        'success'
      );
    } catch (error) {
      console.error('Error reporting match result:', error);
      displayToast(
        'Error',
        'Failed to report match result. Please try again.',
        'error'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      {showToast && (
        <div className={`fixed top-4 right-4 p-4 rounded shadow-lg z-50 ${
          toastMessage.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          <h3 className="font-bold">{toastMessage.title}</h3>
          <p>{toastMessage.message}</p>
        </div>
      )}

      <div className="space-y-8">
        <div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col items-start space-y-1">
              <div className="flex items-center">
                <span className={`${getStatusColor(tournament.status)} text-white px-2 py-1 rounded mr-2`}>
                  {tournament.status === 'registration'
                    ? 'Registration Open'
                    : tournament.status === 'active'
                    ? 'Active'
                    : 'Completed'}
                </span>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  {tournament.tournamentType === 'single-elimination' ? 'Single Elimination' : 'Double Elimination'}
                </span>
              </div>
              <h1 className="text-2xl font-bold">{tournament.name}</h1>
              <div className="flex items-center mt-1">
                <div className="w-5 h-5 bg-gray-200 rounded-full mr-2"></div>
                <span className="text-gray-500">
                  {getGameInfo(tournament.game).name}
                </span>
              </div>
            </div>

            {!connectedAddress ? (
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                onClick={connectWallet}
              >
                Connect Wallet to Participate
              </button>
            ) : tournament.status === 'registration' && !isRegistered ? (
              <button
                className={`bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded ${tournament.currentParticipants >= tournament.maxParticipants ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleRegister}
                disabled={tournament.currentParticipants >= tournament.maxParticipants}
              >
                Register for Tournament
              </button>
            ) : isRegistered ? (
              <span className="bg-green-500 text-white px-3 py-2 rounded">
                You are registered
              </span>
            ) : null}
          </div>
        </div>

        <hr className="my-6 border-t border-gray-200" />

        <div className="border-b border-gray-200">
          <div className="flex space-x-4">
            <button
              className={`px-4 py-2 ${activeTab === 'overview' ? 'border-b-2 border-cyber-primary text-cyber-primary' : 'text-gray-500 hover:text-gray-700'} font-medium`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'brackets' ? 'border-b-2 border-cyber-primary text-cyber-primary' : 'text-gray-500 hover:text-gray-700'} font-medium`}
              onClick={() => setActiveTab('brackets')}
            >
              Brackets
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'participants' ? 'border-b-2 border-cyber-primary text-cyber-primary' : 'text-gray-500 hover:text-gray-700'} font-medium`}
              onClick={() => setActiveTab('participants')}
            >
              Participants
            </button>
            {isCreator && (
              <button
                className={`px-4 py-2 ${activeTab === 'admin' ? 'border-b-2 border-cyber-primary text-cyber-primary' : 'text-gray-500 hover:text-gray-700'} font-medium`}
                onClick={() => setActiveTab('admin')}
              >
                Admin
              </button>
            )}
          </div>
        </div>

        <div className="mt-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="bg-white p-6 border border-gray-200 rounded-md">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium mb-2">
                    Description
                  </h2>
                  <p>{tournament.description}</p>
                </div>

                <hr className="border-t border-gray-200" />

                <div>
                  <h2 className="text-lg font-medium mb-4">
                    Tournament Details
                  </h2>
                  <SimpleDetail
                    label="Status"
                    value={
                      tournament.status === 'registration'
                        ? 'Registration Open'
                        : tournament.status === 'active'
                        ? 'Active'
                        : 'Completed'
                    }
                  />
                  <SimpleDetail
                    label="Format"
                    value={
                      tournament.tournamentType === 'single-elimination'
                        ? 'Single Elimination'
                        : 'Double Elimination'
                    }
                  />
                  <SimpleDetail
                    label="Participants"
                    value={`${tournament.currentParticipants}/${tournament.maxParticipants}`}
                  />
                  {tournament.hasEntryFee && (
                    <SimpleDetail
                      label="Entry Fee"
                      value={`${tournament.entryFeeAmount} ${tournament.entryFeeToken}`}
                    />
                  )}
                  <SimpleDetail
                    label="Registration Ends"
                    value={formatDate(tournament.registrationEndDate)}
                  />
                  <SimpleDetail
                    label="Tournament Starts"
                    value={formatDate(tournament.startDate)}
                  />
                  <SimpleDetail
                    label="Created By"
                    value={`${tournament.creator.slice(0, 6)}...${tournament.creator.slice(-4)}`}
                  />
                </div>

                <hr className="border-t border-gray-200" />

                <div>
                  <h2 className="text-lg font-medium mb-4">
                    Rewards
                  </h2>
                  <SimpleDetail
                    label="Reward Type"
                    value={tournament.rewardType === 'token' ? 'Token' : 'NFT'}
                  />
                  {tournament.rewardType === 'token' && (
                    <SimpleDetail
                      label="Total Prize Pool"
                      value={`${tournament.rewardAmount} ${tournament.rewardToken}`}
                    />
                  )}

                  <h3 className="text-md font-medium mt-4 mb-2">
                    Prize Distribution
                  </h3>
                  <SimpleDetail
                    label="1st Place"
                    value={`${tournament.rewardDistribution.first}%`}
                  />
                  <SimpleDetail
                    label="2nd Place"
                    value={`${tournament.rewardDistribution.second}%`}
                  />
                  <SimpleDetail
                    label="3rd Place"
                    value={`${tournament.rewardDistribution.third}%`}
                  />
                  {tournament.rewardDistribution.fourth > 0 && (
                    <SimpleDetail
                      label="4th Place"
                      value={`${tournament.rewardDistribution.fourth}%`}
                    />
                  )}

                  {/* Claim Reward Component */}
                  {tournament.status === 'completed' && (
                    <div className="mt-6">
                      <ClaimReward
                        tournamentId={tournamentId}
                        onSuccess={() => {
                          displayToast(
                            'Reward claimed!',
                            'You have successfully claimed your tournament reward',
                            'success'
                          );
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Brackets Tab */}
          {activeTab === 'brackets' && (
            <div className="bg-cyber-bg-light p-6 border border-gray-200 rounded-md overflow-x-auto">
              {tournament.status === 'registration' ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <BracketGenerator
                    tournamentId={tournamentId}
                    participants={tournament.participants}
                    registrationEndTime={new Date(tournament.registrationEndDate)}
                    tournamentType={tournament.tournamentType}
                    onBracketsGenerated={(generatedBrackets) => {
                      // Update tournament with generated brackets
                      setTournament({
                        ...tournament,
                        brackets: generatedBrackets,
                        status: 'active' as const
                      });
                    }}
                  />
                </div>
              ) : (
                <>
                  {tournament.status === 'active' && getPendingMatchesCount() > 0 && (
                    <div className="mb-4 p-3 bg-cyber-bg-medium border border-cyber-primary rounded-md">
                      <div className="flex items-center">
                        <div className="mr-3 text-cyber-primary text-xl">ℹ️</div>
                        <div>
                          <h3 className="font-medium text-cyber-primary">Match Results Needed</h3>
                          <p className="text-cyber-text-secondary text-sm">
                            {getPendingMatchesCount()} {getPendingMatchesCount() === 1 ? 'match needs' : 'matches need'} results.
                            Click the &quot;Report Result&quot; button below each match to record the winner.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <TournamentBracketView
                    brackets={tournament.brackets}
                    tournamentType={tournament.tournamentType as TournamentType}
                    onReportMatch={handleReportMatch}
                    connectedAddress={connectedAddress}
                  />
                </>
              )}
            </div>
          )}

          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <div className="bg-cyber-bg-light p-6 border border-gray-200 rounded-md">
              <h2 className="text-lg font-medium mb-4 text-cyber-text-primary">
                Registered Participants ({tournament.currentParticipants}/{tournament.maxParticipants})
              </h2>

              <div className="space-y-2">
                {tournament.participants.map((participant, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 border border-cyber-border-glow rounded-md bg-cyber-bg-medium"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-cyber-bg-dark rounded-full mr-2 flex items-center justify-center border border-cyber-primary">
                        <span>{index + 1}</span>
                      </div>
                      <span className="text-cyber-text-primary">{participant.name}</span>
                    </div>
                    <span className="text-sm text-cyber-text-secondary">
                      {participant.address.slice(0, 6)}...{participant.address.slice(-4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Tab - Only visible to creator */}
          {activeTab === 'admin' && isCreator && (
            <div className="bg-cyber-bg-light p-6 border border-gray-200 rounded-md">
              <h2 className="text-lg font-medium mb-4 text-cyber-text-primary">
                Tournament Administration
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-md font-medium mb-2 text-cyber-text-primary">
                    Tournament Status
                  </h3>
                  <p className="mb-4 text-cyber-text-secondary">
                    Current status:{' '}
                    <span className={`${getStatusColor(tournament.status)} text-white px-2 py-1 rounded`}>
                      {tournament.status === 'registration'
                        ? 'Registration Open'
                        : tournament.status === 'active'
                        ? 'Active'
                        : 'Completed'}
                    </span>
                  </p>

                  {tournament.status === 'registration' && (
                    <button className="bg-gradient-to-r from-cyber-primary to-cyber-secondary hover:from-cyber-secondary hover:to-cyber-primary text-white px-4 py-2 rounded shadow-cyber-shadow-sm">
                      Start Tournament Early
                    </button>
                  )}

                  {tournament.status === 'active' && (
                    <div className="space-y-3">
                      <button
                        className="bg-gradient-to-r from-cyber-secondary to-red-500 hover:from-red-500 hover:to-cyber-secondary text-white px-4 py-2 rounded shadow-cyber-shadow-sm"
                        onClick={async () => {
                          // Check if tournament has a champion
                          const isComplete = isTournamentComplete(tournament.brackets, tournament.tournamentType as TournamentType);
                          if (!isComplete) {
                            displayToast(
                              'Cannot End Tournament',
                              'Tournament is not complete. All matches must be finished first.',
                              'error'
                            );
                            return;
                          }

                          const champion = getTournamentChampion(tournament.brackets, tournament.tournamentType as TournamentType);
                          if (!champion) {
                            displayToast(
                              'Cannot End Tournament',
                              'No champion found. Please ensure all matches have been reported.',
                              'error'
                            );
                            return;
                          }

                          try {
                            // Get all final positions
                            const positions = determineFinalPositions(tournament.brackets, tournament.tournamentType as TournamentType);

                            // Convert positions to a record of position -> address for the finalize method
                            const winnersByPosition: Record<string, string> = {};
                            for (const [position, participant] of Object.entries(positions)) {
                              if (participant) {
                                winnersByPosition[position] = participant.address;
                              }
                            }

                            // Connect to contract
                            await contractService.connect();

                            // Finalize the tournament by declaring all winners at once
                            await contractService.finalizeTournament(tournamentId, winnersByPosition);

                            // Update tournament status
                            setTournament({
                              ...tournament,
                              status: 'completed' as const
                            });

                            displayToast(
                              'Tournament Completed',
                              `The tournament has been completed and all winners have been declared.`,
                              'success'
                            );
                          } catch (error) {
                            console.error('Error finalizing tournament:', error);
                            displayToast(
                              'Error',
                              'Failed to finalize tournament. Please try again.',
                              'error'
                            );
                          }
                        }}
                      >
                        End Tournament
                      </button>

                      <button
                        className="bg-gradient-to-r from-cyber-primary to-cyber-accent hover:from-cyber-accent hover:to-cyber-primary text-white px-4 py-2 rounded shadow-cyber-shadow-sm flex items-center"
                        onClick={() => {
                          // Switch to brackets tab
                          setActiveTab('brackets');

                          displayToast(
                            'Report Match Results',
                            'Please report all match results before ending the tournament.',
                            'info'
                          );
                        }}
                      >
                        <span className="mr-2">📋</span> Report Match Results
                      </button>
                    </div>
                  )}
                </div>

                <hr className="border-t border-gray-300 opacity-20" />

                <div>
                  <h3 className="text-md font-medium mb-4 text-cyber-text-primary">
                    Dispute Resolution
                  </h3>

                  <p className="mb-4 text-cyber-text-secondary">No active disputes</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="report-result-modal bg-cyber-bg-medium rounded-lg max-w-md w-full p-6 relative border-4 border-cyber-primary shadow-lg">
            <button
              className="absolute top-3 right-3 text-cyber-text-primary hover:text-cyber-secondary text-xl font-bold"
              onClick={() => setIsReportModalOpen(false)}
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-4 text-cyber-text-primary border-b-2 border-cyber-primary pb-2">Report Match Result</h2>

            {selectedMatch && (
              <div className="space-y-4">
                <p className="text-cyber-text-primary font-medium">
                  Please select the winner of the match between{' '}
                  <strong className="text-cyber-primary">{selectedMatch.player1?.name}</strong> and{' '}
                  <strong className="text-cyber-secondary">{selectedMatch.player2?.name}</strong>
                </p>

                <div className="bg-cyber-bg-dark p-4 rounded-md">
                  <label className="block text-sm font-bold mb-2 text-cyber-text-primary">Select Winner:</label>
                  <div className="space-y-3">
                    <label className="flex items-center bg-cyber-bg-light p-3 rounded border border-cyber-primary hover:border-cyber-primary cursor-pointer">
                      <input
                        type="radio"
                        value="player1"
                        checked={reportedWinner === 'player1'}
                        onChange={() => setReportedWinner('player1')}
                        className="mr-2 h-5 w-5 text-blue-600"
                      />
                      <span className={`font-medium ${reportedWinner === 'player1' ? 'text-cyber-primary' : 'text-cyber-text-primary'}`}>
                        {selectedMatch.player1?.name} (
                        {selectedMatch.player1?.address.slice(0, 6)}...
                        {selectedMatch.player1?.address.slice(-4)})
                      </span>
                    </label>
                    <label className="flex items-center bg-cyber-bg-light p-3 rounded border border-cyber-secondary hover:border-cyber-secondary cursor-pointer">
                      <input
                        type="radio"
                        value="player2"
                        checked={reportedWinner === 'player2'}
                        onChange={() => setReportedWinner('player2')}
                        className="mr-2 h-5 w-5 text-purple-600"
                      />
                      <span className={`font-medium ${reportedWinner === 'player2' ? 'text-cyber-secondary' : 'text-cyber-text-primary'}`}>
                        {selectedMatch.player2?.name} (
                        {selectedMatch.player2?.address.slice(0, 6)}...
                        {selectedMatch.player2?.address.slice(-4)})
                      </span>
                    </label>
                  </div>
                </div>

                <p className="text-sm text-cyber-text-primary bg-cyber-bg-medium p-3 rounded border border-cyber-accent">
                  <strong>Note:</strong> Both participants must report the same result for it to be confirmed.
                  In case of a dispute, the tournament admin will resolve it.
                </p>
              </div>
            )}

            <div className="flex justify-end mt-6 space-x-3">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium"
                onClick={() => setIsReportModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded shadow-md font-medium ${!reportedWinner ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-600 hover:to-purple-600'}`}
                onClick={submitMatchResult}
                disabled={!reportedWinner}
              >
                Submit Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
