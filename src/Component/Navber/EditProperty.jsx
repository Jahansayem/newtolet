import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ImageUploader from '../../components/AddProperty/ImageUploader'
import LocationPicker from '../../components/AddProperty/LocationPicker'
import { updatePropertyWithImages, getPropertyForEdit } from '../../services/propertyService'
import { validateScreen1, validateScreen2, validateScreen3 } from '../../utils/formValidation'
import { divisions, districts, areas, subAreas } from '../../utils/bangladeshLocations'
import { supabase } from '../../services/supabaseClient'

const categories = [
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { id: 'office', label: 'Office', icon: '🏢' },
  { id: 'sublet', label: 'Sublet', icon: '🔑' },
  { id: 'bachelor', label: 'Bachelor', icon: '👨' },
  { id: 'hostel', label: 'Hostel', icon: '🏨' },
  { id: 'shop', label: 'Shop', icon: '🛍️' },
]

const floorLevels = [
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  '4th Floor',
  '5th Floor',
  '6th Floor',
  '7th Floor',
  '8th Floor',
  '9th Floor',
  '10th Floor',
  '11th Floor',
  '12th Floor',
  '13th Floor',
  '14th Floor',
  '15th Floor',
]

const occupancies = [
  'No Restriction',
  'Only Family',
  'Only Male',
  'Only Female',
]

const rentPeriods = ['Daily', 'Weekly', 'Monthly', 'Yearly']

const propertyTypes = [
  'Apartment',
  'House',
  'Office Space',
  'Shop',
  'Warehouse',
  'Factory',
  'Hostel',
  'Hotel',
  'Building',
  'Unit',
]

const amenitiesList = [
  'Lift',
  'Gas Connection',
  'LPG gas',
  'Generator',
  'CCTV',
  'WiFi',
  'AC',
  'Garage',
  'With Furniture',
]

const CounterInput = ({ label, value, onChange, error, optional = false }) => {
  const handleDecrement = () => {
    onChange(Math.max(0, value - 1))
  }

  const handleIncrement = () => {
    onChange(value + 1)
  }

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '')
    onChange(val === '' ? 0 : parseInt(val))
  }

  return (
    <div>
      <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-1'>
        {label} {!optional && '*'}
      </label>
      <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
        <button
          type='button'
          onClick={handleDecrement}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          −
        </button>
        <button
          type='button'
          onClick={handleIncrement}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          +
        </button>
        <input
          type='text'
          inputMode='numeric'
          pattern='[0-9]*'
          value={value}
          onChange={handleChange}
          className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
        />
      </div>
      {error && <p className='text-red-500 text-xs mt-1'>{error}</p>}
    </div>
  )
}

const SizeInput = ({ label, value, onChange }) => {
  const handleDecrement = () => {
    const currentValue = parseInt(value) || 0
    onChange(Math.max(0, currentValue - 50).toString())
  }

  const handleIncrement = () => {
    const currentValue = parseInt(value) || 0
    onChange((currentValue + 50).toString())
  }

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '')
    onChange(val)
  }

  return (
    <div>
      <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-1'>
        {label}
      </label>
      <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
        <button
          type='button'
          onClick={handleDecrement}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          −
        </button>
        <button
          type='button'
          onClick={handleIncrement}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          +
        </button>
        <input
          type='text'
          inputMode='numeric'
          pattern='[0-9]*'
          value={value}
          onChange={handleChange}
          className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
          placeholder='Optional'
        />
      </div>
    </div>
  )
}

const EditProperty = () => {
  const [searchParams] = useSearchParams()
  const propertyId = searchParams.get('propertyId') || ''
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    category: '',
    property_type: 'Apartment',
    dining_rooms: 0,
    living_rooms: 0,
    total_bathrooms: 0,
    balcony: 0,
    kitchen: 0,
    floor_level: '',
    occupancy: '',
    room_size_sqft: '',
    rent_amount_bdt: '',
    rent_period: '',
    state_district: '',
    area: '',
    sub_area: '',
    contact_number: '',
    short_description: '',
    sector: '',
    road: '',
    house_plot: '',
    lat: null,
    lng: null,
    amenities: [],
    available_from: '',
    deadline: '',
    images: [],
  })

  const [existingImageUrls, setExistingImageUrls] = useState([])
  const [newImageFiles, setNewImageFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [showOptionalLocation, setShowOptionalLocation] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Location hierarchy states
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedUpazilla, setSelectedUpazilla] = useState('')
  const [selectedSubArea, setSelectedSubArea] = useState('')

  // Load existing property data
  useEffect(() => {
    const loadProperty = async () => {
      try {
        setLoading(true)
        setLoadError(null)

        console.log('Loading property with ID:', propertyId)

        if (!propertyId) {
          throw new Error('Property ID is missing from URL')
        }

        // Get user from localStorage
        const storedUser = localStorage.getItem('user')
        const isAuthenticatedUser = storedUser ? JSON.parse(storedUser) : null

        if (!isAuthenticatedUser) {
          throw new Error('Please login to edit this property')
        }

        console.log('Fetching property from database...')

        // Direct fetch from Supabase for better error handling
        const { data: property, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .single()

        console.log('Supabase response:', { property, propertyError })

        if (propertyError) {
          console.error('Supabase error:', propertyError)
          throw new Error(`Property not found: ${propertyError.message}`)
        }

        if (!property) {
          throw new Error('Property not found')
        }

        // Verify ownership
        if (property.user_id !== isAuthenticatedUser.id) {
          throw new Error('You do not have permission to edit this property')
        }

        // Fetch images
        const { data: images } = await supabase
          .from('property_images')
          .select('*')
          .eq('property_id', propertyId)
          .order('display_order')

        // Fetch amenities
        const { data: amenities } = await supabase
          .from('property_amenities')
          .select('amenity_type')
          .eq('property_id', propertyId)

        // Process the property data
        const processedProperty = {
          id: property.id,
          category: property.category,
          property_type: property.property_type,
          dining_rooms: property.dining_rooms || 0,
          living_rooms: property.living_rooms || 0,
          total_bathrooms: property.total_bathrooms,
          balcony: property.balcony,
          floor_level: property.floor_level,
          occupancy: property.occupancy,
          room_size_sqft: property.room_size_sqft || '',
          rent_amount_bdt: property.rent_amount_bdt,
          rent_period: property.rent_period,
          state_district: property.state_district,
          area: property.area,
          sub_area: property.sub_area || '',
          contact_number: property.contact_number,
          short_description: property.short_description,
          sector: property.sector || '',
          road: property.road || '',
          house_plot: property.house_plot || '',
          lat: property.lat,
          lng: property.lng,
          available_from: property.available_from,
          deadline: property.deadline,
          images: (images || []).map(img => img.image_url),
          amenities: (amenities || []).map((a) => a.amenity_type),
          status: property.status,
        }

        console.log('Processed property data:', processedProperty)

        // Set form data
        setFormData({
          category: processedProperty.category || '',
          property_type: processedProperty.property_type || 'Apartment',
          dining_rooms: processedProperty.dining_rooms || 0,
          living_rooms: processedProperty.living_rooms || 0,
          total_bathrooms: processedProperty.total_bathrooms || 0,
          balcony: processedProperty.balcony || 0,
          kitchen: property.total_kitchen || 0,
          floor_level: processedProperty.floor_level || '',
          occupancy: processedProperty.occupancy || '',
          room_size_sqft: processedProperty.room_size_sqft || '',
          rent_amount_bdt: processedProperty.rent_amount_bdt || '',
          rent_period: processedProperty.rent_period || '',
          state_district: processedProperty.state_district || '',
          area: processedProperty.area || '',
          sub_area: processedProperty.sub_area || '',
          contact_number: processedProperty.contact_number || '',
          short_description: processedProperty.short_description || '',
          sector: processedProperty.sector || '',
          road: processedProperty.road || '',
          house_plot: processedProperty.house_plot || '',
          lat: processedProperty.lat,
          lng: processedProperty.lng,
          amenities: processedProperty.amenities || [],
          available_from: processedProperty.available_from || '',
          deadline: processedProperty.deadline || '',
          images: [],
        })

        // Set existing images
        setExistingImageUrls(processedProperty.images || [])

        // Set location hierarchy
        if (processedProperty.state_district) {
          // Try to find matching division
          for (const division of divisions) {
            if (processedProperty.state_district.includes(division) || districts[division]?.includes(processedProperty.state_district)) {
              setSelectedDivision(division)
              // Try to find district
              const districtList = districts[division] || []
              const matchingDistrict = districtList.find(d => processedProperty.state_district.includes(d) || d === processedProperty.state_district)
              if (matchingDistrict) {
                setSelectedDistrict(matchingDistrict)
              }
              break
            }
          }
        }

        if (processedProperty.area) {
          setSelectedUpazilla(processedProperty.area)
        }

        // Set sub-area if available
        if (processedProperty.sub_area) {
          setSelectedSubArea(processedProperty.sub_area)
        }

      } catch (error) {
        console.error('Error loading property:', error)
        setLoadError(error.message || 'Failed to load property')
      } finally {
        setLoading(false)
      }
    }

    loadProperty()
  }, [propertyId])

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const handleLocationSelect = (lat, lng) => {
    updateFormData({ lat, lng })
    setShowLocationPicker(false)
  }

  const handleDivisionChange = (division) => {
    setSelectedDivision(division)
    setSelectedDistrict('')
    setSelectedUpazilla('')
    updateFormData({ state_district: division })
  }

  const handleDistrictChange = (district) => {
    setSelectedDistrict(district)
    setSelectedUpazilla('')
    updateFormData({ state_district: selectedDivision })
  }

  const handleUpazillaChange = (upazilla) => {
    setSelectedUpazilla(upazilla)
    setSelectedSubArea('') // Reset sub-area when upazilla changes
    updateFormData({ area: upazilla, sub_area: '' })
  }

  const handleSubAreaChange = (subArea) => {
    setSelectedSubArea(subArea)
    updateFormData({ sub_area: subArea })
  }

  const availableDistricts = selectedDivision ? districts[selectedDivision] || [] : []
  const availableUpazillas = selectedDistrict ? areas[selectedDistrict] || [] : []

  const handleAmenityToggle = (amenity) => {
    const updatedAmenities = formData.amenities.includes(amenity)
      ? formData.amenities.filter((a) => a !== amenity)
      : [...formData.amenities, amenity]
    updateFormData({ amenities: updatedAmenities })
  }

  const handleImagesChange = (newImages, options) => {
    // Handle removal of existing images
    if (options?.removeExistingUrl) {
      setExistingImageUrls(prev => prev.filter(url => url !== options.removeExistingUrl))
      return
    }

    // Track new files separately from existing URLs
    const newFiles = newImages.filter(img => img instanceof File)
    setNewImageFiles(newFiles)
    updateFormData({ images: newImages })
  }

  const clearErrors = () => setErrors({})
  const setFormErrors = (errorObj) => setErrors(errorObj)

  const handleSubmit = async () => {
    setSubmitError(null)
    setIsSubmitting(true)
    clearErrors()

    try {
      // Calculate total images (existing + new)
      const totalImageCount = existingImageUrls.length + formData.images.length

      // Validate all screens
      const errors1 = validateScreen1(formData)
      const errors2 = validateScreen2(formData)
      const errors3 = validateScreen3(formData)

      // For screen 4, validate dates but NOT images (we do custom validation)
      const errors4 = {}
      if (!formData.available_from) {
        errors4.available_from = 'Please select available from date'
      }
      if (!formData.deadline) {
        errors4.deadline = 'Please select deadline date'
      }
      if (formData.available_from && formData.deadline) {
        const availableDate = new Date(formData.available_from)
        const deadlineDate = new Date(formData.deadline)
        if (availableDate > deadlineDate) {
          errors4.deadline = 'Deadline must be after available from date'
        }
      }

      // Custom image validation - count both existing and new
      if (totalImageCount < 2) {
        errors4.images = 'Please upload at least 2 images (you can keep existing ones or add new ones)'
      } else if (totalImageCount > 10) {
        errors4.images = 'Maximum 10 images allowed'
      }

      const allErrors = { ...errors1, ...errors2, ...errors3, ...errors4 }

      if (Object.keys(allErrors).length > 0) {
        setFormErrors(allErrors)
        const errorList = Object.entries(allErrors)
          .map(([field, message]) => `${field}: ${message}`)
          .join('\n')
        setSubmitError(`Please fix all errors before submitting:\n${errorList}`)
        setIsSubmitting(false)
        const firstErrorField = document.querySelector('[class*="border-red-500"]')
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }

      // Combine existing images with new uploads
      const allImages = [...existingImageUrls]

      // Update the property
      const result = await updatePropertyWithImages(
        propertyId,
        formData,
        newImageFiles,
        allImages
      )

      if (result.success) {
        setSubmitSuccess(true)
        setTimeout(() => {
          navigate('/my-properties', {
            state: {
              message: 'Property updated successfully!',
            },
          })
        }, 2000)
      } else {
        setSubmitError(result.error || 'Failed to update property')
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Submission error:', error)
      setSubmitError(error.message || 'An unexpected error occurred')
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 p-4'>
        <div className='bg-white rounded-lg shadow-md p-8 text-center max-w-md'>
          <div className='mb-4'>
            <svg className='w-16 h-16 mx-auto text-red-500' fill='currentColor' viewBox='0 0 20 20'>
              <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' clipRule='evenodd' />
            </svg>
          </div>
          <h2 className='text-xl font-bold text-gray-900 mb-2'>Error</h2>
          <p className='text-gray-600 mb-6'>{loadError}</p>
          <button
            onClick={() => navigate('/my-properties')}
            className='px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700'
          >
            Back to My Properties
          </button>
        </div>
      </div>
    )
  }

  if (submitSuccess) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4'>
        <div className='bg-white rounded-lg shadow-lg p-8 text-center max-w-md'>
          <div className='mb-4'>
            <svg
              className='w-20 h-20 mx-auto text-green-500'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                clipRule='evenodd'
              />
            </svg>
          </div>
          <h2 className='text-2xl font-bold text-green-900 mb-2'>Success!</h2>
          <p className='text-green-700 mb-4'>
            Your property listing has been updated successfully!
          </p>
          <p className='text-sm text-gray-600'>Redirecting to your properties...</p>
        </div>
      </div>
    )
  }

  const allImagesForDisplay = [...existingImageUrls, ...formData.images]

  return (
    <div className='min-h-screen bg-gray-50 py-4 md:py-8 px-3 sm:px-4 pb-24 md:pb-28'>
      <div className='max-w-2xl mx-auto'>
        {/* Header */}
        <div className='mb-4 md:mb-8'>
          <button
            onClick={() => navigate(-1)}
            className='text-[#1E73B8] hover:text-[#1665a0] font-medium flex items-center gap-1 mb-3 md:mb-4 text-sm md:text-base'
          >
            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z'
                clipRule='evenodd'
              />
            </svg>
            Back
          </button>

          <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2'>
            Edit Property
          </h1>
          <p className='text-sm md:text-base text-gray-600'>
            Update your property details and save changes
          </p>
        </div>

        {/* Form Content */}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className='space-y-4 md:space-y-6'>
          {/* Section 1: Property Details */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-[#1E73B8] text-white rounded-full flex items-center justify-center text-sm font-bold'>1</span>
              Property Details
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Category Selection */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>
                  Select Category *
                </label>
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3'>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type='button'
                      onClick={() => updateFormData({ category: cat.label })}
                      className={`p-3 md:p-4 rounded-lg border-2 transition-all text-center ${
                        formData.category === cat.label
                          ? 'border-[#1E73B8] bg-[#1E73B8]/5'
                          : 'border-gray-300 bg-white hover:border-[#1E73B8]/40'
                      }`}
                    >
                      <div className='text-2xl md:text-3xl mb-1 md:mb-2'>{cat.icon}</div>
                      <p className='font-medium text-xs md:text-sm'>{cat.label}</p>
                    </button>
                  ))}
                </div>
                {errors.category && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.category}</p>}
              </div>

              {/* Property Type Selection */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>
                  Property Type *
                </label>
                <select
                  value={formData.property_type || ''}
                  onChange={(e) => updateFormData({ property_type: e.target.value })}
                  className='w-full border border-gray-300 rounded-lg p-3 md:p-4 text-sm md:text-base focus:outline-none focus:border-[#1E73B8] focus:ring-2 focus:ring-[#1E73B8]/20'
                >
                  <option value=''>Select property type</option>
                  {propertyTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.property_type && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.property_type}</p>}
              </div>

              {/* Specifications Grid */}
              <div className='grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4'>
                <CounterInput
                  label='Dining Rooms'
                  value={formData.dining_rooms || 0}
                  onChange={(val) => updateFormData({ dining_rooms: val })}
                  error={errors.dining_rooms}
                />
                <CounterInput
                  label='Living Rooms'
                  value={formData.living_rooms || 0}
                  onChange={(val) => updateFormData({ living_rooms: val })}
                  error={errors.living_rooms}
                />
                <CounterInput
                  label='Bathrooms'
                  value={formData.total_bathrooms}
                  onChange={(val) => updateFormData({ total_bathrooms: val })}
                  error={errors.total_bathrooms}
                />
                <CounterInput
                  label='Balcony'
                  value={formData.balcony}
                  onChange={(val) => updateFormData({ balcony: val })}
                  error={errors.balcony}
                />
                <CounterInput
                  label='Kitchen'
                  value={formData.kitchen || 0}
                  onChange={(val) => updateFormData({ kitchen: val })}
                  error={errors.kitchen}
                />
                <SizeInput
                  label='Room Size (sqft)'
                  value={formData.room_size_sqft}
                  onChange={(val) => updateFormData({ room_size_sqft: val })}
                />
              </div>

              {/* Floor Level */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
                  Floor Level *
                </label>
                <select
                  value={formData.floor_level}
                  onChange={(e) => updateFormData({ floor_level: e.target.value })}
                  className={`w-full px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.floor_level
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-[#1E73B8]'
                  }`}
                >
                  <option value=''>Select floor level</option>
                  {floorLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
                {errors.floor_level && <p className='text-red-500 text-xs md:text-sm mt-1'>{errors.floor_level}</p>}
              </div>

              {/* Occupancy Restrictions */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>
                  Occupancy Restrictions *
                </label>
                <div className='space-y-2 md:space-y-3'>
                  {occupancies.map((occ) => (
                    <label
                      key={occ}
                      className='flex items-center p-2.5 md:p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50'
                    >
                      <input
                        type='radio'
                        name='occupancy'
                        value={occ}
                        checked={formData.occupancy === occ}
                        onChange={(e) => updateFormData({ occupancy: e.target.value })}
                        className='w-4 h-4 text-[#1E73B8]'
                      />
                      <span className='ml-3 font-medium text-sm md:text-base text-gray-800'>{occ}</span>
                    </label>
                  ))}
                </div>
                {errors.occupancy && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.occupancy}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Pricing */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-[#1E73B8] text-white rounded-full flex items-center justify-center text-sm font-bold'>2</span>
              Pricing Details
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Rent Amount */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
                  Rent Amount (BDT) *
                </label>
                <div className='relative'>
                  <span className='absolute left-3 md:left-4 top-2.5 md:top-3 text-lg md:text-xl font-semibold text-gray-600'>
                    ৳
                  </span>
                  <input
                    type='number'
                    value={formData.rent_amount_bdt}
                    onChange={(e) => updateFormData({ rent_amount_bdt: parseInt(e.target.value) || '' })}
                    className={`w-full pl-8 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                      errors.rent_amount_bdt
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                    }`}
                    placeholder='Enter rent amount'
                    min='1'
                  />
                </div>
                {errors.rent_amount_bdt && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.rent_amount_bdt}</p>}
              </div>

              {/* Rent Period */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>
                  Rental Period *
                </label>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3'>
                  {rentPeriods.map((period) => (
                    <button
                      key={period}
                      type='button'
                      onClick={() => updateFormData({ rent_period: period })}
                      className={`p-3 md:p-4 rounded-lg border-2 transition-all font-semibold text-center ${
                        formData.rent_period === period
                          ? 'border-[#1E73B8] bg-[#1E73B8]/5 text-[#1665a0]'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-[#1E73B8]/40'
                      }`}
                    >
                      <span className='text-xl md:text-2xl'>
                        {period === 'Daily' && '📅'}
                        {period === 'Weekly' && '📆'}
                        {period === 'Monthly' && '📊'}
                        {period === 'Yearly' && '📈'}
                      </span>
                      <br />
                      <span className='text-xs md:text-sm'>{period}</span>
                    </button>
                  ))}
                </div>
                {errors.rent_period && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.rent_period}</p>}
              </div>

              {formData.rent_amount_bdt && formData.rent_period && (
                <div className='bg-green-50 border border-green-200 rounded-lg p-3 md:p-4'>
                  <p className='text-sm md:text-base text-green-800'>
                    <strong>Price:</strong> ৳ {formData.rent_amount_bdt.toLocaleString('en-BD')} per {formData.rent_period.toLowerCase()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Location */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-[#1E73B8] text-white rounded-full flex items-center justify-center text-sm font-bold'>3</span>
              Location Details
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Division Dropdown */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
                  Division *
                </label>
                <select
                  value={selectedDivision}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all bg-white ${
                    errors.state_district && !selectedDivision
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                  }`}
                >
                  <option value=''>Select Division</option>
                  {divisions.map((division) => (
                    <option key={division} value={division}>{division}</option>
                  ))}
                </select>
              </div>

              {/* District Dropdown */}
              {selectedDivision && (
                <div className='animate-fade-in-up'>
                  <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
                    District *
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all bg-white ${
                      errors.state_district && !selectedDistrict
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                    }`}
                  >
                    <option value=''>Select District</option>
                    {availableDistricts.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upazilla Dropdown */}
              {selectedDistrict && (
                <div className='animate-fade-in-up'>
                  <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
                    Upazilla *
                  </label>
                  <select
                    value={selectedUpazilla}
                    onChange={(e) => handleUpazillaChange(e.target.value)}
                    className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all bg-white ${
                      errors.area && !selectedUpazilla
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                    }`}
                  >
                    <option value=''>Select Upazilla</option>
                    {availableUpazillas.map((upazilla) => (
                      <option key={upazilla} value={upazilla}>{upazilla}</option>
                    ))}
                  </select>
                  {errors.area && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.area}</p>}
                </div>
              )}

              {/* Selected Location Display */}
              {selectedUpazilla && (
                <div className='bg-[#1E73B8]/5 border border-[#1E73B8]/30 rounded-lg p-3 md:p-4 animate-fade-in-up'>
                  <p className='text-sm md:text-base text-gray-700'>
                    <strong>Selected Location:</strong>{' '}
                    <span className='text-[#1E73B8]'>{selectedUpazilla}, {selectedDistrict}, {selectedDivision}</span>
                  </p>
                </div>
              )}

              {/* Sub Area Dropdown - Shows if upazilla has sub-areas */}
              {selectedUpazilla && subAreas[selectedUpazilla] && subAreas[selectedUpazilla].length > 0 && (
                <div className='animate-fade-in-up'>
                  <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
                    Sub Area (Optional)
                  </label>
                  <select
                    value={selectedSubArea}
                    onChange={(e) => handleSubAreaChange(e.target.value)}
                    className='w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E73B8] bg-white'
                  >
                    <option value=''>Select Sub Area</option>
                    {subAreas[selectedUpazilla]?.map((subArea) => (
                      <option key={subArea} value={subArea}>
                        {subArea}
                      </option>
                    ))}
                  </select>
                  {selectedSubArea && (
                    <p className='text-green-600 text-xs md:text-sm mt-2 font-medium'>
                      ✓ Sub Area: {selectedSubArea}
                    </p>
                  )}
                </div>
              )}

              {/* Contact Number */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
                  Contact Number *
                </label>
                <div className='flex'>
                  <span className='flex items-center px-3 md:px-4 py-2.5 md:py-3 bg-gray-100 border-2 border-r-0 border-gray-300 rounded-l-lg font-semibold text-sm md:text-base text-gray-700'>
                    +88
                  </span>
                  <input
                    type='tel'
                    value={formData.contact_number.replace('+88', '')}
                    onChange={(e) => updateFormData({ contact_number: '+88' + e.target.value })}
                    className={`flex-1 px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-l-0 rounded-r-lg focus:outline-none transition-all ${
                      errors.contact_number
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                    }`}
                    placeholder='Enter Your Number'
                  />
                </div>
                {errors.contact_number && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.contact_number}</p>}
              </div>

              {/* Short Description */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
                  Short Description *
                </label>
                <textarea
                  value={formData.short_description}
                  onChange={(e) => updateFormData({ short_description: e.target.value })}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all resize-none ${
                    errors.short_description
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                  }`}
                  rows='4'
                  placeholder='e.g., Fresh and clean house, newly renovated with modern amenities.'
                />
                {errors.short_description && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.short_description}</p>}
                <p className='text-gray-500 text-xs mt-1'>{formData.short_description.length} / 500 characters</p>
              </div>

              {/* Set Location Button */}
              <div>
                <button
                  type='button'
                  onClick={() => setShowLocationPicker(true)}
                  className='w-full px-4 md:px-6 py-2.5 md:py-3 bg-[#1E73B8] text-white text-sm md:text-base font-semibold rounded-lg hover:bg-[#1665a0] transition-all flex items-center justify-center gap-2'
                >
                  <svg className='w-4 h-4 md:w-5 md:h-5' fill='currentColor' viewBox='0 0 20 20'>
                    <path fillRule='evenodd' d='M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z' clipRule='evenodd' />
                  </svg>
                  SET LOCATION ON MAP
                </button>
                {formData.lat && formData.lng && (
                  <p className='text-green-600 text-xs md:text-sm mt-2 font-medium'>
                    ✓ Location set: ({formData.lat.toFixed(4)}, {formData.lng.toFixed(4)})
                  </p>
                )}
              </div>

              {/* Optional Details */}
              <div>
                <button
                  type='button'
                  onClick={() => setShowOptionalLocation(!showOptionalLocation)}
                  className='flex items-center gap-2 text-[#1E73B8] font-semibold hover:text-[#1665a0]'
                >
                  <svg className={`w-5 h-5 transition-transform ${showOptionalLocation ? 'rotate-90' : ''}`} fill='currentColor' viewBox='0 0 20 20'>
                    <path fillRule='evenodd' d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z' clipRule='evenodd' />
                  </svg>
                  Optional Details
                </button>

                {showOptionalLocation && (
                  <div className='mt-4 space-y-4 p-4 bg-gray-50 rounded-lg'>
                    <div>
                      <label className='block text-sm font-semibold text-gray-700 mb-1'>Sector</label>
                      <input
                        type='number'
                        value={formData.sector}
                        onChange={(e) => updateFormData({ sector: e.target.value })}
                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E73B8]'
                        placeholder='e.g., 1, 2, 3'
                        min='1'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-semibold text-gray-700 mb-1'>Road</label>
                      <input
                        type='text'
                        value={formData.road}
                        onChange={(e) => updateFormData({ road: e.target.value })}
                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E73B8]'
                        placeholder='e.g., Road 5'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-semibold text-gray-700 mb-1'>House / Plot Number</label>
                      <input
                        type='text'
                        value={formData.house_plot}
                        onChange={(e) => updateFormData({ house_plot: e.target.value })}
                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E73B8]'
                        placeholder='e.g., House 28/9/A'
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Amenities & Upload */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-[#1E73B8] text-white rounded-full flex items-center justify-center text-sm font-bold'>4</span>
              Amenities & Upload
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Amenities */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>Amenities</h3>
                <div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3'>
                  {amenitiesList.map((amenity) => (
                    <label
                      key={amenity}
                      className='flex items-center p-2.5 md:p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-[#1E73B8]/60 hover:bg-[#1E73B8]/5 transition-all'
                    >
                      <input
                        type='checkbox'
                        checked={formData.amenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className='w-4 h-4 md:w-5 md:h-5 text-[#1E73B8] rounded cursor-pointer'
                      />
                      <span className='ml-2 font-medium text-xs md:text-sm text-gray-800'>{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Availability Dates */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>Availability</h3>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4'>
                  <div>
                    <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-2'>Available From *</label>
                    <input
                      type='date'
                      value={formData.available_from}
                      onChange={(e) => updateFormData({ available_from: e.target.value })}
                      className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                        errors.available_from
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                      }`}
                    />
                    {errors.available_from && <p className='text-red-500 text-xs md:text-sm mt-1'>{errors.available_from}</p>}
                  </div>
                  <div>
                    <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-2'>Deadline *</label>
                    <input
                      type='date'
                      value={formData.deadline}
                      onChange={(e) => updateFormData({ deadline: e.target.value })}
                      className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                        errors.deadline
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                      }`}
                    />
                    {errors.deadline && <p className='text-red-500 text-xs md:text-sm mt-1'>{errors.deadline}</p>}
                  </div>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>
                  Property Photos *
                </h3>
                <ImageUploader
                  images={formData.images}
                  onImagesChange={handleImagesChange}
                  error={errors.images}
                  existingImages={existingImageUrls}
                />
                {errors.images && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.images}</p>}
              </div>

              {/* Summary */}
              <div className='bg-gradient-to-r from-[#1E73B8]/5 to-[#1E73B8]/10 border border-[#1E73B8]/30 rounded-lg p-4 md:p-6'>
                <h4 className='font-bold text-gray-800 text-base md:text-lg mb-3'>📋 Update Summary</h4>
                <div className='space-y-1.5 md:space-y-2 text-xs md:text-sm text-gray-700'>
                  <p><strong>Category:</strong> {formData.category || '-'}</p>
                  <p><strong>Price:</strong> {formData.rent_amount_bdt ? `৳${formData.rent_amount_bdt.toLocaleString('en-BD')} per ${formData.rent_period}` : '-'}</p>
                  <p><strong>Location:</strong> {formData.area ? `${formData.area}, ${formData.state_district}` : '-'}</p>
                  <p><strong>Images:</strong> {allImagesForDisplay.length} total</p>
                  <p><strong>Amenities:</strong> {formData.amenities.length > 0 ? formData.amenities.join(', ') : 'None selected'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className='p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg'>
              <p className='text-red-800 font-medium text-sm md:text-base mb-2'>⚠️ Validation Errors</p>
              <ul className='text-red-700 text-xs md:text-sm mt-2 space-y-1'>
                {submitError.split('\n').map((error, idx) => (error ? <li key={idx}>• {error.replace(/^Please fix all errors before submitting:\n?/, '')}</li> : null))}
              </ul>
            </div>
          )}

          {/* Submit Button */}
          <div className='sticky bottom-16 md:bottom-20 bg-white border border-gray-200 rounded-lg p-4 shadow-lg'>
            <button
              type='submit'
              disabled={isSubmitting}
              className='w-full px-6 py-3 bg-[#1E73B8] text-white text-base md:text-lg font-semibold rounded-lg hover:bg-[#1665a0] transition-all disabled:bg-gray-400 disabled:cursor-not-allowed'
            >
              {isSubmitting ? 'Updating...' : 'Update Property Listing'}
            </button>
          </div>
        </form>
      </div>

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPicker
          onSelect={handleLocationSelect}
          onClose={() => setShowLocationPicker(false)}
          initialLat={formData.lat}
          initialLng={formData.lng}
        />
      )}
    </div>
  )
}

export default EditProperty
