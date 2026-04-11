# Supabase MCP Server Setup & Guide

## ✅ Installation Complete

The **Supabase MCP Server** has been successfully installed in your Claude Code environment.

### Installation Details
```
Server: supabase
Status: ✓ Connected
Type: HTTP
URL: https://server.smithery.ai/@supabase-community/supabase-mcp/mcp
Scope: User config (available in all projects)
```

---

## What is Supabase MCP Server?

The Supabase MCP (Model Context Protocol) server is a bridge between Claude Code and your Supabase database. It provides tools to:

- ✅ Query your Supabase database directly
- ✅ Execute SQL commands
- ✅ Manage tables and schemas
- ✅ Handle real-time subscriptions
- ✅ Perform CRUD operations
- ✅ Manage authentication and users
- ✅ Work with storage buckets
- ✅ Execute edge functions

---

## Configuration

### Step 1: Set Environment Variables

Add your Supabase credentials to `.env.local`:

```env
# From your Supabase project settings
SUPABASE_URL=https://ohzpdfuijcajoyyrofzp.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oenBkZnVpamNham95eXJvZnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjIyNTIsImV4cCI6MjA3NDA5ODI1Mn0.sFFSxfwJ_qSqB6gO8yTAuh8PpUJeIo1bVoNxzjNrLxg

# For admin operations (service role key - keep secure!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2: Verify Connection

The MCP server will automatically use these environment variables to connect to your Supabase project.

---

## Available Operations

### Database Queries
```
- Query tables with SQL
- Insert, update, delete records
- Create, alter, drop tables
- Manage indexes and constraints
- Perform complex joins and aggregations
```

### Authentication
```
- Create users
- Reset passwords
- Manage roles
- Handle JWT tokens
- Manage sessions
```

### Real-time Features
```
- Subscribe to table changes
- Listen to database events
- Broadcast messages
- Manage real-time subscriptions
```

### File Storage
```
- Upload files to buckets
- Download files
- Delete files
- Manage bucket permissions
```

### Edge Functions
```
- Deploy functions
- Execute functions
- Manage function logs
- Handle webhooks
```

---

## Usage in Claude Code

### Example 1: Query Users Table

Once the MCP server is connected, you can query your database:

```
Query the users table to get all active users
```

Claude Code will use the Supabase MCP tools to execute this query on your actual database.

### Example 2: Insert New Record

```
Insert a new user record with name='John' and email='john@example.com'
```

### Example 3: Check Payment Transactions

```
Query the payment_transactions table and show me all successful payments from today
```

### Example 4: Update User Credits

```
Update the user with id=12345 to add 100 credits
```

---

## Security Best Practices

### 🔒 What NOT to Do
- ❌ Never commit `.env.local` to git
- ❌ Never share SUPABASE_SERVICE_ROLE_KEY publicly
- ❌ Don't hardcode credentials in code
- ❌ Don't use service role key in frontend
- ❌ Don't execute untrusted SQL

### ✅ What TO Do
- ✅ Use environment variables for all credentials
- ✅ Use ANON_KEY for frontend operations
- ✅ Use SERVICE_ROLE_KEY only for admin operations
- ✅ Keep credentials in `.env.local` (add to .gitignore)
- ✅ Use Row-Level Security (RLS) policies
- ✅ Validate all user inputs

### Environment Variables Setup

```env
# .env.local (NEVER commit this file!)

# Anon key - Safe for frontend operations
SUPABASE_URL=https://ohzpdfuijcajoyyrofzp.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service role key - Admin operations only
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Add to `.gitignore`:
```
.env.local
.env.local.example (if it contains real keys)
```

---

## MCP Server Management

### List All MCP Servers
```bash
claude mcp list
```

Expected output:
```
filesystem: node ... - ✓ Connected
memory: node ... - ✓ Connected
supabase: https://server.smithery.ai... (HTTP) - ✓ Connected
```

### Get Supabase Server Details
```bash
claude mcp get supabase
```

### Remove Supabase Server (if needed)
```bash
claude mcp remove "supabase" -s user
```

### Reinstall If Disconnected
```bash
claude mcp add --transport http supabase https://server.smithery.ai/@supabase-community/supabase-mcp/mcp --scope user
```

---

## Integration with Your Project

### Current Database Tables

Your Supabase project has the following tables:

```
users
├── id (UUID)
├── name (TEXT)
├── email (TEXT)
├── is_active (BOOLEAN)
├── is_admin (BOOLEAN)
├── credits (INTEGER)
└── timestamps

payment_transactions
├── id (UUID)
├── user_id (FK)
├── amount (DECIMAL)
├── status (TEXT)
└── timestamps

properties
├── id (UUID)
├── user_id (FK)
├── title (TEXT)
├── location (JSONB)
└── specifications (JSONB)

feedback
├── id (UUID)
├── user_id (FK)
├── rating (INTEGER)
├── message (TEXT)
└── timestamps
```

### Common Operations

**Get user information:**
```
Query the users table where email='user@example.com' using the Supabase MCP
```

**Check payment history:**
```
Get all payment transactions for user_id='abc123' ordered by date
```

**List properties:**
```
Find all active properties in the location 'Dhaka' with price less than 5000
```

**Add user credits:**
```
Update user with id='xyz789' to increase credits by 50
```

---

## Troubleshooting

### MCP Server Not Connected

**Problem**: Supabase server shows as disconnected

**Solutions**:
1. Verify internet connection
2. Check `SUPABASE_URL` and `SUPABASE_KEY` in `.env.local`
3. Verify credentials are correct from Supabase dashboard
4. Restart Claude Code
5. Reinstall MCP server: `claude mcp remove supabase && claude mcp add --transport http supabase https://server.smithery.ai/@supabase-community/supabase-mcp/mcp --scope user`

### Authentication Error

**Problem**: Getting "Invalid API key" error

**Solutions**:
1. Copy correct key from Supabase Dashboard → Settings → API Keys
2. Ensure you have the right key (ANON vs SERVICE_ROLE)
3. Check for extra whitespace in `.env.local`
4. Verify project hasn't been deleted

### Query Timeout

**Problem**: Queries timing out or slow

**Solutions**:
1. Check database size
2. Verify indexes are created on frequently queried columns
3. Use pagination for large result sets
4. Add WHERE clauses to limit results
5. Check Supabase dashboard for slow query logs

### Permission Denied

**Problem**: "Permission denied" when updating/deleting

**Solutions**:
1. Check Row-Level Security (RLS) policies
2. Verify you're using correct key (service role for admin ops)
3. Check if user has proper role assigned
4. Review Supabase RLS policies in dashboard

---

## Advanced Features

### Real-time Subscriptions

Listen to database changes in real-time:

```
Subscribe to changes in the users table for real-time updates
```

### Edge Functions

Execute serverless functions from Supabase:

```
Execute the send_email edge function with parameters user_id='123' and subject='Welcome'
```

### Storage Operations

Work with file storage:

```
Upload profile.jpg to the avatars bucket for user_id='123'
```

---

## Useful Resources

- **Supabase Dashboard**: https://app.supabase.com
- **Supabase Docs**: https://supabase.com/docs
- **Supabase API Reference**: https://supabase.com/docs/reference/javascript
- **MCP Protocol**: https://modelcontextprotocol.io/
- **Your Project**: https://app.supabase.com/project/ohzpdfuijcajoyyrofzp

---

## Next Steps

1. **Verify Connection**: Ask Claude Code to "query the users table"
2. **Test Operations**: Have Claude Code insert test data
3. **Monitor Performance**: Use Supabase dashboard to monitor queries
4. **Set Up Backups**: Configure automatic backups in Supabase
5. **Configure RLS**: Review and strengthen Row-Level Security policies

---

## Summary

✅ **Supabase MCP Server Installed**: Available globally across all projects
✅ **Status**: Connected and ready to use
✅ **Configuration**: Add `SUPABASE_URL` and `SUPABASE_KEY` to `.env.local`
✅ **Security**: Keep credentials in `.env.local` and `.gitignore`
✅ **Integration**: Can now use Claude Code for database operations

The Supabase MCP server is now ready to help with:
- Database queries and operations
- User authentication management
- Real-time features
- File storage operations
- Edge functions
- And more!

---

**Date Installed**: 2025-12-06
**Server Version**: Latest from Smithery
**Status**: ✅ Active and Connected
