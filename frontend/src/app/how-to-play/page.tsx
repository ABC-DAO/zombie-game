'use client';

import { useRouter } from 'next/navigation';

export default function HowToPlayPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black text-white">
      {/* Header */}
      <div className="relative px-4 py-8 text-center">
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-all duration-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="mb-6">
          <div className="text-6xl mb-4">🧟‍♂️</div>
          <h1 className="text-3xl md:text-5xl font-black mb-2 text-transparent bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text">
            HOW TO PLAY
          </h1>
          <div className="text-orange-400 font-medium">
            ZOMBIEFICATION Rules & Strategy
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pb-16 space-y-8">
        
        {/* Game Overview */}
        <div className="bg-black/50 border border-red-500/30 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">🎃</div>
            <h2 className="text-2xl font-bold text-red-400">Game Overview</h2>
          </div>
          <div className="space-y-3 text-gray-300">
            <p>ZOMBIEFICATION is a viral Halloween game where zombies spread through Farcaster tipping.</p>
            <p><strong className="text-orange-400">Duration:</strong> 12 hours (Halloween 2025)</p>
            <p><strong className="text-orange-400">Goal:</strong> Survive as human OR spread the infection as zombie</p>
          </div>
        </div>

        {/* Game Rules */}
        <div className="bg-black/50 border border-green-500/30 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">📜</div>
            <h2 className="text-2xl font-bold text-green-400">Game Rules</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-black/30 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">1. Everyone Starts Human</div>
              <div className="text-gray-300">No one is initially infected - patience zero begins the apocalypse</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">2. Zombies Infect Humans</div>
              <div className="text-gray-300">Tag @zombie-bite @username in any Farcaster cast to bite them</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">3. Humans Choose Their Fate</div>
              <div className="text-gray-300">Claim your bite to become zombie OR ignore to stay human</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">4. Bites Expire</div>
              <div className="text-gray-300">Unclaimed bites expire after 4 hours</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">5. Final Payout</div>
              <div className="text-gray-300">After 12 hours, all zombies split the remaining $ZOMBIE pool</div>
            </div>
          </div>
        </div>

        {/* How to Bite */}
        <div className="bg-black/50 border border-red-500/30 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">🦷</div>
            <h2 className="text-2xl font-bold text-red-400">How to Bite (Zombies Only)</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-red-500/20 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">Step 1: Create a Cast</div>
              <div className="text-gray-300">Write any Farcaster cast with your target</div>
            </div>
            <div className="bg-red-500/20 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">Step 2: Tag the Bot</div>
              <div className="text-gray-300">Include @zombie-bite and @targetusername</div>
            </div>
            <div className="bg-red-500/20 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">Step 3: Wait for Confirmation</div>
              <div className="text-gray-300">Bot replies with bite confirmation within 30 seconds</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-4 mt-4">
              <div className="font-bold text-orange-400 mb-2">Example Cast:</div>
              <div className="bg-black/50 rounded-lg p-3 font-mono text-sm text-gray-300">
                "The infection spreads... @zombie-bite @alice join the undead! 🧟‍♂️"
              </div>
            </div>
          </div>
        </div>

        {/* How to Become Zombie */}
        <div className="bg-black/50 border border-purple-500/30 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">🧟‍♂️</div>
            <h2 className="text-2xl font-bold text-purple-400">How to Become Zombie</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-purple-500/20 rounded-2xl p-4">
              <div className="font-bold text-purple-400 mb-2">Step 1: Get Bitten</div>
              <div className="text-gray-300">Another zombie must bite you using @zombie-bite</div>
            </div>
            <div className="bg-purple-500/20 rounded-2xl p-4">
              <div className="font-bold text-purple-400 mb-2">Step 2: Visit zombie.epicdylan.com</div>
              <div className="text-gray-300">Check your pending bites in the game interface</div>
            </div>
            <div className="bg-purple-500/20 rounded-2xl p-4">
              <div className="font-bold text-purple-400 mb-2">Step 3: Claim Your Infection</div>
              <div className="text-gray-300">Click "Become Zombie" to join the undead horde</div>
            </div>
            <div className="bg-purple-500/20 rounded-2xl p-4">
              <div className="font-bold text-purple-400 mb-2">Step 4: Spread the Virus</div>
              <div className="text-gray-300">Now you can bite other humans to grow the horde</div>
            </div>
          </div>
        </div>

        {/* Strategy Tips */}
        <div className="bg-black/50 border border-orange-500/30 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">🧠</div>
            <h2 className="text-2xl font-bold text-orange-400">Strategy Tips</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-500/20 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">🧟‍♂️ Zombie Strategy</div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Bite early and often</li>
                <li>• Target active Farcaster users</li>
                <li>• Create viral content with bites</li>
                <li>• Coordinate with other zombies</li>
              </ul>
            </div>
            <div className="bg-green-500/20 rounded-2xl p-4">
              <div className="font-bold text-green-400 mb-2">👤 Human Strategy</div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Stay off Farcaster during active hours</li>
                <li>• Don't engage with zombie content</li>
                <li>• Wait for bites to expire (4 hours)</li>
                <li>• Coordinate survival efforts</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Win Conditions */}
        <div className="bg-black/50 border border-yellow-500/30 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">🏆</div>
            <h2 className="text-2xl font-bold text-yellow-400">Win Conditions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-500/20 rounded-2xl p-4">
              <div className="font-bold text-red-400 mb-2">🧟‍♂️ Zombie Victory</div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Equal share of final $ZOMBIE pool</li>
                <li>• Bragging rights for spreading chaos</li>
                <li>• Leaderboard recognition</li>
              </ul>
            </div>
            <div className="bg-green-500/20 rounded-2xl p-4">
              <div className="font-bold text-green-400 mb-2">👤 Human Victory</div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Pure survival honor</li>
                <li>• "Last Human Standing" recognition</li>
                <li>• Ultimate bragging rights</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Back to Game */}
        <div className="text-center">
          <button
            onClick={() => router.push('/')}
            className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 text-lg"
          >
            🧟‍♂️ Back to Game
          </button>
        </div>
      </div>
    </div>
  );
}