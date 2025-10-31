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
        
        // Check every 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (error) {
        logger.error('Error in zombie bite bot monitoring:', error);
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait longer on error
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

      // Parse the cast for bite targets (mentions + reply target)
      const targets = this.extractBiteTargets(cast.text, cast);
      
      if (targets.length === 0) {
        logger.info('No valid bite targets found in cast');
        return;
      }

      // Get the zombie (cast author) user info
      const zombieUser = await this.getOrCreateUser(cast.author.fid, cast.author.username);
      if (!zombieUser) {
        logger.error('Failed to get zombie user info');
        return;
      }

      // Check if the zombie is actually a zombie
      const isZombie = await this.checkZombieStatus(zombieUser.id);
      if (!isZombie) {
        // Auto-reply: Only zombies can bite
        await this.replyToCast(cast.hash, '🚫 Only zombies can bite humans! Get bitten first to join the undead horde.');
        return;
      }

      // Process each bite target
      for (const target of targets) {
        await this.processBite(zombieUser, target, cast);
      }

    } catch (error) {
      logger.error('Error processing mention:', error);
    }
  }

  extractBiteTargets(text, cast) {
    // Look for @username mentions (excluding @zombie-bite itself)
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
    return targets;
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

  async processBite(zombieUser, targetUsername, cast) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

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
        await this.replyToCast(cast.hash, '🚨 THE ZOMBIE APOCALYPSE HAS BEGUN! 🚨\n\n12-hour infection period started! Tag @zombie-bite @username to spread the virus!\n\nGame ends at ' + new Date(Date.now() + 12 * 60 * 60 * 1000).toLocaleTimeString() + ' CST');
      } else if (!isGameActive) {
        // Game not active and not started by Patient Zero
        await client.query('COMMIT'); // Don't rollback, just exit
        await this.replyToCast(cast.hash, '⏰ The zombie apocalypse hasn\'t started yet! Only Patient Zero can begin the infection...');
        return;
      }

      // Get target user by username
      const userResponse = await axios.get(`https://api.neynar.com/v2/farcaster/user/by_username?username=${targetUsername}`, {
        headers: {
          'accept': 'application/json',
          'api_key': this.neynarApiKey
        }
      });

      const targetUser = userResponse.data?.user;
      if (!targetUser) {
        logger.warn(`Target user @${targetUsername} not found`);
        await client.query('COMMIT'); // Don't rollback game state
        await this.replyToCast(cast.hash, `❌ @${targetUsername} not found on Farcaster. Make sure the username is correct!`);
        return;
      }

      // Prevent self-biting
      if (targetUser.fid === zombieUser.farcaster_fid) {
        await client.query('COMMIT'); // Don't rollback game state
        await this.replyToCast(cast.hash, `🚫 You can't bite yourself! Find a human to infect instead! 🧟‍♂️`);
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

      // Reply to the cast
      await this.replyToCast(cast.hash, `🧟‍♂️ BITE SUCCESSFUL! @${targetUsername} has been bitten and can claim 1 $ZOMBIE at zombie.epicdylan.com to join the undead horde!`);

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
🧟‍♂️ Zombies Created: [Check zombie.epicdylan.com]

🎁 Stay tuned for reward distribution announcements!

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
}

module.exports = ZombieBiteBot;