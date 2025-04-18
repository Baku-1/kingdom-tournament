'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import Link from 'next/link';
import Image from 'next/image';
import { SUPPORTED_GAMES } from '@/config/ronin';

// Mock data for tournaments
const MOCK_TOURNAMENTS = [
  {
    id: '1',
    name: 'Axie Infinity Championship',
    description: 'Compete in the ultimate Axie Infinity tournament for RON tokens!',
    game: 'axie-infinity',
    creator: '0x1234567890abcdef1234567890abcdef12345678',
    tournamentType: 'single-elimination',
    maxParticipants: 16,
    currentParticipants: 8,
    startDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
    registrationEndDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
    status: 'registration',
    rewardType: 'token',
    rewardAmount: '1000',
    rewardToken: 'RON',
  },
  {
    id: '2',
    name: 'Pixels Weekly Tournament',
    description: 'Weekly tournament for Pixels players with NFT rewards',
    game: 'pixels',
    creator: '0xabcdef1234567890abcdef1234567890abcdef12',
    tournamentType: 'double-elimination',
    maxParticipants: 32,
    currentParticipants: 20,
    startDate: new Date(Date.now() + 86400000 * 1), // 1 day from now
    registrationEndDate: new Date(Date.now() + 3600000 * 12), // 12 hours from now
    status: 'registration',
    rewardType: 'nft',
    rewardNftName: 'Rare Pixel Character',
  },
  {
    id: '3',
    name: 'Battle Racers Grand Prix',
    description: 'Race to the finish in this high-stakes tournament',
    game: 'battle-racers',
    creator: '0x7890abcdef1234567890abcdef1234567890abcd',
    tournamentType: 'single-elimination',
    maxParticipants: 8,
    currentParticipants: 8,
    startDate: new Date(Date.now() - 86400000 * 1), // 1 day ago
    registrationEndDate: new Date(Date.now() - 86400000 * 2), // 2 days ago
    status: 'active',
    rewardType: 'token',
    rewardAmount: '500',
    rewardToken: 'RON',
  },
  {
    id: '4',
    name: 'Mavis Market Trading Competition',
    description: 'Show off your trading skills in this special event',
    game: 'mavis-market',
    creator: '0xdef1234567890abcdef1234567890abcdef123456',
    tournamentType: 'single-elimination',
    maxParticipants: 64,
    currentParticipants: 32,
    startDate: new Date(Date.now() + 86400000 * 7), // 7 days from now
    registrationEndDate: new Date(Date.now() + 86400000 * 5), // 5 days from now
    status: 'registration',
    rewardType: 'token',
    rewardAmount: '2000',
    rewardToken: 'AXS',
  },
];

export default function Tournaments() {
  const { connectedAddress } = useWallet();
  const [tournaments, setTournaments] = useState(MOCK_TOURNAMENTS);
  const [filteredTournaments, setFilteredTournaments] = useState(MOCK_TOURNAMENTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Use static values instead of useColorModeValue
  const cardBg = 'white';
  const borderColor = 'gray-200';

  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Filter tournaments based on search term and filters
  useEffect(() => {
    let filtered = tournaments;

    if (searchTerm) {
      filtered = filtered.filter(
        (tournament) =>
          tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tournament.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (gameFilter) {
      filtered = filtered.filter((tournament) => tournament.game === gameFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter((tournament) => tournament.status === statusFilter);
    }

    setFilteredTournaments(filtered);
  }, [tournaments, searchTerm, gameFilter, statusFilter]);

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
        return 'blue';
      case 'active':
        return 'green';
      case 'completed':
        return 'gray';
      default:
        return 'gray';
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <Link
            href="/tournaments/create"
            className={`bg-blue-500 text-white px-4 py-2 rounded ${!connectedAddress ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
            aria-disabled={!connectedAddress}
            onClick={(e) => !connectedAddress && e.preventDefault()}
          >
            Create Tournament
          </Link>
        </div>

        <div>
          <div className="flex flex-col md:flex-row gap-4 mb-6 items-stretch md:items-center">
            <input
              type="text"
              placeholder="Search tournaments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded"
            />
            <select
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
              className="w-full md:w-48 p-2 border border-gray-300 rounded"
            >
              <option value="">All Games</option>
              {SUPPORTED_GAMES.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-48 p-2 border border-gray-300 rounded"
            >
              <option value="">All Statuses</option>
              <option value="registration">Registration Open</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {filteredTournaments.length === 0 ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="flex flex-col items-center">
                <p>No tournaments found</p>
                <Link
                  href="/tournaments/create"
                  className={`mt-2 bg-blue-500 text-white px-3 py-1 text-sm rounded ${!connectedAddress ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                  aria-disabled={!connectedAddress}
                  onClick={(e) => !connectedAddress && e.preventDefault()}
                >
                  Create a Tournament
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:-translate-y-1 transition-transform duration-200"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-center">
                      <span className={`${getStatusColor(tournament.status)} text-white px-2 py-1 rounded text-xs`}>
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
                    <h2 className="text-lg font-medium mt-2">
                      {tournament.name}
                    </h2>
                    <div className="flex items-center mt-2">
                      <div className="w-5 h-5 bg-gray-200 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-500">
                        {getGameInfo(tournament.game).name}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {tournament.description}
                    </p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Participants:</span>
                        <span className="font-medium">
                          {tournament.currentParticipants}/{tournament.maxParticipants}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Registration Ends:</span>
                        <span className="font-medium">{formatDate(tournament.registrationEndDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Starts:</span>
                        <span className="font-medium">{formatDate(tournament.startDate)}</span>
                      </div>
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

                  <div className="border-t border-gray-200 p-3">
                    <Link
                      href={`/tournaments/${tournament.id}`}
                      className="block w-full text-center border border-blue-500 text-blue-500 hover:bg-blue-50 py-1 px-4 rounded text-sm"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
