'use client';

import React from 'react';
import { useWallet } from '@/providers/WalletProvider';
import Link from 'next/link';

export default function Home() {
  const { connectedAddress, connectWallet, isConnecting } = useWallet();

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white min-h-screen py-10">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center py-10 space-y-8">
          <h1 className="text-4xl font-bold">
            Kingdom Tournament
          </h1>
          <p className="text-xl max-w-3xl">
            Create and join tournaments for your favorite games on the Ronin Blockchain.
            Compete for token and NFT rewards in a secure, decentralized platform.
          </p>

          {!connectedAddress ? (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-md text-lg mt-6"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect Ronin Wallet'}
            </button>
          ) : (
            <div className="flex flex-col items-center mt-6 space-y-6">
              <p>Connected: {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}</p>
              <div className="flex flex-wrap md:flex-nowrap gap-4 justify-center">
                <Link href="/tournaments" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-md text-lg">
                  Browse Tournaments
                </Link>
                <Link href="/tournaments/create" className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-md text-lg">
                  Create Tournament
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="mt-20">
          <h2 className="text-2xl font-bold text-center mb-10">
            How It Works
          </h2>

          <div className="flex flex-col md:flex-row gap-8 justify-center items-center">
            <Feature
              title="Create Tournaments"
              description="Set up tournaments for your favorite Ronin blockchain games with customizable brackets and rewards."
              icon="/icons/create.svg"
            />
            <Feature
              title="Join & Compete"
              description="Sign up for tournaments using your Ronin wallet and compete against other players."
              icon="/icons/compete.svg"
            />
            <Feature
              title="Win Rewards"
              description="Winners receive automatic payouts of token or NFT rewards directly to their wallets."
              icon="/icons/reward.svg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="flex flex-col items-center p-8 bg-white shadow-md rounded-lg max-w-sm space-y-4">
      <div className="p-2 rounded-full bg-blue-50">
        {/* Placeholder for icon - replace with actual icons later */}
        <div className="w-12 h-12 bg-blue-500 rounded-full"></div>
      </div>
      <h3 className="text-lg font-medium">
        {title}
      </h3>
      <p className="text-center">
        {description}
      </p>
    </div>
  );
}
