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
      {/* Halloween Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="mb-8">
            <h1 className="text-6xl md:text-8xl font-bold mb-4 text-transparent bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text">
              🧟‍♂️ ZOMBIEFICATION 🧟‍♀️
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-2">
              Halloween 2025 • Zombie Infection Game
            </p>
            <p className="text-lg text-red-400">
              {gameStats?.gameTimeRemaining || 'Loading...'}
            </p>
          </div>

          {/* Game Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-red-900/30 backdrop-blur-sm border border-red-500/30 rounded-xl p-6">
              <div className="text-3xl mb-2">🧟‍♂️</div>
              <div className="text-2xl font-bold text-red-400">{gameStats?.totalZombies || 0}</div>
              <div className="text-gray-300">Infected</div>
            </div>
            
            <div className="bg-green-900/30 backdrop-blur-sm border border-green-500/30 rounded-xl p-6">
              <div className="text-3xl mb-2">👤</div>
              <div className="text-2xl font-bold text-green-400">{gameStats?.totalHumans || 0}</div>
              <div className="text-gray-300">Surviving</div>
            </div>
            
            <div className="bg-purple-900/30 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6">
              <div className="text-3xl mb-2">🦷</div>
              <div className="text-2xl font-bold text-purple-400">{gameStats?.totalTips || 0}</div>
              <div className="text-gray-300">Zombie Bites</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        {/* Farcaster Authentication */}
        {!isFarcasterAuthenticated ? (
          <div className="bg-black/40 backdrop-blur-sm border border-red-500/30 rounded-xl p-8 mb-8 text-center">
            <div className="text-4xl mb-4">🎃</div>
            <h2 className="text-2xl font-bold mb-4 text-red-400">Join the Apocalypse</h2>
            <p className="text-gray-300 mb-6">
              Connect your Farcaster account to participate in the zombie infection game!
            </p>
            <button
              onClick={farcasterLogin}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              🧟‍♂️ Connect Farcaster
            </button>
          </div>
        ) : (
          <>
            {/* User Status Card */}
            <div className={`bg-black/40 backdrop-blur-sm border rounded-xl p-8 mb-8 ${
              userStatus?.isZombie 
                ? 'border-red-500/50 bg-red-900/20' 
                : 'border-green-500/50 bg-green-900/20'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    {userStatus?.isZombie ? '🧟‍♂️ ZOMBIE STATUS' : '👤 HUMAN STATUS'}
                  </h2>
                  <p className="text-gray-300">@{farcasterUser?.username}</p>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    userStatus?.isZombie ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {userStatus?.isZombie ? 'INFECTED' : 'UNINFECTED'}
                  </div>
                  {userStatus?.becameZombieAt && (
                    <div className="text-sm text-gray-400">
                      Infected: {new Date(userStatus.becameZombieAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-lg font-bold text-red-400">{userStatus?.tipsReceived || 0}</div>
                  <div className="text-sm text-gray-400">Tips Received</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-400">{userStatus?.tipsSent || 0}</div>
                  <div className="text-sm text-gray-400">
                    {userStatus?.isZombie ? 'Humans Infected' : 'Tips Sent'}
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-400">{pendingTips.length}</div>
                  <div className="text-sm text-gray-400">Pending Bites</div>
                </div>
              </div>
            </div>

            {/* Pending Tips / Bite Decision */}
            {pendingTips.length > 0 && !userStatus?.isZombie && (
              <div className="bg-red-900/30 backdrop-blur-sm border border-red-500/30 rounded-xl p-8 mb-8">
                <h3 className="text-2xl font-bold mb-4 text-red-400">
                  🦷 You've Been Bitten!
                </h3>
                <p className="text-gray-300 mb-6">
                  You have {pendingTips.length} zombie bite{pendingTips.length > 1 ? 's' : ''}! 
                  Succumb to the bite and become a zombie, or resist and stay human.
                </p>

                <div className="space-y-3 mb-6">
                  {pendingTips.map((tip) => (
                    <div key={tip.id} className="bg-black/30 rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <div className="font-semibold">🧟‍♂️ @{tip.tipperUsername}</div>
                        <div className="text-sm text-gray-400">
                          Expires: {new Date(tip.expiresAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-lg font-bold text-red-400">
                        {tip.amount} $ZOMBIE
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleClaimTips}
                    disabled={claiming}
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
                  >
                    {claiming ? 'Succumbing...' : '🧟‍♂️ Succumb to Bite'}
                  </button>
                  <button
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
                  >
                    👤 Resist (Ignore Tips)
                  </button>
                </div>
              </div>
            )}

            {/* Zombie Powers */}
            {userStatus?.isZombie && (
              <div className="bg-red-900/30 backdrop-blur-sm border border-red-500/30 rounded-xl p-8 mb-8">
                <h3 className="text-2xl font-bold mb-4 text-red-400">
                  🧟‍♂️ Zombie Powers Activated
                </h3>
                <p className="text-gray-300 mb-6">
                  You are now a zombie! Use your undead powers to bite humans and spread the curse.
                </p>
                <button className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200">
                  🦷 Bite Humans (Tip $ZOMBIE)
                </button>
              </div>
            )}

            {/* Wallet Connection */}
            {!isConnected && (
              <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-xl p-8 mb-8 text-center">
                <div className="text-3xl mb-4">💀</div>
                <h3 className="text-xl font-bold mb-4 text-purple-400">Connect Wallet</h3>
                <p className="text-gray-300 mb-6">
                  Connect your wallet to claim zombie tips and participate in the final payout.
                </p>
                <button
                  onClick={connectWallet}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
                >
                  💀 Connect Wallet
                </button>
              </div>
            )}
          </>
        )}

        {/* Game Rules */}
        <div className="bg-black/40 backdrop-blur-sm border border-orange-500/30 rounded-xl p-8">
          <h3 className="text-2xl font-bold mb-4 text-orange-400">🎃 How to Play</h3>
          <div className="space-y-3 text-gray-300">
            <p><strong>1. Bite Humans:</strong> Zombies tip 1 $ZOMBIE to bite humans</p>
            <p><strong>2. Make Your Choice:</strong> Humans can claim tips (become zombie) or ignore them</p>
            <p><strong>3. Tips Expire:</strong> You have 4 hours to decide before tips expire</p>
            <p><strong>4. Final Payout:</strong> All zombies share the prize pool at game end</p>
            <p><strong>5. Strategy:</strong> Become zombie early for more biting time, or wait for bigger final pool</p>
          </div>
          
          <div className="mt-6 flex gap-4">
            <button
              onClick={() => router.push('/leaderboard')}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200"
            >
              📊 Bite Tracker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}