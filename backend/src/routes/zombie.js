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

// Simple in-memory cache for game stats (5 minute TTL)
const cache = {
  gameStats: { data: null, expiry: 0 },
  gameStatus: { data: null, expiry: 0 }
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getFromCache(key) {
  const cached = cache[key];
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  return null;
}

function setCache(key, data) {
  cache[key] = {
    data: data,
    expiry: Date.now() + CACHE_TTL
  };
}

// GET /api/zombie/game-status - Get current game status
router.get('/game-status', async (req, res) => {
  try {
    // Check cache first
    const cachedStatus = getFromCache('gameStatus');
    if (cachedStatus) {
      logger.info('🎃 Returning cached zombie game status');
      return res.json({
        success: true,
        data: cachedStatus
      });
    }

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

    // Cache the result
    setCache('gameStatus', gameStatus);

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
    // Check cache first
    const cachedStats = getFromCache('gameStats');
    if (cachedStats) {
      logger.info('🧟‍♂️ Returning cached zombie game stats');
      return res.json({
        success: true,
        data: cachedStats
      });
    }

    logger.info('🧟‍♂️ Fetching zombie game stats');
    const client = await db.getClient();
    
    // Use the enhanced zombie_game_stats_with_timer view
    let statsData;
    try {
      const result = await client.query('SELECT * FROM zombie_game_stats_with_timer');
      const stats = result.rows[0];
      
      statsData = {
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
      };
    } catch (dbError) {
      // View doesn't exist yet - return zeros
      logger.info('🚧 Zombie game stats view not found, returning default stats');
      statsData = {
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
      };
    } finally {
      client.release();
    }

    // Cache the result
    setCache('gameStats', statsData);

    res.json({
      success: true,
      data: statsData
    });
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
          zs.is_cured,
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
            isCured: false,
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
            isCured: !!player.is_cured,
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
          isCured: false,
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

// POST /api/zombie/claim - Claim zombie bites and become a zombie
router.post('/claim', async (req, res) => {
  try {
    const { 
      recipientWalletAddress,
      recipientFid,
      biteIds, // Array of bite IDs to claim
      farcasterUsername
    } = req.body;
    
    if (!recipientWalletAddress || !recipientFid || !biteIds || !Array.isArray(biteIds) || biteIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipient wallet, FID, and bite IDs array required to become zombie'
      });
    }
    
    logger.info(`🧟‍♂️ Processing zombie bite claims for FID ${recipientFid}: ${biteIds.length} bites`);
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get or create user record
      let userResult = await client.query(
        'SELECT * FROM users WHERE farcaster_fid = $1',
        [recipientFid]
      );
      
      let userId;
      if (userResult.rows.length === 0) {
        // Create new user
        const newUserResult = await client.query(
          'INSERT INTO users (farcaster_fid, farcaster_username, wallet_address) VALUES ($1, $2, $3) RETURNING id',
          [recipientFid, farcasterUsername, recipientWalletAddress.toLowerCase()]
        );
        userId = newUserResult.rows[0].id;
      } else {
        userId = userResult.rows[0].id;
        // Update wallet address if not set
        if (!userResult.rows[0].wallet_address) {
          await client.query(
            'UPDATE users SET wallet_address = $1 WHERE id = $2',
            [recipientWalletAddress.toLowerCase(), userId]
          );
        }
      }
      
      // Get unclaimed bites for this user
      const bitesResult = await client.query(`
        SELECT * FROM zombie_bites 
        WHERE human_fid = $1 AND status = 'PENDING' AND id = ANY($2::int[])
      `, [recipientFid, biteIds]);
      
      if (bitesResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'No valid unclaimed bites found'
        });
      }
      
      const totalBiteAmount = bitesResult.rows.reduce((sum, bite) => sum + parseFloat(bite.bite_amount), 0);
      
      // Mark bites as claimed
      await client.query(`
        UPDATE zombie_bites 
        SET status = 'CLAIMED', claimed_at = NOW()
        WHERE id = ANY($1::int[])
      `, [biteIds]);
      
      // 🧟‍♂️ CRITICAL: Make user a zombie by claiming bites!
      await client.query(`
        INSERT INTO zombie_status (user_id, is_zombie, became_zombie_at, total_bites_sent)
        VALUES ($1, true, NOW(), 0)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          is_zombie = true, 
          became_zombie_at = COALESCE(zombie_status.became_zombie_at, NOW()),
          updated_at = NOW()
      `, [userId]);
      
      await client.query('COMMIT');
      
      logger.info(`✅ Zombie transformation complete! FID ${recipientFid} claimed ${biteIds.length} bites (${totalBiteAmount} $ZOMBIE)`);
      
      res.json({
        success: true,
        message: `🧟‍♂️ TRANSFORMATION COMPLETE! You have succumbed to ${biteIds.length} zombie bite(s) and joined the undead horde!`,
        data: {
          userId,
          bitesClaimed: biteIds.length,
          totalAmount: totalBiteAmount,
          isNowZombie: true,
          transformedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error claiming zombie bites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim zombie bites'
    });
  }
});

// POST /api/zombie/create-test-bites - Create test bites for Patient Group 0
router.post('/create-test-bites', async (req, res) => {
  try {
    const { testUsers, tipperFid, tipperUsername } = req.body;
    
    if (!testUsers || !Array.isArray(testUsers) || testUsers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'testUsers array required'
      });
    }
    
    logger.info(`🧪 Creating test bites for ${testUsers.length} Patient Group 0 users`);
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const biteInserts = [];
      for (let i = 0; i < testUsers.length; i++) {
        const user = testUsers[i];
        const result = await client.query(`
          INSERT INTO zombie_bites (
            zombie_fid, zombie_username, human_fid, human_username, 
            human_wallet_address, bite_amount, cast_hash, status, sent_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING id
        `, [
          tipperFid || 8573,
          tipperUsername || 'zombie-bite',
          user.fid,
          user.username,
          user.walletAddress.toLowerCase(),
          1,
          `test_patient_0_${user.fid}`,
          'PENDING'
        ]);
        
        biteInserts.push({
          biteId: result.rows[0].id,
          fid: user.fid,
          username: user.username
        });
      }
      
      await client.query('COMMIT');
      
      logger.info(`✅ Created ${biteInserts.length} test bites for Patient Group 0`);
      
      res.json({
        success: true,
        message: `Created ${biteInserts.length} test bites for Patient Group 0`,
        data: {
          bites: biteInserts
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error creating test bites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test bites'
    });
  }
});

// POST /api/zombie/auto-transform - Transform users into zombies directly (Patient Group 0)
router.post('/auto-transform', async (req, res) => {
  try {
    const { users } = req.body;
    
    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'users array required'
      });
    }
    
    logger.info(`🧟‍♂️ Auto-transforming ${users.length} Patient Group 0 users into zombies`);
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const transformedUsers = [];
      
      for (const user of users) {
        // Get or create user record
        let userResult = await client.query(
          'SELECT id FROM users WHERE farcaster_fid = $1',
          [user.fid]
        );
        
        let userId;
        if (userResult.rows.length === 0) {
          // Create new user
          const newUserResult = await client.query(
            'INSERT INTO users (farcaster_fid, farcaster_username, wallet_address) VALUES ($1, $2, $3) RETURNING id',
            [user.fid, user.username, user.walletAddress.toLowerCase()]
          );
          userId = newUserResult.rows[0].id;
        } else {
          userId = userResult.rows[0].id;
          // Update wallet address if needed
          await client.query(
            'UPDATE users SET wallet_address = COALESCE(wallet_address, $1), farcaster_username = COALESCE(farcaster_username, $2) WHERE id = $3',
            [user.walletAddress.toLowerCase(), user.username, userId]
          );
        }
        
        // Transform into zombie
        await client.query(`
          INSERT INTO zombie_status (user_id, is_zombie, became_zombie_at, total_bites_sent)
          VALUES ($1, true, NOW(), 0)
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            is_zombie = true, 
            became_zombie_at = COALESCE(zombie_status.became_zombie_at, NOW()),
            updated_at = NOW()
        `, [userId]);
        
        transformedUsers.push({
          fid: user.fid,
          username: user.username,
          walletAddress: user.walletAddress,
          transformedAt: new Date().toISOString()
        });
      }
      
      await client.query('COMMIT');
      
      logger.info(`✅ Auto-transformed ${transformedUsers.length} users into zombies for Patient Group 0`);
      
      res.json({
        success: true,
        message: `🧟‍♂️ Patient Group 0 transformation complete! ${transformedUsers.length} users are now zombies.`,
        data: {
          transformedUsers
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error auto-transforming users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-transform users'
    });
  }
});

// POST /api/zombie/announce-patient-group-0 - Make Patient Group 0 announcement
router.post('/announce-patient-group-0', async (req, res) => {
  try {
    logger.info('📢 Making Patient Group 0 announcement cast');
    
    // Import the zombie bot to use its casting functionality
    const ZombieBiteBot = require('../services/zombieBiteBot');
    const bot = new ZombieBiteBot();
    
    const message = `🧟‍♂️ PATIENT GROUP 0 TRANSFORMATION COMPLETE! 🧟‍♂️

Thanks to our brave testers for their sacrifice:
@naruto007.eth @gandhionchain.eth @joseacabrerav @indefatigable @kday

You are now the first zombies of the apocalypse! 10,000 $ZOMBIE tokens incoming as a thank you for helping test the infection! 🦷💰

#ZOMBIEFICATION #Halloween`;

    const result = await bot.sendPublicCast(message);
    
    if (result) {
      res.json({
        success: true,
        message: 'Patient Group 0 announcement posted successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to post announcement cast'
      });
    }
    
  } catch (error) {
    logger.error('Error making Patient Group 0 announcement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to make Patient Group 0 announcement'
    });
  }
});

// GET /api/zombie/wallet-info - Check bot wallet configuration
router.get('/wallet-info', async (req, res) => {
  try {
    logger.info('🔍 Checking bot wallet configuration');
    
    // Check environment variables
    const hasPrivateKey = !!process.env.BOT_PRIVATE_KEY;
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    
    if (!hasPrivateKey) {
      return res.json({
        success: false,
        error: 'BOT_PRIVATE_KEY not configured',
        config: {
          hasPrivateKey: false,
          rpcUrl
        }
      });
    }

    // Try to initialize token service
    try {
      const { getBotWalletBalance } = require('../services/tokenService');
      const walletInfo = await getBotWalletBalance();
      
      res.json({
        success: true,
        message: 'Bot wallet configured successfully',
        data: walletInfo,
        config: {
          hasPrivateKey: true,
          rpcUrl
        }
      });
    } catch (serviceError) {
      res.json({
        success: false,
        error: `Token service error: ${serviceError.message}`,
        config: {
          hasPrivateKey: true,
          rpcUrl
        }
      });
    }
    
  } catch (error) {
    logger.error('Error checking wallet info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check wallet configuration'
    });
  }
});

// POST /api/zombie/send-patient-rewards - Send 10k ZOMBIE to Patient Group 0
router.post('/send-patient-rewards', async (req, res) => {
  try {
    logger.info('💰 Sending Patient Group 0 rewards');
    
    const patientGroup0 = [
      { username: 'naruto007.eth', address: '0xf90d9375033d4ff284f88fc84ed97a416c6502df' },
      { username: 'gandhionchain.eth', address: '0xb6d082e8d9feee1b7eaf2f044cbb8c0943fedb00' },
      { username: 'joseacabrerav', address: '0x0ac7d72e0a6e21fb840bbd07f2b8d0763b65c2c3' },
      { username: 'indefatigable', address: '0xc2771d8de241fcc2304d4c0e4574b1f41b388527' },
      { username: 'kday', address: '0x77452a8ea2eebc0f79315150241d33c0ec0f6812' }
    ];

    // Check environment variables first
    if (!process.env.BOT_PRIVATE_KEY) {
      logger.error('❌ BOT_PRIVATE_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'BOT_PRIVATE_KEY not configured in environment'
      });
    }

    // Import token transfer service
    const { sendZombieTokens, getBotWalletBalance } = require('../services/tokenService');
    
    // Check wallet balance first
    try {
      const walletInfo = await getBotWalletBalance();
      logger.info('💰 Bot wallet info:', walletInfo);
    } catch (balanceError) {
      logger.error('❌ Error checking wallet balance:', balanceError);
      return res.status(500).json({
        success: false,
        error: `Wallet balance check failed: ${balanceError.message}`
      });
    }
    
    const results = [];
    for (const user of patientGroup0) {
      try {
        const txHash = await sendZombieTokens(user.address, '10000');
        results.push({
          username: user.username,
          address: user.address,
          amount: '10000',
          txHash,
          success: true
        });
        logger.info(`✅ Sent 10,000 ZOMBIE to ${user.username}: ${txHash}`);
      } catch (error) {
        logger.error(`❌ Failed to send ZOMBIE to ${user.username}:`, error);
        results.push({
          username: user.username,
          address: user.address,
          amount: '10000',
          error: error.message,
          success: false
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `Patient Group 0 rewards processed: ${successCount}/${patientGroup0.length} successful`,
      data: {
        totalSent: successCount,
        totalFailed: patientGroup0.length - successCount,
        results
      }
    });
    
  } catch (error) {
    logger.error('Error sending Patient Group 0 rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send Patient Group 0 rewards'
    });
  }
});

// POST /api/zombie/cure - Process cure requests
router.post('/cure', async (req, res) => {
  try {
    const { curerFid, targetFid, txHash, castHash } = req.body;
    
    if (!curerFid || !targetFid || !txHash) {
      return res.status(400).json({
        success: false,
        error: 'curerFid, targetFid, and txHash are required'
      });
    }
    
    logger.info(`💊 Processing cure request: curer=${curerFid}, target=${targetFid}, tx=${txHash}`);
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Check target is currently a zombie (not human or already cured)
      const targetQuery = `
        SELECT zs.is_zombie, zs.is_cured
        FROM zombie_status zs
        JOIN users u ON zs.user_id = u.id
        WHERE u.farcaster_fid = $1
      `;
      const targetResult = await client.query(targetQuery, [targetFid]);
      
      if (targetResult.rows.length === 0 || !targetResult.rows[0].is_zombie) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Target is not a zombie'
        });
      }
      
      if (targetResult.rows[0].is_cured) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Target is already cured'
        });
      }
      
      // Record cure in database
      await client.query(`
        INSERT INTO zombie_cures (cured_user_fid, cured_by_fid, payment_tx_hash, cast_hash)
        VALUES ($1, $2, $3, $4)
      `, [targetFid, curerFid, txHash, castHash || null]);
      
      // Update zombie_status table
      await client.query(`
        UPDATE zombie_status 
        SET is_cured = true, updated_at = NOW()
        WHERE user_id = (SELECT id FROM users WHERE farcaster_fid = $1)
      `, [targetFid]);
      
      await client.query('COMMIT');
      
      logger.info(`✅ Cure successful: target ${targetFid} cured by ${curerFid}`);
      
      res.json({
        success: true,
        message: 'Cure applied successfully',
        data: {
          curedUserFid: targetFid,
          curedByFid: curerFid,
          txHash,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error processing cure:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process cure'
    });
  }
});

// POST /api/zombie/succumb - Process succumb to virus requests
router.post('/succumb', async (req, res) => {
  try {
    const { userFid } = req.body;
    
    if (!userFid) {
      return res.status(400).json({
        success: false,
        error: 'userFid is required'
      });
    }
    
    logger.info(`🧟‍♂️ Processing succumb request for FID: ${userFid}`);
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Check user is currently human
      const userQuery = `
        SELECT zs.is_zombie, zs.is_cured
        FROM zombie_status zs
        JOIN users u ON zs.user_id = u.id
        WHERE u.farcaster_fid = $1
      `;
      const userResult = await client.query(userQuery, [userFid]);
      
      if (userResult.rows.length > 0) {
        const userStatus = userResult.rows[0];
        if (userStatus.is_zombie) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'You are already a zombie!'
          });
        }
        if (userStatus.is_cured) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'You are cured and cannot succumb!'
          });
        }
      }
      
      // Check if user has already claimed allowance
      const claimResult = await client.query(`
        SELECT id FROM zombie_allowance_claims WHERE user_fid = $1
      `, [userFid]);
      
      if (claimResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'You have already claimed your $ZOMBIE allowance!'
        });
      }
      
      // Get or create user record
      let userRecord = await client.query(
        'SELECT id FROM users WHERE farcaster_fid = $1',
        [userFid]
      );
      
      let userId;
      if (userRecord.rows.length === 0) {
        // Create new user with minimal info
        const newUserResult = await client.query(
          'INSERT INTO users (farcaster_fid) VALUES ($1) RETURNING id',
          [userFid]
        );
        userId = newUserResult.rows[0].id;
      } else {
        userId = userRecord.rows[0].id;
      }
      
      // Mock smart contract claim (replace with actual contract call)
      const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
      const claimAmount = 1000;
      
      // Update zombie status
      await client.query(`
        INSERT INTO zombie_status (user_id, is_zombie, is_cured, became_zombie_at, total_bites_sent)
        VALUES ($1, true, false, NOW(), 0)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          is_zombie = true, 
          is_cured = false,
          became_zombie_at = NOW(),
          updated_at = NOW()
      `, [userId]);
      
      // Record allowance claim
      await client.query(`
        INSERT INTO zombie_allowance_claims (user_fid, tx_hash, amount_claimed)
        VALUES ($1, $2, $3)
      `, [userFid, mockTxHash, claimAmount]);
      
      await client.query('COMMIT');
      
      logger.info(`✅ Succumb successful: FID ${userFid} is now a zombie with ${claimAmount} $ZOMBIE`);
      
      res.json({
        success: true,
        message: 'Successfully succumbed to the virus!',
        data: {
          userFid,
          txHash: mockTxHash,
          amountClaimed: claimAmount,
          newStatus: 'zombie',
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error processing succumb:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process succumb request'
    });
  }
});

// GET /api/zombie/cures/:fid - Get user's cure history
router.get('/cures/:fid', async (req, res) => {
  try {
    const { fid } = req.params;
    logger.info(`💊 Fetching cure history for FID: ${fid}`);
    
    const client = await db.getClient();
    
    const curesQuery = `
      SELECT 
        zc.id,
        zc.cured_by_fid,
        zc.cost_amount,
        zc.cured_at,
        zc.is_active,
        u.farcaster_username as cured_by_username
      FROM zombie_cures zc
      LEFT JOIN users u ON u.farcaster_fid = zc.cured_by_fid
      WHERE zc.cured_user_fid = $1
      ORDER BY zc.cured_at DESC
    `;
    
    const result = await client.query(curesQuery, [parseInt(fid)]);
    
    res.json({
      success: true,
      data: {
        cures: result.rows.map(cure => ({
          id: cure.id,
          curedByFid: cure.cured_by_fid,
          curedByUsername: cure.cured_by_username,
          costAmount: parseFloat(cure.cost_amount),
          curedAt: cure.cured_at,
          isActive: cure.is_active
        }))
      }
    });
    
  } catch (error) {
    logger.error('Error fetching cure history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cure history'
    });
  }
});

// GET /api/zombie/cured-status/:fid - Check if user is currently cured
router.get('/cured-status/:fid', async (req, res) => {
  try {
    const { fid } = req.params;
    logger.info(`💊 Checking cure status for FID: ${fid}`);
    
    const client = await db.getClient();
    
    const statusQuery = `
      SELECT 
        zs.is_cured,
        zc.cured_at,
        zc.cured_by_fid,
        u.farcaster_username as cured_by_username
      FROM zombie_status zs
      JOIN users u ON zs.user_id = u.id
      LEFT JOIN zombie_cures zc ON zc.cured_user_fid = u.farcaster_fid AND zc.is_active = true
      LEFT JOIN users curer ON curer.farcaster_fid = zc.cured_by_fid
      WHERE u.farcaster_fid = $1
    `;
    
    const result = await client.query(statusQuery, [parseInt(fid)]);
    
    if (result.rows.length === 0) {
      res.json({
        success: true,
        data: {
          isCured: false,
          curedAt: null,
          curedBy: null
        }
      });
    } else {
      const status = result.rows[0];
      res.json({
        success: true,
        data: {
          isCured: !!status.is_cured,
          curedAt: status.cured_at,
          curedBy: status.cured_by_fid,
          curedByUsername: status.cured_by_username
        }
      });
    }
    
  } catch (error) {
    logger.error('Error checking cure status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check cure status'
    });
  }
});

module.exports = router;