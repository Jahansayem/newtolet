# Admin Panel Setup Guide

## Overview

This is a comprehensive admin panel for managing your property listing website. The admin can control:
- **Dashboard**: Overview statistics and quick actions
- **Cover Photos**: Manage homepage carousel images
- **Users**: Manage user accounts, roles, and permissions
- **Properties**: Review, approve/reject, and feature property listings
- **Orders**: Track and manage property bookings
- **Feedback**: View and respond to user feedback

## Database Setup

Run the following SQL in your Supabase SQL Editor to create all necessary tables:

### 1. Cover Photos Table

```sql
-- Create cover_photos table
CREATE TABLE cover_photos (
  id BIGSERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_cover_photos_order ON cover_photos(order_index);
CREATE INDEX idx_cover_photos_active ON cover_photos(is_active);

ALTER TABLE cover_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active cover photos" ON cover_photos
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can manage cover photos" ON cover_photos
  FOR ALL USING (auth.role() = 'authenticated');
```

### 2. Users Table

```sql
-- Create users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_admin ON users(is_admin);
CREATE INDEX idx_users_is_active ON users(is_active);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can manage users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );
```

### 3. Properties Table

```sql
-- Create properties table
CREATE TABLE properties (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  property_type TEXT,
  location TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  price DECIMAL(10, 2),
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_sqft INTEGER,
  image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  amenities JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  is_featured BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_is_featured ON properties(is_featured);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved properties" ON properties
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Users can view own properties" ON properties
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create properties" ON properties
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own properties" ON properties
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all properties" ON properties
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );
```

### 4. Orders Table

```sql
-- Create orders table
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES properties(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  check_in_date DATE,
  check_out_date DATE,
  total_amount DECIMAL(10, 2),
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_property_id ON orders(property_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all orders" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );
```

### 5. Feedback Table

```sql
-- Create feedback table
CREATE TABLE feedback (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  feedback TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_feedback_is_resolved ON feedback(is_resolved);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback" ON feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all feedback" ON feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can manage feedback" ON feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );
```

### 6. Activities Table (Optional - for tracking admin actions)

```sql
-- Create activities table for audit log
CREATE TABLE activities (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id BIGINT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activities" ON activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );
```

### 7. Site Settings Table (Optional)

```sql
-- Create site_settings table
CREATE TABLE site_settings (
  id BIGSERIAL PRIMARY KEY,
  site_name TEXT DEFAULT 'Property Listings',
  site_description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  maintenance_mode BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings" ON site_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update site settings" ON site_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- Insert default settings
INSERT INTO site_settings (site_name) VALUES ('Property Listings');
```

### 8. Create Update Triggers

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to all tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cover_photos_updated_at
  BEFORE UPDATE ON cover_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 9. Insert Sample Data (Optional)

```sql
-- Insert sample cover photos
INSERT INTO cover_photos (image_url, order_index, is_active) VALUES
  ('https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp', 1, true),
  ('https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp', 2, true),
  ('https://img.daisyui.com/images/stock/photo-1414694762283-acccc27bca85.webp', 3, true),
  ('https://img.daisyui.com/images/stock/photo-1665553365602-b2fb8e5d1707.webp', 4, true);
```

## Creating Your First Admin User

After setting up the database, you need to create an admin user:

### Option 1: Manual SQL Update

1. First, register a user through your app's registration page
2. Then run this SQL to make them an admin:

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE users
SET is_admin = true
WHERE email = 'your-email@example.com';
```

### Option 2: Automatic on First User

You can modify the user registration to automatically make the first user an admin:

```sql
-- Create a function to auto-admin first user
CREATE OR REPLACE FUNCTION auto_admin_first_user()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM users) = 1 THEN
    NEW.is_admin = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER auto_admin_first_user_trigger
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_admin_first_user();
```

## Environment Variables

Make sure your `.env` file contains:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Accessing the Admin Panel

1. Navigate to: `http://localhost:5173/adminpanel`
2. You must be logged in as an admin user
3. If you're not an admin, you won't see admin features

## Admin Panel Features

### Dashboard
- **Statistics Cards**: Total users, properties, orders, and feedback
- **Quick Actions**: Fast navigation to key sections
- **Overview**: Visual summary of platform activity

### Cover Photos
- Add new photos with URL input
- Edit existing photos
- Delete photos with confirmation
- Toggle active/inactive status
- Live image preview

### User Management
- View all registered users
- Block/unblock users
- Assign/remove admin roles
- Delete user accounts
- View user status (active/blocked)

### Property Management
- View all properties (with filters: all, pending, approved, rejected)
- Approve or reject property listings
- Feature properties on homepage
- Delete properties
- View property details

### Order Management
- View all orders
- Update order status (pending, confirmed, completed, cancelled)
- Delete orders
- Track customer bookings

### Feedback Management
- View all user feedback
- Mark as resolved/pending
- Delete feedback
- Track submission dates

## Security Best Practices

1. **Admin Access**: Only users with `is_admin = true` can access the admin panel
2. **RLS Policies**: All tables have Row Level Security enabled
3. **Authentication**: Supabase auth handles user authentication
4. **Data Validation**: Frontend validates all inputs before submission

## File Structure

```
src/
├── Component/
│   └── Adminpanel.jsx              # Main admin panel component
├── services/
│   ├── adminService.js             # Admin CRUD operations
│   ├── coverPhotoService.js        # Cover photo operations
│   └── supabaseClient.js           # Supabase configuration
└── assets/
    └── logo.png                    # App logo
```

## Customization

### Adding More Sections

To add new sections to the admin panel:

1. Add a new menu item in `menuItems` array
2. Create a new state variable if needed
3. Add a new case in the `useEffect` switch statement
4. Add the UI section in the content area
5. Create service functions in `adminService.js`

### Styling

The admin panel uses Tailwind CSS with DaisyUI. Customize colors by modifying the classes:
- Primary color: `indigo-500`
- Success: `green-500`
- Error: `red-500`
- Warning: `yellow-500`

## Troubleshooting

### Issue: Tables not found
- Make sure you've run all SQL scripts in Supabase
- Check that RLS policies are enabled

### Issue: Can't access admin panel
- Verify your user has `is_admin = true` in the database
- Check that you're logged in

### Issue: Data not showing
- Check your Supabase credentials in `.env`
- Verify RLS policies allow your user to read the data
- Check browser console for errors

## Support

For issues or questions:
1. Check the database setup in Supabase SQL Editor
2. Verify environment variables
3. Check browser console for errors
4. Review RLS policies

## Next Steps

1. Run all SQL scripts in Supabase
2. Create your admin user
3. Navigate to `/adminpanel`
4. Start managing your website!
