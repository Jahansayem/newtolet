# Cover Photos Management Setup

## Database Setup

You need to create a table in your Supabase database to store the cover photos.

### SQL Schema

Run this SQL in your Supabase SQL Editor:

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

-- Create index for faster queries
CREATE INDEX idx_cover_photos_order ON cover_photos(order_index);
CREATE INDEX idx_cover_photos_active ON cover_photos(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE cover_photos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read active cover photos
CREATE POLICY "Anyone can view active cover photos" ON cover_photos
  FOR SELECT
  USING (is_active = true);

-- Create policy to allow authenticated users to manage cover photos
-- (You can modify this to only allow admin users)
CREATE POLICY "Authenticated users can manage cover photos" ON cover_photos
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_cover_photos_updated_at
  BEFORE UPDATE ON cover_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Insert some default cover photos
INSERT INTO cover_photos (image_url, order_index, is_active) VALUES
  ('https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp', 1, true),
  ('https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp', 2, true),
  ('https://img.daisyui.com/images/stock/photo-1414694762283-acccc27bca85.webp', 3, true),
  ('https://img.daisyui.com/images/stock/photo-1665553365602-b2fb8e5d1707.webp', 4, true);
```

## Environment Variables

Make sure you have these environment variables set in your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Admin Panel Access

To access the admin panel, navigate to:
```
/adminpanel
```

You'll need to add this route to your Router component.

## Features

### Admin Panel Features:
- ✅ Add new cover photos with image URL
- ✅ Edit existing cover photos
- ✅ Delete cover photos
- ✅ Toggle active/inactive status
- ✅ Preview images before adding
- ✅ Responsive design for mobile and desktop
- ✅ Real-time updates

### Cover Component Features:
- ✅ Automatically fetches active photos from database
- ✅ Falls back to default photos if database is empty
- ✅ Dynamic carousel navigation
- ✅ Loading state while fetching data
- ✅ Error handling with fallback images

## Security Notes

The current RLS policy allows any authenticated user to manage cover photos. For production, you should:

1. Create an `admin_users` table or add an `is_admin` column to your users table
2. Update the RLS policy to only allow admin users:

```sql
-- Example: Only allow admin users to manage cover photos
CREATE POLICY "Only admins can manage cover photos" ON cover_photos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'is_admin' = 'true'
    )
  );
```

## Usage

1. Run the SQL schema in Supabase
2. Navigate to `/adminpanel` in your app
3. Add, edit, or manage cover photos
4. Changes will automatically reflect on the homepage

## File Structure

```
src/
├── services/
│   └── coverPhotoService.js       # Supabase API calls
├── Component/
│   ├── Adminpanel.jsx             # Admin panel for managing photos
│   └── Home/
│       └── Cover.jsx              # Homepage cover carousel
```
