# Database Setup Instructions

## Fix Missing Tables Error

You're getting this error because the `feedback`, `payment_transactions`, `activities`, and `site_settings` tables don't exist in your Supabase database yet.

### Solution: Run SQL Migration

Follow these steps to create the missing tables:

1. **Go to Supabase Dashboard**
   - Visit https://app.supabase.com
   - Select your project
   - Navigate to SQL Editor

2. **Create New Query**
   - Click "New Query"
   - Copy all SQL from `create_missing_tables.sql` file in this project

3. **Execute the SQL**
   - Paste the entire SQL script
   - Click "Run" button
   - Wait for execution to complete

4. **Verify Tables Created**
   - Go to Table Editor
   - You should see these new tables:
     - `feedback`
     - `payment_transactions`
     - `activities`
     - `site_settings`

### SQL Script Location
```
create_missing_tables.sql
```

### Tables Created:

#### 1. **feedback**
- Stores user feedback and ratings
- Fields: id, user_id, name, email, message, rating, is_resolved, created_at, updated_at

#### 2. **payment_transactions**
- Records all payment transactions
- Fields: id, user_id, order_id, transaction_id, amount, status, payment_method, description, created_at, updated_at

#### 3. **activities**
- Tracks admin actions
- Fields: id, admin_id, action_type, entity_type, entity_id, description, created_at

#### 4. **site_settings**
- Stores site configuration
- Fields: id, setting_key, setting_value, created_at, updated_at

### What the Fix Does:

✅ **Creates Missing Tables** - All required tables for admin panel functionality
✅ **Adds Indexes** - Improves query performance
✅ **Enables RLS** - Row Level Security for data protection
✅ **Sets Up Policies** - Access control for different user roles

### Error Handling:

The updated `adminService.js` now includes graceful error handling:
- If tables don't exist, it returns empty arrays instead of crashing
- Console warnings inform you about missing tables
- Admin panel will load but show no data until tables are created

### After Running the SQL:

1. Refresh your browser
2. Navigate to `/admin-dashboard`
3. All features should work without errors
4. Dashboard will display real data from the database

### Quick Checklist:

- [ ] Logged into Supabase Dashboard
- [ ] Opened SQL Editor
- [ ] Copied and executed `create_missing_tables.sql`
- [ ] Verified all 4 tables appear in Table Editor
- [ ] Refreshed browser
- [ ] Admin panel working without errors

### Troubleshooting:

**Still getting PGRST205 error?**
- Make sure you executed ALL SQL from the file
- Check that the query completed successfully (no red errors)
- Verify tables in Table Editor

**Can't find SQL Editor?**
- In Supabase Dashboard, look for "SQL Editor" in left sidebar
- If not visible, you may not have admin access to the project

**Permission Denied errors?**
- Make sure your Supabase user has admin/owner role
- Check RLS policies in Security > Policies
