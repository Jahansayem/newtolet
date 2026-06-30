import React, { useEffect } from 'react'
import { useAddProperty } from '../../contexts/AddPropertyContext'

const Screen1PropertyDetails = () => {
  const { formData, updateFormData, errors, clearErrors } =
    useAddProperty()

  const categories = [
    { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
    { id: 'office', label: 'Office', icon: '🏢' },
    { id: 'sublet', label: 'Sublet', icon: '🔑' },
    { id: 'bachelor', label: 'Bachelor', icon: '👨' },
    { id: 'hostel', label: 'Hostel', icon: '🏨' },
    { id: 'shop', label: 'Shop', icon: '🛍️' },
    { id: 'unit', label: 'Unit', icon: '🏠' },
  ]

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

  useEffect(() => {
    clearErrors()
  }, [clearErrors])

  return (
    <div className='space-y-4 md:space-y-6 pb-20 md:pb-24'>
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
              onClick={() => {
                updateFormData({ category: cat.label })
              }}
              className={`p-3 md:p-4 rounded-lg border-2 transition-all text-center ${
                formData.category === cat.label
                  ? 'border-[#1E73B8] bg-[#1E73B8] text-white shadow-md scale-105'
                  : 'border-gray-200 bg-white hover:border-[#1E73B8] hover:bg-[#1E73B8]/5'
              }`}
            >
              <div className='text-2xl md:text-3xl mb-1 md:mb-2'>{cat.icon}</div>
              <p className={`font-medium text-xs md:text-sm ${formData.category === cat.label ? 'text-white' : 'text-gray-700'}`}>{cat.label}</p>
            </button>
          ))}
        </div>
        {errors.category && (
          <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.category}</p>
        )}
      </div>

      {/* Property Type Selection */}
      <div>
        <label className='block text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4'>
          Property Type *
        </label>
        <select
          value={formData.property_type || 'Apartment'}
          onChange={(e) => updateFormData({ property_type: e.target.value })}
          className='w-full border border-gray-300 rounded-lg p-3 md:p-4 text-sm md:text-base focus:outline-none focus:border-[#1E73B8] focus:ring-2 focus:ring-[#1E73B8]/20 bg-white'
        >
          <option value=''>Select property type</option>
          {propertyTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {errors.property_type && (
          <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.property_type}</p>
        )}
      </div>

      {/* Specifications Grid */}
      <div className='grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4'>
        {/* Rooms */}
        <div>
          <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-1'>
            Rooms
          </label>
          <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = Math.max(0, (formData.dining_rooms || 0) - 1)
                updateFormData({ dining_rooms: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Decrease rooms'
              tabIndex={0}
            >
              −
            </button>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = (formData.dining_rooms || 0) + 1
                updateFormData({ dining_rooms: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Increase rooms'
              tabIndex={0}
            >
              +
            </button>
            <input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              value={formData.dining_rooms || 0}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                updateFormData({ dining_rooms: val === '' ? 0 : parseInt(val) })
              }}
              className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
            />
          </div>
        </div>

        {/* Drawing Room */}
        <div>
          <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-1'>
            Drawing Room
          </label>
          <label className='flex min-h-[42px] items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white cursor-pointer hover:bg-gray-50 transition-colors'>
            <input
              type='checkbox'
              checked={Number(formData.living_rooms || 0) > 0}
              onChange={(e) => {
                updateFormData({ living_rooms: e.target.checked ? 1 : 0 })
              }}
              className='h-4 w-4 rounded border-gray-300 text-[#1E73B8] focus:ring-[#1E73B8]'
            />
            <span className='text-sm md:text-base text-gray-700'>
              {Number(formData.living_rooms || 0) > 0 ? 'Yes' : 'No'}
            </span>
          </label>
          <div className='hidden'>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = Math.max(0, (formData.living_rooms || 0) - 1)
                updateFormData({ living_rooms: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Decrease drawing room'
              tabIndex={0}
            >
              −
            </button>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = (formData.living_rooms || 0) + 1
                updateFormData({ living_rooms: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Increase drawing room'
              tabIndex={0}
            >
              +
            </button>
            <input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              value={formData.living_rooms || 0}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                updateFormData({ living_rooms: val === '' ? 0 : parseInt(val) })
              }}
              className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
            />
          </div>
        </div>

        {/* Bathrooms */}
        <div>
          <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-1'>
            Bathrooms *
          </label>
          <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = Math.max(0, formData.total_bathrooms - 1)
                updateFormData({ total_bathrooms: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Decrease bathrooms'
              tabIndex={0}
            >
              −
            </button>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = formData.total_bathrooms + 1
                updateFormData({ total_bathrooms: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Increase bathrooms'
              tabIndex={0}
            >
              +
            </button>
            <input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              value={formData.total_bathrooms}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                updateFormData({ total_bathrooms: val === '' ? 0 : parseInt(val) })
              }}
              className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
            />
          </div>
          {errors.total_bathrooms && (
            <p className='text-red-500 text-xs mt-1'>{errors.total_bathrooms}</p>
          )}
        </div>

        {/* Balcony */}
        <div>
          <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-1'>
            Balcony *
          </label>
          <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = Math.max(0, formData.balcony - 1)
                updateFormData({ balcony: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Decrease balconies'
              tabIndex={0}
            >
              −
            </button>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = formData.balcony + 1
                updateFormData({ balcony: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Increase balconies'
              tabIndex={0}
            >
              +
            </button>
            <input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              value={formData.balcony}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                updateFormData({ balcony: val === '' ? 0 : parseInt(val) })
              }}
              className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
            />
          </div>
          {errors.balcony && (
            <p className='text-red-500 text-xs mt-1'>{errors.balcony}</p>
          )}
        </div>

        {/* Kitchen */}
        <div>
          <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-1'>
            Kitchen *
          </label>
          <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = Math.max(0, (formData.kitchen || 0) - 1)
                updateFormData({ kitchen: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Decrease kitchen'
              tabIndex={0}
            >
              −
            </button>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const newValue = (formData.kitchen || 0) + 1
                updateFormData({ kitchen: newValue })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Increase kitchen'
              tabIndex={0}
            >
              +
            </button>
            <input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              value={formData.kitchen || 0}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                updateFormData({ kitchen: val === '' ? 0 : parseInt(val) })
              }}
              className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
            />
          </div>
          {errors.kitchen && (
            <p className='text-red-500 text-xs mt-1'>{errors.kitchen}</p>
          )}
        </div>

        {/* Room Size */}
        <div>
          <label className='block text-xs md:text-sm font-semibold text-gray-700 mb-1'>
            Room Size (sqft)
          </label>
          <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const currentValue = parseInt(formData.room_size_sqft) || 0
                const newValue = Math.max(0, currentValue - 50)
                updateFormData({ room_size_sqft: newValue.toString() })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Decrease room size'
              tabIndex={0}
            >
              −
            </button>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const currentValue = parseInt(formData.room_size_sqft) || 0
                const newValue = currentValue + 50
                updateFormData({ room_size_sqft: newValue.toString() })
              }}
              className='px-1.5 sm:px-2 lg:px-2.5 py-2 text-base lg:text-lg font-bold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-all flex-shrink-0 select-none border-r border-gray-300'
              aria-label='Increase room size'
              tabIndex={0}
            >
              +
            </button>
            <input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              value={formData.room_size_sqft}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                updateFormData({ room_size_sqft: val })
              }}
              className='flex-1 min-w-0 text-center py-2 text-sm md:text-base focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
              placeholder='Optional'
            />
          </div>
        </div>
      </div>

      {/* Floor Level */}
      <div>
        <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
          Floor Level *
        </label>
        <select
          value={formData.floor_level}
          onChange={(e) => updateFormData({ floor_level: e.target.value })}
          className={`w-full px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base border rounded-lg focus:outline-none focus:ring-2 bg-white ${
            errors.floor_level
              ? 'border-red-500 focus:ring-red-500/20'
              : 'border-gray-300 focus:border-[#1E73B8] focus:ring-[#1E73B8]/20'
          }`}
        >
          <option value=''>Select floor level</option>
          {floorLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        {errors.floor_level && (
          <p className='text-red-500 text-xs md:text-sm mt-1'>{errors.floor_level}</p>
        )}
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
                className='w-4 h-4 text-blue-600'
              />
              <span className='ml-3 font-medium text-sm md:text-base text-gray-800'>{occ}</span>
            </label>
          ))}
        </div>
        {errors.occupancy && (
          <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.occupancy}</p>
        )}
      </div>

      {/* Info Box */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4'>
        <p className='text-xs md:text-sm text-blue-800'>
          💡 <strong>Tip:</strong> Provide accurate property details to attract
          more interested tenants.
        </p>
      </div>
    </div>
  )
}

export default Screen1PropertyDetails
