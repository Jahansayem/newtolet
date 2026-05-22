import React, { useEffect } from 'react'
import { useAddProperty } from '../../contexts/AddPropertyContext'
import RentDisplay from '../RentDisplay'

const Screen2Pricing = () => {
  const { formData, updateFormData, errors, clearErrors } =
    useAddProperty()

  const rentPeriods = ['Daily', 'Weekly', 'Monthly', 'Yearly']

  useEffect(() => {
    clearErrors()
  }, [clearErrors])

  return (
    <div className='space-y-4 md:space-y-6 pb-20 md:pb-24'>
      <div className='bg-gradient-to-br from-blue-50 to-primary-50 rounded-lg p-4 md:p-6'>
        <h2 className='text-xl md:text-2xl font-bold text-gray-800 mb-2'>
          Set Your Rental Price
        </h2>
        <p className='text-sm md:text-base text-gray-600'>
          Help tenants understand your rental terms and pricing.
        </p>
      </div>

      {/* Rent Amount */}
      <div>
        <label className='block text-base md:text-lg font-semibold text-gray-800 mb-2'>
          Monthly Rent Amount (BDT) {formData.is_rent_negotiable ? '' : '*'}
        </label>
        <div className='relative'>
          <span className='absolute left-3 md:left-4 top-2.5 md:top-3 text-lg md:text-xl font-semibold text-gray-600'>
            ৳
          </span>
          <input
            type='number'
            value={formData.rent_amount_bdt}
            onChange={(e) =>
              updateFormData({ rent_amount_bdt: parseInt(e.target.value) || '' })
            }
            className={`w-full pl-8 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-all ${
              errors.rent_amount_bdt
                ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
            }`}
            placeholder='Enter rent amount'
            min='1'
          />
        </div>
        {errors.rent_amount_bdt && (
          <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.rent_amount_bdt}</p>
        )}
        {formData.rent_amount_bdt && (
          <p className='text-green-600 text-xs md:text-sm mt-2 font-medium'>
            <RentDisplay
              pricing={{
                rent_amount_bdt: formData.rent_amount_bdt,
                is_rent_negotiable: formData.is_rent_negotiable,
              }}
              prefix='৳ '
              suffix={`per ${formData.rent_period?.toLowerCase() || 'period'}`}
            />
          </p>
        )}
      </div>

      <label className='flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-pointer'>
        <input
          type='checkbox'
          checked={Boolean(formData.is_rent_negotiable)}
          onChange={(e) => updateFormData({ is_rent_negotiable: e.target.checked })}
          className='mt-1 h-4 w-4 text-blue-600 bg-white'
        />
        <span>
          <span className='block text-sm md:text-base font-semibold text-gray-800'>Rent is negotiable</span>
          <span className='block text-xs md:text-sm text-gray-600'>Tenants will see this listing as negotiable. You can leave the amount empty.</span>
        </span>
      </label>

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
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
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
        {errors.rent_period && (
          <p className='text-red-500 text-xs md:text-sm mt-2'>{errors.rent_period}</p>
        )}
      </div>

      {/* Price Examples */}
      {formData.is_rent_negotiable && !formData.rent_amount_bdt && formData.rent_period && (
        <div className='bg-green-50 border border-green-200 rounded-lg p-3 md:p-4'>
          <h3 className='font-semibold text-sm md:text-base text-green-900 mb-2 md:mb-3'>Price Summary</h3>
          <div className='space-y-1 md:space-y-2 text-green-800'>
            <p className='text-xs md:text-sm'>
              ðŸ“Œ <strong>Base Price:</strong>{' '}
              <RentDisplay
                pricing={{
                  rent_amount_bdt: formData.rent_amount_bdt,
                  is_rent_negotiable: formData.is_rent_negotiable,
                }}
                prefix='৳ '
              />
            </p>
            <p className='text-xs'>
              This price will be displayed to potential tenants.
            </p>
          </div>
        </div>
      )}
      {formData.rent_amount_bdt && formData.rent_period && (
        <div className='bg-green-50 border border-green-200 rounded-lg p-3 md:p-4'>
          <h3 className='font-semibold text-sm md:text-base text-green-900 mb-2 md:mb-3'>Price Summary</h3>
          <div className='space-y-1 md:space-y-2 text-green-800'>
            <p className='text-xs md:text-sm'>
              📌 <strong>Base Price:</strong>{' '}
              <RentDisplay
                pricing={{
                  rent_amount_bdt: formData.rent_amount_bdt,
                  is_rent_negotiable: formData.is_rent_negotiable,
                }}
                prefix='৳ '
                suffix={`per ${formData.rent_period.toLowerCase()}`}
              />
            </p>
            <p className='text-xs'>
              This price will be displayed to potential tenants.
            </p>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4'>
        <div className='text-xs md:text-sm text-blue-800 space-y-1.5 md:space-y-2'>
          <div>
            💡 <strong>Tip:</strong> Research similar properties in your area to
            set competitive pricing.
          </div>
          <div>📍 Higher prices in premium locations attract serious buyers.</div>
        </div>
      </div>

      {/* Info Box */}
      <div className='bg-amber-50 border border-amber-200 rounded-lg p-3 md:p-4'>
        <p className='text-xs md:text-sm text-amber-800'>
          ⚠️ <strong>Note:</strong> You can edit pricing details later in your
          property dashboard.
        </p>
      </div>
    </div>
  )
}

export default Screen2Pricing
