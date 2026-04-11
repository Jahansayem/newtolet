# Authentication System Guide

Complete guide to the Supabase authentication system integrated into the application.

## Overview

The application uses **Supabase Authentication** with email/password sign-up and login. User data is stored in a PostgreSQL database with proper security policies.

---

## Architecture

### Components

**1. authService.js** (`src/services/authService.js`)
- Core authentication service with all auth functions
- Handles user registration, login, logout
- Password reset functionality
- User profile management
- Credit system integration

**2. AuthContext.jsx** (`src/contexts/AuthContext.jsx`)
- React Context for app-wide auth state
- Provides user data and auth status to entire app
- Manages session state

**3. useAuth Hook** (`src/hooks/useAuth.js`)
- Custom hook to access auth context
- Makes authentication data easily accessible in components

**4. Auth Components**
- **Login.jsx**: User login with email/password
- **Registration.jsx**: User registration with validation
- **ForgotPassword.jsx**: Password reset request

---

## User Registration Flow

### Step 1: Register Form
User enters:
- Full Name
- Email
- Password (6-20 characters)

### Step 2: Validation
- Client-side validation with React Hook Form
- Email format validation
- Password length validation
- Duplicate email check

### Step 3: Create Auth User
```javascript
const result = await registerUser(name, email, password);
```

### Step 4: Create User Profile
User record created in `users` table with:
- Unique ID (from Supabase Auth)
- Name, Email
- is_active: true
- is_admin: false
- credits: 0
- Timestamps

### Step 5: Success
- User redirected to login page
- Email verification link sent (if configured)

### Response
```javascript
{
    success: true,
    user: { /* user data */ },
    message: "Registration successful! Please check your email to verify your account."
}
```

---

## User Login Flow

### Step 1: Login Form
User enters:
- Email
- Password

### Step 2: Supabase Authentication
```javascript
const result = await loginUser(email, password);
```

### Step 3: Verify User Profile
- Fetch user from `users` table
- Check if user is active (is_active = true)

### Step 4: Store Session
- Store user data in localStorage
- Store auth token
- Set AuthContext state

### Step 5: Redirect
- Redirect to home page
- User stays logged in

### Response
```javascript
{
    success: true,
    user: { /* user data with credits */ },
    session: { /* Supabase session */ },
    message: "Login successful!"
}
```

---

## Password Reset Flow

### Step 1: Forgot Password Page
User enters email address

### Step 2: Request Reset
```javascript
const result = await requestPasswordReset(email);
```

### Step 3: Email Sent
- Supabase sends password reset email
- Email contains reset link with token

### Step 4: User Clicks Link
- Opens reset password page
- Token in URL is verified by Supabase

### Step 5: New Password
```javascript
const result = await resetPassword(newPassword);
```

### Step 6: Session Cleared
- User logged out
- Redirected to login
- Must login with new password

---

## Core Functions

### Registration
```javascript
import { registerUser } from '../services/authService';

const result = await registerUser(name, email, password);
// Returns: { success, user, error, message }
```

### Login
```javascript
import { loginUser } from '../services/authService';

const result = await loginUser(email, password);
// Returns: { success, user, session, error, message }
```

### Logout
```javascript
import { logoutUser } from '../services/authService';

const result = await logoutUser();
// Returns: { success, message, error }
```

### Get Current User
```javascript
import { getCurrentUser } from '../services/authService';

const user = await getCurrentUser();
// Returns: user object or null
```

### Check Authentication
```javascript
import { isUserAuthenticated, getStoredUser } from '../services/authService';

if (isUserAuthenticated()) {
    const user = getStoredUser();
    console.log(user.name);
}
```

### Add Credits
```javascript
import { addCreditsToUser } from '../services/authService';

const result = await addCreditsToUser(userId, creditAmount);
// Returns: { success, user, error, message }
```

### Deduct Credits
```javascript
import { deductCreditsFromUser } from '../services/authService';

const result = await deductCreditsFromUser(userId, creditAmount);
// Returns: { success, user, error, message }
```

---

## Using Auth in Components

### Method 1: Using useAuth Hook (Recommended)
```javascript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
    const { user, isAuthenticated, handleLogout } = useAuth();

    return (
        <div>
            {isAuthenticated && <p>Welcome, {user.name}</p>}
            <button onClick={handleLogout}>Logout</button>
        </div>
    );
}
```

### Method 2: Using AuthContext Directly
```javascript
import { AuthContext } from '../contexts/AuthContext';
import { useContext } from 'react';

function MyComponent() {
    const authContext = useContext(AuthContext);

    return <div>{authContext.user.name}</div>;
}
```

### Method 3: Check Authentication in Components
```javascript
import { getStoredUser, isUserAuthenticated } from '../services/authService';

function ProtectedComponent() {
    if (!isUserAuthenticated()) {
        return <p>Please login to view this page</p>;
    }

    const user = getStoredUser();
    return <div>Logged in as: {user.email}</div>;
}
```

---

## Protected Routes

Create a ProtectedRoute component:

```javascript
import { Navigate } from 'react-router-dom';
import { isUserAuthenticated } from '../services/authService';

export const ProtectedRoute = ({ children }) => {
    return isUserAuthenticated() ? children : <Navigate to="/login" />;
};
```

Use in Router:
```javascript
<Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/orderhome" element={
        <ProtectedRoute>
            <Orderhome />
        </ProtectedRoute>
    } />
</Routes>
```

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    credits INTEGER DEFAULT 0,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Row Level Security (RLS)

Users can only:
- Read their own profile
- Update their own profile
- Admins can read all users

---

## Error Handling

### Common Errors

**Email already registered**
```
"Email already registered"
```

**Invalid password**
```
"Invalid login credentials"
```

**User deactivated**
```
"This account has been deactivated"
```

**Password too short**
```
"Password must be at least 6 characters"
```

### Handling Errors in Components
```javascript
const result = await loginUser(email, password);

if (!result.success) {
    setError(result.error);
    // result.error is user-friendly message
}
```

---

## Supabase Configuration

### Environment Variables (Vite)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Client
```javascript
// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## Testing Authentication

### Test Registration
1. Navigate to `/registration`
2. Fill in form with:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123"
3. Should see success message
4. Should redirect to login after 2 seconds

### Test Login
1. Navigate to `/login`
2. Enter email and password from registration
3. Should login successfully
4. Should redirect to home
5. Check localStorage for `user` and `authToken`

### Test Logout
1. After login, click logout button
2. localStorage should be cleared
3. Should redirect to login

### Test Password Reset
1. Navigate to `/forgot-password`
2. Enter email
3. Check email for reset link
4. Click link to reset password

---

## Best Practices

### 1. Always Check Before Using User Data
```javascript
const user = getStoredUser();
if (user?.id) {
    // Safe to use user.id
}
```

### 2. Clear Auth on Logout
```javascript
await logoutUser();
// Clears localStorage and logs out from Supabase
```

### 3. Protect Sensitive Routes
```javascript
<ProtectedRoute>
    <AdminPanel /> {/* Only authenticated users */}
</ProtectedRoute>
```

### 4. Handle Loading States
```javascript
if (isLoading) return <LoadingSpinner />;
if (!isAuthenticated) return <Navigate to="/login" />;
```

### 5. Update User Credits Properly
```javascript
// After successful payment
const result = await addCreditsToUser(userId, 100);
if (result.success) {
    // Update UI with new credits
}
```

---

## Troubleshooting

### User Can't Register
- Check email format
- Verify Supabase connection
- Check browser console for errors
- Verify .env variables set correctly

### User Can't Login
- Check email/password correct
- Verify user was registered
- Check Supabase Auth enabled
- Check user is_active flag

### Session Lost
- Clear browser cache
- Check localStorage not cleared
- Verify auth token in .env.local
- Restart dev server

### Password Reset Not Working
- Check email service configured in Supabase
- Verify email address in system
- Check reset link in email
- Verify VITE_SUPABASE_URL correct

---

## Security Considerations

### What's Protected
- Passwords hashed by Supabase
- JWT tokens for session management
- RLS policies on database
- Email verification (if configured)

### What's Your Responsibility
- Never log passwords
- Clear sensitive data on logout
- Validate input on client AND server
- Use HTTPS in production
- Keep API keys in .env.local (not git)

---

## API Reference

See `src/services/authService.js` for complete function documentation and parameters.

---

**Status**: ✅ Fully Integrated with Supabase
**Last Updated**: 2025-12-06
