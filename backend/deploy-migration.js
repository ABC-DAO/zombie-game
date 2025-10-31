const fs = require('fs');
const path = require('path');
const db = require('./src/services/database');

async function deployMigration() {
  try {
    console.log('🚀 Deploying cure & succumb migration to production...');
    
    // Test connection first
    const connected = await db.testConnection();
    if (!connected) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }
    
    console.log('✅ Connected to production database');
    
    // Read and apply migration
    const migrationPath = path.join(__dirname, 'migrations/004-zombie-cure-and-succumb.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }
    
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Applying cure & succumb migration...');
    
    const client = await db.getClient();
    try {
      await client.query(migrationSql);
      console.log('✅ Migration applied successfully to production!');
    } finally {
      client.release();
    }
    
    // Verify the migration worked
    console.log('🔍 Verifying production migration...');
    
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('zombie_cures', 'zombie_allowance_claims', 'zombie_game_state')
      ORDER BY table_name
    `);
    
    console.log('📊 New tables created:', tableCheck.rows.map(r => r.table_name));
    
    // Check if is_cured column was added
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'zombie_status' 
      AND column_name = 'is_cured'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ is_cured column added to zombie_status table');
    } else {
      console.log('⚠️  is_cured column not found in zombie_status table');
    }
    
    // Check game functions
    const functionCheck = await db.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN ('is_zombie_game_active', 'start_zombie_game')
    `);
    
    console.log('🔧 Game functions created:', functionCheck.rows.map(r => r.routine_name));
    
    // Test the updated zombie_game_stats view
    try {
      const statsTest = await db.query('SELECT * FROM zombie_game_stats LIMIT 1');
      console.log('📈 Updated zombie_game_stats view working:', {
        totalZombies: statsTest.rows[0]?.total_zombies || 0,
        curedZombies: statsTest.rows[0]?.cured_zombies || 0,
        totalSuccumbs: statsTest.rows[0]?.total_succumbs || 0
      });
    } catch (viewError) {
      console.warn('⚠️  zombie_game_stats view may need manual update');
    }
    
    console.log('🎉 CURE & SUCCUMB DEPLOYMENT COMPLETED SUCCESSFULLY!');
    console.log('💊 Players can now:');
    console.log('  - Pay 10,000 $ZOMBIE to cure zombies');
    console.log('  - Succumb for 1,000 $ZOMBIE tokens');
    console.log('  - Use @zombie-bite cure @username <tx_hash>');
    console.log('  - Use @zombie-bite succumb');
    
  } catch (error) {
    console.error('❌ Production migration failed:', error);
    process.exit(1);
  } finally {
    await db.closePool();
  }
}

deployMigration();