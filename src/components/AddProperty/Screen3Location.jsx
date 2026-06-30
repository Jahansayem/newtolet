import React, { useEffect, useState } from 'react'
import { useAddProperty } from '../../contexts/AddPropertyContext'
import LocationPicker from './LocationPicker'
import { FiMapPin, FiExternalLink } from 'react-icons/fi'

const Screen3Location = () => {
  const { formData, updateFormData, errors, clearErrors } =
    useAddProperty()

  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [showOptional, setShowOptional] = useState(false)

  const handleLocationSelect = (lat, lng) => {
    updateFormData({ lat, lng })
    setShowLocationPicker(false)
  }

  useEffect(() => {
    clearErrors()
  }, [clearErrors])

  return (
    <div className='space-y-4 md:space-y-6 pb-20 md:pb-24'>
      <div className='bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 md:p-6'>
        <h2 className='text-xl md:text-2xl font-bold text-gray-800 mb-2'>
          Property Location
        </h2>
        <p className='text-sm md:text-base text-gray-600'>Help tenants find your property easily.</p>
      </div>

      {/* State/District */}
      <div>
        <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
          State / District *
        </label>
        <input
          type='text'
          value={formData.state_district}
          onChange={(e) => updateFormData({ state_district: e.target.value })}
          className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
            errors.state_district
              ? 'border-red-500 focus:ring-2 focus:ring-red-500'
              : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
          }`}
          placeholder='e.g., Dhaka, Mumbai, New York'
        />
        {errors.state_district && (
          <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.state_district}</p>
        )}
      </div>

      {/* Area */}
      <div>
        <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
          Area *
        </label>
        <input
          type='text'
          value={formData.area}
          onChange={(e) => updateFormData({ area: e.target.value })}
          className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
            errors.area
              ? 'border-red-500 focus:ring-2 focus:ring-red-500'
              : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
          }`}
          placeholder='e.g., Uttara, Kafrul, Chinatown'
        />
        {errors.area && <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.area}</p>}
      </div>

      {/* Contact Number */}
      <div>
        <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
          Contact Number *
        </label>
        <div className='flex'>
          <span className='flex items-center px-3 md:px-4 py-2.5 md:py-3 bg-gray-100 border-2 border-r-0 border-gray-300 rounded-l-lg font-semibold text-sm md:text-base text-gray-700'>
            +880
          </span>
          <input
            type='tel'
            value={formData.contact_number.replace('+880', '')}
            onChange={(e) =>
              updateFormData({ contact_number: '+880' + e.target.value })
            }
            className={`flex-1 px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-l-0 rounded-r-lg focus:outline-none transition-all ${
              errors.contact_number
                ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
            }`}
            placeholder='1788888888'
          />
        </div>
        {errors.contact_number && (
          <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.contact_number}</p>
        )}
        <p className='text-gray-500 text-xs mt-1'>
          Format: +8801788888888 or 01788888888
        </p>
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
              : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
          }`}
          rows='4'
          placeholder='e.g., Fresh and clean house, newly renovated with modern amenities. Call me for further questions.'
        />
        {errors.short_description && (
          <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.short_description}</p>
        )}
        <p className='text-gray-500 text-xs mt-1'>
          {formData.short_description.length} / 500 characters
        </p>
      </div>

      {/* Set Location Button */}
      <div>
        <button
          type='button'
          onClick={() => setShowLocationPicker(true)}
          className='w-full px-4 md:px-6 py-2.5 md:py-3 bg-blue-600 text-white text-sm md:text-base font-semibold rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2'
        >
          <svg
            className='w-4 h-4 md:w-5 md:h-5'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path
              fillRule='evenodd'
              d='M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z'
              clipRule='evenodd'
            />
          </svg>
          {formData.lat && formData.lng ? 'UPDATE LOCATION ON MAP' : 'SET LOCATION ON MAP'}
        </button>
        {formData.lat && formData.lng && (
          <p className='text-green-600 text-xs md:text-sm mt-2 font-medium'>
            ✓ Location set: ({formData.lat.toFixed(4)}, {formData.lng.toFixed(4)})
          </p>
        )}
      </div>

      {/* Live Map Preview - Shows when coordinates are set */}
      {formData.lat && formData.lng && (
        <div className='bg-white border-2 border-blue-200 rounded-lg p-4'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-base md:text-lg font-semibold text-gray-800 flex items-center gap-2'>
              <FiMapPin className='text-blue-600' />
              Location Preview
            </h3>
            <a
              href={`https://www.google.com/maps?q=${formData.lat},${formData.lng}`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1'
            >
              Open in Google Maps
              <FiExternalLink size={14} />
            </a>
          </div>

          {/* OpenStreetMap iframe preview */}
          <div className='relative rounded-lg overflow-hidden border border-gray-200'>
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${formData.lng - 0.01}%2C${formData.lat - 0.01}%2C${formData.lng + 0.01}%2C${formData.lat + 0.01}&layer=mapnik&marker=${formData.lat}%2C${formData.lng}`}
              title='Property Location Preview'
              className='w-full h-48 md:h-64'
              style={{ border: 0 }}
              allowFullScreen
              loading='lazy'
              referrerPolicy='no-referrer-when-downgrade'
            />
          </div>

          {/* Location address summary */}
          {formData.state_district || formData.area ? (
            <div className='mt-3 p-3 bg-gray-50 rounded-lg'>
              <p className='text-sm text-gray-700'>
                <span className='font-medium'>Address:</span>{' '}
                {formData.area && <span className='text-blue-600'>{formData.area}</span>}
                {formData.area && formData.state_district && <span>, </span>}
                {formData.state_district && <span className='text-blue-600'>{formData.state_district}</span>}
              </p>
              {formData.sector && (
                <p className='text-xs text-gray-600 mt-1'>
                  Sector: {formData.sector}
                  {formData.road && `, Road: ${formData.road}`}
                  {formData.house_plot && `, House: ${formData.house_plot}`}
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Optional Details */}
      <div>
        <button
          type='button'
          onClick={() => setShowOptional(!showOptional)}
          className='flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700'
        >
          <svg
            className={`w-5 h-5 transition-transform ${
              showOptional ? 'rotate-90' : ''
            }`}
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path
              fillRule='evenodd'
              d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'
              clipRule='evenodd'
            />
          </svg>
          Optional Details
        </button>

        {showOptional && (
          <div className='mt-4 space-y-4 p-4 bg-gray-50 rounded-lg'>
            {/* Sector */}
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-1'>
                Sector
              </label>
              <input
                type='number'
                value={formData.sector}
                onChange={(e) => updateFormData({ sector: e.target.value })}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='e.g., 1, 2, 3'
                min='1'
              />
            </div>

            {/* Road */}
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-1'>
                Road
              </label>
              <input
                type='text'
                value={formData.road}
                onChange={(e) => updateFormData({ road: e.target.value })}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='e.g., Road 5'
              />
            </div>

            {/* House/Plot */}
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-1'>
                House / Plot Number
              </label>
              <input
                type='text'
                value={formData.house_plot}
                onChange={(e) => updateFormData({ house_plot: e.target.value })}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='e.g., House 28/9/A'
              />
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4'>
        <p className='text-xs md:text-sm text-blue-800'>
          💡 <strong>Tip:</strong> Provide a detailed location so tenants can
          easily find your property.
        </p>
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

export default Screen3Location
