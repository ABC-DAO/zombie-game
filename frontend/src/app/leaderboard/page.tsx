'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zombieApi } from '@/lib/api';

interface ZombieStats {
  totalZombies: number;
  totalHumans: number;
  gameTimeRemaining: string;
  topSpreaders: Array<{
    username: string;
    infectionsCount: number;
  }>;
}

export default function ZombieTrackerPage() {
  const router = useRouter();
  const [zombieStats, setZombieStats] = useState<ZombieStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZombieStats();
  }, []);

  const fetchZombieStats = async () => {
    try {
      const [statsResponse, leaderboardResponse] = await Promise.all([
        zombieApi.getGameStats().catch(err => {
          console.warn('Game stats fetch failed:', err.message);
          return { data: { data: null } };
        }),
        zombieApi.getLeaderboard(10).catch(err => {
          console.warn('Leaderboard fetch failed:', err.message);
          return { data: { data: [] } };
        })
      ]);
      
      const stats = statsResponse.data?.data;
      const leaderboard = leaderboardResponse.data?.data;
      
      setZombieStats({
        totalZombies: stats?.totalZombies || 0,
        totalHumans: stats?.totalHumans || 0,
        gameTimeRemaining: 'Halloween 2025 - Coming Soon!',
        topSpreaders: leaderboard?.map((player: any) => ({
          username: player.farcasterUsername || player.username,
          infectionsCount: player.totalBitesSent || player.bites || 0
        })) || []
      });
    } catch (error) {
      console.error('Error fetching zombie stats:', error);
      setZombieStats({
        totalZombies: 0,
        totalHumans: 0,
        gameTimeRemaining: 'Game not started',
        topSpreaders: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading zombie apocalypse data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className="mb-8 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          ← Back to Game
        </button>

        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 text-red-400">
            🧟‍♂️ ZOMBIE APOCALYPSE 🧟‍♀️
          </h1>
          <p className="text-xl text-gray-300">
            Track the Halloween zombie bites
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-red-900/30 backdrop-blur-sm border border-red-500/30 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">🧟‍♂️</div>
            <div className="text-2xl font-bold text-red-400">{zombieStats?.totalZombies || 0}</div>
            <div className="text-gray-300">Total Zombies</div>
          </div>

          <div className="bg-green-900/30 backdrop-blur-sm border border-green-500/30 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">👤</div>
            <div className="text-2xl font-bold text-green-400">{zombieStats?.totalHumans || 0}</div>
            <div className="text-gray-300">Surviving Humans</div>
          </div>

          <div className="bg-purple-900/30 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">⏰</div>
            <div className="text-lg font-bold text-purple-400">{zombieStats?.gameTimeRemaining}</div>
            <div className="text-gray-300">Time Remaining</div>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-sm border border-red-500/30 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-6 text-red-400">🏆 Top Zombie Biters</h2>
          
          {zombieStats?.topSpreaders && zombieStats.topSpreaders.length > 0 ? (
            <div className="space-y-4">
              {zombieStats.topSpreaders.map((spreader, index) => (
                <div 
                  key={spreader.username}
                  className="flex justify-between items-center bg-red-900/20 rounded-lg p-4"
                >
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">🧟‍♂️</div>
                    <div>
                      <div className="font-semibold">@{spreader.username}</div>
                      <div className="text-sm text-gray-400">Rank #{index + 1}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-400">{spreader.infectionsCount}</div>
                    <div className="text-sm text-gray-400">bites</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-4">🧟‍♂️</div>
              <p>No zombies yet... but the apocalypse is coming!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}