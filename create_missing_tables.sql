-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  rating INT DEFAULT 5,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for feedback
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_email ON public.feedback(email);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  transaction_id VARCHAR(255) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_created_at ON public.payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transaction_id ON public.payment_transactions(transaction_id);

-- Create activities table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for activities
CREATE INDEX IF NOT EXISTS idx_activities_admin_id ON public.activities(admin_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_action_type ON public.activities(action_type);

-- Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for site_settings
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON public.site_settings(setting_key);

-- Enable RLS if needed
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for feedback
CREATE POLICY "Allow public to insert feedback" ON public.feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to view their own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admins to view all feedback" ON public.feedback
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- Create basic RLS policies for payment_transactions
CREATE POLICY "Allow users to view their own transactions" ON public.payment_transactions
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admins to manage transactions" ON public.payment_transactions
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Create basic RLS policies for activities
CREATE POLICY "Allow admins to view activities" ON public.activities
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admins to insert activities" ON public.activities
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create basic RLS policies for site_settings
CREATE POLICY "Allow public to view settings" ON public.site_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage settings" ON public.site_settings
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
