const fs = require('fs');
const path = require('path');
const db = require('./src/services/database');

async function applyMigration() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Test connection first
    const connected = await db.testConnection();
    if (!connected) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }
    
    // Read and apply migration
    const migrationPath = path.join(__dirname, 'migrations/004-zombie-cure-and-succumb.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }
    
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Read migration file, applying changes...');
    
    const client = await db.getClient();
    try {
      await client.query(migrationSql);
      console.log('✅ Migration applied successfully!');
    } finally {
      client.release();
    }
    
    // Verify the migration worked
    console.log('🔍 Verifying migration...');
    const verifyResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('zombie_cures', 'zombie_allowance_claims', 'zombie_game_state')
      ORDER BY table_name
    `);
    
    console.log('📊 Tables created:', verifyResult.rows.map(r => r.table_name));
    
    // Check if is_cured column was added
    const columnResult = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'zombie_status' 
      AND column_name = 'is_cured'
    `);
    
    if (columnResult.rows.length > 0) {
      console.log('✅ is_cured column added to zombie_status table');
    } else {
      console.log('⚠️  is_cured column not found in zombie_status table');
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.closePool();
  }
}

applyMigration();