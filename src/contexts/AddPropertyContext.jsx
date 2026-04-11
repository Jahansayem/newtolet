import React, { createContext, useState, useEffect, useCallback } from 'react'
import { DUMMY_PROPERTY_DATA } from '../utils/dummyData'

export const AddPropertyContext = createContext()

const INITIAL_STATE = {
  // Screen 1
  category: '',
  property_type: 'Apartment', // Default property type
  dining_rooms: 0,
  living_rooms: 0,
  total_bathrooms: 0,
  balcony: 0,
  kitchen: 0,
  floor_level: '',
  occupancy: '',
  room_size_sqft: '',

  // Screen 2
  rent_amount_bdt: '',
  rent_period: '',

  // Screen 3
  state_district: '',
  area: '',
  sub_area: '',
  contact_number: '',
  short_description: '',
  sector: '',
  road: '',
  house_plot: '',
  lat: null,
  lng: null,

  // Screen 4
  amenities: [],
  available_from: '',
  deadline: '',
  images: [],
  id_type: '',
  id_front: null,
  id_back: null,
}

const STORAGE_KEY = 'addPropertyFormDraft'

export const AddPropertyProvider = ({ children }) => {
  const [formData, setFormData] = useState(INITIAL_STATE)
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY)
      if (savedData) {
        const parsed = JSON.parse(savedData)
        console.log('📦 Loaded from localStorage:', parsed)
        setFormData(parsed)
      } else if (process.env.NEXT_PUBLIC_ENABLE_DUMMY_DATA === 'true') {
        // Load dummy data for testing if no saved draft exists
        console.log('🧪 Loading dummy data for testing')
        setFormData(DUMMY_PROPERTY_DATA)
      }
    } catch (error) {
      console.error('Failed to load draft:', error)
    }
  }, [])

  // Auto-save to localStorage whenever formData changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData))
    } catch (error) {
      console.error('Failed to save draft:', error)
    }
  }, [formData])

  const updateFormData = useCallback((updates) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }, [])

  const goToStep = useCallback((step) => {
    if (step >= 1 && step <= 4) {
      setCurrentStep(step)
      setErrors({})
    }
  }, [])

  const nextStep = useCallback(() => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1)
      setErrors({})
    }
  }, [currentStep])

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
      setErrors({})
    }
  }, [currentStep])

  const setFormErrors = useCallback((errorObj) => {
    setErrors(errorObj)
  }, [])

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  const resetForm = useCallback(() => {
    setFormData(INITIAL_STATE)
    setCurrentStep(1)
    setErrors({})
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = {
    formData,
    updateFormData,
    currentStep,
    goToStep,
    nextStep,
    prevStep,
    errors,
    setFormErrors,
    clearErrors,
    resetForm,
    isSubmitting,
    setIsSubmitting,
  }

  return (
    <AddPropertyContext.Provider value={value}>
      {children}
    </AddPropertyContext.Provider>
  )
}

export const useAddProperty = () => {
  const context = React.useContext(AddPropertyContext)
  if (!context) {
    throw new Error('useAddProperty must be used within AddPropertyProvider')
  }
  return context
}
