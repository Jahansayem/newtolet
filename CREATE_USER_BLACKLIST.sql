-- ==========================================
-- USER BLACKLIST SYSTEM
-- ==========================================
-- Run this in Supabase SQL Editor to enable blacklist functionality

-- Create blacklist table
CREATE TABLE IF NOT EXISTS user_blacklist (
  id BIGINT PRIMARY KEY DEFAULT generate_id(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blacklisted_by BIGINT REFERENCES users(id),
  notes TEXT,
  is_permanent BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_blacklist_user_id ON user_blacklist(user_id);

-- Enable Row Level Security
ALTER TABLE user_blacklist ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage blacklist" ON user_blacklist
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- Helper function to check if user is blacklisted
CREATE OR REPLACE FUNCTION is_user_blacklisted(user_id_param BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_blacklist
    WHERE user_blacklist.user_id = user_id_param
    AND (is_permanent = true OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
