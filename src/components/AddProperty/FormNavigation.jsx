import React from 'react'
import { useAddProperty } from '../../contexts/AddPropertyContext'

const FormNavigation = ({ onSubmit, isLoading = false }) => {
  const { currentStep, prevStep, nextStep, isSubmitting } = useAddProperty()

  const isFirstStep = currentStep === 1
  const isLastStep = currentStep === 4
  const isProcessing = isSubmitting || isLoading

  return (
    <div className='fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 md:p-4 shadow-lg z-50'>
      <div className='max-w-2xl mx-auto flex gap-2 md:gap-3 justify-between'>
        {/* Back Button */}
        <button
          onClick={prevStep}
          disabled={isFirstStep || isProcessing}
          className={`px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base font-semibold transition-all ${
            isFirstStep || isProcessing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Back
        </button>

        {/* Next or Submit Button */}
        {isLastStep ? (
          <button
            onClick={onSubmit}
            disabled={isProcessing}
            className={`flex-1 px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base font-semibold transition-all flex items-center justify-center gap-2 ${
              isProcessing
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isProcessing ? (
              <>
                <svg className='animate-spin h-4 w-4 md:h-5 md:w-5' viewBox='0 0 24 24'>
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                    fill='none'
                  />
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  />
                </svg>
                <span className='hidden sm:inline'>Submitting...</span>
                <span className='sm:hidden'>Submit...</span>
              </>
            ) : (
              <>
                <span className='hidden sm:inline'>Submit Property</span>
                <span className='sm:hidden'>Submit</span>
                <svg className='w-4 h-4 md:w-5 md:h-5' fill='currentColor' viewBox='0 0 20 20'>
                  <path
                    fillRule='evenodd'
                    d='M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z'
                    clipRule='evenodd'
                  />
                </svg>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={isProcessing}
            className={`flex-1 px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base font-semibold transition-all flex items-center justify-center gap-2 ${
              isProcessing
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <span>Next</span>
            <svg className='w-4 h-4 md:w-5 md:h-5' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default FormNavigation
