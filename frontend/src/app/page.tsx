'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { tippingApi, zombieApi } from '@/lib/api';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useFarcasterMiniApp } from '@/hooks/useFarcasterMiniApp';

interface ZombieGameStats {
  totalZombies: number;
  totalHumans: number;
  totalTips: number;
  gameTimeRemaining: string;
  gameStatus: 'not_started' | 'active' | 'ended';
}

interface UserInfectionStatus {
  walletAddress: string;
  isZombie: boolean;
  pendingTips: number;
  tipsReceived: number;
  tipsSent: number;
  becameZombieAt: string | null;
  farcasterFid: number | null;
  farcasterUsername: string | null;
}

interface PendingTip {
  id: string;
  tipperUsername: string;
  amount: number;
  expiresAt: string;
  castHash?: string;
}

export default function ZombieGamePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connectWallet } = useWalletConnection();
  const { 
    user: farcasterUser, 
    isReady,
    isMiniApp,
    openUrl,
    sdk
  } = useFarcasterMiniApp();
  
  const isFarcasterAuthenticated = !!farcasterUser;
  const farcasterLogin = async () => {
    // TODO: Implement login functionality
    console.log('Farcaster login requested');
  };

  const [gameStats, setGameStats] = useState<ZombieGameStats | null>(null);
  const [userStatus, setUserStatus] = useState<UserInfectionStatus | null>(null);
  const [pendingTips, setPendingTips] = useState<PendingTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  // Fetch game data
  useEffect(() => {
    fetchGameStats();
    if (farcasterUser?.fid) {
      fetchUserStatus();
      fetchPendingTips();
    }
  }, [farcasterUser?.fid]);

  const fetchGameStats = async () => {
    try {
      const [gameStatusResponse, statsResponse] = await Promise.all([
        zombieApi.getGameStatus(),
        zombieApi.getGameStats()
      ]);
      
      const gameStatus = gameStatusResponse.data?.data;
      const stats = statsResponse.data?.data;
      
      setGameStats({
        totalZombies: stats?.totalZombies || 0,
        totalHumans: stats?.totalHumans || 0,
        totalTips: stats?.totalBites || 0,
        gameTimeRemaining: gameStatus?.timeRemaining || 'Halloween 2025 - Coming Soon!',
        gameStatus: gameStatus?.currentPhase === 'active' ? 'active' : 'not_started'
      });
    } catch (error) {
      console.error('Error fetching game stats:', error);
      // Fallback to placeholder data
      setGameStats({
        totalZombies: 0,
        totalHumans: 0,
        totalTips: 0,
        gameTimeRemaining: 'Halloween 2025 - Coming Soon!',
        gameStatus: 'not_started'
      });
    }
  };

  const fetchUserStatus = async () => {
    if (!farcasterUser?.fid) return;
    
    try {
      const response = await zombieApi.getPlayerStatus(farcasterUser.fid);
      const playerData = response.data?.data;
      
      setUserStatus({
        walletAddress: address || playerData?.walletAddress || '',
        isZombie: playerData?.isZombie || false,
        pendingTips: 0, // Will be set by fetchPendingTips
        tipsReceived: playerData?.tipsReceived || 0,
        tipsSent: playerData?.tipsSent || 0,
        becameZombieAt: playerData?.becameZombieAt || null,
        farcasterFid: farcasterUser.fid,
        farcasterUsername: farcasterUser.username
      });
    } catch (error) {
      console.error('Error fetching user status:', error);
      // Fallback to default status
      setUserStatus({
        walletAddress: address || '',
        isZombie: false,
        pendingTips: 0,
        tipsReceived: 0,
        tipsSent: 0,
        becameZombieAt: null,
        farcasterFid: farcasterUser.fid,
        farcasterUsername: farcasterUser.username
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingTips = async () => {
    if (!farcasterUser?.fid) return;
    
    try {
      const response = await zombieApi.getPendingTips(farcasterUser.fid);
      const pendingBites = response.data?.data || [];
      
      setPendingTips(pendingBites.map((bite: any) => ({
        id: bite.id,
        tipperUsername: bite.tipperUsername,
        amount: bite.amount,
        expiresAt: bite.expiresAt,
        castHash: bite.castHash
      })));
    } catch (error) {
      console.error('Error fetching pending tips:', error);
      setPendingTips([]);
    }
  };

  const handleClaimTips = async () => {
    if (!farcasterUser?.fid || !address || pendingTips.length === 0) return;
    
    setClaiming(true);
    try {
      const response = await tippingApi.claimTips({
        recipientWalletAddress: address,
        recipientFid: farcasterUser.fid,
        tipIds: pendingTips.map(tip => tip.id),
        farcasterUsername: farcasterUser.username
      });
      
      if (response.data && response.data.success) {
        // Refresh data after successful infection
        await fetchUserStatus();
        await fetchPendingTips();
        await fetchGameStats();
      }
    } catch (error) {
      console.error('Error claiming tips (becoming zombie):', error);
    } finally {
      setClaiming(false);
    }
  };

  if (loading && farcasterUser?.fid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">🧟‍♂️ Loading zombie apocalypse...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black text-white">
      {/* Hero Section */}
      <div className="relative px-4 py-8 text-center">
        <div className="mb-6">
          <div className="text-8xl mb-4">🧟‍♂️</div>
          <h1 className="text-4xl md:text-6xl font-black mb-2 text-transparent bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text">
            ZOMBIEFICATION
          </h1>
          <div className="text-orange-400 font-medium">
            {gameStats?.gameTimeRemaining || 'Loading...'}
          </div>
        </div>

        {/* Compact Stats */}
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-8">
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4">
            <div className="text-2xl">🧟‍♂️</div>
            <div className="text-xl font-bold text-red-400">{gameStats?.totalZombies || 0}</div>
          </div>
          
          <div className="bg-green-500/20 border border-green-500/30 rounded-2xl p-4">
            <div className="text-2xl">👤</div>
            <div className="text-xl font-bold text-green-400">{gameStats?.totalHumans || 0}</div>
          </div>
          
          <div className="bg-purple-500/20 border border-purple-500/30 rounded-2xl p-4">
            <div className="text-2xl">🦷</div>
            <div className="text-xl font-bold text-purple-400">{gameStats?.totalTips || 0}</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        {/* Farcaster Authentication */}
        {!isFarcasterAuthenticated ? (
          <div className="bg-black/50 border border-red-500/30 rounded-3xl p-6 mb-6 text-center">
            <div className="text-6xl mb-4">🎃</div>
            <h2 className="text-xl font-bold mb-3 text-red-400">Join the Apocalypse</h2>
            <button
              onClick={farcasterLogin}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
            >
              🧟‍♂️ Connect Farcaster
            </button>
          </div>
        ) : (
          <>
            {/* User Status Card */}
            <div className={`border rounded-3xl p-6 mb-6 text-center ${
              userStatus?.isZombie 
                ? 'border-red-500/50 bg-red-500/20' 
                : 'border-green-500/50 bg-green-500/20'
            }`}>
              <div className="text-6xl mb-3">
                {userStatus?.isZombie ? '🧟‍♂️' : '👤'}
              </div>
              <div className={`text-2xl font-bold mb-1 ${
                userStatus?.isZombie ? 'text-red-400' : 'text-green-400'
              }`}>
                {userStatus?.isZombie ? 'INFECTED' : 'SURVIVOR'}
              </div>
              <div className="text-gray-300 mb-4">@{farcasterUser?.username}</div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/20 rounded-2xl p-3">
                  <div className="text-lg font-bold text-red-400">{userStatus?.tipsReceived || 0}</div>
                  <div className="text-xs text-gray-400">Received</div>
                </div>
                <div className="bg-black/20 rounded-2xl p-3">
                  <div className="text-lg font-bold text-orange-400">{userStatus?.tipsSent || 0}</div>
                  <div className="text-xs text-gray-400">
                    {userStatus?.isZombie ? 'Infected' : 'Sent'}
                  </div>
                </div>
                <div className="bg-black/20 rounded-2xl p-3">
                  <div className="text-lg font-bold text-purple-400">{pendingTips.length}</div>
                  <div className="text-xs text-gray-400">Pending</div>
                </div>
              </div>
            </div>

            {/* Pending Bites */}
            {pendingTips.length > 0 && !userStatus?.isZombie && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-3xl p-6 mb-6">
                <div className="text-center mb-6">
                  <div className="text-6xl mb-2">🦷</div>
                  <h3 className="text-xl font-bold text-red-400 mb-2">
                    You've Been Bitten!
                  </h3>
                  <div className="text-sm text-gray-300">
                    {pendingTips.length} bite{pendingTips.length > 1 ? 's' : ''} pending
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {pendingTips.slice(0, 3).map((tip) => (
                    <div key={tip.id} className="bg-black/20 rounded-2xl p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">🧟‍♂️</div>
                        <div>
                          <div className="font-semibold">@{tip.tipperUsername}</div>
                          <div className="text-xs text-gray-400">1 $ZOMBIE</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingTips.length > 3 && (
                    <div className="text-center text-sm text-gray-400">
                      +{pendingTips.length - 3} more bites...
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={handleClaimTips}
                    disabled={claiming}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 text-lg"
                  >
                    {claiming ? 'Becoming Zombie...' : '🧟‍♂️ Become Zombie'}
                  </button>
                </div>
              </div>
            )}

            {/* Zombie Powers */}
            {userStatus?.isZombie && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-3xl p-6 mb-6 text-center">
                <div className="text-6xl mb-4">🧟‍♂️</div>
                <h3 className="text-xl font-bold mb-4 text-red-400">
                  Zombie Powers Active
                </h3>
                <button className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 text-lg">
                  🦷 Bite Humans
                </button>
                <div className="text-xs text-gray-400 mt-2">
                  Tag @zombie-bite @username in Farcaster
                </div>
              </div>
            )}

            {/* Wallet Connection */}
            {!isConnected && (
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-3xl p-6 mb-6 text-center">
                <div className="text-6xl mb-4">💀</div>
                <h3 className="text-lg font-bold mb-3 text-purple-400">Connect Wallet</h3>
                <button
                  onClick={connectWallet}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 text-lg"
                >
                  💀 Connect Wallet
                </button>
              </div>
            )}
          </>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/leaderboard')}
            className="bg-orange-500/20 border border-orange-500/30 rounded-2xl p-4 text-center hover:bg-orange-500/30 transition-all duration-200"
          >
            <div className="text-3xl mb-2">📊</div>
            <div className="text-sm font-medium text-orange-400">Leaderboard</div>
          </button>
          
          <button
            onClick={() => router.push('/how-to-play')}
            className="bg-gray-500/20 border border-gray-500/30 rounded-2xl p-4 text-center hover:bg-gray-500/30 transition-all duration-200"
          >
            <div className="text-3xl mb-2">🎃</div>
            <div className="text-sm font-medium text-gray-400">How to Play</div>
          </button>
        </div>
      </div>
    </div>
  );
}