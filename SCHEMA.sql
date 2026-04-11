-- LEGACY REFERENCE FILE
-- Use DATABASE_SCHEMA.sql as the canonical schema source of truth.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  phone TEXT,
  name TEXT,
  credits INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  is_employee BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  property_type TEXT NOT NULL,
  total_rooms INTEGER,
  total_bathrooms INTEGER,
  balcony INTEGER,
  floor_level TEXT,
  occupancy TEXT,
  room_size_sqft INTEGER,
  rent_amount_bdt INTEGER NOT NULL,
  rent_period TEXT NOT NULL,
  state_district TEXT NOT NULL,
  area TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  short_description TEXT,
  sector TEXT,
  road TEXT,
  house_plot TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  available_from DATE,
  deadline DATE,
  status TEXT DEFAULT 'pending',
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_thumbnail BOOLEAN DEFAULT false,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS property_amenities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  amenity_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  id_type TEXT NOT NULL,
  front_image_url TEXT NOT NULL,
  back_image_url TEXT NOT NULL,
  verification_status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  submitted_at TIMESTAMP DEFAULT now(),
  reviewed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  credits_deducted INTEGER,
  transaction_type TEXT,
  property_id UUID REFERENCES properties(id),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  credits_spent INTEGER,
  viewed_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photo_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  credits_spent INTEGER,
  viewed_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  inquiry_message TEXT,
  contact_attempted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_name TEXT NOT NULL,
  credits_amount INTEGER NOT NULL,
  price_bdt INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_properties_category ON properties(category);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_property_images_property_id ON property_images(property_id);
CREATE INDEX idx_property_amenities_property_id ON property_amenities(property_id);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_contact_views_user_id ON contact_views(user_id);
CREATE INDEX idx_user_orders_user_id ON user_orders(user_id);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  division TEXT NOT NULL,
  district TEXT NOT NULL,
  area TEXT NOT NULL,
  sub_area TEXT,
  category TEXT NOT NULL,
  rooms INTEGER NOT NULL,
  property_need_from DATE,
  max_budget INTEGER,
  additional_preferences TEXT,
  package TEXT DEFAULT '7_days',
  cost INTEGER DEFAULT 1000,
  status TEXT DEFAULT 'pending_payment',
  is_job_feed_posted BOOLEAN DEFAULT false,
  job_feed_posted_at TIMESTAMP,
  job_feed_title TEXT,
  job_feed_description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_orders_job_feed_posted ON orders(is_job_feed_posted, job_feed_posted_at DESC);
