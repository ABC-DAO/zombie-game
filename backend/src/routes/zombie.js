const express = require('express');
const router = express.Router();
const db = require('../services/database');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// GET /api/zombie/game-status - Get current game status
router.get('/game-status', async (req, res) => {
  try {
    logger.info('🎃 Fetching zombie game status');
    
    // For now, return hardcoded values - will be dynamic when game launches
    const gameStatus = {
      isActive: false,
      startTime: process.env.ZOMBIE_GAME_START_TIME || '2025-10-31T08:00:00-07:00',
      endTime: process.env.ZOMBIE_GAME_END_TIME || '2025-10-31T20:00:00-07:00',
      totalPool: parseInt(process.env.ZOMBIE_TOTAL_POOL) || 10000000,
      hourlyUnlock: parseInt(process.env.ZOMBIE_HOURLY_UNLOCK) || 833333,
      timeRemaining: 'Halloween 2025 - Coming Soon!',
      currentPhase: 'pre_game'
    };

    res.json({
      success: true,
      data: gameStatus
    });
  } catch (error) {
    logger.error('Error fetching game status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch game status'
    });
  }
});

// GET /api/zombie/stats - Get overall game statistics with timer
router.get('/stats', async (req, res) => {
  try {
    logger.info('🧟‍♂️ Fetching zombie game stats');
    const client = await db.getClient();
    
    // Use the enhanced zombie_game_stats_with_timer view
    try {
      const result = await client.query('SELECT * FROM zombie_game_stats_with_timer');
      const stats = result.rows[0];
      
      res.json({
        success: true,
        data: {
          totalZombies: parseInt(stats.total_zombies || 0),
          totalHumans: parseInt(stats.total_humans || 0),
          totalBites: parseInt(stats.total_bites || 0),
          pendingBites: parseInt(stats.pending_bites || 0),
          claimedBites: parseInt(stats.claimed_bites || 0),
          gameActive: !!stats.is_active,
          gameStartedAt: stats.game_started_at,
          gameEndsAt: stats.game_ends_at,
          secondsRemaining: stats.seconds_remaining,
          firstBiteByFid: stats.first_bite_by_fid
        }
      });
    } catch (dbError) {
      // View doesn't exist yet - return zeros
      logger.info('🚧 Zombie game stats view not found, returning default stats');
      res.json({
        success: true,
        data: {
          totalZombies: 0,
          totalHumans: 0,
          totalBites: 0,
          pendingBites: 0,
          claimedBites: 0,
          gameActive: false,
          gameStartedAt: null,
          gameEndsAt: null,
          secondsRemaining: null,
          firstBiteByFid: null
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching zombie stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch zombie stats'
    });
  }
});

// GET /api/zombie/status/:fid - Get player zombie status
router.get('/status/:fid', async (req, res) => {
  try {
    const { fid } = req.params;
    logger.info(`🔍 Fetching zombie status for FID: ${fid}`);
    
    const client = await db.getClient();
    
    try {
      const playerQuery = `
        SELECT 
          u.wallet_address,
          u.farcaster_fid,
          u.farcaster_username,
          zs.is_zombie,
          zs.became_zombie_at,
          zs.total_bites_sent,
          u.created_at,
          (SELECT COUNT(*) FROM zombie_bites WHERE human_fid = $1) as bites_received
        FROM users u
        LEFT JOIN zombie_status zs ON u.id = zs.user_id
        WHERE u.farcaster_fid = $1
      `;
      
      const result = await client.query(playerQuery, [parseInt(fid)]);
      
      if (result.rows.length === 0) {
        // Player not in game yet
        res.json({
          success: true,
          data: {
            isZombie: false,
            isInGame: false,
            tipsSent: 0,
            tipsReceived: 0,
            becameZombieAt: null
          }
        });
      } else {
        const player = result.rows[0];
        res.json({
          success: true,
          data: {
            isZombie: !!player.is_zombie,
            isInGame: true,
            walletAddress: player.wallet_address,
            farcasterFid: player.farcaster_fid,
            farcasterUsername: player.farcaster_username,
            tipsSent: parseInt(player.total_bites_sent) || 0,
            tipsReceived: parseInt(player.tips_received) || 0,
            becameZombieAt: player.became_zombie_at,
            joinedAt: player.created_at
          }
        });
      }
    } catch (dbError) {
      // Table doesn't exist yet
      logger.info('🚧 Zombie players table not found, returning default status');
      res.json({
        success: true,
        data: {
          isZombie: false,
          isInGame: false,
          tipsSent: 0,
          tipsReceived: 0,
          becameZombieAt: null
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching player status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player status'
    });
  }
});

// GET /api/zombie/pending/:fid - Get pending bites for a player
router.get('/pending/:fid', async (req, res) => {
  try {
    const { fid } = req.params;
    logger.info(`🦷 Fetching pending bites for FID: ${fid}`);
    
    const client = await db.getClient();
    
    // Use the pending_bites_view we created
    const pendingQuery = `
      SELECT * FROM pending_bites_view 
      WHERE human_fid = $1
      ORDER BY sent_at DESC
    `;
    
    const result = await client.query(pendingQuery, [parseInt(fid)]);
    
    const pendingBites = result.rows.map(bite => ({
      id: bite.id.toString(),
      tipperUsername: bite.zombie_username || 'Anonymous Zombie',
      amount: parseFloat(bite.bite_amount),
      sentAt: bite.sent_at.toISOString(),
      castHash: bite.cast_hash,
      castUrl: bite.cast_url
    }));
    
    res.json({
      success: true,
      data: pendingBites
    });
  } catch (error) {
    logger.error('Error fetching pending bites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending bites'
    });
  }
});

// GET /api/zombie/leaderboard - Get top zombie biters
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    logger.info('🏆 Fetching zombie leaderboard');
    
    const client = await db.getClient();
    
    try {
      // Use the zombie_leaderboard view we created
      const leaderboardQuery = `
        SELECT 
          farcaster_username,
          farcaster_fid,
          wallet_address,
          total_bites_sent as bites_given,
          bites_sent_count,
          became_zombie_at,
          ROW_NUMBER() OVER (ORDER BY total_bites_sent DESC, became_zombie_at ASC) as rank
        FROM zombie_leaderboard
        LIMIT $1
      `;
      
      const result = await client.query(leaderboardQuery, [parseInt(limit)]);
      
      res.json({
        success: true,
        data: result.rows.map(player => ({
          rank: parseInt(player.rank),
          farcasterUsername: player.farcaster_username,
          farcasterFid: player.farcaster_fid,
          walletAddress: player.wallet_address,
          bites: parseInt(player.bites_given || player.bites_received),
          becameZombieAt: player.became_zombie_at
        }))
      });
    } catch (dbError) {
      // Table doesn't exist yet
      logger.info('🚧 Zombie players table not found, returning empty leaderboard');
      res.json({
        success: true,
        data: []
      });
    }
  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

module.exports = router;