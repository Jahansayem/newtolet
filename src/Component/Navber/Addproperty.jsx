import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AddPropertyProvider, useAddProperty } from '../../contexts/AddPropertyContext'
import ImageUploader from '../../components/AddProperty/ImageUploader'
import LocationPicker from '../../components/AddProperty/LocationPicker'
import { submitPropertyListing } from '../../services/propertyService'
import { validateScreen1, validateScreen2, validateScreen3, validateScreen4 } from '../../utils/formValidation'
import { getStoredUser } from '../../services/authService'
import locationData from '../../thetolet_locations_bundle.json'

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

const rentPeriods = ['Daily', 'Weekly', 'Monthly']

const propertyTypes = [
  'Unit',
  'Apartment',
  'House',
  'Office Space',
  'Shop',
  'Warehouse',
  'Factory',
  'Hostel',
  'Hotel',
  'Building',
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
      <label className='block text-xs md:text-sm font-semibold text-black mb-1'>
        {label} {!optional && '*'}
      </label>
      <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
        <button
          type='button'
          onClick={handleDecrement}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-black bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          −
        </button>
        <button
          type='button'
          onClick={handleIncrement}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-black bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
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
          className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
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
      <label className='block text-xs md:text-sm font-semibold text-black mb-1'>
        {label}
      </label>
      <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
        <button
          type='button'
          onClick={handleDecrement}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-black bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          −
        </button>
        <button
          type='button'
          onClick={handleIncrement}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-black bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
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
          className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
          placeholder='Optional'
        />
      </div>
    </div>
  )
}

const AddPropertyContent = () => {
  const navigate = useNavigate()
  const {
    formData,
    updateFormData,
    errors,
    setFormErrors,
    clearErrors,
    resetForm,
    isSubmitting,
    setIsSubmitting,
  } = useAddProperty()

  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [showOptionalLocation, setShowOptionalLocation] = useState(false)

  // Location hierarchy states
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedUpazilla, setSelectedUpazilla] = useState('')
  const [selectedSubArea, setSelectedSubArea] = useState('')

  const handleLocationSelect = (lat, lng) => {
    updateFormData({ lat, lng })
    setShowLocationPicker(false)
  }

  // Handle division change
  const handleDivisionChange = (division) => {
    setSelectedDivision(division)
    setSelectedDistrict('')
    setSelectedUpazilla('')
    updateFormData({ state_district: division })
  }

  // Handle district change
  const handleDistrictChange = (district) => {
    setSelectedDistrict(district)
    setSelectedUpazilla('')
    updateFormData({ state_district: selectedDivision })
  }

  // Handle upazilla change
  const handleUpazillaChange = (upazilla) => {
    setSelectedUpazilla(upazilla)
    setSelectedSubArea('') // Reset sub-area when upazilla changes
    updateFormData({ area: upazilla, sub_area: '' })
  }

  // Handle sub-area change
  const handleSubAreaChange = (subArea) => {
    setSelectedSubArea(subArea)
    updateFormData({ sub_area: subArea })
  }

  // Get available districts based on selected division
  const availableDistricts = selectedDivision
    ? locationData.divisions
        .find(d => d.name === selectedDivision)
        ?.districts.map(d => d.name) || []
    : []

  // Get available upazillas based on selected district
  const availableUpazillas = selectedDistrict && selectedDivision
    ? locationData.divisions
        .find(d => d.name === selectedDivision)
        ?.districts.find(d => d.name === selectedDistrict)
        ?.upazillas.map(u => u.name) || []
    : []

  // Get sub-areas for selected upazilla
  const getSubAreas = (upazillaName) => {
    if (!upazillaName || !selectedDivision || !selectedDistrict) return []
    const division = locationData.divisions.find(d => d.name === selectedDivision)
    if (!division) return []
    const district = division.districts.find(d => d.name === selectedDistrict)
    if (!district) return []
    const upazilla = district.upazillas.find(u => u.name === upazillaName)
    return upazilla?.sub_areas || []
  }

  const handleAmenityToggle = (amenity) => {
    const updatedAmenities = formData.amenities.includes(amenity)
      ? formData.amenities.filter((a) => a !== amenity)
      : [...formData.amenities, amenity]
    updateFormData({ amenities: updatedAmenities })
  }

  const handleImagesChange = (newImages) => {
    updateFormData({ images: newImages })
  }

  const handleSubmit = async () => {
    setSubmitError(null)
    setIsSubmitting(true)
    clearErrors()

    try {
      // Validate all screens
      const errors1 = validateScreen1(formData)
      const errors2 = validateScreen2(formData)
      const errors3 = validateScreen3(formData)
      const errors4 = validateScreen4(formData)

      const allErrors = { ...errors1, ...errors2, ...errors3, ...errors4 }

      if (Object.keys(allErrors).length > 0) {
        setFormErrors(allErrors)
        const errorList = Object.entries(allErrors)
          .map(([field, message]) => `${field}: ${message}`)
          .join('\n')
        setSubmitError(`Please fix all errors before submitting:\n${errorList}`)
        setIsSubmitting(false)
        // Scroll to first error
        const firstErrorField = document.querySelector('[class*="border-red-500"]')
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }

      // Get user ID
      const storedUser = getStoredUser()
      let userId = storedUser?.id

      if (!userId) {
        setSubmitError('Please login to add a property')
        setIsSubmitting(false)
        setTimeout(() => {
          navigate('/login', { state: { from: '/addproperty' } })
        }, 2000)
        return
      }

      // Submit the property listing
      const result = await submitPropertyListing(
        formData,
        userId,
        formData.images
      )

      if (result.success) {
        setSubmitSuccess(true)
        resetForm()
        setTimeout(() => {
          navigate('/my-properties', {
            state: {
              message: `Property listing #${result.propertyId} created successfully!`,
            },
          })
        }, 2000)
      } else {
        setSubmitError(result.error || 'Failed to submit property listing')
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Submission error:', error)
      setSubmitError(error.message || 'An unexpected error occurred')
      setIsSubmitting(false)
    }
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
            Your property listing has been submitted successfully!
          </p>
          <p className='text-sm text-gray-600'>Redirecting to your properties...</p>
        </div>
      </div>
    )
  }

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
            Add Property
          </h1>
          <p className='text-sm md:text-base text-gray-600'>
            Fill in all the details to list your property and start earning!
          </p>
        </div>

        {/* Form Content */}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className='space-y-4 md:space-y-6'>
          {/* Section 1: Property Details */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-[#1E73B8] text-white rounded-full flex items-center justify-center text-sm font-bold'>1</span>
              Property Details
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Category Selection */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>
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
                          ? 'border-[#1E73B8] bg-[#1E73B8]/10 text-black shadow-md scale-105'
                          : 'border-gray-300 bg-white text-black hover:border-[#1E73B8]/40'
                      }`}
                    >
                      <div className='text-2xl md:text-3xl mb-1 md:mb-2'>{cat.icon}</div>
                      <p className='font-medium text-xs md:text-sm text-black'>{cat.label}</p>
                    </button>
                  ))}
                </div>
                {errors.category && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.category}</p>}
              </div>

              {/* Property Type Selection */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>
                  Property Type *
                </label>
                <select
                  value={formData.property_type || ''}
                  onChange={(e) => updateFormData({ property_type: e.target.value })}
                  className='w-full border border-gray-300 rounded-lg p-3 md:p-4 text-sm md:text-base text-black focus:outline-none focus:border-[#1E73B8] focus:ring-2 focus:ring-[#1E73B8]/20 bg-white'
                >
                  <option value=''>Select property type</option>
                  {propertyTypes.map((type) => (
                    <option key={type} value={type} className='text-black'>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.property_type && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.property_type}</p>}
              </div>

              {/* Specifications Grid */}
              <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
                <CounterInput
                  label='Dining Rooms'
                  value={formData.dining_rooms || 0}
                  onChange={(val) => updateFormData({ dining_rooms: val })}
                  error={errors.dining_rooms}
                  optional
                />
                <CounterInput
                  label='Living Rooms'
                  value={formData.living_rooms || 0}
                  onChange={(val) => updateFormData({ living_rooms: val })}
                  error={errors.living_rooms}
                  optional
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
                <label className='block text-base md:text-lg font-semibold text-black mb-2'>
                  Floor Level *
                </label>
                <select
                  value={formData.floor_level}
                  onChange={(e) => updateFormData({ floor_level: e.target.value })}
                  className={`w-full px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base text-black border rounded-lg focus:outline-none focus:ring-2 bg-white ${
                    errors.floor_level
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-[#1E73B8]'
                  }`}
                >
                  <option value=''>Select floor level</option>
                  {floorLevels.map((level) => (
                    <option key={level} value={level} className='text-black'>{level}</option>
                  ))}
                </select>
                {errors.floor_level && <p className='text-red-500 text-xs md:text-sm mt-1'>{errors.floor_level}</p>}
              </div>

              {/* Occupancy Restrictions */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>
                  Occupancy Restrictions *
                </label>
                <div className='space-y-2 md:space-y-3'>
                  {occupancies.map((occ) => (
                    <label
                      key={occ}
                      className={`flex items-center p-2.5 md:p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.occupancy === occ
                          ? 'border-[#1E73B8] bg-white'
                          : 'border-gray-300 bg-white hover:border-[#1E73B8]/60'
                      }`}
                    >
                      <input
                        type='radio'
                        name='occupancy'
                        value={occ}
                        checked={formData.occupancy === occ}
                        onChange={(e) => updateFormData({ occupancy: e.target.value })}
                        className='w-4 h-4 text-[#1E73B8] bg-white'
                      />
                      <span className={`ml-3 font-medium text-sm md:text-base ${
                        formData.occupancy === occ ? 'text-black' : 'text-gray-800'
                      }`}>{occ}</span>
                    </label>
                  ))}
                </div>
                {errors.occupancy && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.occupancy}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Pricing */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-[#1E73B8] text-white rounded-full flex items-center justify-center text-sm font-bold'>2</span>
              Pricing Details
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Rent Amount */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-black mb-2'>
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
                    className={`w-full pl-8 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 text-sm md:text-base text-black border-2 rounded-lg focus:outline-none transition-all bg-white ${
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
                <label className='block text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>
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
                          ? 'border-[#1E73B8] bg-[#1E73B8]/10 text-black'
                          : 'border-gray-300 bg-white text-black hover:border-[#1E73B8]/40'
                      }`}
                    >
                      <span className='text-xl md:text-2xl'>
                        {period === 'Daily' && '📅'}
                        {period === 'Weekly' && '📆'}
                        {period === 'Monthly' && '📊'}
                        {period === 'Yearly' && '📈'}
                      </span>
                      <br />
                      <span className='text-xs md:text-sm text-black'>{period}</span>
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
            <h2 className='text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-[#1E73B8] text-white rounded-full flex items-center justify-center text-sm font-bold'>3</span>
              Location Details
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Division Dropdown */}
              <div>
                <label className='block text-base md:text-lg font-semibold text-black mb-2'>
                  Division *
                </label>
                <select
                  value={selectedDivision}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-black border-2 rounded-lg focus:outline-none transition-all bg-white ${
                    errors.state_district && !selectedDivision
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                  }`}
                >
                  <option value=''>Select Division</option>
                  {locationData.divisions.map((division) => (
                    <option key={division.id} value={division.name} className='text-black'>{division.name}</option>
                  ))}
                </select>
              </div>

              {/* District Dropdown */}
              {selectedDivision && (
                <div className='animate-fade-in-up'>
                  <label className='block text-base md:text-lg font-semibold text-black mb-2'>
                    District *
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-black border-2 rounded-lg focus:outline-none transition-all bg-white ${
                      errors.state_district && !selectedDistrict
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                    }`}
                  >
                    <option value=''>Select District</option>
                    {availableDistricts.map((district) => (
                      <option key={district} value={district} className='text-black'>{district}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upazilla Dropdown */}
              {selectedDistrict && (
                <div className='animate-fade-in-up'>
                  <label className='block text-base md:text-lg font-semibold text-black mb-2'>
                    Upazilla *
                  </label>
                  <select
                    value={selectedUpazilla}
                    onChange={(e) => handleUpazillaChange(e.target.value)}
                    className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-black border-2 rounded-lg focus:outline-none transition-all bg-white ${
                      errors.area && !selectedUpazilla
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                    }`}
                  >
                    <option value=''>Select Upazilla</option>
                    {availableUpazillas.map((upazilla) => (
                      <option key={upazilla} value={upazilla} className='text-black'>{upazilla}</option>
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
              {selectedUpazilla && getSubAreas(selectedUpazilla).length > 0 && (
                <div className='animate-fade-in-up'>
                  <label className='block text-base md:text-lg font-semibold text-black mb-2'>
                    Sub Area (Optional)
                  </label>
                  <select
                    value={selectedSubArea}
                    onChange={(e) => handleSubAreaChange(e.target.value)}
                    className='w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-black border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E73B8] bg-white'
                  >
                    <option value=''>Select Sub Area</option>
                    {getSubAreas(selectedUpazilla).map((subArea) => (
                      <option key={subArea} value={subArea} className='text-black'>
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
                <label className='block text-base md:text-lg font-semibold text-black mb-2'>
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
                    className={`flex-1 px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-black border-2 border-l-0 rounded-r-lg focus:outline-none transition-all bg-white ${
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
                <label className='block text-base md:text-lg font-semibold text-black mb-2'>
                  Short Description *
                </label>
                <textarea
                  value={formData.short_description}
                  onChange={(e) => updateFormData({ short_description: e.target.value })}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-black border-2 rounded-lg focus:outline-none transition-all resize-none bg-white ${
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

              {/* Set Location Button - REMOVED */}

              {/* Optional Details - REMOVED */}
            </div>
          </div>

          {/* Section 4: Facilities & Upload */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-[#1E73B8] text-white rounded-full flex items-center justify-center text-sm font-bold'>4</span>
              Facilities & Upload
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Facilities */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>Facilities</h3>
                <div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3'>
                  {amenitiesList.map((amenity) => (
                    <label
                      key={amenity}
                      className={`flex items-center p-2.5 md:p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.amenities.includes(amenity)
                          ? 'border-[#1E73B8] bg-white'
                          : 'border-gray-300 bg-white hover:border-[#1E73B8]/60'
                      }`}
                    >
                      <input
                        type='checkbox'
                        checked={formData.amenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className='w-4 h-4 md:w-5 md:h-5 text-[#1E73B8] rounded cursor-pointer bg-white'
                      />
                      <span className='ml-2 font-medium text-xs md:text-sm text-black'>{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Availability Dates */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>Availability</h3>
                <div className='space-y-4'>
                  <div>
                    <label className='block text-xs md:text-sm font-semibold text-black mb-2'>Available From *</label>
                    <input
                      type='date'
                      value={formData.available_from}
                      onChange={(e) => updateFormData({ available_from: e.target.value })}
                      className={`w-full px-3 md:px-4 py-2.5 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                        errors.available_from
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                      }`}
                      style={{ colorScheme: 'light', color: 'black', backgroundColor: 'white' }}
                    />
                    {errors.available_from && <p className='text-red-500 text-xs md:text-sm mt-1'>{errors.available_from}</p>}
                  </div>
                  <div>
                    <label className='block text-xs md:text-sm font-semibold text-black mb-2'>Deadline *</label>
                    <input
                      type='date'
                      value={formData.deadline}
                      onChange={(e) => updateFormData({ deadline: e.target.value })}
                      className={`w-full px-3 md:px-4 py-2.5 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                        errors.deadline
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-[#1E73B8]'
                      }`}
                      style={{ colorScheme: 'light', color: 'black', backgroundColor: 'white' }}
                    />
                    {errors.deadline && <p className='text-red-500 text-xs md:text-sm mt-1'>{errors.deadline}</p>}
                  </div>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>
                  Property Photos *
                </h3>
                <ImageUploader
                  images={formData.images}
                  onImagesChange={handleImagesChange}
                  error={errors.images}
                />
              </div>

              {/* Summary */}
              <div className='bg-gradient-to-r from-[#1E73B8]/5 to-[#1E73B8]/10 border border-[#1E73B8]/30 rounded-lg p-4 md:p-6'>
                <h4 className='font-bold text-black text-base md:text-lg mb-3'>📋 Submission Summary</h4>
                <div className='space-y-1.5 md:space-y-2 text-xs md:text-sm text-black'>
                  <p><strong>Category:</strong> {formData.category || '-'}</p>
                  <p><strong>Price:</strong> {formData.rent_amount_bdt ? `৳${formData.rent_amount_bdt.toLocaleString('en-BD')} per ${formData.rent_period}` : '-'}</p>
                  <p><strong>Location:</strong> {formData.area ? `${formData.area}, ${formData.state_district}` : '-'}</p>
                  <p><strong>Images:</strong> {formData.images.length} / 10</p>
                  <p><strong>Amenities:</strong> {formData.amenities.length > 0 ? formData.amenities.join(', ') : 'None selected'}</p>
                </div>
                <div className='bg-amber-50 border border-amber-200 rounded p-2.5 md:p-3 mt-3 md:mt-4'>
                  <p className='text-xs md:text-sm text-amber-800'>
                    <strong>⚠️ Cost:</strong> This listing will cost you <strong>20 credits</strong> to submit.
                  </p>
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
              {isSubmitting ? 'Submitting...' : 'Submit Property Listing'}
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

// Main component with context provider
const Addproperty = () => {
  return (
    <AddPropertyProvider>
      <AddPropertyContent />
    </AddPropertyProvider>
  )
}

export default Addproperty
