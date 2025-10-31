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
    
    // Start monitoring mentions
    this.monitorMentions();
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
      const response = await axios.get(`https://api.neynar.com/v2/farcaster/mentions`, {
        headers: {
          'accept': 'application/json',
          'api_key': this.neynarApiKey
        },
        params: {
          fid: this.botFid,
          limit: 50
        }
      });

      const mentions = response.data?.notifications || [];
      
      for (const mention of mentions) {
        if (mention.type === 'mention' && mention.cast) {
          await this.processMention(mention.cast);
        }
      }
    } catch (error) {
      logger.error('Error checking for mentions:', error.message);
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

      // Parse the cast for bite targets
      const targets = this.extractBiteTargets(cast.text);
      
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

  extractBiteTargets(text) {
    // Look for @username mentions (excluding @zombie-bite itself)
    const mentionRegex = /@(\w+)/g;
    const targets = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1];
      if (username !== this.botUsername && username !== 'zombie-bite') {
        targets.push(username);
      }
    }

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

      // Get target user by username
      const userResponse = await axios.get(`https://api.neynar.com/v2/farcaster/user/by_username?username=${targetUsername}`, {
        headers: {
          'accept': 'application/json',
          'api_key': this.neynarApiKey
        }
      });

      const targetUser = userResponse.data?.result?.user;
      if (!targetUser) {
        logger.warn(`Target user @${targetUsername} not found`);
        await client.query('ROLLBACK');
        return;
      }

      // Prevent self-biting
      if (targetUser.fid === zombieUser.farcaster_fid) {
        await client.query('ROLLBACK');
        return;
      }

      // Create bite record
      await client.query(`
        INSERT INTO zombie_bites 
        (zombie_user_id, human_fid, human_username, bite_amount, cast_hash, cast_url, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        zombieUser.id,
        targetUser.fid,
        targetUser.username,
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

  async replyToCast(parentHash, message) {
    try {
      // This would require Neynar's signer API to post casts
      // For now, just log what we would reply
      logger.info(`🤖 Would reply to ${parentHash}: ${message}`);
      
      // TODO: Implement actual cast posting when you have signer setup
      // const response = await axios.post('https://api.neynar.com/v2/farcaster/cast', {
      //   text: message,
      //   parent: parentHash,
      //   signer_uuid: this.neynarUuid
      // }, {
      //   headers: {
      //     'accept': 'application/json',
      //     'api_key': this.neynarApiKey,
      //     'content-type': 'application/json'
      //   }
      // });
    } catch (error) {
      logger.error('Error replying to cast:', error);
    }
  }
}

module.exports = ZombieBiteBot;