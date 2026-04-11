-- Simple Feedback Table Setup
-- Run this in Supabase SQL Editor

-- Drop existing table if it has wrong structure
DROP TABLE IF EXISTS feedback;

-- Create feedback table
CREATE TABLE feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    feedback TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback
CREATE POLICY "Anyone can insert feedback" ON feedback
    FOR INSERT WITH CHECK (true);

-- Allow anyone to view feedback (for admin)
CREATE POLICY "Anyone can view feedback" ON feedback
    FOR SELECT USING (true);

-- Allow anyone to update feedback (for admin)
CREATE POLICY "Anyone can update feedback" ON feedback
    FOR UPDATE USING (true);

-- Allow anyone to delete feedback (for admin)
CREATE POLICY "Anyone can delete feedback" ON feedback
    FOR DELETE USING (true);

-- Create indexes
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
