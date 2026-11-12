import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AddPropertyProvider, useAddProperty } from '../../contexts/AddPropertyContext'
import ImageUploader from '../../components/AddProperty/ImageUploader'
import LocationPicker from '../../components/AddProperty/LocationPicker'
import { submitPropertyListing } from '../../services/propertyService'
import {
  validateScreen1Codes,
  validateScreen2Codes,
  validateScreen3Codes,
  validateScreen4Codes,
  localizeValidationErrors,
} from '../../utils/formValidation'
import { getStoredUser } from '../../services/authService'
import RentDisplay from '../../components/RentDisplay'
import locationData from '../../thetolet_locations_bundle.json'
import { useLanguage } from '../../i18n/useLanguage'

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
  '16th Floor',
  '17th Floor',
  '18th Floor',
  '19th Floor',
  '20th Floor',
]

const occupancies = [
  'No Restriction',
  'Only Family',
  'Only Male',
  'Only Female',
]

const rentPeriods = ['Daily', 'Weekly', 'Monthly']

// Human-readable names for the validation summary (keys live in the dictionary).
const FIELD_LABEL_KEYS = {
  category: 'addProperty.fields.selectCategory',
  property_type: 'addProperty.fields.propertyType',
  total_bathrooms: 'addProperty.fields.bathrooms',
  balcony: 'addProperty.fields.balcony',
  kitchen: 'addProperty.fields.kitchen',
  floor_level: 'addProperty.fields.floorLevel',
  occupancy: 'addProperty.fields.occupancy',
  rent_amount_bdt: 'addProperty.fields.rentAmount',
  rent_period: 'addProperty.fields.rentalPeriod',
  state_district: 'addProperty.fields.stateDistrict',
  area: 'addProperty.fields.area',
  contact_number: 'addProperty.fields.contactNumber',
  short_description: 'addProperty.fields.shortDescription',
  available_from: 'addProperty.fields.availableFrom',
  deadline: 'addProperty.fields.deadline',
  images: 'addProperty.sections.propertyPhotos',
}

const FIELD_INPUT_IDS = {
  property_type: 'add-propertyType',
  rent_amount_bdt: 'add-rentAmount',
  floor_level: 'add-floorLevel',
  contact_number: 'add-contactNumber',
  short_description: 'add-shortDescription',
  available_from: 'add-availableFrom',
}

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

const CounterInput = ({ label, value, onChange, error, optional = false, ariaKey = '' }) => {
  const { t } = useLanguage()
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
      <label className='ui-label'>
        {label} {!optional && '*'}
      </label>
      <div className='flex items-center overflow-hidden rounded-[var(--radius-input)] border border-[#cbd5e1] bg-white'>
        <button
          type='button'
          onClick={handleDecrement}
          aria-label={ariaKey ? t(`addProperty.aria.decrease${ariaKey}`) : undefined}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-black bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          −
        </button>
        <button
          type='button'
          onClick={handleIncrement}
          aria-label={ariaKey ? t(`addProperty.aria.increase${ariaKey}`) : undefined}
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
          aria-label={label}
          className='flex-1 min-w-0 text-center py-2 text-sm md:text-base bg-white text-ink focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
        />
      </div>
      {error && <p className='text-red-500 text-xs mt-1'>{error}</p>}
    </div>
  )
}

const CheckboxInput = ({ label, checked, onChange, error, optional = false }) => {
  const { t } = useLanguage()

  return (
  <div>
    <span className='ui-label'>
      {label} {!optional && '*'}
    </span>
    <label className='flex min-h-[42px] items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white cursor-pointer hover:bg-gray-50 transition-colors'>
      <input
        type='checkbox'
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className='h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand'
      />
      <span className='text-sm md:text-base text-black'>
        {checked ? t('common.yes') : t('common.no')}
      </span>
    </label>
    {error && <p className='text-red-500 text-xs mt-1'>{error}</p>}
  </div>
  )
}

const SizeInput = ({ label, value, onChange }) => {
  const { t } = useLanguage()
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
      <label className='ui-label'>
        {label}
      </label>
      <div className='flex items-center overflow-hidden rounded-[var(--radius-input)] border border-[#cbd5e1] bg-white'>
        <button
          type='button'
          onClick={handleDecrement}
          aria-label={t('addProperty.aria.decreaseRoomSize')}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-black bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          −
        </button>
        <button
          type='button'
          onClick={handleIncrement}
          aria-label={t('addProperty.aria.increaseRoomSize')}
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
          aria-label={label}
          className='flex-1 min-w-0 text-center py-2 text-sm md:text-base bg-white text-ink focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
          placeholder={t('common.optional')}
        />
      </div>
    </div>
  )
}

const AddPropertyContent = () => {
  const { t, tv } = useLanguage()
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
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState('')
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [showOptionalLocation, setShowOptionalLocation] = useState(false)
  const isMountedRef = useRef(true)
  const redirectTimerRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

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
    setSelectedSubArea('')
    updateFormData({ state_district: division, area: '', sub_area: '' })
  }

  // Handle district change
  const handleDistrictChange = (district) => {
    setSelectedDistrict(district)
    setSelectedUpazilla('')
    setSelectedSubArea('')
    updateFormData({ state_district: district, area: '', sub_area: '' })
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
      const errors1 = localizeValidationErrors(validateScreen1Codes(formData), t)
      const errors2 = localizeValidationErrors(validateScreen2Codes(formData), t)
      const errors3 = localizeValidationErrors(validateScreen3Codes(formData), t)
      const errors4 = localizeValidationErrors(validateScreen4Codes(formData), t)

      const allErrors = { ...errors1, ...errors2, ...errors3, ...errors4 }

      if (Object.keys(allErrors).length > 0) {
        setFormErrors(allErrors)
        const errorList = Object.entries(allErrors)
          .map(([field, message]) => `${FIELD_LABEL_KEYS[field] ? t(FIELD_LABEL_KEYS[field]) : field}: ${message}`)
          .join('\n')
        setSubmitError(`${t('addProperty.alerts.fixErrorsHeading')}\n${errorList}`)
        setIsSubmitting(false)
        // Move focus to the first invalid control; fall back to the first red-bordered element.
        const firstInvalidField = Object.keys(allErrors).find((field) => FIELD_INPUT_IDS[field])
        requestAnimationFrame(() => {
          const target =
            (firstInvalidField && document.getElementById(FIELD_INPUT_IDS[firstInvalidField])) ||
            document.querySelector('[aria-invalid="true"]') ||
            document.querySelector('[class*="border-red-500"]')
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' })
            if (typeof target.focus === 'function') {
              target.focus({ preventScroll: true })
            }
          }
        })
        return
      }

      // Get user ID
      const storedUser = getStoredUser()
      let userId = storedUser?.id

      if (!userId) {
        if (isMountedRef.current) {
          setSubmitError(t('addProperty.alerts.loginRequired'))
          setIsSubmitting(false)
        }
        redirectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            navigate('/login', { state: { from: '/addproperty' } })
          }
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
        // The service message is always set; append the public Property ID so the
        // user can quote it (it is what cards and search use, not the internal uuid).
        const successMessage = [
          result.message ||
            t('addProperty.success.created', { id: result.propertyIdNumber || result.propertyId }),
          result.propertyIdNumber
            ? t('addProperty.success.propertyId', { id: result.propertyIdNumber })
            : '',
          result.warning === 'amenitiesNotSaved' ? t('addProperty.success.amenitiesNotSaved') : '',
        ]
          .filter(Boolean)
          .join(' ')

        if (isMountedRef.current) {
          setSubmitSuccessMessage(successMessage)
          setSubmitSuccess(true)
          resetForm()
        }
        redirectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            navigate('/my-properties', {
              state: {
                message: successMessage,
              },
            })
          }
        }, 2000)
      } else {
        if (isMountedRef.current) {
          setSubmitError(result.error || t('addProperty.alerts.submitFailed'))
          setIsSubmitting(false)
        }
      }
    } catch (error) {
      console.error('Submission error:', error)
      if (isMountedRef.current) {
        setSubmitError(error.message || t('addProperty.alerts.unexpectedError'))
        setIsSubmitting(false)
      }
    }
  }

  const fixErrorsHeading = t('addProperty.alerts.fixErrorsHeading')

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
          <h2 className='text-2xl font-bold text-green-900 mb-2'>{t('addProperty.success.title')}</h2>
          <p className='text-green-700 mb-4'>
            {submitSuccessMessage || t('addProperty.success.submitted')}
          </p>
          <p className='text-sm text-gray-600'>{t('addProperty.success.redirecting')}</p>
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
            className='text-brand hover:text-brand-hover font-medium flex items-center gap-1 mb-3 md:mb-4 text-sm md:text-base'
          >
            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z'
                clipRule='evenodd'
              />
            </svg>
            {t('common.back')}
          </button>

          <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2'>
            {t('addProperty.header.title')}
          </h1>
          <p className='text-sm md:text-base text-gray-600'>
            {t('addProperty.header.subtitle')}
          </p>
        </div>

        {/* Form Content */}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className='space-y-4 md:space-y-6'>
          {/* Section 1: Property Details */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-bold'>1</span>
              {t('addProperty.sections.propertyDetails')}
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Category Selection */}
              <div>
                <p id='add-category-label' className='ui-label text-[15px]'>
                  {t('addProperty.fields.selectCategory')}
                </p>
                <div
                  role='group'
                  aria-labelledby='add-category-label'
                  aria-invalid={errors.category ? 'true' : undefined}
                  aria-describedby={errors.category ? 'add-category-error' : undefined}
                  className='grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3'
                >
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type='button'
                      aria-pressed={formData.category === cat.label}
                      onClick={() => updateFormData({ category: cat.label })}
                      className={`p-3 md:p-4 rounded-lg border-2 transition-all text-center ${
                        formData.category === cat.label
                          ? 'border-brand bg-brand/10 text-black shadow-md scale-105'
                          : 'border-gray-300 bg-white text-black hover:border-brand/40'
                      }`}
                    >
                      <div className='text-2xl md:text-3xl mb-1 md:mb-2'>{cat.icon}</div>
                      <p className='font-medium text-xs md:text-sm text-black'>{tv('categories', cat.label)}</p>
                    </button>
                  ))}
                </div>
                {errors.category && <p id='add-category-error' role='alert' className='ui-error'>{errors.category}</p>}
              </div>

              {/* Property Type Selection */}
              <div>
                <label htmlFor='add-propertyType' className='ui-label text-[15px]'>
                  {t('addProperty.fields.propertyType')}
                </label>
                <select
                  id='add-propertyType'
                  aria-invalid={errors.property_type ? 'true' : undefined}
                  value={formData.property_type || ''}
                  onChange={(e) => updateFormData({ property_type: e.target.value })}
                  className='ui-field'
                >
                  <option value=''>{t('addProperty.placeholders.selectPropertyType')}</option>
                  {propertyTypes.map((type) => (
                    <option key={type} value={type} className='text-black'>
                      {tv('propertyTypes', type)}
                    </option>
                  ))}
                </select>
                {errors.property_type && <p className='ui-error'>{errors.property_type}</p>}
              </div>

              {/* Specifications Grid */}
              <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
                <CounterInput
                  label={t('addProperty.fields.rooms')}
                  ariaKey='Rooms'
                  value={formData.total_rooms || 0}
                  onChange={(val) => updateFormData({ total_rooms: val })}
                  error={errors.total_rooms}
                  optional
                />
                <CheckboxInput
                  label={t('addProperty.fields.drawingRoom')}
                  checked={Number(formData.living_rooms || 0) > 0}
                  onChange={(checked) => updateFormData({ living_rooms: checked ? 1 : 0 })}
                  error={errors.living_rooms}
                  optional
                />
                <CounterInput
                  label={t('addProperty.fields.bathrooms')}
                  ariaKey='Bathrooms'
                  value={formData.total_bathrooms}
                  onChange={(val) => updateFormData({ total_bathrooms: val })}
                  error={errors.total_bathrooms}
                />
                <CounterInput
                  label={t('addProperty.fields.balcony')}
                  ariaKey='Balconies'
                  value={formData.balcony}
                  onChange={(val) => updateFormData({ balcony: val })}
                  error={errors.balcony}
                />
                <CounterInput
                  label={t('addProperty.fields.kitchen')}
                  ariaKey='Kitchen'
                  value={formData.kitchen || 0}
                  onChange={(val) => updateFormData({ kitchen: val })}
                  error={errors.kitchen}
                />
                <SizeInput
                  label={t('addProperty.fields.roomSize')}
                  value={formData.room_size_sqft}
                  onChange={(val) => updateFormData({ room_size_sqft: val })}
                />
              </div>

              {/* Floor Level */}
              <div>
                <label htmlFor='add-floorLevel' className='ui-label text-[15px]'>
                  {t('addProperty.fields.floorLevel')}
                </label>
                <select
                  id='add-floorLevel'
                  aria-invalid={errors.floor_level ? 'true' : undefined}
                  aria-describedby={errors.floor_level ? 'add-floorLevel-error' : undefined}
                  value={formData.floor_level}
                  onChange={(e) => updateFormData({ floor_level: e.target.value })}
                  className={`ui-field ${
                    errors.floor_level
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-brand'
                  }`}
                >
                  <option value=''>{t('addProperty.placeholders.selectFloorLevel')}</option>
                  {floorLevels.map((level) => (
                    <option key={level} value={level} className='text-black'>{tv('floorLevels', level)}</option>
                  ))}
                </select>
                {errors.floor_level && <p id='add-floorLevel-error' role='alert' className='ui-error'>{errors.floor_level}</p>}
              </div>

              {/* Occupancy Restrictions */}
              <div>
                <p id='add-occupancy-label' className='ui-label text-[15px]'>
                  {t('addProperty.fields.occupancy')}
                </p>
                <div
                  role='radiogroup'
                  aria-labelledby='add-occupancy-label'
                  aria-invalid={errors.occupancy ? 'true' : undefined}
                  aria-describedby={errors.occupancy ? 'add-occupancy-error' : undefined}
                  className='space-y-2 md:space-y-3'
                >
                  {occupancies.map((occ) => (
                    <label
                      key={occ}
                      className={`flex items-center p-2.5 md:p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.occupancy === occ
                          ? 'border-brand bg-white'
                          : 'border-gray-300 bg-white hover:border-brand/60'
                      }`}
                    >
                      <input
                        type='radio'
                        name='occupancy'
                        value={occ}
                        checked={formData.occupancy === occ}
                        onChange={(e) => updateFormData({ occupancy: e.target.value })}
                        className='w-4 h-4 text-brand bg-white'
                      />
                      <span className={`ml-3 font-medium text-sm md:text-base ${
                        formData.occupancy === occ ? 'text-black' : 'text-gray-800'
                      }`}>{tv('occupancy', occ)}</span>
                    </label>
                  ))}
                </div>
                {errors.occupancy && <p id='add-occupancy-error' role='alert' className='ui-error'>{errors.occupancy}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Pricing */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-bold'>2</span>
              {t('addProperty.sections.pricingDetails')}
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Rent Amount */}
              <div>
                <label htmlFor='add-rentAmount' className='ui-label text-[15px]'>
                  {t('addProperty.fields.rentAmount')} {formData.is_rent_negotiable ? '' : '*'}
                </label>
                <div className='relative'>
                  <span className='absolute left-3 md:left-4 top-2.5 md:top-3 text-lg md:text-xl font-semibold text-gray-600'>
                    ৳
                  </span>
                  <input
                    id='add-rentAmount'
                    type='number'
                    inputMode='numeric'
                    aria-invalid={errors.rent_amount_bdt ? 'true' : undefined}
                    aria-describedby={errors.rent_amount_bdt ? 'add-rentAmount-error' : undefined}
                    value={formData.rent_amount_bdt}
                    onChange={(e) => updateFormData({ rent_amount_bdt: parseInt(e.target.value) || '' })}
                    className={`ui-field pl-9 md:pl-10 ${
                      errors.rent_amount_bdt
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-brand'
                    }`}
                    placeholder={t('addProperty.placeholders.rentAmount')}
                    min='1'
                  />
                </div>
                {errors.rent_amount_bdt && <p id='add-rentAmount-error' role='alert' className='ui-error'>{errors.rent_amount_bdt}</p>}
              </div>

              <label className='flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={Boolean(formData.is_rent_negotiable)}
                  onChange={(e) => updateFormData({ is_rent_negotiable: e.target.checked })}
                  className='mt-1 h-4 w-4 text-brand bg-white'
                />
                <span>
                  <span className='block text-sm md:text-base font-semibold text-black'>{t('addProperty.fields.rentNegotiable')}</span>
                  <span className='block text-xs md:text-sm text-gray-600'>{t('addProperty.fields.rentNegotiableHint')}</span>
                </span>
              </label>

              {/* Rent Period */}
              <div>
                <p id='add-rentPeriod-label' className='ui-label text-[15px]'>
                  {t('addProperty.fields.rentalPeriod')}
                </p>
                <div
                  role='group'
                  aria-labelledby='add-rentPeriod-label'
                  aria-invalid={errors.rent_period ? 'true' : undefined}
                  aria-describedby={errors.rent_period ? 'add-rentPeriod-error' : undefined}
                  className='grid grid-cols-3 gap-2 md:gap-3'
                >
                  {rentPeriods.map((period) => (
                    <button
                      key={period}
                      type='button'
                      aria-pressed={formData.rent_period === period}
                      onClick={() => updateFormData({ rent_period: period })}
                      className={`p-3 md:p-4 rounded-lg border-2 transition-all font-semibold text-center ${
                        formData.rent_period === period
                          ? 'border-brand bg-brand/10 text-black'
                          : 'border-gray-300 bg-white text-black hover:border-brand/40'
                      }`}
                    >
                      <span className='text-xl md:text-2xl'>
                        {period === 'Daily' && '📅'}
                        {period === 'Weekly' && '📆'}
                        {period === 'Monthly' && '📊'}
                        {period === 'Yearly' && '📈'}
                      </span>
                      <br />
                      <span className='text-xs md:text-sm text-black'>{tv('rentPeriods', period)}</span>
                    </button>
                  ))}
                </div>
                {errors.rent_period && <p id='add-rentPeriod-error' role='alert' className='ui-error'>{errors.rent_period}</p>}
              </div>

              {(formData.rent_amount_bdt || formData.is_rent_negotiable) && formData.rent_period && (
                <div className='bg-green-50 border border-green-200 rounded-lg p-3 md:p-4'>
                  <p className='text-sm md:text-base text-green-800'>
                    <strong>{t('addProperty.pricing.price')}</strong>{' '}
                    <RentDisplay
                      pricing={{
                        rent_amount_bdt: formData.rent_amount_bdt,
                        is_rent_negotiable: formData.is_rent_negotiable,
                      }}
                      prefix='৳ '
                      suffix={!formData.is_rent_negotiable || formData.rent_amount_bdt ? t('addProperty.pricing.perPeriod', { period: tv('rentPeriods', formData.rent_period).toLowerCase() }) : ''}
                    />
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Location */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-bold'>3</span>
              {t('addProperty.sections.locationDetails')}
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Division Dropdown */}
              <div>
                <label htmlFor='add-division' className='ui-label text-[15px]'>{t('addProperty.fields.division')}</label>
                <select
                  id='add-division'
                  value={selectedDivision}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  className={`ui-field ${
                    errors.state_district && !selectedDivision
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-2 focus:ring-brand'
                  }`}
                >
                  <option value=''>{t('addProperty.placeholders.selectDivision')}</option>
                  {locationData.divisions.map((division) => (
                    <option key={division.id} value={division.name} className='text-black'>{tv('divisions', division.name)}</option>
                  ))}
                </select>
              </div>

              {/* District Dropdown */}
              {selectedDivision && (
                <div className='animate-fade-in-up'>
                  <label htmlFor='add-district' className='ui-label text-[15px]'>{t('addProperty.fields.district')}</label>
                  <select
                  id='add-district'
                    value={selectedDistrict}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className={`ui-field ${
                      errors.state_district && !selectedDistrict
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-brand'
                    }`}
                  >
                    <option value=''>{t('addProperty.placeholders.selectDistrict')}</option>
                    {availableDistricts.map((district) => (
                      <option key={district} value={district} className='text-black'>{district}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upazilla Dropdown */}
              {selectedDistrict && (
                <div className='animate-fade-in-up'>
                  <label htmlFor='add-upazilla' className='ui-label text-[15px]'>{t('addProperty.fields.upazilla')}</label>
                  <select
                  id='add-upazilla'
                    value={selectedUpazilla}
                    onChange={(e) => handleUpazillaChange(e.target.value)}
                    className={`ui-field ${
                      errors.area && !selectedUpazilla
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-brand'
                    }`}
                  >
                    <option value=''>{t('addProperty.placeholders.selectUpazilla')}</option>
                    {availableUpazillas.map((upazilla) => (
                      <option key={upazilla} value={upazilla} className='text-black'>{upazilla}</option>
                    ))}
                  </select>
                  {errors.area && <p className='ui-error'>{errors.area}</p>}
                </div>
              )}

              {/* Selected Location Display */}
              {selectedUpazilla && (
                <div className='bg-brand/5 border border-brand/30 rounded-lg p-3 md:p-4 animate-fade-in-up'>
                  <p className='text-sm md:text-base text-gray-700'>
                    <strong>{t('addProperty.location.selectedLocation')}</strong>{' '}
                    <span className='text-brand'>{selectedUpazilla}, {selectedDistrict}, {tv('divisions', selectedDivision)}</span>
                  </p>
                </div>
              )}

              {/* Sub Area Dropdown - Shows if upazilla has sub-areas */}
              {selectedUpazilla && getSubAreas(selectedUpazilla).length > 0 && (
                <div className='animate-fade-in-up'>
                  <label htmlFor='add-subArea' className='ui-label text-[15px]'>{t('addProperty.fields.subArea')}</label>
                  <select
                  id='add-subArea'
                    value={selectedSubArea}
                    onChange={(e) => handleSubAreaChange(e.target.value)}
                    className='ui-field'
                  >
                    <option value=''>{t('addProperty.placeholders.selectSubArea')}</option>
                    {getSubAreas(selectedUpazilla).map((subArea) => (
                      <option key={subArea} value={subArea} className='text-black'>
                        {subArea}
                      </option>
                    ))}
                  </select>
                  {selectedSubArea && (
                    <p className='text-green-600 text-xs md:text-sm mt-2 font-medium'>
                      {t('addProperty.location.subAreaSelected', { subArea: selectedSubArea })}
                    </p>
                  )}
                </div>
              )}

              {/* Contact Number */}
              <div>
                <label htmlFor='add-contactNumber' className='ui-label text-[15px]'>
                  {t('addProperty.fields.contactNumber')}
                </label>
                <div className='flex'>
                  <span className='flex items-center px-3 md:px-4 py-2.5 md:py-3 bg-gray-100 border-2 border-r-0 border-gray-300 rounded-l-lg font-semibold text-sm md:text-base text-gray-700'>
                    +88
                  </span>
                  <input
                    id='add-contactNumber'
                    type='tel'
                    inputMode='tel'
                    autoComplete='tel-national'
                    aria-invalid={errors.contact_number ? 'true' : undefined}
                    aria-describedby={errors.contact_number ? 'add-contactNumber-error' : undefined}
                    value={formData.contact_number.replace('+88', '')}
                    onChange={(e) => updateFormData({ contact_number: '+88' + e.target.value })}
                    className={`ui-field rounded-l-none border-l-0 ${
                      errors.contact_number
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-brand'
                    }`}
                    placeholder={t('addProperty.placeholders.enterYourNumber')}
                  />
                </div>
                {errors.contact_number && <p id='add-contactNumber-error' role='alert' className='ui-error'>{errors.contact_number}</p>}
              </div>

              {/* Short Description */}
              <div>
                <label htmlFor='add-shortDescription' className='ui-label text-[15px]'>
                  {t('addProperty.fields.shortDescription')}
                </label>
                <textarea
                  id='add-shortDescription'
                  aria-invalid={errors.short_description ? 'true' : undefined}
                  aria-describedby={errors.short_description ? 'add-shortDescription-error' : undefined}
                  value={formData.short_description}
                  onChange={(e) => updateFormData({ short_description: e.target.value })}
                  className={`ui-field resize-none ${
                    errors.short_description
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-2 focus:ring-brand'
                  }`}
                  rows='4'
                  placeholder={t('addProperty.placeholders.shortDescriptionBrief')}
                />
                {errors.short_description && <p id='add-shortDescription-error' role='alert' className='ui-error'>{errors.short_description}</p>}
                <p className='text-gray-500 text-xs mt-1'>{t('addProperty.fields.charCount', { count: formData.short_description.length, max: 500 })}</p>
              </div>

              {/* Set Location Button - REMOVED */}

              {/* Optional Details - REMOVED */}
            </div>
          </div>

          {/* Section 4: Facilities & Upload */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-bold'>4</span>
              {t('addProperty.sections.facilitiesUpload')}
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Facilities */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>{t('addProperty.sections.facilities')}</h3>
                <div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3'>
                  {amenitiesList.map((amenity) => (
                    <label
                      key={amenity}
                      className={`flex items-center p-2.5 md:p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.amenities.includes(amenity)
                          ? 'border-brand bg-white'
                          : 'border-gray-300 bg-white hover:border-brand/60'
                      }`}
                    >
                      <input
                        type='checkbox'
                        checked={formData.amenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className='w-4 h-4 md:w-5 md:h-5 text-brand rounded cursor-pointer bg-white'
                      />
                      <span className='ml-2 font-medium text-xs md:text-sm text-black'>{tv('amenities', amenity)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Availability Dates */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>{t('addProperty.sections.availability')}</h3>
                <div className='space-y-4'>
                  <div>
                    <label htmlFor='add-availableFrom' className='ui-label'>{t('addProperty.fields.availableFrom')}</label>
                    <input
                      id='add-availableFrom'
                      type='date'
                      aria-invalid={errors.available_from ? 'true' : undefined}
                      aria-describedby={errors.available_from ? 'add-availableFrom-error' : undefined}
                      value={formData.available_from}
                      onChange={(e) => updateFormData({ available_from: e.target.value })}
                      className={`ui-field ${
                        errors.available_from
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-brand'
                      }`}
                      style={{ colorScheme: 'light', color: 'black', backgroundColor: 'white' }}
                    />
                    {errors.available_from && <p id='add-availableFrom-error' role='alert' className='ui-error'>{errors.available_from}</p>}
                  </div>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-black mb-3 md:mb-4'>
                  {t('addProperty.sections.propertyPhotosRequired')}
                </h3>
                <ImageUploader
                  images={formData.images}
                  onImagesChange={handleImagesChange}
                  error={errors.images}
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div role='alert' className='p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg'>
              <p className='text-red-800 font-medium text-sm md:text-base mb-2'>{t('addProperty.alerts.validationErrors')}</p>
              <ul className='text-red-700 text-xs md:text-sm mt-2 space-y-1'>
                {submitError.split('\n').map((error, idx) => (error ? <li key={idx}>• {error.startsWith(fixErrorsHeading) ? error.slice(fixErrorsHeading.length) : error}</li> : null))}
              </ul>
            </div>
          )}

          {/* Submit Button */}
          <div className='sticky bottom-16 md:bottom-20 bg-white border border-gray-200 rounded-lg p-4 shadow-lg'>
            <button
              type='submit'
              disabled={isSubmitting}
              className='ui-btn ui-btn-primary ui-btn-lg w-full'
            >
              {isSubmitting ? t('addProperty.navigation.submitting') : t('addProperty.navigation.submitListing')}
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
