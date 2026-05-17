# Property ID Reset Guide - Start from 100000

## Overview
This script will reset all existing property IDs to start from 100000 while maintaining chronological order.

## Pre-Flight Checklist
- [ ] Database is backed up
- [ ] Application is in maintenance mode (optional but recommended)
- [ ] No active property submissions in progress

## Execution Steps

### Step 1: Run Backup (IMPORTANT!)
First, create a backup of current property IDs:

```bash
# Using Supabase CLI
supabase db execute --file scripts/backup_property_ids.sql

# Or run directly in Supabase SQL Editor
# Copy the contents of backup_property_ids.sql
```

### Step 2: Apply the Migration
Execute the main migration:

```bash
# Using Supabase CLI
supabase db execute --file supabase/migrations/20260504100000_reset_property_ids_start_100000.sql

# Or run in Supabase SQL Editor
# Copy the contents of the migration file
```

### Step 3: Verification
Run this query to verify the reset:

```sql
SELECT
    property_id_number,
    COUNT(*) as property_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM properties
WHERE property_id_number IS NOT NULL
GROUP BY property_id_number
ORDER BY property_id_number ASC
LIMIT 10;
```

Expected result:
- First property_id_number should be 100000
- Sequential numbers (100000, 100001, 100002, etc.)
- Count should be 1 for each ID

## Post-Migration

### Application Restart (Optional)
The property ID generation logic in `propertyService.js` will automatically continue from 100000+ after the reset. No code changes needed.

### Clear Application Cache
If you have cached property data, clear it:

```javascript
// In browser console or temporarily add to your app
localStorage.clear();
sessionStorage.clear();
```

## Rollback Plan
If you need to restore the old IDs:

```sql
-- Restore from backup
UPDATE properties p
SET property_id_number = b.old_property_id_number
FROM property_id_backup b
WHERE p.id = b.id;

-- Verify restore
SELECT property_id_number, COUNT(*)
FROM properties
GROUP BY property_id_number
ORDER BY property_id_number;
```

## Notes
- All property IDs will be sequential starting from 100000
- Oldest properties get lower numbers (100000, 100001, etc.)
- New properties will continue sequentially (100000 + total_properties + 1, etc.)
- This only changes the display `property_id_number`, not the internal `id`
- All foreign key relationships remain intact (they use the internal `id`)
