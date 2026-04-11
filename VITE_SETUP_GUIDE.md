# Vite Setup Guide

This project uses **Vite** instead of Create React App (CRA). Vite is a modern build tool with faster development experience.

## Key Differences from Create React App

### Environment Variables

**Create React App (OLD)**
```javascript
const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
```

**Vite (NEW - REQUIRED)**
```javascript
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
```

### Important Rules

1. **All environment variables must start with `VITE_` prefix** for Vite to expose them to the browser
2. Use `import.meta.env` instead of `process.env`
3. Environment variables are replaced at **build time**, not runtime
4. Variables are only available after the Vite dev server starts

## Environment Variable Setup

### Step 1: Create `.env.local` file

Copy the `.env.local.example` file to `.env.local` in the project root:

```bash
cp .env.local.example .env.local
```

### Step 2: Add Your Configuration

Edit `.env.local` with your values:

```env
# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE

# Supabase Configuration
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# API Configuration
VITE_API_URL=http://localhost:3000
VITE_API_TIMEOUT=30000

# Feature Flags
VITE_ENABLE_MAPS=true
VITE_ENABLE_PAYMENTS=true
VITE_ENABLE_ADMIN=true
```

### Step 3: Restart Dev Server

After adding environment variables, **restart the Vite dev server**:

```bash
npm run dev
```

## Available Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_GOOGLE_MAPS_API_KEY` | `will_add_later` | Google Maps API key for map display |
| `VITE_SUPABASE_URL` | (from .env) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | (from .env) | Supabase anonymous key |
| `VITE_API_URL` | `http://localhost:3000` | Backend API URL |
| `VITE_API_TIMEOUT` | `30000` | API request timeout in ms |
| `VITE_ENABLE_MAPS` | `true` | Enable Google Maps features |
| `VITE_ENABLE_PAYMENTS` | `true` | Enable payment system |
| `VITE_ENABLE_ADMIN` | `true` | Enable admin panel |

## Git Configuration

The following files should NOT be committed:

- `.env.local` - Contains local development secrets
- `.env.local.example` - Template for developers (should be in git)
- `dist/` - Build output (generated)
- `node_modules/` - Dependencies (generated)

Check `.gitignore` to ensure these are excluded:

```gitignore
.env.local
dist/
node_modules/
```

## Common Issues and Solutions

### Issue: "process is not defined" Error

**Cause**: Using `process.env` in component code

**Solution**: Use `import.meta.env` instead

```javascript
// ❌ WRONG
const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// ✅ CORRECT
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
```

### Issue: Environment Variable is `undefined`

**Cause**:
1. Variable name doesn't start with `VITE_`
2. Dev server wasn't restarted after adding variable
3. Variable not defined in `.env.local` or `.env`

**Solution**:
1. Ensure variable starts with `VITE_`
2. Restart dev server: `npm run dev`
3. Add the variable to `.env.local`

### Issue: Map Not Showing / API Key Error

**Cause**: `VITE_GOOGLE_MAPS_API_KEY` not set or missing

**Solution**:
1. Add your Google Maps API key to `.env.local`
2. Get key from: https://console.cloud.google.com/
3. Enable "Maps JavaScript API" in Google Cloud Console
4. Restart dev server

## Using Environment Variables in Components

### Example: Listdetails Component

```javascript
import { LoadScript, GoogleMap } from '@react-google-maps/api';

const Listdetails = () => {
    // Extract API key at component top
    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    return (
        <>
            {googleMapsApiKey ? (
                <LoadScript googleMapsApiKey={googleMapsApiKey}>
                    <GoogleMap mapContainerStyle={{}} center={{}} zoom={15}>
                        {/* Map components */}
                    </GoogleMap>
                </LoadScript>
            ) : (
                <div>Map API key not configured</div>
            )}
        </>
    );
};
```

## Build Configuration

Vite configuration is in `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    middlewareMode: false,
    watch: {
      usePolling: true,
    },
  },
})
```

## Development vs Production

### Development
```bash
npm run dev
```
- Runs on http://localhost:5173 (or next available port)
- Hot module replacement (HMR) enabled
- Fast builds with minimal optimization

### Production
```bash
npm run build
npm run preview
```
- Runs full optimization and minification
- Output in `dist/` directory
- Smaller file sizes and better performance

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [Vite Environment Variables Guide](https://vitejs.dev/guide/env-and-modes.html)
- [React + Vite Guide](https://vitejs.dev/guide/ssr.html#setting-up-the-dev-server)
- [Google Maps API](https://developers.google.com/maps)
- [Supabase Documentation](https://supabase.com/docs)
