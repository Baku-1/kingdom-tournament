'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import Link from 'next/link';
import { SUPPORTED_GAMES } from '@/config/ronin';

// Tournament data will be fetched from the backend API

interface GameInfo {
  id: string;
  name: string;
  image: string;
}

// Contract interface removed as we're using the backend API

interface Tournament {
  id: string;
  name: string;
  description: string;
  game: string;
  creator: string;
  tournamentType: string;
  maxParticipants: number;
  currentParticipants: number;
  participants?: Array<{ address: string; name: string }>;
  startDate: Date;
  registrationEndDate: Date;
  status: string;
  rewardType: string;
  rewardAmount?: string;
  rewardToken?: string;
  rewardNftName?: string;
}

export default function MyTournaments() {
  const { connectedAddress, connectWallet } = useWallet();
  const [createdTournaments, setCreatedTournaments] = useState<Tournament[]>([]);
  const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('created');

  // Status is now determined by the backend API

  // Fetch tournaments when wallet connects
  useEffect(() => {
    const fetchTournaments = async () => {
      if (!connectedAddress) return;

      try {
        setIsLoading(true);

        // Get all tournaments from backend API
        const response = await fetch('/api/tournaments');

        if (!response.ok) {
          throw new Error('Failed to fetch tournaments');
        }

        const allTournaments = await response.json();

        // Process tournaments - convert date strings to Date objects
        const processedTournaments = allTournaments.map((tournament: Tournament) => ({
          ...tournament,
          startDate: new Date(tournament.startDate),
          registrationEndDate: new Date(tournament.registrationEndDate)
        }));

        // Filter created tournaments
        const created = processedTournaments.filter((t: Tournament) =>
          t.creator.toLowerCase() === connectedAddress.toLowerCase()
        );

        // Filter joined tournaments
        const joined = processedTournaments.filter((t: Tournament) => {
          // Check if user is in participants list
          const isParticipant = t.participants?.some(
            (p: { address: string; name: string }) => p.address.toLowerCase() === connectedAddress.toLowerCase()
          );
          return isParticipant && t.creator.toLowerCase() !== connectedAddress.toLowerCase();
        });

        setCreatedTournaments(created);
        setJoinedTournaments(joined);
      } catch (error) {
        console.error('Error fetching tournaments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTournaments();
  }, [connectedAddress]);

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
        return 'bg-blue-500 text-white';
      case 'active':
        return 'bg-green-500 text-white';
      case 'completed':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-500 text-white';
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

  if (!connectedAddress) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
          <h1 className="text-2xl font-bold">Connect Wallet</h1>
          <p>Please connect your Ronin wallet to view your tournaments</p>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            onClick={connectWallet}
          >
            Connect Ronin Wallet
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4">Loading your tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">My Tournaments</h1>

        <div>
          <div className="border-b border-gray-200">
            <div className="flex space-x-4">
              <button
                className={`px-4 py-2 ${activeTab === 'created' ? 'border-b-2 border-blue-500 text-blue-500 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('created')}
              >
                Created Tournaments
              </button>
              <button
                className={`px-4 py-2 ${activeTab === 'joined' ? 'border-b-2 border-blue-500 text-blue-500 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('joined')}
              >
                Joined Tournaments
              </button>
            </div>
          </div>

          <div className="mt-6">
            {/* Created Tournaments Tab */}
            {activeTab === 'created' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-medium">Tournaments You Created</h2>
                  <Link
                    href="/tournaments/create"
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 text-sm rounded"
                  >
                    Create New Tournament
                  </Link>
                </div>

                {createdTournaments.length === 0 ? (
                  <div className="flex items-center justify-center min-h-[200px] bg-white p-6 border border-gray-200 rounded-md">
                    <div className="flex flex-col items-center">
                      <p>You haven&apos;t created any tournaments yet</p>
                      <Link
                        href="/tournaments/create"
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 text-sm rounded mt-2"
                      >
                        Create a Tournament
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {createdTournaments.map((tournament) => (
                      <TournamentCard
                        key={tournament.id}
                        tournament={tournament}
                        formatDate={formatDate}
                        getStatusColor={getStatusColor}
                        getGameInfo={getGameInfo}
                        isCreator={true}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Joined Tournaments Tab */}
            {activeTab === 'joined' && (
              <div>
                <h2 className="text-lg font-medium mb-6">
                  Tournaments You Joined
                </h2>

                {joinedTournaments.length === 0 ? (
                  <div className="flex items-center justify-center min-h-[200px] bg-white p-6 border border-gray-200 rounded-md">
                    <div className="flex flex-col items-center">
                      <p>You havent joined any tournaments yet</p>
                      <Link
                        href="/tournaments"
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 text-sm rounded mt-2"
                      >
                        Browse Tournaments
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {joinedTournaments.map((tournament) => (
                      <TournamentCard
                        key={tournament.id}
                        tournament={tournament}
                        formatDate={formatDate}
                        getStatusColor={getStatusColor}
                        getGameInfo={getGameInfo}
                        isCreator={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tournament Card Component
function TournamentCard({
  tournament,
  formatDate,
  getStatusColor,
  getGameInfo,
  isCreator,
}: {
  tournament: Tournament;
  formatDate: (date: Date) => string;
  getStatusColor: (status: string) => string;
  getGameInfo: (gameId: string) => GameInfo;
  isCreator: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden transition-transform duration-200 hover:translate-y-[-5px]">
      <div className="p-4 pb-0">
        <div className="flex justify-between items-center">
          <span className={`${getStatusColor(tournament.status)} px-2 py-1 text-xs rounded`}>
            {tournament.status === 'registration'
              ? 'Registration Open'
              : tournament.status === 'active'
              ? 'Active'
              : 'Completed'}
          </span>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
            {tournament.tournamentType === 'single-elimination' ? 'Single' : 'Double'}
          </span>
        </div>
        <h3 className="text-lg font-medium mt-2">
          {tournament.name}
        </h3>
        <div className="flex items-center mt-2">
          <div className="w-5 h-5 bg-gray-200 rounded-full mr-2"></div>
          <span className="text-sm text-gray-500">
            {getGameInfo(tournament.game).name}
          </span>
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm mb-3 line-clamp-2">
          {tournament.description}
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Participants:</span>
            <span className="font-medium">
              {tournament.currentParticipants}/{tournament.maxParticipants}
            </span>
          </div>
          {tournament.status === 'registration' ? (
            <div className="flex justify-between">
              <span className="text-gray-500">Registration Ends:</span>
              <span className="font-medium">{formatDate(tournament.registrationEndDate)}</span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span className="text-gray-500">{tournament.status === 'active' ? 'Started:' : 'Ended:'}</span>
              <span className="font-medium">{formatDate(tournament.startDate)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Reward:</span>
            <span className="font-medium">
              {tournament.rewardType === 'token'
                ? `${tournament.rewardAmount} ${tournament.rewardToken}`
                : tournament.rewardNftName}
            </span>
          </div>
        </div>
      </div>

      <hr className="border-t border-gray-200" />

      <div className="p-4 pt-3">
        <Link
          href={`/tournaments/${tournament.id}`}
          className={`block w-full text-center px-4 py-2 rounded text-sm ${
            isCreator && tournament.status === 'active'
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'border border-blue-500 text-blue-500 hover:bg-blue-50'
          }`}
        >
          {isCreator && tournament.status === 'active' ? 'Manage Tournament' : 'View Details'}
        </Link>
      </div>
    </div>
  );
}
