/**
 * Script to generate 52 sample properties for testing/demo
 * Run with: node scripts/generateSampleProperties.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const envPath = join(__dirname, '../.env.local')
dotenv.config({ path: envPath })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Sample data arrays
const CATEGORIES = ['Family', 'Office', 'Sublet', 'Bachelor', 'Hostel', 'Shop', 'Warehouse', 'Factory']
const PROPERTY_TYPES = ['Apartment', 'House', 'Office Space', 'Shop', 'Warehouse', 'Factory', 'Hostel', 'Building']
const OCCUPANCIES = ['No Restriction', 'Only Family', 'Only Male', 'Only Female']
const RENT_PERIODS = ['Monthly', 'Yearly']
const FLOOR_LEVELS = ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', '6th Floor', '7th Floor', '8th Floor', '9th Floor', '10th Floor']

const AMENITIES_OPTIONS = [
  ['WiFi', 'Lift', 'Generator'],
  ['WiFi', 'Lift', 'Generator', 'Gas Connection', 'CCTV'],
  ['WiFi', 'Lift', 'Generator', 'Gas Connection', 'Parking'],
  ['WiFi', 'Lift', 'AC', 'Gas Connection'],
  ['WiFi', 'Generator', 'Gas Connection', 'CCTV'],
  ['WiFi', 'Lift', 'Generator', 'Gas Connection', 'AC', 'Parking', 'CCTV'],
]

const LOCATIONS = [
  { district: 'Dhaka', area: 'Uttara', lat: 23.8103, lng: 90.4125 },
  { district: 'Dhaka', area: 'Gulshan', lat: 23.7591, lng: 90.3939 },
  { district: 'Dhaka', area: 'Banani', lat: 23.7536, lng: 90.3950 },
  { district: 'Dhaka', area: 'Dhanmondi', lat: 23.7529, lng: 90.3814 },
  { district: 'Dhaka', area: 'Mirpur', lat: 23.8022, lng: 90.3993 },
  { district: 'Dhaka', area: 'Mohammadpur', lat: 23.7574, lng: 90.3608 },
  { district: 'Dhaka', area: 'Old Dhaka', lat: 23.7109, lng: 90.4125 },
  { district: 'Dhaka', area: 'Bashundhara', lat: 23.8103, lng: 90.4325 },
  { district: 'Chittagong', area: 'GEC Circle', lat: 22.3585, lng: 91.8215 },
  { district: 'Chittagong', area: 'Agrabad', lat: 22.3456, lng: 91.8256 },
  { district: 'Chittagong', area: 'Halishahar', lat: 22.3654, lng: 91.8056 },
  { district: 'Chittagong', area: 'Nasirabad', lat: 22.3756, lng: 91.8156 },
  { district: 'Sylhet', area: 'Zindabazar', lat: 24.8875, lng: 91.8833 },
  { district: 'Sylhet', area: 'Ambarkhana', lat: 24.8925, lng: 91.8783 },
  { district: 'Rajshahi', area: 'Sadar', lat: 24.3733, lng: 88.5861 },
  { district: 'Khulna', area: 'Sadar', lat: 22.8206, lng: 89.5526 },
  { district: 'Bogra', area: 'Sadar', lat: 24.8516, lng: 89.3702 },
  { district: 'Comilla', area: 'Sadar', lat: 23.4607, lng: 91.1809 },
  { district: 'Rangpur', area: 'Sadar', lat: 25.7439, lng: 89.2477 },
  { district: 'Barisal', area: 'Sadar', lat: 22.7010, lng: 90.3531 },
]

const DESCRIPTIONS = [
  'Spacious and well-ventilated property with modern amenities',
  'Freshly renovated with premium fittings and fixtures',
  'Prime location with easy access to schools, hospitals, and markets',
  'Peaceful residential area with 24/7 security',
  'Brand new property with contemporary design',
  'Well-maintained property in a prime neighborhood',
  'Ideal for families with all necessary facilities nearby',
  'Modern layout with abundant natural light',
  'Corner property with excellent ventilation',
  'Newly constructed with high-quality materials',
  'Located in a busy commercial area, perfect for business',
  'Quiet residential area, away from city noise',
  'Close to public transport and main roads',
  'Premium furnishing and ready to move in',
]

// Sample image URLs (using placeholder images - replace with actual uploaded images)
const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
  'https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800',
  'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
]

// Get a random item from array
const random = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Get a random number between min and max
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// Generate a single property
function generateProperty(index) {
  const category = random(CATEGORIES)
  const location = random(LOCATIONS)
  const propertyType = random(PROPERTY_TYPES)
  const images = [SAMPLE_IMAGES[index % SAMPLE_IMAGES.length], SAMPLE_IMAGES[(index + 1) % SAMPLE_IMAGES.length]]

  // Price based on location and category
  let basePrice = 15000
  if (location.district === 'Dhaka' && (location.area === 'Gulshan' || location.area === 'Banani')) {
    basePrice = 45000
  } else if (location.district === 'Dhaka') {
    basePrice = 25000
  } else if (location.district === 'Chittagong') {
    basePrice = 20000
  }

  if (category === 'Office' || category === 'Shop') {
    basePrice = Math.floor(basePrice * 0.8)
  } else if (category === 'Bachelor') {
    basePrice = Math.floor(basePrice * 0.6)
  } else if (category === 'Hostel') {
    basePrice = Math.floor(basePrice * 0.4)
  }

  const rent = basePrice + randomInt(-5000, 15000)

  // Available from date (within next 3 months)
  const availableFrom = new Date()
  availableFrom.setDate(availableFrom.getDate() + randomInt(7, 90))

  // Deadline (within 1-6 months from available date)
  const deadline = new Date(availableFrom)
  deadline.setMonth(deadline.getMonth() + randomInt(1, 6))

  return {
    category,
    property_type: propertyType,
    total_rooms: category === 'Bachelor' || category === 'Hostel' ? randomInt(1, 3) : randomInt(2, 5),
    total_bathrooms: randomInt(1, 4),
    balcony: randomInt(0, 3),
    floor_level: random(FLOOR_LEVELS),
    occupancy: random(OCCUPANCIES),
    room_size_sqft: randomInt(400, 3500),
    rent_amount_bdt: rent,
    rent_period: 'Monthly',
    state_district: location.district,
    area: location.area,
    contact_number: `+8801${randomInt(7, 9)}${randomInt(1000000, 9999999)}`,
    short_description: random(DESCRIPTIONS),
    sector: randomInt(1, 15) > 10 ? `Sector ${randomInt(1, 15)}` : null,
    road: `Road ${randomInt(1, 50)}`,
    house_plot: `House ${randomInt(1, 200)}`,
    lat: location.lat + (Math.random() - 0.5) * 0.01,
    lng: location.lng + (Math.random() - 0.5) * 0.01,
    available_from: availableFrom.toISOString().split('T')[0],
    deadline: deadline.toISOString().split('T')[0],
    status: index < 40 ? 'approved' : 'pending', // First 40 approved, rest pending
    views: randomInt(0, 500),
    amenities: random(AMENITIES_OPTIONS),
    images,
  }
}

// Generate all properties
function generateAllProperties(count = 52) {
  const properties = []
  for (let i = 0; i < count; i++) {
    properties.push(generateProperty(i))
  }
  return properties
}

// Get or create admin user for properties
async function getOrCreateAdminUser() {
  // First try to get an existing admin user
  const { data: existingAdmin, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_admin', true)
    .limit(1)
    .single()

  if (existingAdmin) {
    console.log('Using existing admin user:', existingAdmin.email)
    return existingAdmin.id
  }

  // Create a demo admin user (you should change these credentials)
  const demoEmail = 'admin@demo.com'
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: demoEmail,
    password: 'Admin123456',
  })

  if (authError && !authError.message.includes('already registered')) {
    console.error('Error creating admin user:', authError)
    return null
  }

  // Get or create user record
  const { data: userRecord } = await supabase
    .from('users')
    .upsert({
      id: authData.user?.id || crypto.randomUUID(),
      email: demoEmail,
      name: 'Demo Admin',
      is_admin: true,
      is_active: true,
    })
    .select()
    .single()

  console.log('Created admin user:', demoEmail)
  return userRecord.id
}

// Insert properties into database
async function insertProperties(properties, userId) {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  }

  console.log(`\nInserting ${properties.length} properties...`)

  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i]
    const progress = `(${i + 1}/${properties.length})`

    try {
      // Insert property
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .insert({
          user_id: userId,
          category: prop.category,
          property_type: prop.property_type,
          total_rooms: prop.total_rooms,
          total_bathrooms: prop.total_bathrooms,
          balcony: prop.balcony,
          floor_level: prop.floor_level,
          occupancy: prop.occupancy,
          room_size_sqft: prop.room_size_sqft,
          rent_amount_bdt: prop.rent_amount_bdt,
          rent_period: prop.rent_period,
          state_district: prop.state_district,
          area: prop.area,
          contact_number: prop.contact_number,
          short_description: prop.short_description,
          sector: prop.sector,
          road: prop.road,
          house_plot: prop.house_plot,
          lat: prop.lat,
          lng: prop.lng,
          available_from: prop.available_from,
          deadline: prop.deadline,
          status: prop.status,
          views: prop.views,
        })
        .select()
        .single()

      if (propertyError) throw propertyError

      const propertyId = propertyData.id

      // Insert images
      const imageData = prop.images.map((url, index) => ({
        property_id: propertyId,
        image_url: url,
        is_thumbnail: index === 0,
        display_order: index,
      }))

      const { error: imagesError } = await supabase
        .from('property_images')
        .insert(imageData)

      if (imagesError) throw imagesError

      // Insert amenities
      const amenitiesData = prop.amenities.map((amenity) => ({
        property_id: propertyId,
        amenity_type: amenity,
      }))

      const { error: amenitiesError } = await supabase
        .from('property_amenities')
        .insert(amenitiesData)

      if (amenitiesError) throw amenitiesError

      results.success++
      console.log(`${progress} ✓ "${prop.category}" - ${prop.area}, ${prop.state_district}`)
    } catch (error) {
      results.failed++
      results.errors.push({ index: i + 1, error: error.message })
      console.error(`${progress} ✗ Error:`, error.message)
    }
  }

  return results
}

// Main function
async function main() {
  console.log('=== Sample Property Generator ===\n')

  // Get admin user
  const userId = await getOrCreateAdminUser()
  if (!userId) {
    console.error('Failed to get/create admin user')
    process.exit(1)
  }

  // Generate properties
  console.log('Generating 52 sample properties...')
  const properties = generateAllProperties(52)

  // Insert properties
  const results = await insertProperties(properties, userId)

  // Summary
  console.log('\n=== Summary ===')
  console.log(`Successfully inserted: ${results.success}`)
  console.log(`Failed: ${results.failed}`)

  if (results.errors.length > 0) {
    console.log('\nErrors:')
    results.errors.forEach((e) => console.log(`  - Property ${e.index}: ${e.error}`))
  }

  console.log('\nDone!')
}

main().catch(console.error)
