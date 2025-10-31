import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

if (!process.env.NEXT_PUBLIC_API_URL) {
  console.warn('⚠️ NEXT_PUBLIC_API_URL not set, using fallback:', API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('🕐 API Timeout - backend may be sleeping, try again in 30s:', error.message);
    } else if (error.response?.status >= 500) {
      console.error('🔴 Backend Server Error:', error.response?.data || error.message);
    } else if (!error.response) {
      console.error('🔌 Network Error - backend unreachable:', error.message);
    } else {
      console.error('❌ API Error:', error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

// Zombie Game API
export const zombieApi = {
  // Game status and stats
  getGameStatus: () => api.get('/api/zombie/game-status'),
  getGameStats: () => api.get('/api/zombie/stats'),
  getLeaderboard: (limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return api.get(`/api/zombie/leaderboard${params.toString() ? `?${params}` : ''}`);
  },
  
  // Player status
  getPlayerStatus: (fid: number) => api.get(`/api/zombie/status/${fid}`),
  getPendingTips: (fid: number) => api.get(`/api/zombie/pending/${fid}`),
  
  // Game actions
  sendTip: (data: {
    tipperWalletAddress: string;
    tipperFid: number;
    recipientFid: number;
    recipientUsername?: string;
    castHash?: string;
    castUrl?: string;
  }) => api.post('/api/zombie/tip', data),
  
  claimTips: (data: {
    recipientWalletAddress: string;
    recipientFid: number;
    tipIds: string[];
    farcasterUsername?: string;
  }) => api.post('/api/zombie/claim', data),
};

// Tipping API (Updated for zombie game)
export const tippingApi = {
  sendTip: (data: {
    tipperWalletAddress: string;
    recipientFid: number;
    recipientUsername?: string;
    tipAmount: number;
    castHash?: string;
    castUrl?: string;
    message?: string;
  }) => api.post('/api/tipping/send', data),
  
  getReceivedTips: (fid: number, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return api.get(`/api/tipping/received/${fid}${params.toString() ? `?${params}` : ''}`);
  },
  
  getSentTips: (address: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return api.get(`/api/tipping/sent/${address}${params.toString() ? `?${params}` : ''}`);
  },
  
  claimTips: (data: {
    recipientWalletAddress: string;
    recipientFid: number;
    tipIds: string[];
    farcasterUsername?: string;
  }) => api.post('/api/tipping/claim', data),
  
  getStats: () => api.get('/api/tipping/stats'),
};

// Users API
export const usersApi = {
  getProfile: (address: string) => api.get(`/api/users/profile/${address}`),
  getByFarcasterFid: (fid: number) => api.get(`/api/users/farcaster/${fid}`),
  updateProfile: (address: string, data: {
    farcasterFid?: number;
    farcasterUsername?: string;
  }) => api.put(`/api/users/profile/${address}`, data),
  searchUsers: (username: string, limit?: number) => {
    const params = new URLSearchParams();
    params.append('username', username);
    if (limit) params.append('limit', limit.toString());
    return api.get(`/api/users/search?${params}`);
  },
};

// Farcaster API
export const farcasterApi = {
  getUser: (fid: number) => api.get(`/api/farcaster/user/${fid}`),
  getUserByUsername: (username: string) => api.get(`/api/farcaster/user/username/${username}`),
  getStats: (fid: number) => api.get(`/api/farcaster/stats/${fid}`),
};

// Keep legacy export for compatibility
export const stakingApi = {
  // Deprecated - keeping for backwards compatibility only
  getPosition: () => Promise.reject(new Error('Staking disabled in zombie game')),
  getStats: () => zombieApi.getGameStats(),
  getLeaderboard: () => zombieApi.getLeaderboard(),
};