'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { useRouter } from 'next/navigation';
import { SUPPORTED_GAMES, TOURNAMENT_TYPES } from '@/config/ronin';
import { contractService } from '@/services/ContractService';

type TokenBalances = {
  RON: string;
  AXS: string;
  SLP: string;
  USDC: string;
};

type TokenType = keyof TokenBalances;

type TokenAddresses = {
  [K in TokenType]: string;
};

export default function CreateTournament() {
  const { connectedAddress, connectWallet } = useWallet();
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', message: '', type: '' });

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [game, setGame] = useState('');
  const [tournamentType, setTournamentType] = useState('single-elimination');
  const [startDate, setStartDate] = useState('');
  const [registrationEndDate, setRegistrationEndDate] = useState('');
  const [rewardType, setRewardType] = useState('token');
  const [tokenAddress, setTokenAddress] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenType>('RON');
  const [tokenAmount, setTokenAmount] = useState('');
  const [nftAddress, setNftAddress] = useState('');
  const [nftId, setNftId] = useState('');

  // Mock wallet token balances (in a real app, these would be fetched from the blockchain)
  const [walletBalances] = useState<TokenBalances>({
    RON: '1000',
    AXS: '50',
    SLP: '10000',
    USDC: '500'
  });
  const [positionBasedRewards, setPositionBasedRewards] = useState(false);
  const [rewardDistribution, setRewardDistribution] = useState({
    first: 100,
    second: 0,
    third: 0,
    fourth: 0,
  });
  // Entry fee state
  const [hasEntryFee, setHasEntryFee] = useState(false);
  const [entryFeeAmount, setEntryFeeAmount] = useState('');
  const [entryFeeToken, setEntryFeeToken] = useState('RON');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Simple toast function
  const displayToast = (title: string, message: string, type: string) => {
    setToastMessage({ title, message, type });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connectedAddress) {
      displayToast(
        'Wallet not connected',
        'Please connect your Ronin wallet to create a tournament',
        'error'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Create tournament using contract service
      await contractService.connect(); // Ensure wallet is connected

      const tournamentData = {
        name,
        description,
        gameId: game,
        tournamentType,
        registrationEndDate,
        startDate,
        rewardType,
        rewardTokenAddress: rewardType === 'token' ? (connectedAddress || tokenAddress) : (connectedAddress || nftAddress),
        rewardToken: rewardType === 'token' ? selectedToken : '',
        rewardAmount: rewardType === 'token' ? tokenAmount : nftId,
        rewardDistribution: {
          first: rewardDistribution.first,
          second: rewardDistribution.second,
          third: rewardDistribution.third,
          fourth: rewardDistribution.fourth,
        },
        // Entry fee data
        hasEntryFee,
        entryFeeAmount: hasEntryFee ? entryFeeAmount : '0',
        entryFeeToken: hasEntryFee ? entryFeeToken : 'RON',
      };

      const tournamentId = await contractService.createTournament(tournamentData);

      displayToast(
        'Tournament created!',
        `Your tournament has been successfully created with ID: ${tournamentId}`,
        'success'
      );

      // Redirect to the tournaments page
      router.push('/tournaments');
    } catch (error) {
      console.error('Error creating tournament:', error);
      displayToast(
        'Error',
        'Failed to create tournament. Please try again.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reward distribution change
  const handleRewardDistributionChange = (position: string, value: number) => {
    setRewardDistribution({
      ...rewardDistribution,
      [position]: value,
    });
  };

  // Update token address based on selected token
  useEffect(() => {
    // Token addresses from Ronin blockchain
    const tokenAddresses: TokenAddresses = {
      RON: connectedAddress || '', // RON is the native token, so we use the wallet address
      AXS: '0x97a9107c1793bc407d6f527b77e7fff4d812bece', // AXS token on Ronin
      SLP: '0xa8754b9fa15fc18bb59458815510e40a12cd2014', // SLP token on Ronin
      USDC: '0x0b7007c13325c48911f73a2dad5fa5dcbf808adc', // USDC token on Ronin
    };

    if (selectedToken && tokenAddresses[selectedToken]) {
      setTokenAddress(tokenAddresses[selectedToken]);
    }
  }, [selectedToken, connectedAddress]);

  if (!connectedAddress) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
          <h1 className="text-2xl font-bold">Connect Wallet</h1>
          <p>Please connect your Ronin wallet to create a tournament</p>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            onClick={connectWallet}
          >
            Connect Ronin Wallet
          </button>
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
        <h1 className="text-2xl font-bold">Create Tournament</h1>
        <p>Fill out the form below to create a new tournament</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-1">
                Tournament Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter tournament name"
                className="w-full p-2 border border-gray-300 rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter tournament description"
                rows={4}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Game <span className="text-red-500">*</span>
              </label>
              <select
                value={game}
                onChange={(e) => setGame(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                required
              >
                <option value="">Select game</option>
                {SUPPORTED_GAMES.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tournament Type <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-4">
                {TOURNAMENT_TYPES.map((type) => (
                  <label key={type.id} className="flex items-center">
                    <input
                      type="radio"
                      value={type.id}
                      checked={tournamentType === type.id}
                      onChange={() => setTournamentType(type.id)}
                      className="mr-2"
                    />
                    {type.name}
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {TOURNAMENT_TYPES.find((type) => type.id === tournamentType)?.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Registration End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={registrationEndDate}
                  onChange={(e) => setRegistrationEndDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Tournament Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xl font-medium mb-4">Entry Fee Settings</h2>

              <div className="mb-6">
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={hasEntryFee}
                    onChange={(e) => setHasEntryFee(e.target.checked)}
                    className="mr-2"
                  />
                  Require entry fee
                </label>
                <p className="text-sm text-gray-500 mb-4">
                  97.5% of entry fees go to you, 2.5% goes to platform maintenance
                </p>

                {hasEntryFee && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-md">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Fee Amount <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entryFeeAmount}
                        onChange={(e) => setEntryFeeAmount(e.target.value)}
                        placeholder="Enter fee amount"
                        className="w-full p-2 border border-gray-300 rounded"
                        required={hasEntryFee}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Fee Token <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={entryFeeToken}
                        onChange={(e) => setEntryFeeToken(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                        required={hasEntryFee}
                      >
                        <option value="RON">RON (Native Token)</option>
                        <option value="USDC">USDC</option>
                        <option value="AXS">AXS</option>
                        <option value="SLP">SLP</option>
                        <option value="CUSTOM">Custom Token</option>
                      </select>
                    </div>

                    {entryFeeToken === 'CUSTOM' && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">
                          Custom Token Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Enter token contract address"
                          className="w-full p-2 border border-gray-300 rounded"
                          required={hasEntryFee && entryFeeToken === 'CUSTOM'}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <h2 className="text-xl font-medium mb-4">Reward Settings</h2>

              <div className="p-4 mb-4 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="text-md font-medium text-blue-800 mb-2">Important Information</h3>
                <p className="text-sm text-blue-700 mb-2">
                  The rewards you specify below will be used as collateral and will be locked in the tournament contract until winners are determined.
                </p>
                <p className="text-sm text-blue-700 mb-2">
                  Make sure you have sufficient funds in your connected wallet. The specified amount will be transferred from your wallet when creating the tournament.
                </p>
                {connectedAddress ? (
                  <p className="text-sm text-blue-700">
                    Connected wallet: <span className="font-medium">{`${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`}</span>
                  </p>
                ) : (
                  <p className="text-sm text-red-700">
                    Please connect your wallet to create a tournament.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Reward Type <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="token"
                      checked={rewardType === 'token'}
                      onChange={() => setRewardType('token')}
                      className="mr-2"
                    />
                    Token
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="nft"
                      checked={rewardType === 'nft'}
                      onChange={() => setRewardType('nft')}
                      className="mr-2"
                    />
                    NFT
                  </label>
                </div>
              </div>

              {rewardType === 'token' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Token Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={connectedAddress || tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      placeholder="Connect wallet to use your address"
                      className="w-full p-2 border border-gray-300 rounded bg-gray-50"
                      disabled={!!connectedAddress}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your wallet address will be used for token collateral.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Select Token <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      <select
                        value={selectedToken}
                        onChange={(e) => setSelectedToken(e.target.value as TokenType)}
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                      >
                        <option value="RON">RON (Native Token) - Balance: {walletBalances.RON}</option>
                        <option value="AXS">AXS - Balance: {walletBalances.AXS}</option>
                        <option value="SLP">SLP - Balance: {walletBalances.SLP}</option>
                        <option value="USDC">USDC - Balance: {walletBalances.USDC}</option>
                      </select>

                      <div className="mt-2">
                        <label className="block text-sm font-medium mb-1">
                          Token Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min={0}
                            max={parseFloat(walletBalances[selectedToken])}
                            value={tokenAmount}
                            onChange={(e) => setTokenAmount(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setTokenAmount(walletBalances[selectedToken])}
                            className="ml-2 px-2 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                          >
                            Max
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          This amount will be locked as collateral in the tournament contract.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      NFT Contract Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={connectedAddress || nftAddress}
                      onChange={(e) => setNftAddress(e.target.value)}
                      placeholder="Connect wallet to use your address"
                      className="w-full p-2 border border-gray-300 rounded bg-gray-50"
                      disabled={!!connectedAddress}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your wallet address will be used for NFT collateral.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      NFT ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nftId}
                      onChange={(e) => setNftId(e.target.value)}
                      placeholder="Enter NFT ID"
                      className="w-full p-2 border border-gray-300 rounded"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This NFT will be locked as collateral in the tournament contract.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={positionBasedRewards}
                    onChange={(e) => setPositionBasedRewards(e.target.checked)}
                    className="mr-2"
                  />
                  Enable position-based rewards
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Distribute rewards based on final tournament positions
                </p>
              </div>

              {positionBasedRewards && (
                <div className="p-4 border border-gray-300 rounded mt-4">
                  <p className="mb-4">Reward Distribution (Total: 100%)</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        1st Place (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rewardDistribution.first}
                        onChange={(e) => handleRewardDistributionChange('first', parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        2nd Place (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rewardDistribution.second}
                        onChange={(e) => handleRewardDistributionChange('second', parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        3rd Place (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rewardDistribution.third}
                        onChange={(e) => handleRewardDistributionChange('third', parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        4th Place (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rewardDistribution.fourth}
                        onChange={(e) => handleRewardDistributionChange('fourth', parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>
                  </div>

                  <p className={`mt-4 ${
                    Object.values(rewardDistribution).reduce((a, b) => a + b, 0) === 100
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}>
                    Total: {Object.values(rewardDistribution).reduce((a, b) => a + b, 0)}%
                    {Object.values(rewardDistribution).reduce((a, b) => a + b, 0) !== 100 &&
                      ' (Must equal 100%)'}
                  </p>
                </div>
              )}

              <button
                type="submit"
                className={`mt-8 bg-blue-500 text-white font-bold py-2 px-4 rounded ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                }`}
                disabled={
                  isSubmitting ||
                  !name ||
                  !game ||
                  !startDate ||
                  !registrationEndDate ||
                  (rewardType === 'token' && (!tokenAddress || !tokenAmount)) ||
                  (rewardType === 'nft' && (!nftAddress || !nftId)) ||
                  (positionBasedRewards &&
                    Object.values(rewardDistribution).reduce((a, b) => a + b, 0) !== 100)
                }
              >
                {isSubmitting ? 'Creating...' : 'Create Tournament'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
