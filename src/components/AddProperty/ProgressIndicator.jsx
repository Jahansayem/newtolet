import React from 'react'
import { useAddProperty } from '../../contexts/AddPropertyContext'

const ProgressIndicator = () => {
  const { currentStep } = useAddProperty()

  const steps = [
    { number: 1, label: 'Property Details' },
    { number: 2, label: 'Pricing' },
    { number: 3, label: 'Location' },
    { number: 4, label: 'Upload' },
  ]

  return (
    <div className='mb-6 md:mb-8'>
      <div className='flex items-center justify-between'>
        {steps.map((step, index) => (
          <div key={step.number} className='flex-1 flex items-center'>
            {/* Step Circle */}
            <div className='flex flex-col items-center flex-1'>
              <div
                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-base font-semibold transition-all ${
                  step.number === currentStep
                    ? 'bg-blue-500 text-white md:scale-125'
                    : step.number < currentStep
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step.number < currentStep ? (
                  <svg
                    className='w-4 h-4 md:w-6 md:h-6'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path
                      fillRule='evenodd'
                      d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                      clipRule='evenodd'
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>

              {/* Label */}
              <p className='text-xs md:text-sm font-medium text-gray-700 text-center mt-2 max-w-[60px] sm:max-w-[80px] md:max-w-none leading-tight'>
                {step.label}
              </p>
            </div>

            {/* Connecting Line */}
            {index < steps.length - 1 && (
              <div className='h-1 flex-1 mx-1 md:mx-2 mb-6'>
                <div
                  className={`h-full transition-all ${
                    step.number < currentStep ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Step Counter */}
      <div className='text-center mt-3 md:mt-4 text-xs md:text-sm text-gray-600'>
        Step {currentStep} of 4
      </div>
    </div>
  )
}

export default ProgressIndicator
