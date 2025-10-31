const axios = require('axios');
const db = require('./database');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

class ZombieBiteBot {
  constructor() {
    this.neynarApiKey = process.env.NEYNAR_API_KEY;
    this.neynarUuid = process.env.NEYNAR_UUID;
    this.botUsername = process.env.FARCASTER_BOT_USERNAME || 'zombie-bite';
    this.botFid = process.env.FARCASTER_BOT_FID;
    this.isRunning = false;
    this.lastCheckedTimestamp = Date.now();
    this.processedCasts = new Set(); // Prevent duplicate processing
  }

  async start() {
    if (this.isRunning) {
      logger.warn('🧟‍♂️ Zombie bite bot already running');
      return;
    }

    if (!this.neynarApiKey || !this.botFid) {
      logger.error('❌ Missing required environment variables for zombie bite bot');
      return;
    }

    this.isRunning = true;
    logger.info('🧟‍♂️ Starting zombie bite bot monitoring...');
    
    // Start monitoring mentions and game state
    this.monitorMentions();
    this.monitorGameEnd();
  }

  async stop() {
    this.isRunning = false;
    logger.info('🛑 Zombie bite bot stopped');
  }

  async monitorMentions() {
    while (this.isRunning) {
      try {
        await this.checkForMentions();
        
        // Check every 30 seconds (reduced from 10s for better performance)
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        logger.error('Error in zombie bite bot monitoring:', error);
        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute on error
      }
    }
  }

  async checkForMentions() {
    try {
      // Get mentions of the zombie-bite bot
      const response = await axios.get(`https://api.neynar.com/v2/farcaster/notifications`, {
        headers: {
          'accept': 'application/json',
          'api_key': this.neynarApiKey
        },
        params: {
          fid: this.botFid,
          type: 'mentions',
          limit: 25
        }
      });

      const mentions = response.data?.notifications || [];
      
      for (const mention of mentions) {
        if (mention.type === 'mention' && mention.cast) {
          await this.processMention(mention.cast);
        }
      }
    } catch (error) {
      logger.error('Error checking for mentions:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
    }
  }

  async processMention(cast) {
    // Skip if already processed
    if (this.processedCasts.has(cast.hash)) {
      return;
    }

    // Skip old casts (older than 10 minutes)
    const castTime = new Date(cast.timestamp);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (castTime < tenMinutesAgo) {
      return;
    }

    this.processedCasts.add(cast.hash);

    try {
      logger.info('🧟‍♂️ Processing zombie bite mention:', {
        hash: cast.hash,
        author: cast.author?.username,
        text: cast.text
      });

      // Parse the cast for commands or bite targets
      const parsed = this.extractBiteTargets(cast.text, cast);
      
      if (!parsed || (parsed.type === 'bite' && parsed.targets.length === 0)) {
        logger.info('No valid commands or bite targets found in cast');
        return;
      }

      // Get the user (cast author) info
      const user = await this.getOrCreateUser(cast.author.fid, cast.author.username);
      if (!user) {
        logger.error('Failed to get user info');
        return;
      }

      // Route to appropriate handler based on command type
      if (parsed.type === 'cure') {
        await this.processCure(user.farcaster_fid, parsed.username, parsed.txHash, cast);
      } else if (parsed.type === 'succumb') {
        await this.processSuccumb(user.farcaster_fid, cast);
      } else if (parsed.type === 'bite') {
        // Check if the user is actually a zombie for bite commands
        const isZombie = await this.checkZombieStatus(user.id);
        if (!isZombie) {
          // Auto-reply: Only zombies can bite
          await this.replyToCast(cast.hash, '🚫 Only zombies can bite humans! Get bitten first to join the undead horde.');
          return;
        }

        // Process each bite target
        for (const target of parsed.targets) {
          await this.processBite(user, target, cast);
        }
      }

    } catch (error) {
      logger.error('Error processing mention:', error);
    }
  }

  extractBiteTargets(text, cast) {
    // Check for cure command first: @zombie-bite cure @username <tx_hash>
    const cureMatch = text.match(/@zombie-bite\s+cure\s+@([\w-]+)\s+([0-9a-fA-Fx]+)/);
    if (cureMatch) {
      return { type: 'cure', username: cureMatch[1], txHash: cureMatch[2] };
    }

    // Check for succumb command: @zombie-bite succumb OR @zombie-bite claim
    const succumbMatch = text.match(/@zombie-bite\s+(succumb|claim)/);
    if (succumbMatch) {
      return { type: 'succumb' };
    }

    // Look for @username mentions (excluding @zombie-bite itself) for bites
    // Regex supports: letters, numbers, hyphens, underscores (valid Farcaster username chars)
    const mentionRegex = /@([\w-]+)/g;
    const targets = [];
    let match;

    // Extract mentioned usernames
    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1];
      if (username !== this.botUsername && username !== 'zombie-bite') {
        targets.push(username);
      }
    }

    // If this is a reply, also bite the person being replied to
    if (cast.parent_author && cast.parent_author.username) {
      const replyTarget = cast.parent_author.username;
      if (replyTarget !== this.botUsername && 
          replyTarget !== 'zombie-bite' && 
          !targets.includes(replyTarget)) {
        targets.push(replyTarget);
        logger.info(`🔄 Added reply target: @${replyTarget}`);
      }
    }

    logger.info(`🔍 Extracted bite targets from "${text}": [${targets.join(', ')}]`);
    return { type: 'bite', targets };
  }

  async getOrCreateUser(fid, username) {
    const client = await db.getClient();
    
    try {
      // Try to get existing user
      let result = await client.query(
        'SELECT * FROM users WHERE farcaster_fid = $1',
        [fid]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Get user's wallet address from Farcaster
      const userResponse = await axios.get(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
        headers: {
          'accept': 'application/json',
          'api_key': this.neynarApiKey
        }
      });

      const user = userResponse.data?.users?.[0];
      let walletAddress = null;
      
      if (user?.verified_addresses?.eth_addresses?.length > 0) {
        walletAddress = user.verified_addresses.eth_addresses[0];
      }

      // Create user (even without wallet - they can connect later)
      result = await client.query(
        'INSERT INTO users (farcaster_fid, farcaster_username, wallet_address) VALUES ($1, $2, $3) RETURNING *',
        [fid, username, walletAddress?.toLowerCase() || null]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async checkZombieStatus(userId) {
    const client = await db.getClient();
    
    try {
      const result = await client.query(
        'SELECT is_zombie FROM zombie_status WHERE user_id = $1',
        [userId]
      );

      return result.rows.length > 0 && result.rows[0].is_zombie;
    } finally {
      client.release();
    }
  }

  // Command format: @zombie-bite cure @username <tx_hash>
  async processCure(curerFid, targetUsername, txHash, cast) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // 1. Extract target FID from username
      let userResponse;
      try {
        userResponse = await axios.get(`https://api.neynar.com/v2/farcaster/user/by_username?username=${targetUsername}`, {
          headers: {
            'accept': 'application/json',
            'api_key': this.neynarApiKey
          }
        });
      } catch (userLookupError) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ User not found');
      }

      const targetUser = userResponse.data?.user;
      if (!targetUser) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ User not found');
      }

      const targetFid = targetUser.fid;

      // 2. Verify payment transaction on Base network (placeholder - implement with actual Base RPC)
      const paymentValid = await this.verifyZombiePayment(txHash, 10000);
      if (!paymentValid) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ Invalid payment transaction');
      }

      // 3. Check target is currently a zombie (not human or already cured)
      const targetStatus = await this.getZombieStatusByFid(targetFid);
      if (!targetStatus || !targetStatus.is_zombie) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ Target is not a zombie');
      }
      if (targetStatus.is_cured) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ Target is already cured');
      }

      // 4. Record cure in database
      await client.query(`
        INSERT INTO zombie_cures (cured_user_fid, cured_by_fid, payment_tx_hash, cast_hash)
        VALUES ($1, $2, $3, $4)
      `, [targetFid, curerFid, txHash, cast.hash]);

      // 5. Update zombie_status table
      await client.query(`
        UPDATE zombie_status 
        SET is_cured = true, updated_at = NOW()
        WHERE user_id = (SELECT id FROM users WHERE farcaster_fid = $1)
      `, [targetFid]);

      await client.query('COMMIT');

      // 6. Post confirmation cast
      await this.replyToCast(cast.hash, 
        `💊 @${targetUsername} has been cured! They cannot bite until infected again.`
      );

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Cure processing error:', error);
      await this.replyToCast(cast.hash, '❌ Cure failed - please try again');
    } finally {
      client.release();
    }
  }

  // Command format: @zombie-bite succumb
  async processSuccumb(userFid, cast) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // 1. Check user is currently human
      const userStatus = await this.getZombieStatusByFid(userFid);
      if (userStatus && userStatus.is_zombie) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ You are already a zombie!');
      }
      if (userStatus && userStatus.is_cured) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ You are cured and cannot succumb!');
      }

      // 2. Check if user has already claimed allowance for this game
      const hasClaimed = await this.checkZombieAllowanceClaimed(userFid);
      if (hasClaimed) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ You have already claimed your $ZOMBIE allowance!');
      }

      // 3. Initiate smart contract claim (placeholder - implement with actual contract call)
      const claimResult = await this.claimZombieAllowance(userFid);
      if (!claimResult.success) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ Failed to claim $ZOMBIE allowance. Try again.');
      }

      // 4. Get or create user record
      const user = await this.getOrCreateUser(userFid, cast.author.username);
      if (!user) {
        await client.query('ROLLBACK');
        return await this.replyToCast(cast.hash, '❌ Failed to process user data');
      }

      // 5. Update zombie status
      await client.query(`
        INSERT INTO zombie_status (user_id, is_zombie, is_cured, became_zombie_at, total_bites_sent)
        VALUES ($1, true, false, NOW(), 0)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          is_zombie = true, 
          is_cured = false,
          became_zombie_at = NOW(),
          updated_at = NOW()
      `, [user.id]);

      // 6. Record allowance claim
      await client.query(`
        INSERT INTO zombie_allowance_claims (user_fid, tx_hash, amount_claimed)
        VALUES ($1, $2, $3)
      `, [userFid, claimResult.txHash, claimResult.amount]);

      await client.query('COMMIT');

      // 7. Post confirmation
      await this.replyToCast(cast.hash, 
        `🧟‍♂️ You have succumbed to the virus and claimed ${claimResult.amount} $ZOMBIE! Welcome to the horde! 🧟‍♀️`
      );

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Succumb processing error:', error);
      await this.replyToCast(cast.hash, '❌ Succumb failed - please try again');
    } finally {
      client.release();
    }
  }

  async processBite(zombieUser, targetUsername, cast) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Check if zombie is currently cured
      const zombieStatus = await this.getZombieStatusByFid(zombieUser.farcaster_fid);
      if (zombieStatus && zombieStatus.is_cured) {
        await client.query('COMMIT');
        await this.replyToCast(cast.hash, 
          '💊 You are currently cured and cannot bite! Get infected again to resume biting.'
        );
        return;
      }

      // Check if game is active
      const gameActiveResult = await client.query('SELECT is_zombie_game_active() as is_active');
      const isGameActive = gameActiveResult.rows[0].is_active;
      
      logger.info(`🎮 Game status check: isGameActive=${isGameActive}, raw result:`, gameActiveResult.rows[0]);

      // If game hasn't started and this is Dylan (Patient Zero), start the game
      if (!isGameActive && zombieUser.farcaster_fid === 8573) {
        const gameStartResult = await client.query('SELECT start_zombie_game($1)', [zombieUser.farcaster_fid]);
        logger.info('🚨 GAME STARTED! Patient Zero Dylan has sent the first bite - 12 hour timer begins!');
        logger.info('🎮 Game start result:', gameStartResult.rows[0]);
        
        // Post game start announcement (separate from transaction)
        await this.replyToCast(cast.hash, `🚨 THE ZOMBIE APOCALYPSE HAS BEGUN! 🚨

12-hour infection period started! Tag @zombie-bite @username to spread the virus!

Game ends at ${new Date(Date.now() + 12 * 60 * 60 * 1000).toLocaleTimeString()} CST

🎃 Play ZOMBIEFICATION: https://farcaster.xyz/miniapps/pK1eGntYKwcA/zombification`);
      } else if (!isGameActive) {
        // Game not active and not started by Patient Zero
        await client.query('COMMIT'); // Don't rollback, just exit
        await this.replyToCast(cast.hash, '⏰ The zombie apocalypse hasn\'t started yet! Only Patient Zero can begin the infection...');
        return;
      }

      // Get target user by username with error handling
      let userResponse;
      try {
        logger.info(`🔍 Looking up user: @${targetUsername}`);
        userResponse = await axios.get(`https://api.neynar.com/v2/farcaster/user/by_username?username=${targetUsername}`, {
          headers: {
            'accept': 'application/json',
            'api_key': this.neynarApiKey
          },
          timeout: 10000
        });
        logger.info(`✅ User lookup successful for @${targetUsername}`);
      } catch (userLookupError) {
        logger.error(`❌ Failed to lookup user @${targetUsername}:`, {
          status: userLookupError.response?.status,
          statusText: userLookupError.response?.statusText,
          message: userLookupError.message,
          data: userLookupError.response?.data,
          code: userLookupError.code
        });
        await client.query('COMMIT'); // Don't rollback game state
        try {
          await this.replyToCast(cast.hash, `❌ @${targetUsername} not found on Farcaster. Make sure the username is correct!`);
        } catch (replyError) {
          logger.error('Failed to reply to cast after user lookup error:', replyError);
        }
        return;
      }

      const targetUser = userResponse.data?.user;
      if (!targetUser) {
        logger.warn(`❌ Target user @${targetUsername} not found in response:`, userResponse.data);
        await client.query('COMMIT'); // Don't rollback game state
        try {
          await this.replyToCast(cast.hash, `❌ @${targetUsername} not found on Farcaster. Make sure the username is correct!`);
        } catch (replyError) {
          logger.error('Failed to reply to cast after user not found:', replyError);
        }
        return;
      }

      // Prevent self-biting
      if (targetUser.fid === zombieUser.farcaster_fid) {
        await client.query('COMMIT'); // Don't rollback game state
        try {
          await this.replyToCast(cast.hash, `🚫 You can't bite yourself! Find a human to infect instead! 🧟‍♂️`);
        } catch (replyError) {
          logger.error('Failed to reply to cast for self-bite prevention:', replyError);
        }
        return;
      }

      // Get target user's wallet address for claims processing
      const targetWalletAddress = targetUser.verified_addresses?.eth_addresses?.[0] || null;
      logger.info(`🔍 Target user @${targetUsername}: FID=${targetUser.fid}, wallet=${targetWalletAddress || 'NONE'}`);

      // Create bite record
      await client.query(`
        INSERT INTO zombie_bites 
        (zombie_user_id, human_fid, human_username, human_wallet_address, bite_amount, cast_hash, cast_url, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        zombieUser.id,
        targetUser.fid,
        targetUser.username,
        targetWalletAddress,
        1.0, // Always 1 $ZOMBIE
        cast.hash,
        `https://warpcast.com/${cast.author.username}/${cast.hash}`,
        'PENDING'
      ]);

      // Update zombie's bite count
      await client.query(`
        UPDATE zombie_status 
        SET total_bites_sent = total_bites_sent + 1, updated_at = NOW()
        WHERE user_id = $1
      `, [zombieUser.id]);

      await client.query('COMMIT');

      logger.info(`🧟‍♂️ BITE RECORDED: ${zombieUser.farcaster_username} bit @${targetUsername}`);

      // Reply to the cast with mini-app link
      try {
        await this.replyToCast(cast.hash, `🧟‍♂️ BITE SUCCESSFUL! @${targetUsername} has been bitten and can claim 1 $ZOMBIE to join the undead horde!

🎃 Play ZOMBIEFICATION: https://farcaster.xyz/miniapps/pK1eGntYKwcA/zombification`);
      } catch (replyError) {
        logger.error('Failed to reply to cast for successful bite:', replyError);
        // Don't throw - bite was recorded successfully
      }

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing bite:', error);
    } finally {
      client.release();
    }
  }

  async monitorGameEnd() {
    while (this.isRunning) {
      try {
        await this.checkGameEnd();
        
        // Check every minute for game end
        await new Promise(resolve => setTimeout(resolve, 60000));
      } catch (error) {
        logger.error('Error monitoring game end:', error);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }

  async checkGameEnd() {
    const client = await db.getClient();
    
    try {
      // Check if game just ended
      const gameStateResult = await client.query(`
        SELECT is_active, game_ends_at, final_cast_sent, total_bites_sent
        FROM zombie_game_state zgs
        LEFT JOIN (
          SELECT COUNT(*) as total_bites_sent FROM zombie_bites
        ) stats ON true
        WHERE zgs.id = 1
      `);
      
      if (gameStateResult.rows.length === 0) return;
      
      const gameState = gameStateResult.rows[0];
      
      // If game ended and we haven't sent final cast yet
      if (!gameState.is_active && gameState.game_ends_at && !gameState.final_cast_sent) {
        await this.sendGameEndCast(gameState.total_bites_sent || 0);
        
        // Mark final cast as sent
        await client.query(`
          UPDATE zombie_game_state 
          SET final_cast_sent = true, updated_at = NOW()
          WHERE id = 1
        `);
      }
    } finally {
      client.release();
    }
  }

  async sendGameEndCast(totalBites) {
    try {
      const message = `🧟‍♂️ THE ZOMBIE APOCALYPSE HAS ENDED! 🧟‍♂️

Thank you to everyone who participated in ZOMBIEFICATION - Halloween 2025!

📊 Final Stats:
🦷 Total Bites: ${totalBites}
🧟‍♂️ Zombies Created: [Check stats below]

🎁 Stay tuned for reward distribution announcements!

🎃 View Results: https://farcaster.xyz/miniapps/pK1eGntYKwcA/zombification

An ABC_DAO Halloween experiment 🎃`;

      logger.info(`🎉 POSTING GAME END CAST: ${message}`);
      
      const response = await axios.post('https://api.neynar.com/v2/farcaster/cast', {
        text: message,
        signer_uuid: this.neynarUuid
      }, {
        headers: {
          'accept': 'application/json',
          'api_key': this.neynarApiKey,
          'content-type': 'application/json'
        }
      });
      
      if (response.status >= 200 && response.status < 300) {
        logger.info('✅ Game end cast posted successfully');
      } else {
        logger.error('❌ Failed to post game end cast:', response.data);
      }
    } catch (error) {
      logger.error('Error sending game end cast:', error);
    }
  }

  async replyToCast(parentHash, message) {
    try {
      logger.info(`🤖 Replying to ${parentHash}: ${message}`);
      
      const response = await axios.post('https://api.neynar.com/v2/farcaster/cast', {
        text: message,
        parent: parentHash,
        signer_uuid: this.neynarUuid
      }, {
        headers: {
          'accept': 'application/json',
          'api_key': this.neynarApiKey,
          'content-type': 'application/json'
        }
      });
      
      if (response.status >= 200 && response.status < 300) {
        logger.info('✅ Cast posted successfully to Farcaster');
        return response.data;
      } else {
        logger.error('❌ Failed to post cast:', response.data);
        throw new Error(`Farcaster API error: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      logger.error('Error replying to cast:', error);
    }
  }

  async sendPublicCast(message) {
    try {
      logger.info(`📢 Posting public cast: ${message}`);
      
      const response = await axios.post('https://api.neynar.com/v2/farcaster/cast', {
        text: message,
        signer_uuid: this.neynarUuid
      }, {
        headers: {
          'accept': 'application/json',
          'api_key': this.neynarApiKey,
          'content-type': 'application/json'
        }
      });
      
      if (response.status >= 200 && response.status < 300) {
        logger.info('✅ Public cast posted successfully to Farcaster');
        return response.data;
      } else {
        logger.error('❌ Failed to post public cast:', response.data);
        throw new Error(`Farcaster API error: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      logger.error('Error posting public cast:', error);
    }
  }

  // Helper functions for cure and succumb functionality
  async getZombieStatusByFid(fid) {
    const client = await db.getClient();
    
    try {
      const result = await client.query(`
        SELECT zs.is_zombie, zs.is_cured, zs.became_zombie_at, zs.total_bites_sent
        FROM zombie_status zs
        JOIN users u ON zs.user_id = u.id
        WHERE u.farcaster_fid = $1
      `, [fid]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      client.release();
    }
  }

  async verifyZombiePayment(txHash, expectedAmount) {
    // TODO: Implement actual Base network transaction verification
    // For now, return true if txHash looks valid (starts with 0x and is 66 chars)
    if (txHash.startsWith('0x') && txHash.length === 66) {
      logger.info(`💊 Payment verification placeholder - txHash: ${txHash}, amount: ${expectedAmount}`);
      return true;
    }
    return false;
  }

  async checkZombieAllowanceClaimed(userFid) {
    const client = await db.getClient();
    
    try {
      const result = await client.query(`
        SELECT id FROM zombie_allowance_claims 
        WHERE user_fid = $1
      `, [userFid]);
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async claimZombieAllowance(userFid) {
    // TODO: Implement actual smart contract interaction
    // For now, return mock success response
    logger.info(`🧟‍♂️ Claiming zombie allowance for FID: ${userFid}`);
    return {
      success: true,
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`, // Mock tx hash
      amount: 1000
    };
  }

  async deactivateCures(userFid) {
    const client = await db.getClient();
    
    try {
      return await client.query(`
        UPDATE zombie_cures 
        SET is_active = false 
        WHERE cured_user_fid = $1 AND is_active = true
      `, [userFid]);
    } finally {
      client.release();
    }
  }
}

module.exports = ZombieBiteBot;