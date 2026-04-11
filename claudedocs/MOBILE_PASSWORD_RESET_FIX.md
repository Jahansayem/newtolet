# Mobile Password Reset Fix

## Problem
When clicking the password reset link from Gmail on mobile, it shows "Invalid or expired password reset link."

## Root Cause
The redirect URL in your Supabase project doesn't include your deployed domain, only localhost.

## Solution

### Step 1: Find Your Deployed Domain

If your site is deployed, check what domain it uses:
- **Vercel**: `your-project.vercel.app`
- **Netlify**: `your-project.netlify.app`
- **Custom domain**: `yourdomain.com`

### Step 2: Configure Supabase Redirect URLs

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project: `ohzpdfuijcajoyyrofzp`

2. **Navigate to Authentication → URL Configuration**

3. **Add these URLs to "Redirect URLs"** (one per line):

   ```
   http://localhost:5173/reset-password
   http://localhost:4173/reset-password
   https://your-actual-domain.com/reset-password
   ```

   Replace `your-actual-domain.com` with your real deployed domain.

   **Examples:**
   - If using Vercel: `https://your-project-name.vercel.app/reset-password`
   - If using Netlify: `https://your-project-name.netlify.app/reset-password`
   - If custom domain: `https://yourdomain.com/reset-password`

4. **Click "Save"**

### Step 3: Update Allowed Redirect URLs

Make sure to also add to **Site URL**:
- `http://localhost:5173` (for local dev)
- `https://your-actual-domain.com` (for production)

### Step 4: Test Again

1. Request a new password reset email
2. Click the link from Gmail on mobile
3. It should now work!

---

## Alternative: Check Current Site URL

To find what your actual domain is, run:

```bash
# Check if you have a deployed URL
cat vercel.json
cat package.json | grep -i homepage
```

Or check your deployment platform dashboard.

---

## Debug on Mobile

After updating Supabase, on your mobile phone:

1. **Open Chrome/Safari and navigate to:**
   ```
   https://your-domain.com/reset-password#access_token=test
   ```

2. **Open Browser DevTools** (if possible) or check the URL bar to see if the hash is preserved

3. If the hash is lost, your domain/host might be stripping hash fragments

---

## Quick Fix for Testing

If you want to test right now without deployment:

1. Use your computer (not mobile)
2. Go to `/forgot-password`
3. Enter your email
4. Click the link from your email on your computer
5. It should work on desktop

Then fix the redirect URLs for mobile as described above.

---

## What Changed in Code

The code now:
- ✅ Checks both URL hash AND query params (mobile fallback)
- ✅ Logs detailed URL information for debugging
- ✅ Allows password reset if already logged in
- ✅ Better error messages

But the **main fix** is adding your domain to Supabase redirect URLs!
