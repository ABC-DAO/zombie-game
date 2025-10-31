const { ethers } = require('ethers');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// ZOMBIE token contract configuration
const ZOMBIE_TOKEN_ADDRESS = '0x7E27Ee24E30b8A89bCF3d9E1d5A8A2Ec9265B0D1'; // Replace with actual ZOMBIE token address
const ZOMBIE_DECIMALS = 18;

// ERC20 ABI for token transfers
const ERC20_ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  }
];

class TokenService {
  constructor() {
    // Initialize provider and wallet
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Bot wallet private key (stored in environment)
    const privateKey = process.env.BOT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('BOT_PRIVATE_KEY environment variable required');
    }
    
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.zombieContract = new ethers.Contract(ZOMBIE_TOKEN_ADDRESS, ERC20_ABI, this.wallet);
    
    logger.info(`🧟‍♂️ TokenService initialized with wallet: ${this.wallet.address}`);
  }

  async sendZombieTokens(recipientAddress, amount) {
    try {
      logger.info(`💰 Sending ${amount} ZOMBIE tokens to ${recipientAddress}`);
      
      // Convert amount to wei (considering 18 decimals)
      const amountInWei = ethers.parseUnits(amount.toString(), ZOMBIE_DECIMALS);
      
      // Check balance first
      const balance = await this.zombieContract.balanceOf(this.wallet.address);
      if (balance < amountInWei) {
        throw new Error(`Insufficient ZOMBIE balance. Need: ${amount}, Have: ${ethers.formatUnits(balance, ZOMBIE_DECIMALS)}`);
      }
      
      // Get gas price
      const gasPrice = await this.provider.getFeeData();
      
      // Send transaction
      const tx = await this.zombieContract.transfer(recipientAddress, amountInWei, {
        gasPrice: gasPrice.gasPrice,
        gasLimit: 100000 // Standard ERC20 transfer
      });
      
      logger.info(`📤 ZOMBIE transfer transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        logger.info(`✅ ZOMBIE transfer confirmed: ${tx.hash}`);
        return tx.hash;
      } else {
        throw new Error(`Transaction failed: ${tx.hash}`);
      }
      
    } catch (error) {
      logger.error(`❌ Error sending ZOMBIE tokens:`, error);
      throw error;
    }
  }

  async getZombieBalance(address) {
    try {
      const balance = await this.zombieContract.balanceOf(address);
      return ethers.formatUnits(balance, ZOMBIE_DECIMALS);
    } catch (error) {
      logger.error(`Error getting ZOMBIE balance for ${address}:`, error);
      throw error;
    }
  }

  async getBotWalletBalance() {
    try {
      const zombieBalance = await this.getZombieBalance(this.wallet.address);
      const ethBalance = await this.provider.getBalance(this.wallet.address);
      
      return {
        zombieBalance: parseFloat(zombieBalance),
        ethBalance: parseFloat(ethers.formatEther(ethBalance)),
        walletAddress: this.wallet.address
      };
    } catch (error) {
      logger.error('Error getting bot wallet balance:', error);
      throw error;
    }
  }
}

// Export singleton instance and functions
const tokenService = new TokenService();

module.exports = {
  sendZombieTokens: (recipient, amount) => tokenService.sendZombieTokens(recipient, amount),
  getZombieBalance: (address) => tokenService.getZombieBalance(address),
  getBotWalletBalance: () => tokenService.getBotWalletBalance(),
  tokenService
};