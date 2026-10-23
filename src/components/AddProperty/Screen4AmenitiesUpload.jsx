import React, { useCallback, useEffect } from 'react'
import { useAddProperty } from '../../contexts/AddPropertyContext'
import { validateScreen4Codes, localizeValidationErrors } from '../../utils/formValidation'
import ImageUploader from './ImageUploader'
import IDVerification from './IDVerification'
import RentDisplay from '../RentDisplay'
import { useLanguage } from '../../i18n/useLanguage'

const Screen4AmenitiesUpload = () => {
  const { t, tv } = useLanguage()
  const { formData, updateFormData, errors, setFormErrors, clearErrors } =
    useAddProperty()

  const amenitiesList = [
    'Lift',
    'Gas Connection',
    'LPG gas',
    'Generator',
    'CCTV',
    'WiFi',
    'AC',
    'Garage',
  ]

  const handleAmenityToggle = (amenity) => {
    const updatedAmenities = formData.amenities.includes(amenity)
      ? formData.amenities.filter((a) => a !== amenity)
      : [...formData.amenities, amenity]

    updateFormData({ amenities: updatedAmenities })
  }

  const handleImagesChange = (newImages) => {
    updateFormData({ images: newImages })
  }

  const handleNext = useCallback(() => {
    clearErrors()
    const screenErrors = localizeValidationErrors(validateScreen4Codes(formData), t)

    if (Object.keys(screenErrors).length === 0) {
      // This is the final screen, so we don't call nextStep()
      // Instead, we trigger submission in the main container
      // Return true to indicate validation passed
      return true
    } else {
      setFormErrors(screenErrors)
      return false
    }
  }, [clearErrors, formData, setFormErrors, t])

  useEffect(() => {
    clearErrors()
    // Expose handleNext to parent for form submission
    window.validateScreen4AndSubmit = handleNext

    return () => {
      if (window.validateScreen4AndSubmit === handleNext) {
        delete window.validateScreen4AndSubmit
      }
    }
  }, [clearErrors, handleNext])

  return (
    <div className='space-y-4 md:space-y-8 pb-20 md:pb-24'>
      <div className='bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 md:p-6'>
        <h2 className='text-xl md:text-2xl font-bold text-gray-800 mb-2'>
          {t('addProperty.sections.amenitiesUpload')}
        </h2>
        <p className='text-sm md:text-base text-gray-600'>
          {t('addProperty.sections.amenitiesUploadSubtitle')}
        </p>
      </div>

      {/* Amenities Section */}
      <div>
        <h3 className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>{t('addProperty.sections.amenities')}</h3>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3'>
          {amenitiesList.map((amenity) => (
            <label
              key={amenity}
              className='flex items-center p-2.5 md:p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all'
            >
              <input
                type='checkbox'
                checked={formData.amenities.includes(amenity)}
                onChange={() => handleAmenityToggle(amenity)}
                className='w-4 h-4 md:w-5 md:h-5 text-blue-600 rounded cursor-pointer'
              />
              <span className='ml-2 font-medium text-xs md:text-sm text-gray-800'>{tv('amenities', amenity)}</span>
            </label>
          ))}
        </div>
        {formData.amenities.length > 0 && (
          <div className='mt-2 md:mt-3 p-2.5 md:p-3 bg-blue-50 rounded-lg'>
            <p className='text-xs md:text-sm text-blue-800'>
              <strong>{t('addProperty.amenities.selected')}</strong> {formData.amenities.map((a) => tv('amenities', a)).join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Availability Dates */}
      <div>
        <h3 className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>{t('addProperty.sections.availability')}</h3>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4'>
          {/* Available From */}
          <div>
            <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-2'>
              {t('addProperty.fields.availableFrom')}
            </label>
            <input
              type='date'
              value={formData.available_from}
              onChange={(e) =>
                updateFormData({ available_from: e.target.value })
              }
              className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                errors.available_from
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
              }`}
            />
            {errors.available_from && (
              <p className='text-red-500 text-xs md:text-sm mt-1'>
                {errors.available_from}
              </p>
            )}
          </div>

          {/* Deadline */}
          <div>
            <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-2'>
              {t('addProperty.fields.deadline')}
            </label>
            <input
              type='date'
              value={formData.deadline}
              onChange={(e) => updateFormData({ deadline: e.target.value })}
              className={`w-full px-3 md:px-4 py-2 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
                errors.deadline
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
              }`}
            />
            {errors.deadline && (
              <p className='text-red-500 text-xs md:text-sm mt-1'>{errors.deadline}</p>
            )}
          </div>
        </div>
      </div>

      {/* Image Upload Section */}
      <div>
        <h3 className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>
          {t('addProperty.sections.propertyPhotos')}
        </h3>
        <ImageUploader
          images={formData.images}
          onImagesChange={handleImagesChange}
          error={errors.images}
        />
      </div>

      {/* ID Verification Section */}
      <div>
        <h3 className='text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>
          {t('addProperty.sections.identityVerification')}
        </h3>
        <IDVerification
          idType={formData.id_type}
          idFront={formData.id_front}
          idBack={formData.id_back}
          onIdTypeChange={(type) => updateFormData({ id_type: type })}
          onIdFrontChange={(file) => updateFormData({ id_front: file })}
          onIdBackChange={(file) => updateFormData({ id_back: file })}
          isVerified={false}
          error={errors.id_verification}
        />
      </div>

      {/* Summary */}
      <div className='bg-gradient-to-r from-blue-50 to-primary-50 border border-blue-200 rounded-lg p-4 md:p-6 space-y-2 md:space-y-3'>
        <h4 className='font-bold text-gray-800 text-base md:text-lg'>{t('addProperty.summary.title')}</h4>

        <div className='space-y-1.5 md:space-y-2 text-xs md:text-sm text-gray-700'>
          <p>
            <strong>{t('addProperty.summary.category')}</strong> {tv('categories', formData.category)}
          </p>
          <p>
            <strong>{t('addProperty.summary.propertyType')}</strong> {tv('propertyTypes', formData.property_type)}
          </p>
          <p>
            <strong>{t('addProperty.summary.price')}</strong>{' '}
            <RentDisplay
              pricing={{
                rent_amount_bdt: formData.rent_amount_bdt,
                is_rent_negotiable: formData.is_rent_negotiable,
              }}
              prefix='৳ '
              suffix={!formData.is_rent_negotiable || formData.rent_amount_bdt ? t('addProperty.pricing.perPeriod', { period: tv('rentPeriods', formData.rent_period) }) : ''}
            />
          </p>
          <p>
            <strong>{t('addProperty.summary.location')}</strong> {formData.area}, {formData.state_district}
          </p>
          <p>
            <strong>{t('addProperty.summary.images')}</strong> {t('addProperty.summary.imagesOutOf', { count: formData.images.length, max: 10 })}
          </p>
          <p>
            <strong>{t('addProperty.summary.amenities')}</strong>{' '}
            {formData.amenities.length > 0
              ? formData.amenities.map((a) => tv('amenities', a)).join(', ')
              : t('addProperty.amenities.noneSelected')}
          </p>
        </div>

        <div className='bg-amber-50 border border-amber-200 rounded p-2.5 md:p-3 mt-3 md:mt-4'>
          <p className='text-xs md:text-sm text-amber-800'>
            <strong>{t('addProperty.summary.costLabel')}</strong> {t('addProperty.summary.costPrefix')}{' '}
            <strong>{t('addProperty.summary.costCredits')}</strong> {t('addProperty.summary.costSuffix')}
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className='bg-green-50 border border-green-200 rounded-lg p-3 md:p-4'>
        <div className='text-xs md:text-sm text-green-800 space-y-1.5 md:space-y-2'>
          <div>
            {t('addProperty.summary.allFilled')}
          </div>
          <div>
            {t('addProperty.summary.clickSubmit')}
          </div>
          <div>
            {t('addProperty.summary.adminReview')}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Screen4AmenitiesUpload
