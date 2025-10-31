'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigation = [
    { name: 'Apocalypse', href: '/', icon: '🧟‍♂️' },
    { name: 'Bite Tracker', href: '/leaderboard', icon: '🦷' },
    { name: 'How to Play', href: '/how-to-play', icon: '🎃' },
  ];

  return (
    <header className="bg-black/80 backdrop-blur-sm border-b border-red-500/30 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="text-3xl">🧟‍♂️</div>
            <span className="text-xl font-bold text-transparent bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text">
              ZOMBIEFICATION
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center space-x-2 text-gray-300 hover:text-red-400 transition-colors duration-200"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* Game Status */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              <span className="text-red-400 font-bold">Halloween 2025</span>
            </div>
            <div className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-lg">
              <span className="text-sm font-bold">🎃 JOIN APOCALYPSE</span>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-gray-300 hover:text-red-400 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-red-500/30">
            <div className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center space-x-3 text-gray-300 hover:text-red-400 transition-colors duration-200 py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
              <div className="pt-4">
                <div className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-4 py-3 rounded-lg transition-all duration-200 text-center">
                  <span className="font-bold">🎃 JOIN APOCALYPSE</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}