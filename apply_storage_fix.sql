-- ============================================
-- Supabase Storage RLS Fix
-- ============================================
-- Run this in Supabase SQL Editor to fix image upload errors
-- Error: "new row violates row-level security policy"
--
-- This script:
-- 1. Ensures RLS is enabled on storage.objects
-- 2. Creates policies for property-images bucket
-- 3. Creates policies for id-documents bucket
-- ============================================

-- Enable RLS on storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROPERTY-IMAGES BUCKET POLICIES
-- ============================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "property_images_upload" ON storage.objects;
DROP POLICY IF EXISTS "property_images_download" ON storage.objects;
DROP POLICY IF EXISTS "property_images_update" ON storage.objects;
DROP POLICY IF EXISTS "property_images_delete" ON storage.objects;

-- Allow public uploads to property-images
CREATE POLICY "property_images_upload"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'property-images');

-- Allow public downloads from property-images
CREATE POLICY "property_images_download"
ON storage.objects
FOR SELECT
USING (bucket_id = 'property-images');

-- Allow updates to property-images
CREATE POLICY "property_images_update"
ON storage.objects
FOR UPDATE
WITH CHECK (bucket_id = 'property-images');

-- Allow deletes from property-images
CREATE POLICY "property_images_delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'property-images');

-- ============================================
-- ID-DOCUMENTS BUCKET POLICIES
-- ============================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "id_documents_upload" ON storage.objects;
DROP POLICY IF EXISTS "id_documents_download" ON storage.objects;
DROP POLICY IF EXISTS "id_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "id_documents_delete" ON storage.objects;

-- Allow public uploads to id-documents
CREATE POLICY "id_documents_upload"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'id-documents');

-- Allow public downloads from id-documents
CREATE POLICY "id_documents_download"
ON storage.objects
FOR SELECT
USING (bucket_id = 'id-documents');

-- Allow updates to id-documents
CREATE POLICY "id_documents_update"
ON storage.objects
FOR UPDATE
WITH CHECK (bucket_id = 'id-documents');

-- Allow deletes from id-documents
CREATE POLICY "id_documents_delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'id-documents');
