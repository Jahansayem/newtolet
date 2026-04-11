# Troubleshooting Guide

## Common Errors and Solutions

### 1. "process is not defined" Error

**Error Message:**
```
Uncaught ReferenceError: process is not defined
    at Listdetails (http://localhost:5173/src/Component/Home/Listdetails.jsx:627:27)
```

**Root Cause:**
Using Create React App's `process.env` syntax with Vite, which doesn't define `process` globally.

**Solution:**
Replace all instances of `process.env` with `import.meta.env`:

```javascript
// ❌ WRONG (Create React App style)
const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// ✅ CORRECT (Vite style)
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
```

**Fix Applied:**
- All files verified to use `import.meta.env`
- Listdetails.jsx already correctly uses: `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`

---

### 2. Environment Variable is `undefined`

**Symptoms:**
- Maps don't load
- API key not recognized
- Fallback UI shows instead of actual content

**Possible Causes:**
1. Variable not prefixed with `VITE_`
2. Dev server not restarted after adding variable
3. Variable not defined in `.env.local` or `.env`
4. Browser cache contains old version

**Solution:**

```bash
# Step 1: Check .env.local or .env file
# Should have format: VITE_VARIABLE_NAME=value

# Step 2: Restart dev server
npm run dev

# Step 3: Clear browser cache
# Chrome/Firefox: Ctrl+Shift+Delete
# Then reload page: F5 or Ctrl+R

# Step 4: Verify in browser console
# Should print the value, not 'undefined'
console.log(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
```

---

### 3. Port 5173 is Already in Use

**Error Message:**
```
Port 5173 is in use, trying another one...
```

**Solution:**

Option A: Kill the process using port 5173
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :5173
kill -9 <PID>
```

Option B: Use a different port
```bash
npm run dev -- --port 3000
```

---

### 4. Google Maps Not Loading

**Symptoms:**
- Yellow warning box instead of map
- Message: "Map Not Available - To view the map, add VITE_GOOGLE_MAPS_API_KEY"

**Solution:**

1. **Get Google Maps API Key:**
   - Go to: https://console.cloud.google.com/
   - Create new project or select existing
   - Enable "Maps JavaScript API"
   - Go to Credentials → Create API Key
   - Copy the key

2. **Add to .env.local:**
   ```env
   VITE_GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
   ```

3. **Restart Dev Server:**
   ```bash
   npm run dev
   ```

4. **Test:**
   - Navigate to a property details page
   - Map should load with property location

---

### 5. Build Errors or Chunk Size Warnings

**Warning:**
```
Some chunks are larger than 500 kB after minification.
```

**Why It Happens:**
Bundle size is large due to dependencies (Google Maps, Swiper, etc.)

**Solution:**
This is a warning, not an error. For production:

```javascript
// vite.config.js - Add chunk size config
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000, // Increase threshold
    rollupOptions: {
      output: {
        manualChunks: {
          'google-maps': ['@react-google-maps/api'],
          'swiper': ['swiper'],
        }
      }
    }
  }
})
```

---

### 6. Blank Page or 404 Error

**Symptoms:**
- Browser shows blank page
- Check console for errors
- Network tab shows 404 responses

**Solutions:**

**A. Dev Server Not Running**
```bash
npm run dev
```

**B. Wrong Port**
- Check if running on correct port (default 5173)
- Check terminal output for actual port

**C. Router Configuration Issue**
```javascript
// Check Router.jsx for proper route definitions
// All routes should have corresponding components
```

**D. Component Import Errors**
```javascript
// Check all imports are correct
// Wrong: import { X } from './components'
// Right: import { X } from './Component/X'
// Note: Case sensitivity matters!
```

---

### 7. Styles Not Loading or TailwindCSS Not Working

**Symptoms:**
- Unstyled UI (looks broken)
- TailwindCSS classes not applied
- Only basic HTML visible

**Solution:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Then restart dev server
npm run dev
```

Check `vite.config.js` includes TailwindCSS:
```javascript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

---

### 8. Hot Module Replacement (HMR) Not Working

**Symptoms:**
- Changes to code don't appear without full page refresh
- Slow development experience

**Solution:**

Add to `vite.config.js`:
```javascript
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

---

## Debug Commands

### Check Environment Variables
```bash
# See all available VITE_ variables in browser console
Object.entries(import.meta.env).forEach(([key, value]) => {
  if (key.startsWith('VITE_')) console.log(`${key}=${value}`)
})
```

### Check Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Reload page (F5)
4. Look for failed requests (red)
5. Check response errors

### Check Component Rendering
1. Open DevTools (F12)
2. Go to Console tab
3. No red errors should appear
4. Check for yellow warnings

### Build and Test Locally
```bash
npm run build      # Creates dist/ folder
npm run preview    # Serves dist/ locally
# Visit http://localhost:4173
```

---

## Performance Issues

### Slow Dev Server Start
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Slow Page Load
```bash
# Check bundle size
npm run build

# Look at dist/assets/ folder
# Google Maps bundle is usually largest
```

---

## Getting Help

1. **Check this guide first** - Most issues are environment-related
2. **Check browser console** (F12) - Look for red errors
3. **Check terminal output** - Dev server logs errors
4. **Check documentation:**
   - VITE_SETUP_GUIDE.md
   - GOOGLE_MAPS_SETUP.md
   - Project-specific docs

---

## Quick Checklist

- [ ] Node.js 16+ installed (`node --version`)
- [ ] npm packages installed (`npm install`)
- [ ] `.env.local` file exists and has VITE_ variables
- [ ] Dev server running (`npm run dev`)
- [ ] Browser not cached (Ctrl+Shift+Delete)
- [ ] All imports use correct paths
- [ ] Components properly imported in Router
- [ ] Google Maps API key added (if using maps)
- [ ] No red errors in browser console
- [ ] Network requests returning 200 status

If issues persist after checking this list, check the specific setup guides:
- VITE_SETUP_GUIDE.md
- GOOGLE_MAPS_SETUP.md
- COMPLETE_SETUP_GUIDE.md
