# Google Maps Integration Setup

## Overview
The Listdetails component now includes an interactive Google Map showing property locations with markers and info windows.

## Features
✓ Interactive map with property location
✓ Draggable map with zoom controls
✓ Street view and fullscreen options
✓ Custom marker icon (indigo pin)
✓ Info window with property details
✓ Responsive design
✓ Fallback for API errors
✓ Support for latitude/longitude coordinates

## Setup Instructions

### Step 1: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API (optional)
   - Geocoding API (optional)

4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API Key

### Step 2: Add API Key to Environment Variables

Create a `.env.local` file in the project root:

```bash
REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

Example:
```bash
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSyDummy_1234567890abcdefghijklmnop
```

### Step 3: Verify Installation

The `@react-google-maps/api` package is already installed. Verify with:

```bash
npm list @react-google-maps/api
```

Should show: `@react-google-maps/api@2.20.7`

### Step 4: Test the Map

1. Add latitude and longitude to your property data:

```javascript
location: {
  latitude: 23.8103,    // Dhaka, Bangladesh
  longitude: 90.4125,
  area: "Gulshan",
  state_district: "Dhaka",
  contact_number: "01712345678"
}
```

2. Navigate to any property details page
3. Scroll to "Location on Map" section
4. Verify the map loads and displays the property pin

## Property Data Structure

To ensure the map displays correctly, your property data should include:

```javascript
{
  id: 1,
  property_type: "Apartment",
  location: {
    latitude: 23.8103,
    longitude: 90.4125,
    area: "Gulshan",
    state_district: "Dhaka",
    contact_number: "01712345678",
    short_description: "Beautiful 3-bedroom apartment...",
  },
  specifications: {
    total_rooms: 3,
    total_bathrooms: 2,
    floor_level: "3rd Floor"
  },
  amenities: ["WiFi", "Parking", "Garden"],
  pricing: {
    rent_amount_bdt: 50000,
    rent_period: "month"
  },
  images: ["url1", "url2", "url3"]
}
```

## Map Features

### 1. Custom Marker
- Blue indigo pin marker
- Clickable to show info window
- Shows property details on click

### 2. Info Window
Shows when marker is clicked:
- Property type
- Location (area, district)
- Monthly rent price

### 3. Map Controls
- Zoom in/out buttons
- Map type selector (Satellite, Terrain)
- Fullscreen button
- Pan and drag

### 4. Default Locations

If latitude/longitude not provided, defaults to:
- **Dhaka, Bangladesh**: 23.8103°N, 90.4125°E

## Coordinates for Bangladesh Cities

```
Dhaka:        23.8103°N, 90.4125°E
Chittagong:   22.3569°N, 91.7832°E
Khulna:       22.8456°N, 89.5600°E
Rajshahi:     24.3745°N, 88.6042°E
Sylhet:       24.8949°N, 91.8687°E
Barisal:      22.7010°N, 90.3535°E
Rangpur:      25.7439°N, 89.2752°E
Mymensingh:   24.7471°N, 90.4203°E
```

## Error Handling

### If API Key is Missing
- Map will display error boundary
- Shows fallback location text
- Component remains functional

### If Map Fails to Load
```javascript
onError={() => (
  <div className='bg-yellow-50 border border-yellow-200 p-4 rounded text-yellow-800'>
    <p className='font-bold'>Map temporarily unavailable</p>
    <p className='text-sm mt-1'>
      Location: {lists.location.area}, {lists.location.state_district}
    </p>
  </div>
)}
```

## Advanced Configuration

### Custom Map Styles

To customize map appearance, modify the `options` prop:

```javascript
options={{
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      stylers: [{ visibility: 'off' }],
    },
  ],
}}
```

### Change Marker Icon

```javascript
icon={{
  path: 'M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8z',
  fillColor: '#4f46e5',  // Change color
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 2,
  scale: 2,
}}
```

### Adjust Zoom Level

```javascript
<GoogleMap
  center={mapCenter}
  zoom={15}  // Change zoom (1-20)
/>
```

## API Quotas & Pricing

### Free Tier Includes
- First 28,000 map loads per month
- $2 per 1,000 additional loads after that
- Maps JavaScript API is generally free for:
  - Basic map display
  - Markers and info windows
  - Map controls

### Monitor Usage
1. Go to Google Cloud Console
2. Navigation → Billing
3. View API usage and quotas

### Set Budget Alert
1. Go to Billing → Budget and alerts
2. Create new budget
3. Set monthly limit to prevent surprise charges

## Troubleshooting

### Map Not Displaying
**Problem:** Map shows blank/gray area
**Solutions:**
- Verify API key in `.env.local`
- Check API is enabled in Google Cloud Console
- Verify latitude/longitude are valid
- Check browser console for errors

### Marker Not Showing
**Problem:** Marker icon not visible
**Solutions:**
- Verify `mapCenter` has valid coordinates
- Check marker styling in code
- Increase zoom level

### "Google is not defined"
**Problem:** JavaScript console error
**Solutions:**
- Ensure API key is set correctly
- API key might be restricted to specific domains
- Check `.env.local` file location

### API Key Rejected
**Problem:** 403 Forbidden error
**Solutions:**
- Regenerate API key
- Check key restrictions:
  - Go to Credentials → API key
  - Set "Application restrictions" to "HTTP referrers"
  - Add your domain (e.g., `localhost:3000`)
- Wait a few minutes for key to activate

## Security Best Practices

### Restrict API Key
1. Go to Credentials → Select your key
2. Set "Application restrictions":
   - **HTTP referrers** (recommended)
   - Add: `localhost:3000` for development
   - Add: `yourdomain.com` for production

### Restrict APIs
Only enable required APIs:
- Maps JavaScript API (required)
- Places API (if using search)
- Geocoding API (if using address lookup)

### Never Commit API Key
- Always use `.env.local` or `.env.local.example`
- Add `.env.local` to `.gitignore`
- Never hardcode keys in components

## Environment Variables Example

### .env.local
```bash
# Google Maps API Key
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSyDummy_your_actual_key_here
```

### .env.local.example (for Git)
```bash
# Google Maps API Key - Get from Google Cloud Console
REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

## Testing

### Test Map Display
```javascript
// In browser console
console.log(window.google.maps); // Should show Google Maps object
```

### Test Coordinates
Use these test coordinates in Dhaka:
- Gulshan: 23.8103, 90.4125
- Dhanmondi: 23.7610, 90.3710
- Banani: 23.8282, 90.4179
- Mirpur: 23.8170, 90.3650

## Performance Tips

### 1. Lazy Load Maps
Load maps only when component is visible:
```javascript
const [mapLoaded, setMapLoaded] = useState(false);

useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) setMapLoaded(true);
  });
  
  observer.observe(mapRef.current);
}, []);
```

### 2. Optimize Marker Count
Only show markers for visible properties

### 3. Cache Map State
Store map center/zoom to avoid reloads

## Next Steps

1. ✅ Get Google Maps API Key
2. ✅ Add API key to `.env.local`
3. ✅ Test map on property details page
4. ✅ Customize marker appearance if needed
5. ✅ Set API restrictions for security
6. ✅ Monitor API usage in Google Cloud Console
