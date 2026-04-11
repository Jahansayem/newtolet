import React, { useState, useEffect } from 'react'
import { validateImageFile } from '../../services/imageUploadService'

const IDVerification = ({
  idType = '',
  idFront = null,
  idBack = null,
  onIdTypeChange,
  onIdFrontChange,
  onIdBackChange,
  isVerified = false,
  error = null,
}) => {
  const [frontPreview, setFrontPreview] = useState(null)
  const [backPreview, setBackPreview] = useState(null)

  const idTypes = ['Passport', 'National ID', 'Driving License']

  useEffect(() => {
    if (idFront) {
      const reader = new FileReader()
      reader.onloadend = () => setFrontPreview(reader.result)
      reader.readAsDataURL(idFront)
    } else {
      setFrontPreview(null)
    }
  }, [idFront])

  useEffect(() => {
    if (idBack) {
      const reader = new FileReader()
      reader.onloadend = () => setBackPreview(reader.result)
      reader.readAsDataURL(idBack)
    } else {
      setBackPreview(null)
    }
  }, [idBack])

  const handleFileSelect = (file, side) => {
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.isValid) {
      alert(validation.error)
      return
    }

    if (side === 'front') {
      onIdFrontChange(file)
    } else {
      onIdBackChange(file)
    }
  }

  const handleDrop = (e, side) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0], side)
    }
  }

  if (isVerified) {
    return (
      <div className='bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center'>
        <svg
          className='w-16 h-16 mx-auto text-green-500 mb-3'
          fill='currentColor'
          viewBox='0 0 20 20'
        >
          <path
            fillRule='evenodd'
            d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
            clipRule='evenodd'
          />
        </svg>
        <h4 className='text-lg font-bold text-green-900 mb-2'>
          ✓ Already Verified
        </h4>
        <p className='text-green-700'>
          Your identity has been verified. You don't need to upload ID documents
          again.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4'>
        <p className='text-sm text-amber-800'>
          <strong>📋 ONE-TIME ID VERIFICATION</strong>
          <br />
          Upload clear copies of your ID for verification. This is a one-time
          requirement to build trust on the platform.
        </p>
      </div>

      {/* ID Type Selection */}
      <div>
        <label className='block text-sm font-semibold text-gray-800 mb-3'>
          ID Document Type *
        </label>
        <div className='grid grid-cols-3 gap-2'>
          {idTypes.map((type) => (
            <button
              key={type}
              type='button'
              onClick={() => onIdTypeChange(type)}
              className={`p-3 rounded-lg border-2 font-medium text-center transition-all ${
                idType === type
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
              }`}
            >
              {type === 'Passport' && '📕'}
              {type === 'National ID' && '🆔'}
              {type === 'Driving License' && '🚗'}
              <br />
              <span className='text-xs'>{type}</span>
            </button>
          ))}
        </div>
      </div>

      {idType && (
        <>
          {/* Front Side Upload */}
          <div>
            <label className='block text-sm font-semibold text-gray-800 mb-2'>
              {idType} - Front Side *
            </label>
            <div
              onDrop={(e) => handleDrop(e, 'front')}
              onDragOver={(e) => {
                e.preventDefault()
                e.currentTarget.classList.add(
                  'bg-blue-50',
                  'border-blue-500'
                )
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove(
                  'bg-blue-50',
                  'border-blue-500'
                )
              }}
              className='border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all'
            >
              <input
                type='file'
                accept='image/*'
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0], 'front')
                  }
                }}
                className='hidden'
                id='id-front-input'
              />
              <label htmlFor='id-front-input' className='cursor-pointer block'>
                {frontPreview ? (
                  <div className='space-y-2'>
                    <img
                      src={frontPreview}
                      alt='Front preview'
                      className='h-32 mx-auto rounded object-cover'
                    />
                    <p className='text-sm text-gray-600'>Click to change</p>
                  </div>
                ) : (
                  <div>
                    <svg
                      className='w-8 h-8 mx-auto mb-2 text-gray-400'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z' />
                    </svg>
                    <p className='text-sm font-medium text-gray-700'>
                      Select or drag {idType} front side
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Back Side Upload */}
          <div>
            <label className='block text-sm font-semibold text-gray-800 mb-2'>
              {idType} - Back Side *
            </label>
            <div
              onDrop={(e) => handleDrop(e, 'back')}
              onDragOver={(e) => {
                e.preventDefault()
                e.currentTarget.classList.add(
                  'bg-blue-50',
                  'border-blue-500'
                )
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove(
                  'bg-blue-50',
                  'border-blue-500'
                )
              }}
              className='border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all'
            >
              <input
                type='file'
                accept='image/*'
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0], 'back')
                  }
                }}
                className='hidden'
                id='id-back-input'
              />
              <label htmlFor='id-back-input' className='cursor-pointer block'>
                {backPreview ? (
                  <div className='space-y-2'>
                    <img
                      src={backPreview}
                      alt='Back preview'
                      className='h-32 mx-auto rounded object-cover'
                    />
                    <p className='text-sm text-gray-600'>Click to change</p>
                  </div>
                ) : (
                  <div>
                    <svg
                      className='w-8 h-8 mx-auto mb-2 text-gray-400'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z' />
                    </svg>
                    <p className='text-sm font-medium text-gray-700'>
                      Select or drag {idType} back side
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Completion Status */}
          {idFront && idBack && (
            <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
              <p className='text-green-800 font-medium'>
                ✓ Both sides uploaded successfully
              </p>
              <p className='text-green-700 text-sm mt-1'>
                Documents will be reviewed by admin. You'll be notified once
                verified.
              </p>
            </div>
          )}
        </>
      )}

      {error && <p className='text-red-500 text-sm'>{error}</p>}

      {/* Important Notes */}
      <div className='bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2'>
        <h4 className='font-semibold text-gray-800 mb-2'>📌 Important Notes:</h4>
        <ul className='text-sm text-gray-700 space-y-1'>
          <li>✓ Upload clear, readable images of your ID</li>
          <li>✓ Both front and back sides are required</li>
          <li>✓ Images will be kept confidential</li>
          <li>✓ One-time verification only</li>
          <li>✓ Admin will review within 24 hours</li>
        </ul>
      </div>
    </div>
  )
}

export default IDVerification
