// Dummy data for testing the Add Property form
// Enable by setting VITE_ENABLE_DUMMY_DATA=true in .env.local

export const DUMMY_PROPERTY_DATA = {
  // Screen 1: Property Details
  category: 'Family',  // Matches label from Screen1PropertyDetails.jsx line 75
  property_type: 'Apartment',  // Property type (Apartment, House, etc.)
  total_rooms: 3,
  total_bathrooms: 2,
  balcony: 1,
  kitchen: 1,
  floor_level: '2nd Floor',  // Matches floorLevels array
  occupancy: 'No Restriction',  // Matches occupancies array
  room_size_sqft: '1200',

  // Screen 2: Pricing
  rent_amount_bdt: 25000,
  rent_period: 'Monthly',  // Matches rentPeriods array
  is_rent_negotiable: false,

  // Screen 3: Location
  state_district: 'Dhaka',
  area: 'Uttara',
  contact_number: '',
  short_description: '',
  sector: 'Sector 7',
  road: 'Road 5',
  house_plot: 'House 28',
  lat: 23.8103,
  lng: 90.4125,

  // Screen 4: Amenities & Upload
  amenities: ['WiFi', 'Lift', 'Generator', 'Gas', 'Parking'],
  available_from: '2025-12-15',
  deadline: '2026-03-15',
  images: [],  // Cannot prefill file objects - user must upload manually
  id_type: 'NID',
  id_front: null,  // Cannot prefill file objects
  id_back: null,   // Cannot prefill file objects
}

// For debugging - log when dummy data is imported
console.log('🧪 Dummy data loaded:', DUMMY_PROPERTY_DATA)
