'use client';

import React, { useState } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const { connectedAddress, connectWallet, disconnectWallet } = useWallet();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  return (
    <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="font-bold text-xl" style={{ fontFamily: 'var(--font-orbitron)' }}>
              <Link href="/" className="gradient-text">Cyber Battlefield</Link>
            </div>
            <nav className="hidden md:flex space-x-4">
              <NavLink href="/tournaments" isActive={pathname === '/tournaments'}>
                Tournaments
              </NavLink>
              {connectedAddress && (
                <NavLink href="/my-tournaments" isActive={pathname === '/my-tournaments'}>
                  My Tournaments
                </NavLink>
              )}
            </nav>
          </div>

          <div className="flex items-center">
            {!connectedAddress ? (
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                onClick={connectWallet}
              >
                Connect Wallet
              </button>
            ) : (
              <div className="relative">
                <button
                  className="border border-blue-500 text-blue-500 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50"
                  onClick={toggleDropdown}
                >
                  {`${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`}
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
                    <Link href="/my-tournaments" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      My Tournaments
                    </Link>
                    <button
                      onClick={disconnectWallet}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              className="md:hidden ml-2 p-2"
              onClick={toggleMenu}
              aria-label="Toggle Navigation"
            >
              {isMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="flex flex-col space-y-4">
              <NavLink href="/tournaments" isActive={pathname === '/tournaments'}>
                Tournaments
              </NavLink>
              {connectedAddress && (
                <NavLink href="/my-tournaments" isActive={pathname === '/my-tournaments'}>
                  My Tournaments
                </NavLink>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// NavLink component
function NavLink({ children, href, isActive }: { children: React.ReactNode; href: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`px-2 py-1 rounded-md ${isActive ? 'font-semibold text-blue-500' : 'text-gray-600'} hover:text-gray-800`}
    >
      {children}
    </Link>
  );
}

// Icons
function HamburgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
