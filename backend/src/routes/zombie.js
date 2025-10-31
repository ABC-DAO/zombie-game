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

// GET /api/zombie/stats - Get overall game statistics
router.get('/stats', async (req, res) => {
  try {
    logger.info('🧟‍♂️ Fetching zombie game stats');
    const client = await db.getClient();
    
    // Try to get stats from zombie_players table (may not exist yet)
    try {
      const statsQuery = `
        SELECT 
          COUNT(CASE WHEN is_zombie = true THEN 1 END) as total_zombies,
          COUNT(CASE WHEN is_zombie = false THEN 1 END) as total_humans,
          COUNT(*) as total_players,
          COALESCE(SUM(tips_sent), 0) as total_bites,
          COALESCE(SUM(tips_received), 0) as total_bites_received
        FROM zombie_players
      `;
      
      const result = await client.query(statsQuery);
      const stats = result.rows[0];
      
      res.json({
        success: true,
        data: {
          totalZombies: parseInt(stats.total_zombies),
          totalHumans: parseInt(stats.total_humans),
          totalPlayers: parseInt(stats.total_players),
          totalBites: parseInt(stats.total_bites),
          totalBitesReceived: parseInt(stats.total_bites_received)
        }
      });
    } catch (dbError) {
      // Table doesn't exist yet - return zeros
      logger.info('🚧 Zombie players table not found, returning default stats');
      res.json({
        success: true,
        data: {
          totalZombies: 0,
          totalHumans: 0,
          totalPlayers: 0,
          totalBites: 0,
          totalBitesReceived: 0
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
          wallet_address,
          farcaster_fid,
          farcaster_username,
          is_zombie,
          became_zombie_at,
          tips_sent,
          tips_received,
          created_at
        FROM zombie_players 
        WHERE farcaster_fid = $1
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
            isZombie: player.is_zombie,
            isInGame: true,
            walletAddress: player.wallet_address,
            farcasterFid: player.farcaster_fid,
            farcasterUsername: player.farcaster_username,
            tipsSent: parseInt(player.tips_sent) || 0,
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
    
    // Get unclaimed tips (bites) from farcaster_tips table
    const pendingQuery = `
      SELECT 
        ft.id,
        ft.tip_amount,
        ft.created_at,
        ft.cast_hash,
        u.farcaster_username as tipper_username,
        ft.created_at + INTERVAL '4 hours' as expires_at
      FROM farcaster_tips ft
      LEFT JOIN users u ON ft.tipper_user_id = u.id
      LEFT JOIN tip_claims tc ON ft.id = tc.tip_id
      WHERE ft.recipient_fid = $1 
        AND tc.id IS NULL 
        AND ft.created_at + INTERVAL '4 hours' > NOW()
      ORDER BY ft.created_at DESC
    `;
    
    const result = await client.query(pendingQuery, [parseInt(fid)]);
    
    const pendingBites = result.rows.map(tip => ({
      id: tip.id.toString(),
      tipperUsername: tip.tipper_username || 'Anonymous Zombie',
      amount: parseFloat(tip.tip_amount),
      expiresAt: tip.expires_at.toISOString(),
      castHash: tip.cast_hash
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
    const { limit = 50, type = 'biters' } = req.query;
    logger.info('🏆 Fetching zombie leaderboard');
    
    const client = await db.getClient();
    
    try {
      let leaderboardQuery;
      if (type === 'biters') {
        // Top biters (zombies who have bitten the most humans)
        leaderboardQuery = `
          SELECT 
            farcaster_username,
            farcaster_fid,
            wallet_address,
            tips_sent as bites_given,
            became_zombie_at,
            ROW_NUMBER() OVER (ORDER BY tips_sent DESC, became_zombie_at ASC) as rank
          FROM zombie_players 
          WHERE is_zombie = true AND tips_sent > 0
          ORDER BY tips_sent DESC, became_zombie_at ASC
          LIMIT $1
        `;
      } else {
        // Most bitten (humans who received the most bites before turning)
        leaderboardQuery = `
          SELECT 
            farcaster_username,
            farcaster_fid,
            wallet_address,
            tips_received as bites_received,
            became_zombie_at,
            ROW_NUMBER() OVER (ORDER BY tips_received DESC) as rank
          FROM zombie_players 
          WHERE tips_received > 0
          ORDER BY tips_received DESC
          LIMIT $1
        `;
      }
      
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