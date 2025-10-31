const axios = require('axios');

// Update this with your production backend URL
const BACKEND_URL = process.env.BACKEND_URL || 'https://your-backend.railway.app';

async function testDeployment() {
  console.log('🧪 Testing CURE & SUCCUMB deployment...');
  console.log('🔗 Backend URL:', BACKEND_URL);
  
  try {
    // Test 1: Basic health check
    console.log('\n1️⃣ Testing basic health...');
    const healthResponse = await axios.get(`${BACKEND_URL}/api/zombie/stats`);
    console.log('✅ Backend is responding');
    
    const stats = healthResponse.data.data;
    console.log('📊 Current game stats:', {
      totalZombies: stats.totalZombies,
      totalHumans: stats.totalHumans,
      curedZombies: stats.curedZombies || 'NEW FIELD',
      totalSuccumbs: stats.totalSuccumbs || 'NEW FIELD'
    });
    
    // Test 2: Check if new API endpoints exist
    console.log('\n2️⃣ Testing new API endpoints...');
    
    // Test succumb endpoint (should return 400 without userFid)
    try {
      await axios.post(`${BACKEND_URL}/api/zombie/succumb`, {});
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Succumb endpoint exists and validates input');
      } else {
        console.log('❌ Succumb endpoint error:', error.message);
      }
    }
    
    // Test cure endpoint (should return 400 without required fields)
    try {
      await axios.post(`${BACKEND_URL}/api/zombie/cure`, {});
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Cure endpoint exists and validates input');
      } else {
        console.log('❌ Cure endpoint error:', error.message);
      }
    }
    
    // Test 3: Check cure status endpoint
    console.log('\n3️⃣ Testing cure status endpoint...');
    try {
      const cureStatusResponse = await axios.get(`${BACKEND_URL}/api/zombie/cured-status/8573`);
      console.log('✅ Cure status endpoint working');
      console.log('💊 Patient Zero cure status:', cureStatusResponse.data.data);
    } catch (error) {
      console.log('❌ Cure status endpoint error:', error.message);
    }
    
    // Test 4: Check cure history endpoint
    console.log('\n4️⃣ Testing cure history endpoint...');
    try {
      const cureHistoryResponse = await axios.get(`${BACKEND_URL}/api/zombie/cures/8573`);
      console.log('✅ Cure history endpoint working');
      console.log('📋 Patient Zero cure history:', cureHistoryResponse.data.data.cures.length, 'cures');
    } catch (error) {
      console.log('❌ Cure history endpoint error:', error.message);
    }
    
    // Test 5: Check updated player status includes cure info
    console.log('\n5️⃣ Testing updated player status...');
    try {
      const statusResponse = await axios.get(`${BACKEND_URL}/api/zombie/status/8573`);
      const playerData = statusResponse.data.data;
      console.log('✅ Player status endpoint working');
      console.log('🧟‍♂️ Patient Zero status:', {
        isZombie: playerData.isZombie,
        isCured: playerData.isCured || 'NEW FIELD',
        isInGame: playerData.isInGame
      });
    } catch (error) {
      console.log('❌ Player status endpoint error:', error.message);
    }
    
    console.log('\n🎉 DEPLOYMENT TEST COMPLETE!');
    console.log('\n📝 Next Steps:');
    console.log('1. Test bot commands on Farcaster:');
    console.log('   - @zombie-bite succumb');
    console.log('   - @zombie-bite cure @username 0x1234...');
    console.log('2. Check frontend UI updates');
    console.log('3. Monitor production logs for errors');
    
  } catch (error) {
    console.log('❌ DEPLOYMENT TEST FAILED:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('🔍 Backend appears to be down or URL incorrect');
      console.log('💡 Check Railway deployment status');
    } else if (error.response?.status >= 500) {
      console.log('🔍 Backend server error - check logs');
    } else {
      console.log('🔍 Unexpected error:', error.response?.data || error.message);
    }
  }
}

// Run the test
testDeployment().catch(console.error);