# 🧟‍♂️ CURE & SUCCUMB Deployment Checklist

## 📋 Pre-Deployment Steps

### 1. Database Migration
```bash
# Connect to your production database and run:
DATABASE_URL="your_supabase_connection_string" node backend/deploy-migration.js
```

### 2. Verify Tables Created
Check that these tables exist in your Supabase dashboard:
- ✅ `zombie_cures` - Tracks cure transactions
- ✅ `zombie_allowance_claims` - Tracks succumb transactions  
- ✅ `zombie_game_state` - Game management
- ✅ `zombie_status` has new `is_cured` column

### 3. Railway Deployment
Push the updated code to trigger Railway deployment:
```bash
git add .
git commit -m "🧟‍♂️ Add cure & succumb functionality

- Add database migration for cure/succumb tables
- Implement @zombie-bite cure @username <tx_hash> command
- Implement @zombie-bite succumb command
- Add cure/succumb API endpoints
- Update frontend with cure status and succumb button
- Enhanced bot logic for cured zombie restrictions"

git push origin main
```

## 🧪 Testing Steps

### Phase 1: Database & API Testing
1. **Test API Endpoints**
   ```bash
   # Check if new endpoints are responding
   curl https://your-backend.railway.app/api/zombie/stats
   ```

2. **Verify Game Stats Include Cure Data**
   Should return new fields: `cured_zombies`, `total_succumbs`

### Phase 2: Bot Command Testing
1. **Test Succumb Command**
   - Post on Farcaster: `@zombie-bite succumb`
   - Should respond with transformation confirmation
   - Check API that user is now a zombie

2. **Test Cure Command** 
   - Post on Farcaster: `@zombie-bite cure @testuser 0x1234567890abcdef...`
   - Should verify payment and cure the zombie
   - Check API that user is now cured

### Phase 3: Frontend Testing
1. **Human State**
   - Should show "Succumb to Virus" button
   - Should display 1,000 $ZOMBIE reward

2. **Zombie State**
   - Should show "Zombie Powers Active" for uncured
   - Should show "You Are Cured!" for cured zombies

3. **Cure Status**
   - Cured zombies should have blue theme
   - Should show "Cannot bite until infected again"

## 📊 Expected Behavior

### Succumb Flow
1. Human clicks "Succumb Now" button
2. Makes API call to `/api/zombie/succumb`
3. User becomes zombie immediately
4. Receives 1,000 $ZOMBIE tokens (mock)
5. UI updates to zombie state

### Cure Flow
1. Someone pays 10,000 $ZOMBIE on Base network
2. Posts `@zombie-bite cure @username <tx_hash>`
3. Bot verifies payment and applies cure
4. Target zombie becomes cured (cannot bite)
5. UI shows blue "CURED ZOMBIE" status

### Game Mechanics
- Cured zombies cannot bite others
- Cured zombies can be bitten again (removes cure)
- Succumb is one-time per game per user
- All transactions are tracked in database

## 🚨 Rollback Plan
If issues occur:
1. Database rollback: Remove new tables/columns
2. Code rollback: Revert to previous git commit
3. Bot disable: Comment out cure/succumb command parsing

## ✅ Success Criteria
- [ ] Database migration applied successfully
- [ ] Railway deployment completed
- [ ] Bot responds to cure/succumb commands
- [ ] Frontend shows new UI elements
- [ ] API endpoints return correct data
- [ ] No errors in production logs