-- ZOMBIE CURE & SUCCUMB MECHANISM - Migration 004
-- Adds cure and succumb functionality to existing zombie game

-- ===================================================================
-- ADD CURE STATUS TO EXISTING ZOMBIE_STATUS TABLE
-- ===================================================================
ALTER TABLE zombie_status 
ADD COLUMN IF NOT EXISTS is_cured BOOLEAN DEFAULT false;

-- ===================================================================
-- ZOMBIE CURES TABLE - Tracks cure transactions
-- ===================================================================
CREATE TABLE IF NOT EXISTS zombie_cures (
  id SERIAL PRIMARY KEY,
  cured_user_fid INTEGER NOT NULL, -- Farcaster ID of cured user
  cured_by_fid INTEGER NOT NULL, -- Farcaster ID of user who paid for cure
  game_id INTEGER, -- Which game this cure applies to (if games table exists)
  cost_amount DECIMAL(18,8) NOT NULL DEFAULT 10000, -- Always 10000 $ZOMBIE
  payment_tx_hash VARCHAR(100) UNIQUE NOT NULL, -- Base network transaction hash
  cured_at TIMESTAMP DEFAULT NOW(),
  cast_hash VARCHAR(100) NOT NULL, -- Farcaster cast that triggered cure
  is_active BOOLEAN DEFAULT true, -- False when zombie is bitten again
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for checking if user is currently cured
CREATE INDEX IF NOT EXISTS idx_zombie_cures_active ON zombie_cures(cured_user_fid, is_active);
-- Index for payment verification
CREATE INDEX IF NOT EXISTS idx_zombie_cures_tx ON zombie_cures(payment_tx_hash);

-- ===================================================================
-- ZOMBIE ALLOWANCE CLAIMS TABLE - Tracks succumb transactions
-- ===================================================================
CREATE TABLE IF NOT EXISTS zombie_allowance_claims (
  id SERIAL PRIMARY KEY,
  user_fid INTEGER NOT NULL, -- Farcaster ID of user who claimed
  game_id INTEGER, -- Which game this claim applies to (if games table exists)
  tx_hash VARCHAR(100) UNIQUE NOT NULL, -- Smart contract transaction hash
  amount_claimed DECIMAL(18,8) NOT NULL DEFAULT 1000, -- Amount of $ZOMBIE claimed
  claimed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for checking if user has claimed for current game
CREATE INDEX IF NOT EXISTS idx_zombie_allowance_claims_user ON zombie_allowance_claims(user_fid);
-- Index for transaction verification
CREATE INDEX IF NOT EXISTS idx_zombie_allowance_claims_tx ON zombie_allowance_claims(tx_hash);

-- ===================================================================
-- ADD MISSING COLUMNS TO ZOMBIE_BITES IF NEEDED
-- ===================================================================
ALTER TABLE zombie_bites 
ADD COLUMN IF NOT EXISTS human_wallet_address VARCHAR(42);

-- ===================================================================
-- ZOMBIE GAME STATE TABLE - Tracks overall game status
-- ===================================================================
CREATE TABLE IF NOT EXISTS zombie_game_state (
  id SERIAL PRIMARY KEY,
  is_active BOOLEAN DEFAULT false,
  game_started_at TIMESTAMP NULL,
  game_ends_at TIMESTAMP NULL,
  patient_zero_fid INTEGER, -- FID of patient zero
  final_cast_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default game state if doesn't exist
INSERT INTO zombie_game_state (id, is_active) 
SELECT 1, false
WHERE NOT EXISTS (SELECT 1 FROM zombie_game_state WHERE id = 1);

-- ===================================================================
-- HELPER FUNCTIONS
-- ===================================================================

-- Function to check if zombie game is active
CREATE OR REPLACE FUNCTION is_zombie_game_active()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    game_active BOOLEAN;
    game_end_time TIMESTAMP;
BEGIN
    SELECT is_active, game_ends_at 
    INTO game_active, game_end_time
    FROM zombie_game_state 
    WHERE id = 1;
    
    -- If no game state record, game is not active
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- If game is marked inactive, it's not active
    IF NOT game_active THEN
        RETURN false;
    END IF;
    
    -- If game has an end time and it's passed, deactivate and return false
    IF game_end_time IS NOT NULL AND game_end_time <= NOW() THEN
        UPDATE zombie_game_state 
        SET is_active = false, updated_at = NOW() 
        WHERE id = 1;
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

-- Function to start zombie game
CREATE OR REPLACE FUNCTION start_zombie_game(patient_zero_fid INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    game_duration INTERVAL := '12 hours';
BEGIN
    -- Start the game
    UPDATE zombie_game_state 
    SET 
        is_active = true,
        game_started_at = NOW(),
        game_ends_at = NOW() + game_duration,
        patient_zero_fid = start_zombie_game.patient_zero_fid,
        updated_at = NOW()
    WHERE id = 1;
    
    RETURN true;
END;
$$;

-- ===================================================================
-- UPDATED VIEWS WITH CURE STATUS
-- ===================================================================

-- Updated zombie leaderboard view to include cure status
CREATE OR REPLACE VIEW zombie_leaderboard AS
SELECT 
    u.farcaster_fid,
    u.farcaster_username,
    u.wallet_address,
    zs.became_zombie_at,
    zs.total_bites_sent,
    zs.is_cured,
    COUNT(zb.id) as bites_sent_count
FROM users u
JOIN zombie_status zs ON u.id = zs.user_id
LEFT JOIN zombie_bites zb ON u.id = zb.zombie_user_id
WHERE zs.is_zombie = true
GROUP BY u.id, u.farcaster_fid, u.farcaster_username, u.wallet_address, zs.became_zombie_at, zs.total_bites_sent, zs.is_cured
ORDER BY zs.total_bites_sent DESC, zs.became_zombie_at ASC;

-- Updated game stats view to include cure data
CREATE OR REPLACE VIEW zombie_game_stats AS
SELECT
  (SELECT COUNT(*) FROM zombie_status WHERE is_zombie = true) AS total_zombies,
  (SELECT COUNT(*) FROM zombie_status WHERE is_zombie = false) AS total_humans,
  (SELECT COUNT(*) FROM zombie_status WHERE is_zombie = true AND is_cured = true) AS cured_zombies,
  (SELECT COUNT(*) FROM zombie_bites) AS total_bites,
  (SELECT COUNT(*) FROM zombie_bites WHERE status = 'PENDING') AS pending_bites,
  (SELECT COUNT(*) FROM zombie_bites WHERE status = 'CLAIMED') AS claimed_bites,
  (SELECT COUNT(*) FROM zombie_cures WHERE is_active = true) AS active_cures,
  (SELECT COUNT(*) FROM zombie_allowance_claims) AS total_succumbs;

-- Enhanced game stats view with timer (what the code expects)
CREATE OR REPLACE VIEW zombie_game_stats_with_timer AS
SELECT
  (SELECT COUNT(*) FROM zombie_status WHERE is_zombie = true) AS total_zombies,
  (SELECT COUNT(*) FROM zombie_status WHERE is_zombie = false) AS total_humans,
  (SELECT COUNT(*) FROM zombie_status WHERE is_zombie = true AND is_cured = true) AS cured_zombies,
  (SELECT COUNT(*) FROM zombie_bites) AS total_bites,
  (SELECT COUNT(*) FROM zombie_bites WHERE status = 'PENDING') AS pending_bites,
  (SELECT COUNT(*) FROM zombie_bites WHERE status = 'CLAIMED') AS claimed_bites,
  (SELECT COUNT(*) FROM zombie_cures WHERE is_active = true) AS active_cures,
  (SELECT COUNT(*) FROM zombie_allowance_claims) AS total_succumbs,
  zgs.is_active,
  zgs.game_started_at,
  zgs.game_ends_at,
  CASE 
    WHEN zgs.game_ends_at IS NULL THEN NULL
    WHEN zgs.game_ends_at <= NOW() THEN 0
    ELSE EXTRACT(EPOCH FROM (zgs.game_ends_at - NOW()))::INTEGER
  END AS seconds_remaining,
  zgs.patient_zero_fid AS first_bite_by_fid
FROM zombie_game_state zgs
WHERE zgs.id = 1;

-- ===================================================================
-- AUTO-UPDATE TRIGGER FOR GAME STATE
-- ===================================================================
CREATE TRIGGER IF NOT EXISTS trg_zombie_game_state_updated_at
BEFORE UPDATE ON zombie_game_state
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Verify new tables were created
-- SELECT 'zombie_cures' as table_name, COUNT(*) as row_count FROM zombie_cures
-- UNION ALL
-- SELECT 'zombie_allowance_claims' as table_name, COUNT(*) as row_count FROM zombie_allowance_claims
-- UNION ALL
-- SELECT 'zombie_game_state' as table_name, COUNT(*) as row_count FROM zombie_game_state;

-- Check updated zombie_status structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'zombie_status' 
-- ORDER BY ordinal_position;

-- Test game functions
-- SELECT is_zombie_game_active() as game_is_active;
-- SELECT * FROM zombie_game_stats;