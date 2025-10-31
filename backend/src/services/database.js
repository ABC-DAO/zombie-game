const { Pool } = require('pg');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// Log database configuration for debugging
console.log('🔍 DATABASE: NODE_ENV =', process.env.NODE_ENV);
console.log('🔍 DATABASE: DATABASE_URL =', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
if (process.env.DATABASE_URL) {
  const urlParts = process.env.DATABASE_URL.split('/');
  console.log('🔍 DATABASE: Database name =', urlParts[urlParts.length - 1]);
}

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/steaknstake',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Increased from 10 to handle more concurrent requests
  min: 3, // Increased minimum connections
  idleTimeoutMillis: 60000, // Keep at 60 seconds
  connectionTimeoutMillis: 15000, // Reduced from 20 to 15 seconds for faster failures
  acquireTimeoutMillis: 20000, // Reduced timeout for quicker failures
  statementTimeout: 25000, // Reduced from 30 to 25 seconds
  allowExitOnIdle: true, // Allow pool to exit if all connections are idle
});

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Add connection pool monitoring
pool.on('connect', (client) => {
  logger.info('New client connected', { totalCount: pool.totalCount, idleCount: pool.idleCount });
});

pool.on('remove', (client) => {
  logger.info('Client removed', { totalCount: pool.totalCount, idleCount: pool.idleCount });
});

// Log pool stats periodically in development (reduced frequency)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    logger.info('Pool stats', { 
      totalCount: pool.totalCount, 
      idleCount: pool.idleCount, 
      waitingCount: pool.waitingCount 
    });
  }, 300000); // Every 5 minutes instead of 1 minute
}

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('✅ Database connection successful', { timestamp: result.rows[0].now });
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    return false;
  }
}

// Initialize database (create tables if they don't exist)
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    
    // Read and execute schema
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, '../../database-schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schema);
      logger.info('✅ Database schema initialized successfully');
    } else {
      logger.warn('⚠️  Database schema file not found, skipping initialization');
    }

    // Apply zombie migration if not already applied
    try {
      // Check if zombie tables exist
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'zombie_status'
      `);
      
      if (tableCheck.rows.length === 0) {
        // Apply zombie tables migration first
        const zombieTablesPath = path.join(__dirname, '../../plans/zombie-tables-fixed.sql');
        if (fs.existsSync(zombieTablesPath)) {
          const zombieTables = fs.readFileSync(zombieTablesPath, 'utf8');
          await client.query(zombieTables);
          logger.info('✅ Zombie tables created successfully');
        }
      }

      // Check if cure migration is needed
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'zombie_status' 
        AND column_name = 'is_cured'
      `);
      
      if (columnCheck.rows.length === 0) {
        // Apply just the is_cured column addition
        await client.query(`
          ALTER TABLE zombie_status 
          ADD COLUMN IF NOT EXISTS is_cured BOOLEAN DEFAULT false;
        `);
        logger.info('✅ is_cured column added to zombie_status table');
      } else {
        logger.info('✅ is_cured column already exists');
      }
    } catch (migrationError) {
      logger.error('❌ Zombie migration failed:', migrationError);
    }
    
    client.release();
    return true;
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    return false;
  }
}

// Get a client from the pool with retry logic
async function getClient(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.connect();
    } catch (error) {
      logger.error(`Error getting database client (attempt ${attempt}/${retries}):`, error.message);
      
      if (attempt === retries) {
        // On final attempt, throw the error
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Execute a query with automatic client management
async function query(text, params) {
  const client = await getClient();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Execute multiple queries in a transaction
async function transaction(queries) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    const results = [];
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown
async function closePool() {
  try {
    await pool.end();
    logger.info('🔌 Database connection pool closed');
  } catch (error) {
    logger.error('Error closing database pool:', error);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database connections...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database connections...');
  await closePool();
  process.exit(0);
});

module.exports = {
  pool,
  getClient,
  query,
  transaction,
  testConnection,
  initializeDatabase,
  closePool
};