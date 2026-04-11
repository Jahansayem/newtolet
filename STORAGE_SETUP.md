# Storage Bucket Setup Guide

## Issue: Image Upload Failing with "Unexpected token '<'" Error

This error means the Supabase Storage bucket doesn't exist or isn't configured.

## Fix: Create Storage Buckets in Supabase

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Click on **Storage** in the left sidebar
3. Click **"New bucket"**
4. Create the following buckets:

#### Bucket 1: property-images
- **Name:** `property-images`
- **Public bucket:** ✅ YES (toggle ON)
- **File size limit:** 5MB
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`

#### Bucket 2: id-documents (optional, for ID verification)
- **Name:** `id-documents`
- **Public bucket:** ❌ NO (keep private)
- **File size limit:** 2MB

### Option 2: Using SQL

Run this in your Supabase SQL Editor:

```sql
-- Insert storage bucket for property-images (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Insert storage bucket for id-documents (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-documents',
  'id-documents',
  false,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Allow public access to property-images bucket
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'property-images');

-- Allow authenticated users to upload to property-images
CREATE POLICY "Authenticated Upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-images');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated Delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'property-images');
```

## Verify Setup

After creating buckets, verify:

1. Go to **Storage** → **property-images**
2. Make sure **Public** toggle is ON
3. Click on **Policies** tab - you should see the access policies

## Common Issues

### "Bucket not found" error
- The bucket doesn't exist - follow the steps above to create it

### "Permission denied" error
- The bucket policies aren't set up - run the SQL above or create policies via Dashboard

### CORS errors
- Go to Storage → your bucket → Configuration → CORS Policy
- Add this configuration:

```json
[
  {
    "origin": ["*"],
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "maxAge": 3600
  }
]
```
