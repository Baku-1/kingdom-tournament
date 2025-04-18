'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { useParams, useRouter } from 'next/navigation';
import { SUPPORTED_GAMES } from '@/config/ronin';
import { contractService } from '@/services/ContractService';
import ClaimReward from '@/components/ClaimReward';
import BracketGenerator from '@/components/BracketGenerator';
import { Bracket, Match, Participant, generateBrackets, updateBracketsWithResult } from '@/utils/bracketUtils';
import { Tournament } from '@/types/tournament';

// Mock tournament data (would be fetched from API/blockchain in a real app)
const MOCK_TOURNAMENT = {
  id: '1',
  name: 'Axie Infinity Championship',
  description: 'Compete in the ultimate Axie Infinity tournament for RON tokens! This tournament will test your skills and strategy in Axie Infinity battles. The top players will earn RON tokens as rewards.',
  game: 'axie-infinity',
  creator: '0x1234567890abcdef1234567890abcdef12345678',
  tournamentType: 'single-elimination',
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
      matches: [
        {
          id: 1,
          round: 1,
          position: 0,
          player1: { address: '0x1111111111111111111111111111111111111111', name: 'Player 1' },
          player2: { address: '0x2222222222222222222222222222222222222222', name: 'Player 2' },
          winner: null,
          status: 'pending',
        },
        {
          id: 2,
          round: 1,
          position: 1,
          player1: { address: '0x3333333333333333333333333333333333333333', name: 'Player 3' },
          player2: { address: '0x4444444444444444444444444444444444444444', name: 'Player 4' },
          winner: null,
          status: 'pending',
        },
        {
          id: 3,
          round: 1,
          position: 2,
          player1: { address: '0x5555555555555555555555555555555555555555', name: 'Player 5' },
          player2: { address: '0x6666666666666666666666666666666666666666', name: 'Player 6' },
          winner: null,
          status: 'pending',
        },
        {
          id: 4,
          round: 1,
          position: 3,
          player1: { address: '0x7777777777777777777777777777777777777777', name: 'Player 7' },
          player2: { address: '0x8888888888888888888888888888888888888888', name: 'Player 8' },
          winner: null,
          status: 'pending',
        },
      ],
    },
    {
      round: 2,
      matches: [
        {
          id: 5,
          round: 2,
          position: 0,
          player1: null,
          player2: null,
          winner: null,
          status: 'pending',
        },
        {
          id: 6,
          round: 2,
          position: 1,
          player1: null,
          player2: null,
          winner: null,
          status: 'pending',
        },
      ],
    },
    {
      round: 3,
      matches: [
        {
          id: 7,
          round: 3,
          position: 0,
          player1: null,
          player2: null,
          winner: null,
          status: 'pending',
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
  const { id } = useParams();
  const { connectedAddress, connectWallet } = useWallet();
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', message: '', type: '' });

  const [tournament, setTournament] = useState<Tournament>(MOCK_TOURNAMENT as Tournament);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [reportedWinner, setReportedWinner] = useState('');

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
        if (!id) return;

        // In a real implementation, we would fetch the tournament data from the contract
        // For now, we'll use the mock data
        // const tournamentData = await contractService.getTournamentInfo(id);
        // setTournament(tournamentData);

        setIsLoading(false);

        // Check if user is registered
        if (connectedAddress) {
          const isUserRegistered = tournament.participants.some(
            (p) => p.address.toLowerCase() === connectedAddress.toLowerCase()
          );
          setIsRegistered(isUserRegistered);

          // Check if user is creator
          setIsCreator(tournament.creator.toLowerCase() === connectedAddress.toLowerCase());
        }
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
  }, [id, connectedAddress, tournament]);

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
      // In a real implementation, we would interact with the contract and handle entry fees
      // await contractService.connect();

      // Handle entry fee if required
      if (tournament.hasEntryFee) {
        // Simulate payment processing
        displayToast(
          'Processing payment',
          `Sending ${tournament.entryFeeAmount} ${tournament.entryFeeToken} entry fee...`,
          'info'
        );

        // In a real implementation, we would:
        // 1. Calculate platform fee (2.5%)
        const platformFeePercentage = 2.5;
        const entryFeeAmount = parseFloat(tournament.entryFeeAmount);
        const platformFee = entryFeeAmount * (platformFeePercentage / 100);
        const creatorFee = entryFeeAmount - platformFee;

        // 2. Send 97.5% to tournament creator
        console.log(`Sending ${creatorFee} ${tournament.entryFeeToken} to tournament creator`);

        // 3. Send 2.5% to platform wallet
        console.log(`Sending ${platformFee} ${tournament.entryFeeToken} to platform wallet`);

        // 4. Register for tournament after payment is confirmed
        // await contractService.registerForTournament(id);
      } else {
        // No entry fee, just register
        // await contractService.registerForTournament(id);
      }

      // Simulate successful registration
      setTimeout(() => {
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
      }, 1000);
    } catch (error) {
      console.error('Error registering for tournament:', error);
      displayToast(
        'Error',
        'Failed to register for tournament. Please try again.',
        'error'
      );
    }
  };

  // Handle match result reporting
  const handleReportMatch = (match: any) => {
    setSelectedMatch(match);
    setReportedWinner('');
    setIsReportModalOpen(true);
  };

  // Submit match result
  const submitMatchResult = async () => {
    if (!reportedWinner) {
      displayToast(
        'Error',
        'Please select a winner',
        'error'
      );
      return;
    }

    try {
      // In a real implementation, we would interact with the contract
      // For now, we'll just update the local state
      // await contractService.connect();
      // const winnerAddress = reportedWinner === 'player1' ? selectedMatch.player1.address : selectedMatch.player2.address;
      // await contractService.declareWinner(id, selectedMatch.position, winnerAddress);

      const updatedBrackets = tournament.brackets.map((bracket) => {
        if (bracket.round === selectedMatch.round) {
          const updatedMatches = bracket.matches.map((match) => {
            if (match.id === selectedMatch.id) {
              return {
                ...match,
                winner: reportedWinner === 'player1' ? match.player1 : match.player2,
                status: 'completed' as 'completed',
              };
            }
            return match;
          });
          return { ...bracket, matches: updatedMatches };
        }
        return bracket;
      });

      // Update next round's match with the winner
      if (selectedMatch.round < tournament.brackets.length) {
        const nextRound = selectedMatch.round + 1;
        const matchIndexInCurrentRound = tournament.brackets[selectedMatch.round - 1].matches.findIndex(
          (m) => m.id === selectedMatch.id
        );
        const nextMatchIndex = Math.floor(matchIndexInCurrentRound / 2);
        const isFirstPlayer = matchIndexInCurrentRound % 2 === 0;

        updatedBrackets[nextRound - 1].matches = updatedBrackets[nextRound - 1].matches.map((match, idx) => {
          if (idx === nextMatchIndex) {
            return {
              ...match,
              player1: isFirstPlayer
                ? reportedWinner === 'player1'
                  ? selectedMatch.player1
                  : selectedMatch.player2
                : match.player1,
              player2: !isFirstPlayer
                ? reportedWinner === 'player1'
                  ? selectedMatch.player1
                  : selectedMatch.player2
                : match.player2,
            };
          }
          return match;
        });
      }

      setTournament({
        ...tournament,
        brackets: updatedBrackets,
      });

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
            <button className="px-4 py-2 border-b-2 border-blue-500 text-blue-500 font-medium">
              Overview
            </button>
            <button className="px-4 py-2 text-gray-500 hover:text-gray-700">
              Brackets
            </button>
            <button className="px-4 py-2 text-gray-500 hover:text-gray-700">
              Participants
            </button>
            {isCreator && (
              <button className="px-4 py-2 text-gray-500 hover:text-gray-700">
                Admin
              </button>
            )}
          </div>
        </div>

        <div className="mt-6">
          {/* Overview Tab */}
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
                      tournamentId={id as string}
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

          {/* Brackets Tab - Hidden by default */}
          <div className="hidden">
            <div className="bg-white p-6 border border-gray-200 rounded-md overflow-x-auto">
              {tournament.status === 'registration' ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <BracketGenerator
                    tournamentId={id as string}
                    participants={tournament.participants}
                    registrationEndTime={new Date(tournament.registrationEndDate)}
                    onBracketsGenerated={(generatedBrackets) => {
                      // Update tournament with generated brackets
                      setTournament({
                        ...tournament,
                        brackets: generatedBrackets,
                        status: 'active' as 'active'
                      });
                    }}
                  />
                </div>
              ) : (
                <div className="min-w-[900px]">
                  <div className="flex justify-between mb-6">
                    {tournament.brackets.map((bracket, index) => (
                      <div key={index} className="flex-1 flex flex-col items-stretch space-y-8">
                        <h3 className="text-sm font-medium text-center">
                          {index === 0
                            ? 'Round 1'
                            : index === tournament.brackets.length - 1
                            ? 'Final'
                            : `Round ${index + 1}`}
                        </h3>

                        <div className="flex flex-col space-y-16">
                          {bracket.matches.map((match, matchIndex) => (
                            <div
                              key={match.id}
                              className={`border border-gray-200 rounded-md p-3 relative h-[100px] ${match.status === 'completed' ? 'bg-gray-50' : 'bg-white'}`}
                            >
                              <div className="flex flex-col space-y-2">
                                <div
                                  className={`flex justify-between items-center p-2 rounded-md ${match.winner?.address === match.player1?.address ? 'bg-green-50' : 'bg-white'}`}
                                >
                                  <span className={match.winner?.address === match.player1?.address ? 'font-bold' : 'font-normal'}>
                                    {match.player1 ? match.player1.name : 'TBD'}
                                  </span>
                                  {match.winner?.address === match.player1?.address && (
                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Winner</span>
                                  )}
                                </div>

                                <div
                                  className={`flex justify-between items-center p-2 rounded-md ${match.winner?.address === match.player2?.address ? 'bg-green-50' : 'bg-white'}`}
                                >
                                  <span className={match.winner?.address === match.player2?.address ? 'font-bold' : 'font-normal'}>
                                    {match.player2 ? match.player2.name : 'TBD'}
                                  </span>
                                  {match.winner?.address === match.player2?.address && (
                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Winner</span>
                                  )}
                                </div>
                              </div>

                              {isRegistered &&
                                match.status !== 'completed' &&
                                match.player1 &&
                                match.player2 &&
                                (match.player1.address === connectedAddress ||
                                 match.player2.address === connectedAddress) && (
                                <button
                                  className="absolute bottom-[-20px] right-0 bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded"
                                  onClick={() => handleReportMatch({ ...match, round: index + 1 })}
                                >
                                  Report Result
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Participants Tab - Hidden by default */}
          <div className="hidden">
            <div className="bg-white p-6 border border-gray-200 rounded-md">
              <h2 className="text-lg font-medium mb-4">
                Registered Participants ({tournament.currentParticipants}/{tournament.maxParticipants})
              </h2>

              <div className="space-y-2">
                {tournament.participants.map((participant, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 border border-gray-200 rounded-md"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-200 rounded-full mr-2"></div>
                      <span>{participant.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {participant.address.slice(0, 6)}...{participant.address.slice(-4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Admin Tab - Hidden by default, only visible to creator */}
          {isCreator && (
            <div className="hidden">
              <div className="bg-white p-6 border border-gray-200 rounded-md">
                <h2 className="text-lg font-medium mb-4">
                  Tournament Administration
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-md font-medium mb-2">
                      Tournament Status
                    </h3>
                    <p className="mb-4">
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
                      <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                        Start Tournament Early
                      </button>
                    )}

                    {tournament.status === 'active' && (
                      <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
                        End Tournament
                      </button>
                    )}
                  </div>

                  <hr className="border-t border-gray-200" />

                  <div>
                    <h3 className="text-md font-medium mb-4">
                      Dispute Resolution
                    </h3>

                    <p className="mb-4">No active disputes</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={() => setIsReportModalOpen(false)}
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-4">Report Match Result</h2>

            {selectedMatch && (
              <div className="space-y-4">
                <p>
                  Please select the winner of the match between{' '}
                  <strong>{selectedMatch.player1?.name}</strong> and{' '}
                  <strong>{selectedMatch.player2?.name}</strong>
                </p>

                <div>
                  <label className="block text-sm font-medium mb-2">Winner</label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="player1"
                        checked={reportedWinner === 'player1'}
                        onChange={() => setReportedWinner('player1')}
                        className="mr-2"
                      />
                      {selectedMatch.player1?.name} (
                      {selectedMatch.player1?.address.slice(0, 6)}...
                      {selectedMatch.player1?.address.slice(-4)})
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="player2"
                        checked={reportedWinner === 'player2'}
                        onChange={() => setReportedWinner('player2')}
                        className="mr-2"
                      />
                      {selectedMatch.player2?.name} (
                      {selectedMatch.player2?.address.slice(0, 6)}...
                      {selectedMatch.player2?.address.slice(-4)})
                    </label>
                  </div>
                </div>

                <p className="text-sm text-gray-500">
                  Note: Both participants must report the same result for it to be confirmed.
                  In case of a dispute, the tournament admin will resolve it.
                </p>
              </div>
            )}

            <div className="flex justify-end mt-6 space-x-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => setIsReportModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 bg-blue-500 text-white rounded ${!reportedWinner ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
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
