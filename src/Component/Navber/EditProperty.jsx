import React, { useState, useEffect, useId, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ImageUploader from '../../components/AddProperty/ImageUploader'
import LocationPicker from '../../components/AddProperty/LocationPicker'
import { getPropertyForEdit, updatePropertyWithImages } from '../../services/propertyService'
import { buildAdminEditPropertyHref } from '../../lib/routePaths'
import { getPropertyIdNumber } from '../../utils/propertyDisplaySerial'
import {
  validateScreen1Codes,
  validateScreen2Codes,
  validateScreen3Codes,
  localizeValidationErrors,
} from '../../utils/formValidation'
import { divisions, districts, areas, subAreas } from '../../utils/bangladeshLocations'
import RentDisplay from '../../components/RentDisplay'
import { useLanguage } from '../../i18n/useLanguage'

// Errors thrown while loading carry an i18n key so the message can be
// re-rendered in the active language without re-fetching the property.
const keyedError = (key, vars) => Object.assign(new Error(key), { i18n: { key, vars } })

const categories = [
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { id: 'office', label: 'Office', icon: '🏢' },
  { id: 'sublet', label: 'Sublet', icon: '🔑' },
  { id: 'bachelor', label: 'Bachelor', icon: '👨' },
  { id: 'hostel', label: 'Hostel', icon: '🏨' },
  { id: 'shop', label: 'Shop', icon: '🛍️' },
]

const EDIT_FIELD_LABEL_KEYS = {
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

const CounterInput = ({ label, value, onChange, error, optional = false, ariaKey = '' }) => {
  const { t } = useLanguage()
  const inputId = useId()
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
      <label htmlFor={inputId} className='ui-label'>
        {label} {!optional && '*'}
      </label>
      <div className='flex items-center overflow-hidden rounded-[var(--radius-input)] border border-[#cbd5e1] bg-white'>
        <button
          type='button'
          onClick={handleDecrement}
          aria-label={ariaKey ? t(`addProperty.aria.decrease${ariaKey}`) : undefined}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          −
        </button>
        <button
          type='button'
          onClick={handleIncrement}
          aria-label={ariaKey ? t(`addProperty.aria.increase${ariaKey}`) : undefined}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          +
        </button>
        <input
          id={inputId}
          type='text'
          inputMode='numeric'
          pattern='[0-9]*'
          value={value}
          onChange={handleChange}
          aria-invalid={error ? 'true' : undefined}
          className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
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
        aria-label={label}
        className='h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand'
      />
      <span className='text-sm md:text-base text-gray-700'>
        {checked ? t('common.yes') : t('common.no')}
      </span>
    </label>
    {error && <p className='text-red-500 text-xs mt-1'>{error}</p>}
  </div>
  )
}

const SizeInput = ({ label, value, onChange }) => {
  const { t } = useLanguage()
  const inputId = useId()
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
      <label htmlFor={inputId} className='ui-label'>
        {label}
      </label>
      <div className='flex items-center overflow-hidden rounded-[var(--radius-input)] border border-[#cbd5e1] bg-white'>
        <button
          type='button'
          onClick={handleDecrement}
          aria-label={t('addProperty.aria.decreaseRoomSize')}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          −
        </button>
        <button
          type='button'
          onClick={handleIncrement}
          aria-label={t('addProperty.aria.increaseRoomSize')}
          className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
          tabIndex={0}
        >
          +
        </button>
        <input
          id={inputId}
          type='text'
          inputMode='numeric'
          pattern='[0-9]*'
          value={value}
          onChange={handleChange}
          className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
          placeholder={t('common.optional')}
        />
      </div>
    </div>
  )
}

// `adminPanel` is passed only by the admin panel's listing editor, which embeds
// this form: { propertyId, canEdit, onSaved(mode), onClose(), renderActions(state) }.
// Without it this is the owner's edit page and behaves as it always has.
const EditPropertyForm = ({ adminPanel = null }) => {
  const { t, tv } = useLanguage()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const arrivalNotice = location.state?.notice || ''
  const propertyId = adminPanel ? adminPanel.propertyId || '' : searchParams.get('propertyId') || ''
  const isAdminEditRequest = Boolean(adminPanel)
  const adminCanEdit = adminPanel?.canEdit === true
  const returnTo = searchParams.get('returnTo') || '/my-properties'
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    category: '',
    property_type: 'Apartment',
    total_rooms: 0,
    living_rooms: 0,
    total_bathrooms: 0,
    balcony: 0,
    kitchen: 0,
    floor_level: '',
    occupancy: '',
    room_size_sqft: '',
    rent_amount_bdt: '',
    rent_period: '',
    is_rent_negotiable: false,
    state_district: '',
    area: '',
    sub_area: '',
    contact_number: '',
    whatsapp_enabled: false,
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
  // Sector, road and house are always open for admins, who review every field.
  const [showOptionalLocation, setShowOptionalLocation] = useState(isAdminEditRequest)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  // Amenities and image rows exactly as loaded. Saving diffs against this, and
  // the form cannot be submitted until it exists.
  const loadedRef = useRef(null)
  const [isLoaded, setIsLoaded] = useState(false)
  // Public ID shown at the top, plus what "Update & next" needs to find the
  // listing that follows this one in the pending queue.
  const [listingMeta, setListingMeta] = useState({ idNumber: '', status: '', createdAt: '' })
  const [submitMode, setSubmitMode] = useState('update')

  // Location hierarchy states
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedUpazilla, setSelectedUpazilla] = useState('')
  const [selectedSubArea, setSelectedSubArea] = useState('')

  const findDistrictForArea = (areaName, divisionName = '') => {
    if (!areaName) {
      return ''
    }

    if (areas[areaName]?.length) {
      return areaName
    }

    if (divisionName) {
      const divisionDistricts = districts[divisionName] || []
      const matchingDistrict = divisionDistricts.find((district) =>
        areas[district]?.includes(areaName)
      )

      if (matchingDistrict) {
        return matchingDistrict
      }
    }

    return Object.keys(areas).find((district) => areas[district]?.includes(areaName)) || ''
  }

  // Load existing property data
  useEffect(() => {
    // A superseded run (id change, StrictMode re-run, unmount) must never write
    // state: its late result would overwrite edits made in the meantime.
    let cancelled = false

    const loadProperty = async () => {
      try {
        setLoading(true)
        setLoadError(null)
        setIsLoaded(false)
        loadedRef.current = null

        if (!propertyId) {
          throw keyedError('addProperty.edit.errors.missingId')
        }

        // Get user from localStorage
        const storedUser = localStorage.getItem('user')
        const isAuthenticatedUser = storedUser ? JSON.parse(storedUser) : null

        if (!isAuthenticatedUser) {
          throw keyedError('addProperty.edit.errors.loginRequired')
        }

        // Property, images and amenities arrive together in one request, so the
        // form is initialised exactly once from one consistent snapshot.
        let loaded
        try {
          loaded = await getPropertyForEdit(propertyId)
        } catch (fetchError) {
          throw keyedError('addProperty.edit.errors.notFoundWithReason', { reason: fetchError.message })
        }

        if (cancelled) {
          return
        }

        const { property, imageRows, amenities } = loaded

        const canAdminEdit = isAdminEditRequest && (isAuthenticatedUser.is_admin === true || adminCanEdit)

        // Verify ownership
        if (property.user_id !== isAuthenticatedUser.id && !canAdminEdit) {
          throw keyedError('addProperty.edit.errors.noPermission')
        }

        // Process the property data
        const processedProperty = {
          id: property.id,
          category: property.category,
          property_type: property.property_type,
          total_rooms: property.total_rooms || 0,
          living_rooms: property.living_rooms || 0,
          total_bathrooms: property.total_bathrooms,
          balcony: property.balcony,
          floor_level: property.floor_level,
          occupancy: property.occupancy,
          room_size_sqft: property.room_size_sqft || '',
          rent_amount_bdt: property.rent_amount_bdt,
          rent_period: property.rent_period,
          is_rent_negotiable: Boolean(property.is_rent_negotiable),
          state_district: property.state_district,
          area: property.area,
          sub_area: property.sub_area || '',
          contact_number: property.contact_number,
          whatsapp_enabled: property.whatsapp_enabled === true,
          short_description: property.short_description,
          sector: property.sector || '',
          road: property.road || '',
          house_plot: property.house_plot || '',
          lat: property.lat,
          lng: property.lng,
          available_from: property.available_from,
          deadline: property.deadline,
          images: imageRows.map(img => img.image_url),
          amenities: [...amenities],
          status: property.status,
        }

        // Set form data
        setFormData({
          category: processedProperty.category || '',
          property_type: processedProperty.property_type || 'Apartment',
          total_rooms: processedProperty.total_rooms || 0,
          living_rooms: processedProperty.living_rooms || 0,
          total_bathrooms: processedProperty.total_bathrooms || 0,
          balcony: processedProperty.balcony || 0,
          kitchen: property.total_kitchen || 0,
          floor_level: processedProperty.floor_level || '',
          occupancy: processedProperty.occupancy || '',
          room_size_sqft: processedProperty.room_size_sqft || '',
          rent_amount_bdt: processedProperty.rent_amount_bdt || '',
          rent_period: processedProperty.rent_period || '',
          is_rent_negotiable: Boolean(processedProperty.is_rent_negotiable),
          state_district: processedProperty.state_district || '',
          area: processedProperty.area || '',
          sub_area: processedProperty.sub_area || '',
          contact_number: processedProperty.contact_number || '',
          whatsapp_enabled: processedProperty.whatsapp_enabled === true,
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

        // Preserve legacy rows where state_district may hold either a division or a district.
        const matchedDivision = divisions.find(
          (division) =>
            processedProperty.state_district === division ||
            districts[division]?.includes(processedProperty.state_district)
        ) || ''

        const matchedDistrict =
          (matchedDivision && districts[matchedDivision]?.includes(processedProperty.state_district)
            ? processedProperty.state_district
            : '') ||
          findDistrictForArea(processedProperty.area, matchedDivision)

        if (matchedDivision) {
          setSelectedDivision(matchedDivision)
        }

        if (matchedDistrict) {
          setSelectedDistrict(matchedDistrict)
        }

        if (processedProperty.area && matchedDistrict && areas[matchedDistrict]?.includes(processedProperty.area)) {
          setSelectedUpazilla(processedProperty.area)
        }

        // Set sub-area if available
        if (processedProperty.sub_area) {
          setSelectedSubArea(processedProperty.sub_area)
        }

        setListingMeta({
          idNumber: getPropertyIdNumber(property),
          status: property.status || '',
          createdAt: property.created_at || '',
        })
        loadedRef.current = { amenities: [...amenities], imageRows }
        setIsLoaded(true)
      } catch (error) {
        if (cancelled) {
          return
        }
        console.error('Error loading property:', error)
        setLoadError(error.i18n || { message: error.message })
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProperty()

    return () => {
      cancelled = true
    }
  }, [isAdminEditRequest, adminCanEdit, propertyId])

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
    setSelectedSubArea('')
    updateFormData({ state_district: division, area: '', sub_area: '' })
  }

  const handleDistrictChange = (district) => {
    setSelectedDistrict(district)
    setSelectedUpazilla('')
    setSelectedSubArea('')
    updateFormData({ state_district: district, area: '', sub_area: '' })
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
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }))
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

  // mode: 'update' for everyone; the admin editor also uses 'approve' and
  // 'next' and decides what follows a successful save.
  const handleSubmit = async ({ mode = 'update' } = {}) => {
    // Never save a form whose amenities and images have not been loaded.
    if (!loadedRef.current) {
      return
    }

    setSubmitMode(mode)
    setSubmitError(null)
    setIsSubmitting(true)
    clearErrors()

    try {
      // Calculate total images (existing + new)
      const totalImageCount = existingImageUrls.length + formData.images.length

      // Validate all screens
      const errors1 = localizeValidationErrors(validateScreen1Codes(formData), t)
      const errors2 = localizeValidationErrors(validateScreen2Codes(formData), t)
      const errors3 = localizeValidationErrors(validateScreen3Codes(formData), t)

      // For screen 4, validate dates but NOT images (we do custom validation)
      const errors4 = {}
      if (!formData.available_from) {
        errors4.available_from = t('addProperty.validation.availableFromRequired')
      }
      if (!formData.deadline) {
        errors4.deadline = t('addProperty.validation.deadlineRequired')
      }
      if (formData.available_from && formData.deadline) {
        const availableDate = new Date(formData.available_from)
        const deadlineDate = new Date(formData.deadline)
        if (availableDate > deadlineDate) {
          errors4.deadline = t('addProperty.validation.deadlineBeforeAvailable')
        }
      }

      // Custom image validation - count both existing and new
      if (totalImageCount < 2) {
        errors4.images = t('addProperty.edit.imagesMinExisting')
      } else if (totalImageCount > 10) {
        errors4.images = t('addProperty.validation.imagesMax', { max: 10 })
      }

      // Admins can save an incomplete listing: no field is required for them.
      const allErrors = isAdminEditRequest ? {} : { ...errors1, ...errors2, ...errors3, ...errors4 }

      if (Object.keys(allErrors).length > 0) {
        setFormErrors(allErrors)
        const errorList = Object.entries(allErrors)
          .map(([field, message]) => `${EDIT_FIELD_LABEL_KEYS[field] ? t(EDIT_FIELD_LABEL_KEYS[field]) : field}: ${message}`)
          .join('\n')
        setSubmitError(`${t('addProperty.alerts.fixErrorsHeading')}\n${errorList}`)
        setIsSubmitting(false)
        requestAnimationFrame(() => {
          const target = document.querySelector('[aria-invalid="true"]') || document.querySelector('[class*="border-red-500"]')
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' })
            if (typeof target.focus === 'function') {
              target.focus({ preventScroll: true })
            }
          }
        })
        return
      }

      // Combine existing images with new uploads
      const allImages = [...existingImageUrls]

      // Update the property
      const result = await updatePropertyWithImages(
        propertyId,
        formData,
        newImageFiles,
        allImages,
        {
          allowAdminEdit: isAdminEditRequest,
          adminAccess: adminCanEdit,
          preserveStatus: isAdminEditRequest,
          loaded: loadedRef.current,
        }
      )

      // A failed save may still have stored the new uploads. Treat them as
      // existing images so a retry does not upload and insert them again.
      if (!result.success && result.savedImageUrls?.length) {
        setExistingImageUrls((prev) => [...prev, ...result.savedImageUrls])
        setNewImageFiles([])
        updateFormData({ images: [] })
      }

      if (result.success && adminPanel) {
        // The admin editor stays in the panel: it approves, moves to the next
        // pending listing or reloads this one.
        try {
          await adminPanel.onSaved?.(mode)
        } finally {
          setIsSubmitting(false)
        }
        return
      }

      if (result.success) {
        setSubmitSuccess(true)
        setTimeout(() => {
          navigate(returnTo, {
            state: {
              message: t('addProperty.edit.updatedMessage'),
            },
          })
        }, 2000)
      } else {
        setSubmitError(result.error || t('addProperty.edit.updateFailed'))
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Submission error:', error)
      setSubmitError(error.message || t('addProperty.alerts.unexpectedError'))
      setIsSubmitting(false)
    }
  }

  const fixErrorsHeading = t('addProperty.alerts.fixErrorsHeading')

  if (loading) {
    return (
      <div className={`${adminPanel ? 'py-16' : 'min-h-screen bg-gray-50'} flex items-center justify-center`} role='status' aria-label='Loading listing'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={`${adminPanel ? 'py-10' : 'min-h-screen bg-gray-50'} flex items-center justify-center p-4`}>
        <div className='bg-white rounded-lg shadow-md p-8 text-center max-w-md'>
          <div className='mb-4'>
            <svg className='w-16 h-16 mx-auto text-red-500' fill='currentColor' viewBox='0 0 20 20'>
              <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' clipRule='evenodd' />
            </svg>
          </div>
          <h2 className='text-xl font-bold text-gray-900 mb-2'>{t('addProperty.edit.errorTitle')}</h2>
          <p className='text-gray-600 mb-6'>
            {loadError.key ? t(loadError.key, loadError.vars) : (loadError.message || t('addProperty.edit.errors.loadFailed'))}
          </p>
          <button
            onClick={() => (adminPanel ? adminPanel.onClose?.() : navigate(returnTo))}
            className='px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700'
          >
            {isAdminEditRequest ? t('addProperty.edit.backToAdminProperties') : t('addProperty.edit.backToMyProperties')}
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
          <h2 className='text-2xl font-bold text-green-900 mb-2'>{t('addProperty.success.title')}</h2>
          <p className='text-green-700 mb-4'>
            {t('addProperty.edit.updated')}
          </p>
          <p className='text-sm text-gray-600'>
            {isAdminEditRequest ? t('addProperty.edit.redirectingAdmin') : t('addProperty.success.redirecting')}
          </p>
        </div>
      </div>
    )
  }

  const allImagesForDisplay = [...existingImageUrls, ...formData.images]

  // Admin editor only (admin screens are English-only): a stored area that is
  // not one of the dropdown options stays visible, and empty key fields are
  // pointed out without blocking the save.
  const storedAreaUnlisted = Boolean(adminPanel) && Boolean(formData.area) && !availableUpazillas.includes(formData.area)
  const storedFloorUnlisted = Boolean(adminPanel) && Boolean(formData.floor_level) && !floorLevels.includes(formData.floor_level)
  const adminWarnings = adminPanel
    ? [!formData.occupancy && 'Occupancy is empty', !formData.floor_level && 'Floor is empty', !formData.area && 'Area is empty'].filter(Boolean)
    : []

  return (
    <div className={adminPanel ? 'min-w-0' : 'min-h-screen bg-gray-50 py-4 md:py-8 px-3 sm:px-4 pb-24 md:pb-28'}>
      <div className={adminPanel ? '' : 'max-w-2xl mx-auto'}>
        {/* Header (the admin editor shows its own) */}
        <div className={adminPanel ? 'hidden' : 'mb-4 md:mb-8'}>
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
            {t('addProperty.edit.title')}
          </h1>
          <p className='text-sm md:text-base text-gray-600'>
            {t('addProperty.edit.subtitle')}
          </p>
          {listingMeta.idNumber && (
            <p className='mt-3'>
              <span className='ui-id-ticket' data-testid='edit-listing-id'>
                {t('listing.card.idLabel', { id: listingMeta.idNumber })}
              </span>
            </p>
          )}
          {arrivalNotice && (
            <p role='status' className='mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm md:text-base text-green-800'>
              {arrivalNotice}
            </p>
          )}
        </div>

        {/* Form Content */}
        <form noValidate={isAdminEditRequest} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className='space-y-4 md:space-y-6'>
          {/* Section 1: Property Details */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-bold'>1</span>
              {t('addProperty.sections.propertyDetails')}
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Category Selection */}
              <div>
                <span id='edit-category-label' className='ui-label text-[15px]'>
                  {t('addProperty.fields.selectCategory')}
                </span>
                <div role='group' aria-labelledby='edit-category-label' className='grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3'>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type='button'
                      aria-pressed={formData.category === cat.label}
                      onClick={() => updateFormData({ category: cat.label })}
                      className={`p-3 md:p-4 rounded-lg border-2 transition-all text-center ${
                        formData.category === cat.label
                          ? 'border-brand bg-brand/5'
                          : 'border-gray-300 bg-white hover:border-brand/40'
                      }`}
                    >
                      <div aria-hidden='true' className='text-2xl md:text-3xl mb-1 md:mb-2'>{cat.icon}</div>
                      <p className='font-medium text-xs md:text-sm'>{tv('categories', cat.label)}</p>
                    </button>
                  ))}
                </div>
                {errors.category && <p className='ui-error'>{errors.category}</p>}
              </div>

              {/* Property Type Selection */}
              <div>
                <label htmlFor='edit-propertyType' className='ui-label text-[15px]'>
                  {t('addProperty.fields.propertyType')}
                </label>
                <select id='edit-propertyType'
                  value={formData.property_type || ''}
                  onChange={(e) => updateFormData({ property_type: e.target.value })}
                  className='ui-field'
                >
                  <option value=''>{t('addProperty.placeholders.selectPropertyType')}</option>
                  {propertyTypes.map((type) => (
                    <option key={type} value={type}>
                      {tv('propertyTypes', type)}
                    </option>
                  ))}
                </select>
                {errors.property_type && <p className='ui-error'>{errors.property_type}</p>}
              </div>

              {/* Specifications Grid */}
              <div className='grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4'>
                <CounterInput
                  label={t('addProperty.fields.rooms')}
                  value={formData.total_rooms || 0}
                  onChange={(val) => updateFormData({ total_rooms: val })}
                  error={errors.total_rooms}
                  ariaKey='Rooms'
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
                  value={formData.total_bathrooms}
                  onChange={(val) => updateFormData({ total_bathrooms: val })}
                  error={errors.total_bathrooms}
                  ariaKey='Bathrooms'
                />
                <CounterInput
                  label={t('addProperty.fields.balcony')}
                  value={formData.balcony}
                  onChange={(val) => updateFormData({ balcony: val })}
                  error={errors.balcony}
                  ariaKey='Balconies'
                />
                <CounterInput
                  label={t('addProperty.fields.kitchen')}
                  value={formData.kitchen || 0}
                  onChange={(val) => updateFormData({ kitchen: val })}
                  error={errors.kitchen}
                  ariaKey='Kitchen'
                />
                <SizeInput
                  label={t('addProperty.fields.roomSize')}
                  value={formData.room_size_sqft}
                  onChange={(val) => updateFormData({ room_size_sqft: val })}
                />
              </div>

              {/* Floor Level */}
              <div>
                <label htmlFor='edit-floorLevel' className='ui-label text-[15px]'>
                  {t('addProperty.fields.floorLevel')}
                </label>
                <select id='edit-floorLevel'
                  value={formData.floor_level}
                  onChange={(e) => updateFormData({ floor_level: e.target.value })}
                  aria-invalid={errors.floor_level ? 'true' : undefined}
                  className={`w-full px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.floor_level
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-brand'
                  }`}
                >
                  <option value=''>{t('addProperty.placeholders.selectFloorLevel')}</option>
                  {storedFloorUnlisted && (
                    <option value={formData.floor_level}>{formData.floor_level} (not in list)</option>
                  )}
                  {floorLevels.map((level) => (
                    <option key={level} value={level}>{tv('floorLevels', level)}</option>
                  ))}
                </select>
                {errors.floor_level && <p className='ui-error'>{errors.floor_level}</p>}
              </div>

              {/* Occupancy Restrictions */}
              <div>
                <span id='edit-occupancy-label' className='ui-label text-[15px]'>
                  {t('addProperty.fields.occupancy')}
                </span>
                <div role='radiogroup' aria-labelledby='edit-occupancy-label' aria-invalid={errors.occupancy ? 'true' : undefined} className='space-y-2 md:space-y-3'>
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
                        className='w-4 h-4 text-brand'
                      />
                      <span className='ml-3 font-medium text-sm md:text-base text-gray-800'>{tv('occupancy', occ)}</span>
                    </label>
                  ))}
                </div>
                {errors.occupancy && <p className='ui-error'>{errors.occupancy}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Pricing */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-bold'>2</span>
              {t('addProperty.sections.pricingDetails')}
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Rent Amount */}
              <div>
                <label htmlFor='edit-rentAmount' className='ui-label text-[15px]'>
                  {t('addProperty.fields.rentAmount')} {formData.is_rent_negotiable ? '' : '*'}
                </label>
                <div className='relative'>
                  <span className='absolute left-3 md:left-4 top-2.5 md:top-3 text-lg md:text-xl font-semibold text-gray-600'>
                    ৳
                  </span>
                  <input id='edit-rentAmount'
                    type='number'
                    value={formData.rent_amount_bdt}
                    onChange={(e) => updateFormData({ rent_amount_bdt: parseInt(e.target.value) || '' })}
                    aria-invalid={errors.rent_amount_bdt ? 'true' : undefined}
                    className={`w-full pl-8 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                      errors.rent_amount_bdt
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-brand'
                    }`}
                    placeholder={t('addProperty.placeholders.rentAmount')}
                    min='1'
                  />
                </div>
                {errors.rent_amount_bdt && <p className='ui-error'>{errors.rent_amount_bdt}</p>}
              </div>

              <label className='flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={Boolean(formData.is_rent_negotiable)}
                  onChange={(e) => updateFormData({ is_rent_negotiable: e.target.checked })}
                  className='mt-1 h-4 w-4 text-brand bg-white'
                />
                <span>
                  <span className='block text-sm md:text-base font-semibold text-gray-800'>{t('addProperty.fields.rentNegotiable')}</span>
                  <span className='block text-xs md:text-sm text-gray-600'>{t('addProperty.fields.rentNegotiableHint')}</span>
                </span>
              </label>

              {/* Rent Period */}
              <div>
                <span id='edit-rentPeriod-label' className='ui-label text-[15px]'>
                  {t('addProperty.fields.rentalPeriod')}
                </span>
                <div role='group' aria-labelledby='edit-rentPeriod-label' className='grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3'>
                  {rentPeriods.map((period) => (
                    <button
                      key={period}
                      type='button'
                      aria-pressed={formData.rent_period === period}
                      onClick={() => updateFormData({ rent_period: period })}
                      className={`p-3 md:p-4 rounded-lg border-2 transition-all font-semibold text-center ${
                        formData.rent_period === period
                          ? 'border-brand bg-brand/5 text-brand-pressed'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-brand/40'
                      }`}
                    >
                      <span aria-hidden='true' className='text-xl md:text-2xl'>
                        {period === 'Daily' && '📅'}
                        {period === 'Weekly' && '📆'}
                        {period === 'Monthly' && '📊'}
                        {period === 'Yearly' && '📈'}
                      </span>
                      <br />
                      <span className='text-xs md:text-sm'>{tv('rentPeriods', period)}</span>
                    </button>
                  ))}
                </div>
                {errors.rent_period && <p className='ui-error'>{errors.rent_period}</p>}
              </div>

              {formData.is_rent_negotiable && !formData.rent_amount_bdt && formData.rent_period && (
                <div className='bg-green-50 border border-green-200 rounded-lg p-3 md:p-4'>
                  <p className='text-sm md:text-base text-green-800'>
                    <strong>{t('addProperty.pricing.price')}</strong>{' '}
                    <RentDisplay
                      pricing={{
                        rent_amount_bdt: formData.rent_amount_bdt,
                        is_rent_negotiable: formData.is_rent_negotiable,
                      }}
                      prefix='৳ '
                    />
                  </p>
                </div>
              )}

              {formData.rent_amount_bdt && formData.rent_period && (
                <div className='bg-green-50 border border-green-200 rounded-lg p-3 md:p-4'>
                  <p className='text-sm md:text-base text-green-800'>
                    <strong>{t('addProperty.pricing.price')}</strong>{' '}
                    <RentDisplay
                      pricing={{
                        rent_amount_bdt: formData.rent_amount_bdt,
                        is_rent_negotiable: formData.is_rent_negotiable,
                      }}
                      prefix='৳ '
                      suffix={t('addProperty.pricing.perPeriod', { period: tv('rentPeriods', formData.rent_period).toLowerCase() })}
                    />
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Location */}
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <h2 className='text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
              <span className='w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-bold'>3</span>
              {t('addProperty.sections.locationDetails')}
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {adminPanel && (formData.state_district || formData.area || formData.sub_area) && (
                <p className='ui-note text-sm' data-testid='stored-location'>
                  <strong>Stored location:</strong>{' '}
                  {[formData.state_district, formData.area, formData.sub_area].filter(Boolean).join(' › ')}
                  {storedAreaUnlisted ? ' — this area is not in the dropdown list. It is kept unless you choose another.' : ''}
                </p>
              )}

              {/* Division Dropdown */}
              <div>
                <label htmlFor='edit-division' className='ui-label text-[15px]'>
                  {t('addProperty.fields.division')}
                </label>
                <select id='edit-division'
                  value={selectedDivision}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all bg-white ${
                    errors.state_district && !selectedDivision
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-2 focus:ring-brand'
                  }`}
                >
                  <option value=''>{t('addProperty.placeholders.selectDivision')}</option>
                  {divisions.map((division) => (
                    <option key={division} value={division}>{tv('divisions', division)}</option>
                  ))}
                </select>
              </div>

              {/* District Dropdown */}
              {selectedDivision && (
                <div className='animate-fade-in-up'>
                  <label htmlFor='edit-district' className='ui-label text-[15px]'>
                    {t('addProperty.fields.district')}
                  </label>
                  <select id='edit-district'
                    value={selectedDistrict}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all bg-white ${
                      errors.state_district && !selectedDistrict
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-brand'
                    }`}
                  >
                    <option value=''>{t('addProperty.placeholders.selectDistrict')}</option>
                    {availableDistricts.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upazilla Dropdown */}
              {selectedDistrict && (
                <div className='animate-fade-in-up'>
                  <label htmlFor='edit-upazilla' className='ui-label text-[15px]'>
                    {t('addProperty.fields.upazilla')}
                  </label>
                  <select id='edit-upazilla'
                    value={selectedUpazilla || (storedAreaUnlisted ? formData.area : '')}
                    onChange={(e) => handleUpazillaChange(e.target.value)}
                    className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all bg-white ${
                      errors.area && !selectedUpazilla
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-brand'
                    }`}
                  >
                    <option value=''>{t('addProperty.placeholders.selectUpazilla')}</option>
                    {storedAreaUnlisted && (
                      <option value={formData.area}>{formData.area} (not in list)</option>
                    )}
                    {availableUpazillas.map((upazilla) => (
                      <option key={upazilla} value={upazilla}>{upazilla}</option>
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
              {selectedUpazilla && subAreas[selectedUpazilla] && subAreas[selectedUpazilla].length > 0 && (
                <div className='animate-fade-in-up'>
                  <label htmlFor='edit-subArea' className='ui-label text-[15px]'>
                    {t('addProperty.fields.subArea')}
                  </label>
                  <select id='edit-subArea'
                    value={selectedSubArea}
                    onChange={(e) => handleSubAreaChange(e.target.value)}
                    className='ui-field'
                  >
                    <option value=''>{t('addProperty.placeholders.selectSubArea')}</option>
                    {subAreas[selectedUpazilla]?.map((subArea) => (
                      <option key={subArea} value={subArea}>
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
                <label htmlFor='edit-contactNumber' className='ui-label text-[15px]'>
                  {t('addProperty.fields.contactNumber')}
                </label>
                <div className='flex'>
                  <span className='flex items-center px-3 md:px-4 py-2.5 md:py-3 bg-gray-100 border-2 border-r-0 border-gray-300 rounded-l-lg font-semibold text-sm md:text-base text-gray-700'>
                    +88
                  </span>
                  <input id='edit-contactNumber'
                    type='tel'
                    value={formData.contact_number.replace('+88', '')}
                    onChange={(e) => updateFormData({ contact_number: '+88' + e.target.value })}
                    aria-invalid={errors.contact_number ? 'true' : undefined}
                    className={`flex-1 px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-l-0 rounded-r-lg focus:outline-none transition-all ${
                      errors.contact_number
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-brand'
                    }`}
                    placeholder={t('addProperty.placeholders.enterYourNumber')}
                  />
                </div>
                {errors.contact_number && <p className='ui-error'>{errors.contact_number}</p>}
                <label htmlFor='edit-whatsapp' className='mt-3 flex min-h-11 items-center gap-2 text-sm text-ink'>
                  <input
                    id='edit-whatsapp'
                    type='checkbox'
                    checked={formData.whatsapp_enabled === true}
                    onChange={(e) => updateFormData({ whatsapp_enabled: e.target.checked })}
                    className='h-4 w-4 accent-brand'
                  />
                  {t('addProperty.fields.whatsappEnabled')}
                </label>
              </div>

              {/* Short Description */}
              <div>
                <label htmlFor='edit-shortDescription' className='ui-label text-[15px]'>
                  {t('addProperty.fields.shortDescription')}
                </label>
                <textarea id='edit-shortDescription'
                  value={formData.short_description}
                  onChange={(e) => updateFormData({ short_description: e.target.value })}
                  aria-invalid={errors.short_description ? 'true' : undefined}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all resize-none ${
                    errors.short_description
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-2 focus:ring-brand'
                  }`}
                  rows='4'
                  placeholder={t('addProperty.placeholders.shortDescriptionBrief')}
                />
                {errors.short_description && <p className='ui-error'>{errors.short_description}</p>}
                <p className='text-gray-500 text-xs mt-1'>{t('addProperty.fields.charCount', { count: formData.short_description.length, max: 500 })}</p>
              </div>

              {/* Set Location Button */}
              <div>
                <button
                  type='button'
                  onClick={() => setShowLocationPicker(true)}
                  className='w-full px-4 md:px-6 py-2.5 md:py-3 bg-brand text-white text-sm md:text-base font-semibold rounded-lg hover:bg-brand-hover transition-all flex items-center justify-center gap-2'
                >
                  <svg className='w-4 h-4 md:w-5 md:h-5' fill='currentColor' viewBox='0 0 20 20'>
                    <path fillRule='evenodd' d='M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z' clipRule='evenodd' />
                  </svg>
                  {t('addProperty.location.setOnMap')}
                </button>
                {formData.lat && formData.lng && (
                  <p className='text-green-600 text-xs md:text-sm mt-2 font-medium'>
                    {t('addProperty.location.locationSet', { lat: formData.lat.toFixed(4), lng: formData.lng.toFixed(4) })}
                  </p>
                )}
              </div>

              {/* Optional Details */}
              <div>
                <button
                  type='button'
                  onClick={() => setShowOptionalLocation(!showOptionalLocation)}
                  aria-expanded={showOptionalLocation}
                  aria-controls='edit-optional-details'
                  className='flex items-center gap-2 text-brand font-semibold hover:text-brand-hover'
                >
                  <svg aria-hidden='true' className={`w-5 h-5 transition-transform ${showOptionalLocation ? 'rotate-90' : ''}`} fill='currentColor' viewBox='0 0 20 20'>
                    <path fillRule='evenodd' d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z' clipRule='evenodd' />
                  </svg>
                  {t('addProperty.fields.optionalDetails')}
                </button>

                {showOptionalLocation && (
                  <div id='edit-optional-details' className='mt-4 space-y-4 p-4 bg-gray-50 rounded-lg'>
                    <div>
                      <label htmlFor='edit-sector' className='ui-label'>{t('addProperty.fields.sector')}</label>
                      <input id='edit-sector'
                        type='number'
                        value={formData.sector}
                        onChange={(e) => updateFormData({ sector: e.target.value })}
                        className='ui-field'
                        placeholder={t('addProperty.placeholders.sector')}
                        min='1'
                      />
                    </div>
                    <div>
                      <label htmlFor='edit-road' className='ui-label'>{t('addProperty.fields.road')}</label>
                      <input id='edit-road'
                        type='text'
                        value={formData.road}
                        onChange={(e) => updateFormData({ road: e.target.value })}
                        className='ui-field'
                        placeholder={t('addProperty.placeholders.road')}
                      />
                    </div>
                    <div>
                      <label htmlFor='edit-housePlot' className='ui-label'>{t('addProperty.fields.housePlot')}</label>
                      <input id='edit-housePlot'
                        type='text'
                        value={formData.house_plot}
                        onChange={(e) => updateFormData({ house_plot: e.target.value })}
                        className='ui-field'
                        placeholder={t('addProperty.placeholders.housePlot')}
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
              <span className='w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-bold'>4</span>
              {t(isAdminEditRequest ? 'addProperty.sections.facilitiesUpload' : 'addProperty.sections.amenitiesUpload')}
            </h2>

            <div className='space-y-4 md:space-y-5'>
              {/* Amenities */}
              <div>
                <h3 id='edit-amenities-label' className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>{t('addProperty.sections.amenities')}</h3>
                <div role='group' aria-labelledby='edit-amenities-label' className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3'>
                  {amenitiesList.map((amenity) => (
                    <label
                      key={amenity}
                      className='flex items-center p-2.5 md:p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-brand/60 hover:bg-brand/5 transition-all'
                    >
                      <input
                        type='checkbox'
                        value={amenity}
                        checked={formData.amenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className='w-4 h-4 md:w-5 md:h-5 text-brand rounded cursor-pointer'
                      />
                      <span className='ml-2 font-medium text-xs md:text-sm text-gray-800'>{tv('amenities', amenity)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Availability Dates */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>{t('addProperty.sections.availability')}</h3>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4'>
                  <div>
                    <label htmlFor='edit-availableFrom' className='ui-label'>{t('addProperty.fields.availableFrom')}</label>
                    <input id='edit-availableFrom'
                      type='date'
                      value={formData.available_from}
                      onChange={(e) => updateFormData({ available_from: e.target.value })}
                      aria-invalid={errors.available_from ? 'true' : undefined}
                      className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                        errors.available_from
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-brand'
                      }`}
                    />
                    {errors.available_from && <p className='ui-error'>{errors.available_from}</p>}
                  </div>
                  <div>
                    <label htmlFor='edit-deadline' className='ui-label'>{t('addProperty.fields.deadline')}</label>
                    <input id='edit-deadline'
                      type='date'
                      value={formData.deadline}
                      onChange={(e) => updateFormData({ deadline: e.target.value })}
                      aria-invalid={errors.deadline ? 'true' : undefined}
                      className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                        errors.deadline
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-brand'
                      }`}
                    />
                    {errors.deadline && <p className='ui-error'>{errors.deadline}</p>}
                  </div>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <h3 className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>
                  {t(isAdminEditRequest ? 'addProperty.sections.propertyPhotos' : 'addProperty.sections.propertyPhotosRequired')}
                </h3>
                <ImageUploader
                  images={formData.images}
                  onImagesChange={handleImagesChange}
                  error={errors.images}
                  existingImages={existingImageUrls}
                />
                {errors.images && <p className='ui-error'>{errors.images}</p>}
              </div>

              {/* Summary */}
              <div className='bg-gradient-to-r from-brand/5 to-brand/10 border border-brand/30 rounded-lg p-4 md:p-6'>
                <h4 className='font-bold text-gray-800 text-base md:text-lg mb-3'>{t('addProperty.edit.summaryTitle')}</h4>
                <div className='space-y-1.5 md:space-y-2 text-xs md:text-sm text-gray-700'>
                  <p><strong>{t('addProperty.summary.category')}</strong> {formData.category ? tv('categories', formData.category) : '-'}</p>
                  <p>
                    <strong>{t('addProperty.summary.price')}</strong>{' '}
                    {formData.rent_amount_bdt || formData.is_rent_negotiable ? (
                      <RentDisplay
                        pricing={{
                          rent_amount_bdt: formData.rent_amount_bdt,
                          is_rent_negotiable: formData.is_rent_negotiable,
                        }}
                        prefix='৳ '
                        suffix={formData.rent_amount_bdt ? t('addProperty.pricing.perPeriod', { period: tv('rentPeriods', formData.rent_period) }) : ''}
                      />
                    ) : '-'}
                  </p>
                  <p><strong>{t('addProperty.summary.negotiable')}</strong> {formData.is_rent_negotiable ? t('common.yes') : t('common.no')}</p>
                  <p><strong>{t('addProperty.summary.location')}</strong> {formData.area ? `${formData.area}, ${tv('divisions', formData.state_district)}` : '-'}</p>
                  <p><strong>{t('addProperty.summary.images')}</strong> {t('addProperty.edit.imagesTotal', { count: allImagesForDisplay.length })}</p>
                  <p><strong>{t('addProperty.summary.amenities')}</strong> {formData.amenities.length > 0 ? formData.amenities.map((amenity) => tv('amenities', amenity)).join(', ') : t('addProperty.amenities.noneSelected')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className='p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg'>
              <p className='text-red-800 font-medium text-sm md:text-base mb-2'>{t('addProperty.alerts.validationErrors')}</p>
              <ul className='text-red-700 text-xs md:text-sm mt-2 space-y-1'>
                {submitError.split('\n').map((error, idx) => (error ? <li key={idx}>• {error.startsWith(fixErrorsHeading) ? error.slice(fixErrorsHeading.length) : error}</li> : null))}
              </ul>
            </div>
          )}

          {/* Submit: the admin editor supplies its own action bar */}
          {adminPanel ? (
            adminPanel.renderActions({
              submit: (mode) => handleSubmit({ mode }),
              isSubmitting,
              isLoaded,
              submitMode,
              warnings: adminWarnings,
            })
          ) : (
            <div className='sticky bottom-16 md:bottom-20 bg-white border border-gray-200 rounded-lg p-4 shadow-lg'>
              <button
                type='submit'
                disabled={isSubmitting || !isLoaded}
                className='ui-btn ui-btn-primary ui-btn-lg w-full'
              >
                {isSubmitting ? t('addProperty.edit.updating') : t('addProperty.edit.updateListing')}
              </button>
            </div>
          )}
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

// Keyed by listing so that moving to another one ("Update & next") remounts the
// form: fresh state and a fresh load instead of leftovers from the last listing.
const EditProperty = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const propertyId = searchParams.get('propertyId') || ''
  // Old admin links (?admin=1) now open the editor inside the admin panel.
  const adminHref = searchParams.get('admin') === '1' && propertyId ? buildAdminEditPropertyHref(propertyId) : ''

  useEffect(() => {
    if (adminHref) {
      navigate(adminHref, { replace: true })
    }
  }, [adminHref, navigate])

  if (adminHref) {
    return null
  }

  return <EditPropertyForm key={propertyId} />
}

export { EditPropertyForm }

export default EditProperty
