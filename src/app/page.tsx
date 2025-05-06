'use client';

import React from 'react';
import { useWallet } from '@/providers/WalletProvider';
import Link from 'next/link';

export default function Home() {
  const { connectedAddress, connectWallet, isConnecting } = useWallet();

  return (
    <div className="min-h-screen py-10">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center py-10 space-y-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-orbitron)' }}>
            <span className="gradient-text">CYBER BATTLEFIELD</span>
          </h1>
          <p className="text-xl max-w-3xl" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            Enter the digital arena and battle for supremacy on the Ronin Blockchain.
            Compete for token and NFT rewards in this futuristic, decentralized platform.
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
          <h2 className="text-2xl font-bold text-center mb-10" style={{ fontFamily: 'var(--font-orbitron)' }}>
            <span className="gradient-text">BATTLE PROTOCOL</span>
          </h2>

          <div className="flex flex-col md:flex-row gap-8 justify-center items-center">
            <Feature
              title="DEPLOY ARENA"
              description="Establish your digital battleground on the Ronin blockchain with customizable brackets and high-stakes rewards."
            />
            <Feature
              title="ENTER COMBAT"
              description="Connect your Ronin wallet to join the fray and test your skills against elite cyber warriors."
            />
            <Feature
              title="CLAIM VICTORY"
              description="Conquer your opponents and receive automatic token or NFT rewards directly to your digital arsenal."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center p-8 bg-cyber-bg-light border border-cyber-primary shadow-md rounded-lg max-w-sm space-y-4 glow-border">
      <div className="p-2 rounded-full" style={{ background: 'rgba(0, 240, 255, 0.1)' }}>
        <div className="w-12 h-12 rounded-full" style={{ background: 'var(--cyber-gradient-primary)' }}></div>
      </div>
      <h3 className="text-lg font-medium" style={{ fontFamily: 'var(--font-orbitron)' }}>
        <span className="gradient-text">{title}</span>
      </h3>
      <p className="text-center" style={{ fontFamily: 'var(--font-rajdhani)' }}>
        {description}
      </p>
    </div>
  );
}
