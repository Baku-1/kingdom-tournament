'use client';

import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-50 text-gray-700 border-t border-gray-200 mt-10">
      <div className="container mx-auto py-10 px-4 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
          <div>
            <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-orbitron)' }}>
              Cyber Battlefield
            </h3>
            <p className="text-sm max-w-xs">
              Enter the digital arena and battle for supremacy on the Ronin Blockchain.
              Compete for token and NFT rewards in this futuristic, decentralized platform.
            </p>
          </div>

          <div className="flex flex-row space-x-10">
            <div className="flex flex-col items-start">
              <h4 className="font-semibold mb-2">
                Platform
              </h4>
              <Link href="/" className="hover:underline mb-2">Home</Link>
              <Link href="/tournaments" className="hover:underline mb-2">Tournaments</Link>
              <Link href="/tournaments/create" className="hover:underline mb-2">Create Tournament</Link>
            </div>

            <div className="flex flex-col items-start">
              <h4 className="font-semibold mb-2">
                Resources
              </h4>
              <a href="https://wallet.roninchain.com/" target="_blank" rel="noopener noreferrer" className="hover:underline mb-2">
                Ronin Wallet
              </a>
              <a href="https://docs.roninchain.com/" target="_blank" rel="noopener noreferrer" className="hover:underline mb-2">
                Ronin Docs
              </a>
              <a href="https://roninchain.com/" target="_blank" rel="noopener noreferrer" className="hover:underline mb-2">
                Ronin Blockchain
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8">
          <p className="text-center text-sm">
            © {new Date().getFullYear()} <span className="gradient-text">Cyber Battlefield</span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
