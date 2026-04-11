# Complete Application Setup Guide

## 🎯 Overview
This document provides complete setup instructions for the entire application including Google Maps integration, payment system, and admin panel.

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Google Maps Configuration](#google-maps-configuration)
4. [Payment System Setup](#payment-system-setup)
5. [Admin Panel Setup](#admin-panel-setup)
6. [Database Setup](#database-setup)
7. [Running the Application](#running-the-application)
8. [Testing Checklist](#testing-checklist)

---

## Prerequisites

### Required Software
- Node.js 18+ (https://nodejs.org/)
- npm 9+ or yarn
- Git
- Supabase account (https://supabase.com)
- Google Cloud account (https://console.cloud.google.com)

### Installation Check
```bash
node --version    # Should be v18 or higher
npm --version     # Should be 9 or higher
```

---

## Environment Setup

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd project-directory
```

### Step 2: Install Dependencies
```bash
npm install
```

This installs all required packages:
- React 19.2.0
- React Router DOM 7.10.0
- Supabase 2.86.0
- Swiper 12.0.3
- Google Maps API 2.20.7
- Tailwind CSS 4.1.17
- React Icons 5.5.0

### Step 3: Create Environment File
```bash
# Copy example file
cp .env.local.example .env.local

# Edit .env.local with your credentials
nano .env.local  # or use your preferred editor
```

### Step 4: Verify Installation
```bash
npm run build  # Check for build errors
```

---

## Google Maps Configuration

### Quick Setup (5 minutes)

#### 1. Get API Key
```
1. Visit: https://console.cloud.google.com/
2. Create new project
3. Enable "Maps JavaScript API"
4. Create API Key under Credentials
5. Copy the key
```

#### 2. Add to .env.local
```bash
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSy_your_actual_key_here
```

#### 3. Restrict API Key (Security)
```
1. Go to Credentials → Select your API Key
2. Set "Application restrictions" to "HTTP referrers"
3. Add allowed domains:
   - http://localhost:3000 (development)
   - https://yourdomain.com (production)
```

#### 4. Test Maps
- Navigate to any property details page (`/listdetails/:id`)
- Scroll to "Location on Map"
- Verify map displays with property pin

### Map Features Enabled
✓ Interactive map with zoom/pan
✓ Custom marker pins
✓ Info windows with property details
✓ Street view button
✓ Fullscreen button
✓ Map type selector (Road/Satellite/Terrain)
✓ Fallback for API errors
✓ Support for latitude/longitude coordinates

### Bangladesh Coordinates Reference
```
Dhaka:        23.8103°N, 90.4125°E
Chittagong:   22.3569°N, 91.7832°E
Khulna:       22.8456°N, 89.5600°E
Rajshahi:     24.3745°N, 88.6042°E
```

---

## Payment System Setup

### Quick Setup (3 minutes)

The payment system is fully configured with:
- ✓ 4 credit packages (Starter, Basic, Professional, Enterprise)
- ✓ 3 payment methods (bKash, Nagad, Rocket)
- ✓ Automatic credit addition
- ✓ Payment history tracking
- ✓ SMS & push notifications

### Access Payment Module
```
Route: /orderhome
Features:
- View credit balance
- Purchase credit packages
- Select payment gateway
- View payment history
- See credit usage costs
```

### Payment Flow
```
1. User clicks "Buy Now" on package
2. Selects payment method (bKash/Nagad/Rocket)
3. Enters phone number
4. Confirms order
5. Simulated payment processing
6. Credits added to account
7. SMS notification sent
8. User redirected
```

### Credit Packages
```
Starter:       100 credits @ ৳500 (0% discount)
Basic:         300 credits @ ৳1,140 (5% discount)
Professional:  1000 credits @ ৳3,080 (12% discount) ⭐
Enterprise:    5000 credits @ ৳12,000 (20% discount)
```

### Credit Usage Costs
```
Post Property:       20 credits
View Contact:        10 credits
View Photo Gallery:  10 credits
```

### Real Payment Gateway Integration (Future)
To integrate real payment gateways:

#### bKash Integration
```bash
# Register at: https://merchant.bkash.com/
npm install bkash-api  # (when available)
```

Update `src/services/paymentService.js`:
```javascript
const bkashConfig = {
  appKey: process.env.REACT_APP_BKASH_APP_KEY,
  appSecret: process.env.REACT_APP_BKASH_APP_SECRET,
  baseUrl: 'https://api.bkashapp.com/v1'
}
```

#### Nagad Integration
```bash
npm install nagad-api  # (when available)
```

#### Rocket Integration
```bash
npm install rocket-api  # (when available)
```

---

## Admin Panel Setup

### Quick Setup (2 minutes)

### Access Admin Panel
```
Route: /admin-dashboard
Features:
- Dashboard overview with statistics
- Payment transaction monitoring
- User management with blocking capabilities
- Cover photo management
- Real-time data updates
```

### Admin Tabs
1. **Overview**
   - Total users and active users
   - Total revenue
   - Transaction statistics
   - Platform overview

2. **Payment Transactions**
   - View all transactions
   - Filter by status
   - Search by email/transaction ID
   - Update transaction status
   - View transaction details

3. **User Management**
   - View all users
   - Block/unblock users
   - Promote to admin
   - Delete users
   - View user details

4. **Cover Photos**
   - Upload new cover photos
   - Manage carousel order
   - Activate/deactivate photos
   - Delete photos
   - Preview gallery

### Admin Credentials Setup
Currently using localStorage authentication. For production, implement:

```javascript
// src/services/adminService.js
// Add role-based access control (RBAC)
export const checkAdminAccess = (user) => {
  return user?.is_admin === true;
}

// Add activity logging
export const logAdminAction = async (adminId, action) => {
  // Log to activities table
}
```

---

## Database Setup

### Step 1: Create Supabase Project
```
1. Go to: https://app.supabase.com/
2. Click "New Project"
3. Enter project name
4. Set strong password
5. Select region (closest to users)
6. Wait for provisioning
```

### Step 2: Get Database Credentials
```
1. Go to Settings → API
2. Copy:
   - Project URL
   - Anon Public Key
3. Add to .env.local:
```

```bash
REACT_APP_SUPABASE_URL=https://xxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJxxx...
```

### Step 3: Run Database Migrations
```bash
# Option 1: Using SQL Editor in Supabase UI
1. Go to SQL Editor
2. Create new query
3. Copy entire content from: create_missing_tables.sql
4. Click "Run"

# Option 2: Using Supabase CLI
npm install -g supabase
supabase db push
```

### Step 4: Verify Tables Created
In Supabase Dashboard → Table Editor, verify:
- ✓ users
- ✓ properties
- ✓ orders
- ✓ feedback
- ✓ payment_transactions
- ✓ credit_transactions
- ✓ activities
- ✓ site_settings

### Required Tables Schema

#### users
```sql
id (UUID) - Primary Key
email (VARCHAR)
password (VARCHAR - hashed)
name (VARCHAR)
phone (VARCHAR)
credits (INTEGER, default: 0)
is_active (BOOLEAN, default: true)
is_admin (BOOLEAN, default: false)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

#### payment_transactions
```sql
id (UUID) - Primary Key
user_id (UUID) - Foreign Key
transaction_id (VARCHAR) - Unique
amount (DECIMAL)
status (VARCHAR) - pending/success/failed
payment_method (VARCHAR) - bkash/nagad/rocket
credits_to_add (INTEGER)
description (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

#### feedback
```sql
id (UUID) - Primary Key
user_id (UUID) - Foreign Key
email (VARCHAR)
message (TEXT)
rating (INTEGER)
is_resolved (BOOLEAN)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

#### cover_photos
```sql
id (UUID) - Primary Key
image_url (TEXT)
order_index (INTEGER)
is_active (BOOLEAN)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

---

## Running the Application

### Development Server
```bash
# Start development server
npm run dev

# Should output:
# Local: http://localhost:5173
# Press 'q' to quit
```

### Build for Production
```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

### Available Routes
```
/                    - Home page
/registration        - User registration
/login              - User login
/orderhome          - Order/Credit purchase
/addproperty        - Add new property
/propertylist       - View all properties
/listdetails/:id    - Property details with map
/dashboard          - User dashboard
/admin-dashboard    - Admin control panel
/payment-confirm    - Payment confirmation
```

---

## Testing Checklist

### ✅ Environment Setup
- [ ] Node.js v18+ installed
- [ ] npm 9+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` file created
- [ ] All environment variables set

### ✅ Google Maps
- [ ] API key obtained from Google Cloud
- [ ] API key added to `.env.local`
- [ ] Maps JavaScript API enabled in Google Cloud
- [ ] Navigate to property details page
- [ ] Map displays correctly
- [ ] Marker shows property location
- [ ] Zoom/pan controls work
- [ ] Info window opens on marker click

### ✅ Payment System
- [ ] Navigate to `/orderhome`
- [ ] View credit packages
- [ ] Click "Buy Now" on a package
- [ ] Select payment method
- [ ] Enter test phone number
- [ ] Confirm order
- [ ] Wait for processing
- [ ] See success message
- [ ] Check payment history
- [ ] Verify credits added to balance

### ✅ Admin Panel
- [ ] Navigate to `/admin-dashboard`
- [ ] View dashboard statistics
- [ ] Click on Payment Transactions tab
- [ ] Filter transactions by status
- [ ] Search for transactions
- [ ] Click on User Management tab
- [ ] View all users
- [ ] Test blocking/unblocking user
- [ ] Click on Cover Photos tab
- [ ] Add new cover photo
- [ ] Reorder photos
- [ ] Deactivate photo

### ✅ Database
- [ ] Supabase project created
- [ ] Database tables created
- [ ] Test data inserted
- [ ] Can query data in UI
- [ ] Row Level Security policies applied
- [ ] Backups enabled (automatic)

### ✅ Property Listings
- [ ] Navigate to `/propertylist`
- [ ] View all properties
- [ ] Click on property
- [ ] View details page
- [ ] See map with location
- [ ] View all photos in swiper
- [ ] See amenities and specs
- [ ] Click "Contact Owner"

### ✅ Performance
- [ ] Page load time < 3 seconds
- [ ] Maps load smoothly
- [ ] Payment forms responsive
- [ ] Admin dashboard responsive on mobile

---

## Troubleshooting

### Issue: "Google is not defined"
**Solution:**
- Check API key in `.env.local`
- Verify API is enabled in Google Cloud Console
- Restart development server: `npm run dev`

### Issue: Map shows blank/gray
**Solution:**
- Verify latitude/longitude coordinates
- Check API key restrictions in Google Cloud
- Try incognito mode (clear cache)
- Check browser console for errors

### Issue: "Cannot find module '@react-google-maps/api'"
**Solution:**
```bash
npm install @react-google-maps/api
```

### Issue: Payment not processing
**Solution:**
- Check `.env.local` for required variables
- Verify Supabase connection
- Check browser console for errors
- Restart development server

### Issue: Admin panel not accessible
**Solution:**
- Ensure user has `is_admin = true` in database
- Check localStorage for user data
- Verify routes are correct
- Check browser console

### Issue: Maps API quota exceeded
**Solution:**
- Check usage in Google Cloud Console
- Set budget alerts
- Consider upgrading plan
- Implement API caching

---

## Deployment Checklist

### Before Production Deployment

#### Security
- [ ] Remove all test/dummy data
- [ ] Set strong database passwords
- [ ] Enable HTTPS everywhere
- [ ] Restrict API keys by domain
- [ ] Enable Row Level Security in Supabase
- [ ] Remove sensitive data from logs
- [ ] Enable backups

#### Performance
- [ ] Test with production data
- [ ] Optimize images
- [ ] Enable caching headers
- [ ] Minify CSS/JS
- [ ] Test on slow network (throttle)
- [ ] Check Lighthouse scores

#### Testing
- [ ] Run `npm run build` without errors
- [ ] Test all payment flows
- [ ] Test all admin functions
- [ ] Test on different browsers
- [ ] Test on mobile devices
- [ ] Load testing with production data

#### Configuration
- [ ] Update `.env.local` for production
- [ ] Update Google Maps API key restrictions
- [ ] Update database connection string
- [ ] Update CORS settings
- [ ] Enable monitoring/logging
- [ ] Set up error tracking (Sentry)

---

## Support & Documentation

### Official Documentation
- React: https://react.dev/
- Supabase: https://supabase.com/docs
- Google Maps: https://developers.google.com/maps
- Tailwind CSS: https://tailwindcss.com/docs
- Swiper: https://swiperjs.com/react

### Additional Guides
- `GOOGLE_MAPS_SETUP.md` - Detailed Google Maps configuration
- `PAYMENT_SYSTEM_DOCUMENTATION.md` - Payment system details
- `SETUP_DATABASE_TABLES.md` - Database migration instructions
- `ADMIN_PANEL_SETUP.md` - Admin panel documentation (if exists)

---

## Quick Commands Reference

```bash
# Installation
npm install

# Development
npm run dev

# Build
npm run build

# Preview
npm run preview

# Lint
npm run lint
```

---

## Next Steps

1. ✅ Complete environment setup
2. ✅ Configure Google Maps API
3. ✅ Set up Supabase database
4. ✅ Run migrations
5. ✅ Test payment system
6. ✅ Test admin panel
7. ✅ Test property listings with maps
8. ✅ Deploy to production

---

**Last Updated:** December 2024
**Version:** 1.0.0
