-- PERFORMANCE OPTIMIZATION INDEXES
-- Additional indexes to improve query performance for zombie game

-- ===================================================================
-- ZOMBIE STATUS TABLE INDEXES (Already exist but adding more)
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_zombie_status_is_cured ON zombie_status(is_cured);
CREATE INDEX IF NOT EXISTS idx_zombie_status_compound ON zombie_status(is_zombie, is_cured);

-- ===================================================================
-- FARCASTER TIPS TABLE INDEXES
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_farcaster_tips_recipient_fid ON farcaster_tips(recipient_fid);
CREATE INDEX IF NOT EXISTS idx_farcaster_tips_status ON farcaster_tips(status);
CREATE INDEX IF NOT EXISTS idx_farcaster_tips_created_at ON farcaster_tips(created_at);
CREATE INDEX IF NOT EXISTS idx_farcaster_tips_compound_status ON farcaster_tips(status, recipient_fid);
CREATE INDEX IF NOT EXISTS idx_farcaster_tips_tipper_user_id ON farcaster_tips(tipper_user_id);

-- ===================================================================
-- USERS TABLE INDEXES
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_users_farcaster_fid ON users(farcaster_fid);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_farcaster_username ON users(farcaster_username);

-- ===================================================================
-- STAKING POSITIONS INDEXES
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_staking_positions_user_id ON staking_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_staking_positions_staked_amount ON staking_positions(staked_amount);
CREATE INDEX IF NOT EXISTS idx_staking_positions_last_allowance_reset ON staking_positions(last_allowance_reset);

-- ===================================================================
-- SYSTEM SETTINGS INDEXES
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- ===================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ===================================================================
ANALYZE zombie_status;
ANALYZE farcaster_tips;
ANALYZE users;
ANALYZE staking_positions;
ANALYZE zombie_bites;