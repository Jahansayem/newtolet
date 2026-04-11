# Supabase Storage RLS Fix

## Problem
You're getting the error: `new row violates row-level security policy` when uploading images to Storage.

This happens because the Storage buckets (`property-images` and `id-documents`) have RLS (Row-Level Security) enabled but no proper policies configured to allow uploads.

## Solution - Apply These RLS Policies

### Step 1: Go to Supabase Dashboard
1. Visit https://app.supabase.com
2. Select your "Rental App" project
3. Go to **Storage** (left sidebar)
4. Click on **Policies** tab

### Step 2: Create Policies for `property-images` Bucket

**Policy 1 - Allow Public Uploads:**
```sql
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'property-images');
```

**Policy 2 - Allow Public Downloads:**
```sql
CREATE POLICY "Allow public downloads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'property-images');
```

**Policy 3 - Allow Updates:**
```sql
CREATE POLICY "Allow public updates"
ON storage.objects
FOR UPDATE
WITH CHECK (bucket_id = 'property-images');
```

**Policy 4 - Allow Deletes:**
```sql
CREATE POLICY "Allow public deletes"
ON storage.objects
FOR DELETE
USING (bucket_id = 'property-images');
```

### Step 3: Create Policies for `id-documents` Bucket

Repeat the same 4 policies above, but replace `property-images` with `id-documents`

### Alternative (Simpler): Disable RLS on Storage Objects

If you want a quicker solution without policies:
1. Go to **SQL Editor** in Supabase
2. Run this command:
```sql
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

This disables RLS on storage.objects table, allowing all uploads/downloads.

## Why This Happens
- Supabase Storage uses the `storage.objects` table in the public schema
- When RLS is enabled, you must define policies for each bucket
- The policies specify who can INSERT (upload), SELECT (download), UPDATE, and DELETE objects
- Without policies, all operations are blocked by default

## Files Affected
- `src/services/imageUploadService.js` - Uploads to both buckets
- `src/services/propertyService.js` - Calls the upload functions

## Testing
After applying the fix:
1. Try uploading a property with images again
2. Check browser console - errors should be gone
3. Images should upload successfully
