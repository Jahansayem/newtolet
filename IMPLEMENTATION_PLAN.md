# Add Property Workflow - Comprehensive Implementation Plan

## Executive Summary

This plan details the complete implementation of a 4-screen multi-step property listing form with Supabase backend integration, Google Maps location picker, image upload, and ID verification system for the "বাসা ভাড়া" rental platform.

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Component Structure
```
src/
├── Component/
│   ├── Navber/
│   │   └── Addproperty.jsx (main container)
│   ├── AddProperty/
│   │   ├── FormContext.jsx (form state management)
│   │   ├── ProgressIndicator.jsx
│   │   ├── screens/
│   │   │   ├── Screen1PropertyDetails.jsx
│   │   │   ├── Screen2PricingTerms.jsx
│   │   │   ├── Screen3LocationDetails.jsx
│   │   │   └── Screen4AmenitiesUpload.jsx
│   │   ├── components/
│   │   │   ├── CategorySelector.jsx
│   │   │   ├── PropertyTypeSelector.jsx
│   │   │   ├── ImageUploader.jsx
│   │   │   ├── LocationPicker.jsx
│   │   │   ├── AmenitiesCheckboxes.jsx
│   │   │   ├── IDVerification.jsx
│   │   │   └── FormNavigation.jsx
│   │   └── utils/
│   │       ├── formValidation.js
│   │       └── imageCompression.js
│   └── Route/
│       └── PropertyProvider.jsx (extended context)
├── config/
│   └── supabaseClient.js
└── services/
    ├── propertyService.js
    ├── imageUploadService.js
    └── verificationService.js
```

### 1.2 Technology Stack
- **Frontend**: React 19.2 + React Router 7.10
- **Forms**: React Hook Form 7.67
- **Styling**: Tailwind CSS 4.1 + DaisyUI 5.5
- **State**: Context API (following existing Listprovaider.jsx pattern)
- **Backend**: Supabase (Postgres DB + Storage)
- **Maps**: Google Maps JavaScript API
- **Icons**: React Icons 5.5

---

## 2. SUPABASE SETUP

### 2.1 Environment Configuration

**Step 1: Create `.env` file** (root directory)
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**Step 2: Add `.env` to `.gitignore`**
```
.env
.env.local
```

### 2.2 Supabase Client Configuration

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\config\supabaseClient.js`
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 2.3 Database Schema

**Execute in Supabase SQL Editor:**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  phone TEXT,
  name TEXT,
  credits INTEGER DEFAULT 100,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Basic info
  category TEXT NOT NULL, -- Family, Office, Sublet, Bachelor, Hostel, Shop
  property_type TEXT NOT NULL, -- House, Unit, Room, Seat, Flat, Floor, Apartment
  
  -- Specifications
  total_rooms INTEGER,
  total_bathrooms INTEGER,
  balcony INTEGER,
  floor_level TEXT,
  occupancy TEXT, -- No Restriction, Only Family, Only Male, Only Female
  room_size_sqft INTEGER,
  
  -- Pricing
  rent_amount_bdt INTEGER NOT NULL,
  rent_period TEXT NOT NULL, -- Daily, Weekly, Monthly, Yearly
  
  -- Location
  state_district TEXT NOT NULL,
  area TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  short_description TEXT,
  sector TEXT,
  road TEXT,
  house_plot TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  
  -- Availability
  available_from DATE,
  deadline DATE,
  
  -- Status
  status TEXT DEFAULT 'active', -- active, inactive, rented
  views INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property images table
CREATE TABLE public.property_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_thumbnail BOOLEAN DEFAULT FALSE,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property amenities table
CREATE TABLE public.property_amenities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  amenity_type TEXT NOT NULL, -- Lift, Gas Connection, Generator, CCTV, WiFi, Garage, Security Alarm
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User verifications table (ONE-TIME)
CREATE TABLE public.user_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  id_type TEXT NOT NULL, -- Passport, NID, License
  front_image_url TEXT NOT NULL,
  back_image_url TEXT NOT NULL,
  verification_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  admin_notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id) -- Ensure one verification per user
);

-- Credit transactions table
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  credits_spent INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- property_upload, contact_view, photo_view
  reference_id UUID, -- property_id for context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_properties_user_id ON public.properties(user_id);
CREATE INDEX idx_properties_category ON public.properties(category);
CREATE INDEX idx_properties_area ON public.properties(area);
CREATE INDEX idx_property_images_property_id ON public.property_images(property_id);
CREATE INDEX idx_property_amenities_property_id ON public.property_amenities(property_id);
CREATE INDEX idx_user_verifications_user_id ON public.user_verifications(user_id);

-- Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own data
CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Properties: Anyone can read, only owner can insert/update/delete
CREATE POLICY "Anyone can view properties" ON public.properties FOR SELECT USING (true);
CREATE POLICY "Users can insert own properties" ON public.properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own properties" ON public.properties FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own properties" ON public.properties FOR DELETE USING (auth.uid() = user_id);

-- Property images: Anyone can view, only property owner can modify
CREATE POLICY "Anyone can view property images" ON public.property_images FOR SELECT USING (true);
CREATE POLICY "Property owner can insert images" ON public.property_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND user_id = auth.uid())
);

-- Property amenities: Anyone can view, only property owner can modify
CREATE POLICY "Anyone can view amenities" ON public.property_amenities FOR SELECT USING (true);
CREATE POLICY "Property owner can insert amenities" ON public.property_amenities FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND user_id = auth.uid())
);

-- User verifications: Users can only see/modify own verification
CREATE POLICY "Users can view own verification" ON public.user_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own verification" ON public.user_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Credit transactions: Users can only see own transactions
CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
```

### 2.4 Supabase Storage Buckets

**Create in Supabase Dashboard:**

1. **property-images** bucket
   - Public: Yes
   - File size limit: 5MB
   - Allowed MIME types: image/jpeg, image/png, image/webp

2. **id-documents** bucket
   - Public: No (admin only)
   - File size limit: 10MB
   - Allowed MIME types: image/jpeg, image/png, application/pdf

**Storage Policies (execute in SQL editor):**

```sql
-- Property images bucket: Anyone can read, authenticated users can upload
CREATE POLICY "Anyone can view property images" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
CREATE POLICY "Authenticated users can upload property images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'property-images' AND auth.role() = 'authenticated'
);

-- ID documents bucket: Only user can view own documents, only user can upload
CREATE POLICY "Users can view own ID documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'id-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can upload own ID documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'id-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 2.5 Required npm Packages

```bash
npm install @supabase/supabase-js browser-image-compression @react-google-maps/api
```

---

## 3. FORM STATE MANAGEMENT

### 3.1 Form Context Provider

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\FormContext.jsx`

**Purpose**: Centralized state management for multi-step form data

**Key Features**:
- Manages form data across all 4 screens
- Persists data in localStorage for recovery
- Provides validation state
- Tracks current step (1-4)
- Handles form submission to Supabase

**Structure**:
```javascript
import { createContext, useContext, useState, useEffect } from 'react'
import { submitProperty } from '../../services/propertyService'

const FormContext = createContext()

export const useFormContext = () => {
  const context = useContext(FormContext)
  if (!context) {
    throw new Error('useFormContext must be used within FormProvider')
  }
  return context
}

const initialFormData = {
  // Screen 1
  category: '',
  property_type: '',
  total_rooms: 0,
  total_bathrooms: 0,
  balcony: 0,
  floor_level: '',
  occupancy: '',
  room_size_sqft: null,
  
  // Screen 2
  rent_amount_bdt: 0,
  rent_period: '',
  
  // Screen 3
  state_district: '',
  area: '',
  contact_number: '',
  short_description: '',
  sector: '',
  road: '',
  house_plot: '',
  lat: null,
  lng: null,
  location_link: '',
  
  // Screen 4
  amenities: [],
  available_from: '',
  deadline: '',
  images: [], // Array of File objects
  imagePreviewUrls: [], // Array of URLs for preview
  id_front: null,
  id_back: null,
  id_type: ''
}

export const FormProvider = ({ children, onSubmitSuccess }) => {
  const [formData, setFormData] = useState(initialFormData)
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Load saved draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('propertyFormDraft')
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft)
        setFormData(prev => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error('Failed to load draft:', error)
      }
    }
  }, [])
  
  // Auto-save draft to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem('propertyFormDraft', JSON.stringify(formData))
    }, 1000) // Debounce 1 second
    
    return () => clearTimeout(timeoutId)
  }, [formData])
  
  const updateFormData = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }))
  }
  
  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1)
      window.scrollTo(0, 0)
    }
  }
  
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
      window.scrollTo(0, 0)
    }
  }
  
  const handleSubmit = async () => {
    setIsSubmitting(true)
    setErrors({})
    
    try {
      // Get current user ID from Supabase auth
      const userId = 'current-user-id' // TODO: Get from auth context
      
      const result = await submitProperty(formData, userId)
      
      // Clear draft from localStorage
      localStorage.removeItem('propertyFormDraft')
      
      // Reset form
      setFormData(initialFormData)
      setCurrentStep(1)
      
      if (onSubmitSuccess) {
        onSubmitSuccess(result.propertyId)
      }
      
    } catch (error) {
      console.error('Submission error:', error)
      setErrors({ submit: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const resetForm = () => {
    setFormData(initialFormData)
    setCurrentStep(1)
    setErrors({})
    localStorage.removeItem('propertyFormDraft')
  }
  
  const value = {
    formData,
    currentStep,
    errors,
    isSubmitting,
    updateFormData,
    nextStep,
    prevStep,
    handleSubmit,
    resetForm,
    setErrors
  }
  
  return (
    <FormContext.Provider value={value}>
      {children}
    </FormContext.Provider>
  )
}
```

---

## 4. SCREEN-BY-SCREEN IMPLEMENTATION

### 4.1 Screen 1 - Property Details

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\screens\Screen1PropertyDetails.jsx`

**Layout Structure**:
```
┌─────────────────────────────────────────┐
│   Step 1 of 4: Property Details        │
├─────────────────────────────────────────┤
│                                         │
│  Category Selection (Cards/Buttons)     │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
│  │Fam│ │Off│ │Sub│ │Bch│ │Hos│ │Shp│ │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ │
│                                         │
│  Property Type                          │
│  ├─ Dropdown/Grid selector              │
│                                         │
│  Specifications                         │
│  ├─ Total Rooms      [  3  ]           │
│  ├─ Bathrooms        [  2  ]           │
│  ├─ Balcony          [  1  ]           │
│                                         │
│  Floor Level                            │
│  ├─ Dropdown (Ground - 8th Floor)      │
│                                         │
│  Occupancy Restrictions                 │
│  ├─ Radio buttons/Dropdown              │
│                                         │
│  Room Size (Optional)                   │
│  ├─ [ 180 ] sq ft                      │
│                                         │
│         [Cancel]  [Next: Pricing →]    │
└─────────────────────────────────────────┘
```

**Component Implementation**:

```javascript
import React from 'react'
import { useFormContext } from '../FormContext'
import { validateScreen1 } from '../utils/formValidation'
import CategorySelector from '../components/CategorySelector'
import PropertyTypeSelector from '../components/PropertyTypeSelector'
import FormNavigation from '../components/FormNavigation'

const Screen1PropertyDetails = () => {
  const { formData, updateFormData, nextStep, setErrors, errors } = useFormContext()
  
  const categories = ['Family', 'Office', 'Sublet', 'Bachelor', 'Hostel', 'Shop']
  const propertyTypes = ['House', 'Unit', 'Room', 'Seat', 'Flat', 'Floor', 'Apartment']
  const floorLevels = [
    'Ground Level', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor',
    '5th Floor', '6th Floor', '7th Floor', '8th Floor'
  ]
  const occupancyOptions = ['No Restriction', 'Only Family', 'Only Male', 'Only Female']
  
  const handleNext = () => {
    const validationErrors = validateScreen1(formData)
    if (Object.keys(validationErrors).length === 0) {
      setErrors({})
      nextStep()
    } else {
      setErrors(validationErrors)
    }
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Step 1: Property Details</h2>
      
      {/* Category Selection */}
      <div>
        <label className="label">
          <span className="label-text font-semibold">Category *</span>
        </label>
        <CategorySelector
          categories={categories}
          selected={formData.category}
          onSelect={(category) => updateFormData({ category })}
        />
        {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
      </div>
      
      {/* Property Type */}
      <div>
        <label className="label">
          <span className="label-text font-semibold">Property Type *</span>
        </label>
        <PropertyTypeSelector
          types={propertyTypes}
          selected={formData.property_type}
          onSelect={(type) => updateFormData({ property_type: type })}
        />
        {errors.property_type && <p className="text-red-500 text-sm mt-1">{errors.property_type}</p>}
      </div>
      
      {/* Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Total Rooms *</span>
          </label>
          <input
            type="number"
            min="0"
            max="50"
            value={formData.total_rooms}
            onChange={(e) => updateFormData({ total_rooms: parseInt(e.target.value) || 0 })}
            className="input input-bordered"
          />
          {errors.total_rooms && <p className="text-red-500 text-sm mt-1">{errors.total_rooms}</p>}
        </div>
        
        <div className="form-control">
          <label className="label">
            <span className="label-text">Bathrooms *</span>
          </label>
          <input
            type="number"
            min="0"
            max="20"
            value={formData.total_bathrooms}
            onChange={(e) => updateFormData({ total_bathrooms: parseInt(e.target.value) || 0 })}
            className="input input-bordered"
          />
          {errors.total_bathrooms && <p className="text-red-500 text-sm mt-1">{errors.total_bathrooms}</p>}
        </div>
        
        <div className="form-control">
          <label className="label">
            <span className="label-text">Balcony *</span>
          </label>
          <input
            type="number"
            min="0"
            max="10"
            value={formData.balcony}
            onChange={(e) => updateFormData({ balcony: parseInt(e.target.value) || 0 })}
            className="input input-bordered"
          />
          {errors.balcony && <p className="text-red-500 text-sm mt-1">{errors.balcony}</p>}
        </div>
      </div>
      
      {/* Floor Level */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Floor Level *</span>
        </label>
        <select
          value={formData.floor_level}
          onChange={(e) => updateFormData({ floor_level: e.target.value })}
          className="select select-bordered"
        >
          <option value="">Select floor level</option>
          {floorLevels.map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
        {errors.floor_level && <p className="text-red-500 text-sm mt-1">{errors.floor_level}</p>}
      </div>
      
      {/* Occupancy */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Occupancy Restrictions *</span>
        </label>
        <select
          value={formData.occupancy}
          onChange={(e) => updateFormData({ occupancy: e.target.value })}
          className="select select-bordered"
        >
          <option value="">Select occupancy restriction</option>
          {occupancyOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        {errors.occupancy && <p className="text-red-500 text-sm mt-1">{errors.occupancy}</p>}
      </div>
      
      {/* Room Size (Optional) */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">Room Size (Optional)</span>
        </label>
        <div className="input-group">
          <input
            type="number"
            min="0"
            max="10000"
            value={formData.room_size_sqft || ''}
            onChange={(e) => updateFormData({ room_size_sqft: parseInt(e.target.value) || null })}
            placeholder="Enter size"
            className="input input-bordered flex-1"
          />
          <span className="bg-gray-200 px-4 flex items-center">sq ft</span>
        </div>
        {errors.room_size_sqft && <p className="text-red-500 text-sm mt-1">{errors.room_size_sqft}</p>}
      </div>
      
      <FormNavigation
        currentStep={1}
        onNext={handleNext}
        canProceed={true}
      />
    </div>
  )
}

export default Screen1PropertyDetails
```

**Component**: CategorySelector.jsx
```javascript
const CategorySelector = ({ categories, selected, onSelect }) => {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {categories.map(category => (
        <button
          key={category}
          type="button"
          onClick={() => onSelect(category)}
          className={`btn ${selected === category ? 'btn-primary' : 'btn-outline'}`}
        >
          {category}
        </button>
      ))}
    </div>
  )
}

export default CategorySelector
```

**Component**: PropertyTypeSelector.jsx
```javascript
const PropertyTypeSelector = ({ types, selected, onSelect }) => {
  return (
    <select
      value={selected}
      onChange={(e) => onSelect(e.target.value)}
      className="select select-bordered w-full"
    >
      <option value="">Select property type</option>
      {types.map(type => (
        <option key={type} value={type}>{type}</option>
      ))}
    </select>
  )
}

export default PropertyTypeSelector
```

**Validation Rules**:
- Category: Required
- Property Type: Required
- Total Rooms: Required, min 0, max 50
- Bathrooms: Required, min 0, max 20
- Balcony: Required, min 0, max 10
- Floor Level: Required
- Occupancy: Required
- Room Size: Optional, min 0, max 10000 if provided

---

### 4.2 Screen 2 - Pricing & Terms

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\screens\Screen2PricingTerms.jsx`

```javascript
import React from 'react'
import { useFormContext } from '../FormContext'
import { validateScreen2 } from '../utils/formValidation'
import FormNavigation from '../components/FormNavigation'

const Screen2PricingTerms = () => {
  const { formData, updateFormData, nextStep, prevStep, setErrors, errors } = useFormContext()
  
  const rentPeriods = ['Daily', 'Weekly', 'Monthly', 'Yearly']
  
  const handleNext = () => {
    const validationErrors = validateScreen2(formData)
    if (Object.keys(validationErrors).length === 0) {
      setErrors({})
      nextStep()
    } else {
      setErrors(validationErrors)
    }
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Step 2: Pricing & Terms</h2>
      
      {/* Rent Amount */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">Rent Amount (BDT) *</span>
        </label>
        <div className="input-group">
          <span className="bg-gray-200 px-4 flex items-center text-lg">৳</span>
          <input
            type="number"
            min="100"
            max="10000000"
            value={formData.rent_amount_bdt || ''}
            onChange={(e) => updateFormData({ rent_amount_bdt: parseInt(e.target.value) || 0 })}
            placeholder="Enter rent amount"
            className="input input-bordered flex-1"
          />
        </div>
        {errors.rent_amount_bdt && <p className="text-red-500 text-sm mt-1">{errors.rent_amount_bdt}</p>}
      </div>
      
      {/* Rent Period */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">Rent Period *</span>
        </label>
        <select
          value={formData.rent_period}
          onChange={(e) => updateFormData({ rent_period: e.target.value })}
          className="select select-bordered w-full"
        >
          <option value="">Select rent period</option>
          {rentPeriods.map(period => (
            <option key={period} value={period}>{period}</option>
          ))}
        </select>
        {errors.rent_period && <p className="text-red-500 text-sm mt-1">{errors.rent_period}</p>}
      </div>
      
      <FormNavigation
        currentStep={2}
        onBack={prevStep}
        onNext={handleNext}
        canProceed={true}
      />
    </div>
  )
}

export default Screen2PricingTerms
```

**Validation Rules**:
- Rent Amount: Required, min 100, max 10000000
- Rent Period: Required, one of allowed values

---

### 4.3 Screen 3 - Location Details

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\screens\Screen3LocationDetails.jsx`

```javascript
import React, { useState } from 'react'
import { useFormContext } from '../FormContext'
import { validateScreen3 } from '../utils/formValidation'
import FormNavigation from '../components/FormNavigation'
import LocationPicker from '../components/LocationPicker'

const Screen3LocationDetails = () => {
  const { formData, updateFormData, nextStep, prevStep, setErrors, errors } = useFormContext()
  const [showLocationModal, setShowLocationModal] = useState(false)
  
  const handleNext = () => {
    const validationErrors = validateScreen3(formData)
    if (Object.keys(validationErrors).length === 0) {
      setErrors({})
      nextStep()
    } else {
      setErrors(validationErrors)
    }
  }
  
  const handleLocationSelect = (lat, lng) => {
    updateFormData({
      lat,
      lng,
      location_link: `https://maps.google.com/?q=${lat},${lng}`
    })
    setShowLocationModal(false)
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Step 3: Location Details</h2>
      
      {/* State/District */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">State/District *</span>
        </label>
        <input
          type="text"
          value={formData.state_district}
          onChange={(e) => updateFormData({ state_district: e.target.value })}
          placeholder="e.g., Dhaka"
          className="input input-bordered"
        />
        {errors.state_district && <p className="text-red-500 text-sm mt-1">{errors.state_district}</p>}
      </div>
      
      {/* Area */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">Area *</span>
        </label>
        <input
          type="text"
          value={formData.area}
          onChange={(e) => updateFormData({ area: e.target.value })}
          placeholder="e.g., Uttara"
          className="input input-bordered"
        />
        {errors.area && <p className="text-red-500 text-sm mt-1">{errors.area}</p>}
      </div>
      
      {/* Contact Number */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">Contact Number *</span>
        </label>
        <input
          type="tel"
          value={formData.contact_number}
          onChange={(e) => updateFormData({ contact_number: e.target.value })}
          placeholder="+8801712345678"
          className="input input-bordered"
        />
        {errors.contact_number && <p className="text-red-500 text-sm mt-1">{errors.contact_number}</p>}
      </div>
      
      {/* Short Description */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">Short Description</span>
        </label>
        <textarea
          value={formData.short_description}
          onChange={(e) => updateFormData({ short_description: e.target.value })}
          placeholder="Describe your property..."
          className="textarea textarea-bordered h-24"
          maxLength="500"
        />
        <label className="label">
          <span className="label-text-alt">{formData.short_description?.length || 0}/500</span>
        </label>
        {errors.short_description && <p className="text-red-500 text-sm mt-1">{errors.short_description}</p>}
      </div>
      
      {/* Location Picker */}
      <div>
        <label className="label">
          <span className="label-text font-semibold">Set Location on Map</span>
        </label>
        <button
          type="button"
          onClick={() => setShowLocationModal(true)}
          className="btn btn-outline btn-primary"
        >
          📍 SET LOCATION
        </button>
        {formData.lat && formData.lng && (
          <p className="text-sm text-gray-600 mt-2">
            Selected: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
          </p>
        )}
      </div>
      
      {/* Optional Details */}
      <div className="divider">Optional Details</div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Sector</span>
          </label>
          <input
            type="text"
            value={formData.sector}
            onChange={(e) => updateFormData({ sector: e.target.value })}
            placeholder="e.g., Sector 7"
            className="input input-bordered"
          />
        </div>
        
        <div className="form-control">
          <label className="label">
            <span className="label-text">Road</span>
          </label>
          <input
            type="text"
            value={formData.road}
            onChange={(e) => updateFormData({ road: e.target.value })}
            placeholder="e.g., Road 5"
            className="input input-bordered"
          />
        </div>
        
        <div className="form-control">
          <label className="label">
            <span className="label-text">House/Plot</span>
          </label>
          <input
            type="text"
            value={formData.house_plot}
            onChange={(e) => updateFormData({ house_plot: e.target.value })}
            placeholder="e.g., House 12/B"
            className="input input-bordered"
          />
        </div>
      </div>
      
      {/* Location Modal */}
      {showLocationModal && (
        <LocationPicker
          onLocationSelect={handleLocationSelect}
          onClose={() => setShowLocationModal(false)}
          initialLat={formData.lat}
          initialLng={formData.lng}
        />
      )}
      
      <FormNavigation
        currentStep={3}
        onBack={prevStep}
        onNext={handleNext}
        canProceed={true}
      />
    </div>
  )
}

export default Screen3LocationDetails
```

**Component**: LocationPicker.jsx

```javascript
import React, { useState } from 'react'
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api'

const LocationPicker = ({ onLocationSelect, onClose, initialLat, initialLng }) => {
  const [selectedPosition, setSelectedPosition] = useState(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  )
  const [mapCenter] = useState({ lat: 23.8103, lng: 90.4125 }) // Dhaka default

  const handleMapClick = (event) => {
    const lat = event.latLng.lat()
    const lng = event.latLng.lng()
    setSelectedPosition({ lat, lng })
  }

  const handleConfirm = () => {
    if (selectedPosition) {
      onLocationSelect(selectedPosition.lat, selectedPosition.lng)
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-3xl">
        <h3 className="font-bold text-lg mb-4">Select Property Location</h3>
        <p className="text-sm text-gray-600 mb-4">Click on the map to set your property location</p>
        
        <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '400px' }}
            center={selectedPosition || mapCenter}
            zoom={13}
            onClick={handleMapClick}
          >
            {selectedPosition && <Marker position={selectedPosition} />}
          </GoogleMap>
        </LoadScript>
        
        {selectedPosition && (
          <p className="text-sm text-gray-600 mt-3">
            Selected: {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
          </p>
        )}
        
        <div className="modal-action">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedPosition}
            className="btn btn-primary"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  )
}

export default LocationPicker
```

**Validation Rules**:
- State/District: Required, max 100 chars
- Area: Required, max 100 chars
- Contact Number: Required, format validation (Bangladesh: +880...)
- Short Description: Optional, max 500 chars
- Sector, Road, House/Plot: Optional, max 50 chars each
- Lat/Lng: Optional but recommended

---

### 4.4 Screen 4 - Amenities & Upload

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\screens\Screen4AmenitiesUpload.jsx`

```javascript
import React, { useState, useEffect } from 'react'
import { useFormContext } from '../FormContext'
import { validateScreen4 } from '../utils/formValidation'
import { checkUserVerification } from '../../../services/propertyService'
import FormNavigation from '../components/FormNavigation'
import AmenitiesCheckboxes from '../components/AmenitiesCheckboxes'
import ImageUploader from '../components/ImageUploader'
import IDVerification from '../components/IDVerification'

const Screen4AmenitiesUpload = () => {
  const { formData, updateFormData, prevStep, handleSubmit, setErrors, errors, isSubmitting } = useFormContext()
  const [isUserVerified, setIsUserVerified] = useState(false)
  const [userCredits, setUserCredits] = useState(100) // TODO: Fetch from Supabase
  
  useEffect(() => {
    // Check if user is already verified
    const checkVerification = async () => {
      try {
        const userId = 'current-user-id' // TODO: Get from auth context
        const status = await checkUserVerification(userId)
        setIsUserVerified(status === 'approved')
      } catch (error) {
        console.error('Error checking verification:', error)
      }
    }
    checkVerification()
  }, [])
  
  const handleFinalSubmit = () => {
    const validationErrors = validateScreen4(formData, isUserVerified)
    if (Object.keys(validationErrors).length === 0) {
      setErrors({})
      handleSubmit()
    } else {
      setErrors(validationErrors)
    }
  }
  
  const amenitiesList = [
    'Lift',
    'Gas Connection',
    'Generator',
    'CCTV',
    'WiFi',
    'Garage',
    'Security Alarm'
  ]
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Step 4: Amenities & Images</h2>
      
      {/* Amenities */}
      <div>
        <label className="label">
          <span className="label-text font-semibold">Amenities</span>
        </label>
        <AmenitiesCheckboxes
          amenities={amenitiesList}
          selected={formData.amenities}
          onChange={(amenities) => updateFormData({ amenities })}
        />
      </div>
      
      {/* Availability Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Available From *</span>
          </label>
          <input
            type="date"
            value={formData.available_from}
            onChange={(e) => updateFormData({ available_from: e.target.value })}
            className="input input-bordered"
            min={new Date().toISOString().split('T')[0]}
          />
          {errors.available_from && <p className="text-red-500 text-sm mt-1">{errors.available_from}</p>}
        </div>
        
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Deadline *</span>
          </label>
          <input
            type="date"
            value={formData.deadline}
            onChange={(e) => updateFormData({ deadline: e.target.value })}
            className="input input-bordered"
            min={formData.available_from || new Date().toISOString().split('T')[0]}
          />
          {errors.deadline && <p className="text-red-500 text-sm mt-1">{errors.deadline}</p>}
        </div>
      </div>
      
      {/* Property Images */}
      <div>
        <label className="label">
          <span className="label-text font-semibold">Property Images (2-6 required) *</span>
        </label>
        <p className="text-sm text-gray-600 mb-3">First image will be used as thumbnail</p>
        <ImageUploader
          images={formData.images}
          onImagesChange={(images) => updateFormData({ images })}
          maxImages={6}
          minImages={2}
        />
        {errors.images && <p className="text-red-500 text-sm mt-1">{errors.images}</p>}
      </div>
      
      {/* ID Verification */}
      {!isUserVerified && (
        <div>
          <label className="label">
            <span className="label-text font-semibold">ID Verification (ONE-TIME) *</span>
          </label>
          <IDVerification
            idType={formData.id_type}
            frontImage={formData.id_front}
            backImage={formData.id_back}
            onIdTypeChange={(type) => updateFormData({ id_type: type })}
            onFrontImageChange={(file) => updateFormData({ id_front: file })}
            onBackImageChange={(file) => updateFormData({ id_back: file })}
            errors={errors}
          />
        </div>
      )}
      
      {isUserVerified && (
        <div className="alert alert-success">
          <span>✓ Your ID is already verified</span>
        </div>
      )}
      
      {/* Credit Info */}
      <div className="card bg-base-200">
        <div className="card-body">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Credit Cost:</p>
              <p className="text-2xl font-bold">20 credits</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">Your Balance:</p>
              <p className={`text-2xl font-bold ${userCredits >= 20 ? 'text-green-600' : 'text-red-600'}`}>
                {userCredits} credits
              </p>
            </div>
          </div>
          {userCredits < 20 && (
            <div className="alert alert-warning mt-2">
              <span>Insufficient credits. Please purchase credits to list your property.</span>
            </div>
          )}
        </div>
      </div>
      
      {errors.submit && (
        <div className="alert alert-error">
          <span>{errors.submit}</span>
        </div>
      )}
      
      <FormNavigation
        currentStep={4}
        onBack={prevStep}
        onSubmit={handleFinalSubmit}
        isSubmitting={isSubmitting}
        canProceed={userCredits >= 20}
      />
    </div>
  )
}

export default Screen4AmenitiesUpload
```

**Component**: AmenitiesCheckboxes.jsx

```javascript
const AmenitiesCheckboxes = ({ amenities, selected, onChange }) => {
  const handleToggle = (amenity) => {
    if (selected.includes(amenity)) {
      onChange(selected.filter(a => a !== amenity))
    } else {
      onChange([...selected, amenity])
    }
  }
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {amenities.map(amenity => (
        <label key={amenity} className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            checked={selected.includes(amenity)}
            onChange={() => handleToggle(amenity)}
            className="checkbox checkbox-primary"
          />
          <span className="label-text">{amenity}</span>
        </label>
      ))}
    </div>
  )
}

export default AmenitiesCheckboxes
```

**Component**: ImageUploader.jsx

```javascript
import React, { useState } from 'react'
import { compressImage, validateImageFile } from '../utils/imageCompression'

const ImageUploader = ({ images, onImagesChange, maxImages = 6, minImages = 2 }) => {
  const [previews, setPreviews] = useState([])
  const [isCompressing, setIsCompressing] = useState(false)

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files)
    
    if (images.length + files.length > maxImages) {
      alert(`Maximum ${maxImages} images allowed`)
      return
    }

    setIsCompressing(true)
    
    try {
      // Validate all files first
      for (const file of files) {
        validateImageFile(file)
      }
      
      // Compress images
      const compressedFiles = await Promise.all(
        files.map(file => compressImage(file))
      )

      onImagesChange([...images, ...compressedFiles])
      
      // Generate preview URLs
      const newPreviews = compressedFiles.map(file => URL.createObjectURL(file))
      setPreviews([...previews, ...newPreviews])
      
    } catch (error) {
      alert(error.message)
    } finally {
      setIsCompressing(false)
    }
  }

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    
    // Revoke old URL
    URL.revokeObjectURL(previews[index])
    
    onImagesChange(newImages)
    setPreviews(newPreviews)
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {previews.map((preview, index) => (
          <div key={index} className="relative group">
            <img
              src={preview}
              alt={`Preview ${index + 1}`}
              className="w-full h-32 object-cover rounded border-2 border-gray-300"
            />
            {index === 0 && (
              <span className="absolute top-1 left-1 badge badge-primary badge-sm">Thumbnail</span>
            )}
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute top-1 right-1 btn btn-xs btn-circle btn-error opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
            <p className="text-xs text-center mt-1">Image {index + 1}</p>
          </div>
        ))}
        
        {images.length < maxImages && (
          <label className="border-2 border-dashed border-gray-400 h-32 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all rounded">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isCompressing}
            />
            {isCompressing ? (
              <>
                <div className="loading loading-spinner loading-sm"></div>
                <span className="text-xs mt-2">Compressing...</span>
              </>
            ) : (
              <>
                <span className="text-3xl text-gray-400">+</span>
                <span className="text-xs text-gray-500 mt-1">Add Image</span>
              </>
            )}
          </label>
        )}
      </div>
      
      <p className="text-sm text-gray-600 mt-3">
        {images.length}/{maxImages} images ({minImages} minimum required)
      </p>
    </div>
  )
}

export default ImageUploader
```

**Component**: IDVerification.jsx

```javascript
import React, { useState } from 'react'

const IDVerification = ({
  idType,
  frontImage,
  backImage,
  onIdTypeChange,
  onFrontImageChange,
  onBackImageChange,
  errors
}) => {
  const [frontPreview, setFrontPreview] = useState(null)
  const [backPreview, setBackPreview] = useState(null)
  
  const idTypes = ['NID', 'Passport', 'License']
  
  const handleFrontSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      onFrontImageChange(file)
      setFrontPreview(URL.createObjectURL(file))
    }
  }
  
  const handleBackSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      onBackImageChange(file)
      setBackPreview(URL.createObjectURL(file))
    }
  }
  
  return (
    <div className="space-y-4">
      <div className="form-control">
        <label className="label">
          <span className="label-text">ID Type *</span>
        </label>
        <select
          value={idType}
          onChange={(e) => onIdTypeChange(e.target.value)}
          className="select select-bordered"
        >
          <option value="">Select ID Type</option>
          {idTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        {errors.id_type && <p className="text-red-500 text-sm mt-1">{errors.id_type}</p>}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">
            <span className="label-text">Front Side *</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFrontSelect}
            className="file-input file-input-bordered w-full"
          />
          {frontPreview && (
            <img src={frontPreview} alt="Front" className="w-full h-40 object-cover mt-2 rounded" />
          )}
          {errors.id_front && <p className="text-red-500 text-sm mt-1">{errors.id_front}</p>}
        </div>
        
        <div>
          <label className="label">
            <span className="label-text">Back Side *</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleBackSelect}
            className="file-input file-input-bordered w-full"
          />
          {backPreview && (
            <img src={backPreview} alt="Back" className="w-full h-40 object-cover mt-2 rounded" />
          )}
          {errors.id_back && <p className="text-red-500 text-sm mt-1">{errors.id_back}</p>}
        </div>
      </div>
    </div>
  )
}

export default IDVerification
```

---

## 5. NAVIGATION & PROGRESS COMPONENTS

### 5.1 ProgressIndicator

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\ProgressIndicator.jsx`

```javascript
import React from 'react'
import { useFormContext } from './FormContext'

const steps = [
  { number: 1, label: 'Details' },
  { number: 2, label: 'Pricing' },
  { number: 3, label: 'Location' },
  { number: 4, label: 'Amenities' }
]

const ProgressIndicator = () => {
  const { currentStep } = useFormContext()
  
  return (
    <div className="w-full mb-8">
      <ul className="steps steps-horizontal w-full">
        {steps.map(step => (
          <li
            key={step.number}
            className={`step ${step.number <= currentStep ? 'step-primary' : ''}`}
          >
            {step.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ProgressIndicator
```

### 5.2 FormNavigation

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\components\FormNavigation.jsx`

```javascript
import React from 'react'

const getNextStepLabel = (currentStep) => {
  const labels = {
    1: 'Pricing',
    2: 'Location',
    3: 'Amenities'
  }
  return labels[currentStep] || 'Next'
}

const FormNavigation = ({ currentStep, onBack, onNext, onSubmit, isSubmitting, canProceed }) => {
  return (
    <div className="flex justify-between mt-8 pt-6 border-t">
      {currentStep > 1 && (
        <button
          type="button"
          onClick={onBack}
          className="btn btn-outline"
          disabled={isSubmitting}
        >
          ← Back
        </button>
      )}
      
      {currentStep < 4 ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="btn btn-primary ml-auto"
        >
          Next: {getNextStepLabel(currentStep)} →
        </button>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !canProceed}
          className="btn btn-success ml-auto gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Submitting...
            </>
          ) : (
            <>
              🏠 Submit for Review
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default FormNavigation
```

---

## 6. VALIDATION UTILITIES

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\utils\formValidation.js`

[See full validation code in section 8 of the original plan above]

---

## 7. IMAGE COMPRESSION UTILITIES

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\utils\imageCompression.js`

```javascript
import imageCompression from 'browser-image-compression'

export const compressImage = async (file, options = {}) => {
  const defaultOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg'
  }

  try {
    const compressedFile = await imageCompression(file, { ...defaultOptions, ...options })
    return compressedFile
  } catch (error) {
    console.error('Image compression error:', error)
    throw new Error('Failed to compress image')
  }
}

export const validateImageFile = (file) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  const maxSize = 10 * 1024 * 1024 // 10MB

  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP allowed.')
  }

  if (file.size > maxSize) {
    throw new Error('File size exceeds 10MB limit.')
  }

  return true
}
```

---

## 8. SUPABASE SERVICES

### 8.1 Property Service

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\services\propertyService.js`

[See full propertyService code in section 7 of original plan above]

### 8.2 Image Upload Service

**File**: `C:\Users\Jahan\Downloads\Git Clone\eight\src\services\imageUploadService.js`

[See full imageUploadService code in section 6 of original plan above]

---

## 9. IMPLEMENTATION SEQUENCE

### Phase 1: Foundation (Days 1-2)
1. ✓ Set up Supabase project
2. ✓ Execute database schema SQL
3. ✓ Create storage buckets
4. ✓ Configure environment variables (.env file)
5. ✓ Install npm packages: `@supabase/supabase-js`, `browser-image-compression`, `@react-google-maps/api`
6. ✓ Create Supabase client configuration
7. ✓ Create directory structure

### Phase 2: Form Infrastructure (Days 3-4)
8. Build FormContext.jsx with state management
9. Build ProgressIndicator.jsx
10. Build FormNavigation.jsx
11. Create validation utilities (formValidation.js)
12. Create image compression utilities (imageCompression.js)

### Phase 3: Screen Implementation (Days 5-8)
13. Build Screen 1 (Property Details)
    - CategorySelector component
    - PropertyTypeSelector component
    - Form inputs with validation
14. Build Screen 2 (Pricing & Terms)
15. Build Screen 3 (Location Details)
    - Google Maps integration
    - LocationPicker modal component
16. Build Screen 4 (Amenities & Upload)
    - ImageUploader component with compression
    - AmenitiesCheckboxes component
    - IDVerification component

### Phase 4: Backend Integration (Days 9-10)
17. Implement imageUploadService.js
18. Implement propertyService.js with full submission logic
19. Implement credit checking and deduction
20. Test end-to-end flow

### Phase 5: Testing & Polish (Days 11-12)
21. Manual testing of all screens
22. Edge case testing (network failures, validation)
23. Mobile responsiveness testing
24. Loading states and error handling refinement

### Phase 6: Deployment (Day 13)
25. Deploy Supabase schema to production
26. Configure storage buckets and policies
27. Deploy frontend with environment variables
28. Monitor initial submissions

---

## 10. TESTING CHECKLIST

### Screen 1 Testing
- [ ] All categories selectable
- [ ] All property types selectable
- [ ] Number inputs accept valid ranges (0-50 rooms, 0-20 bathrooms, 0-10 balconies)
- [ ] Validation triggers on empty required fields
- [ ] Cannot proceed to next step with validation errors
- [ ] Optional room size field works correctly

### Screen 2 Testing
- [ ] Rent amount accepts numbers only
- [ ] Currency symbol (৳) displays correctly
- [ ] All rent periods selectable (Daily, Weekly, Monthly, Yearly)
- [ ] Validation prevents amounts below 100 or above 10,000,000
- [ ] Can navigate back to Screen 1

### Screen 3 Testing
- [ ] Google Maps modal opens on "SET LOCATION" button
- [ ] Map click sets lat/lng correctly
- [ ] Selected coordinates display below button
- [ ] Phone number validation works for +880 format
- [ ] Optional fields (sector, road, house/plot) can be left empty
- [ ] Textarea allows multiline input with character count
- [ ] Can navigate back to Screen 2

### Screen 4 Testing
- [ ] Amenities multi-select works (can select multiple)
- [ ] Date pickers prevent past dates for "Available From"
- [ ] Deadline must be after "Available From"
- [ ] Image upload shows previews immediately
- [ ] Can upload 2-6 images only (enforced)
- [ ] First image marked as "Thumbnail"
- [ ] Image compression works (files reduced in size)
- [ ] Can remove individual images
- [ ] ID upload section shows/hides based on verification status
- [ ] Credit balance displayed correctly
- [ ] Submit button disabled if credits < 20

### Submission Testing
- [ ] All data persists across step navigation (back/next)
- [ ] Form data auto-saves to localStorage
- [ ] All data inserted to correct Supabase tables
- [ ] Images uploaded to Supabase Storage "property-images" bucket
- [ ] ID documents uploaded to "id-documents" bucket (if not verified)
- [ ] Amenities inserted to property_amenities table
- [ ] Credits deducted correctly (user.credits - 20)
- [ ] Credit transaction logged
- [ ] Success message displayed
- [ ] Redirect to property list works
- [ ] localStorage draft cleared after successful submission

### Edge Cases
- [ ] Network failure during image upload (retry mechanism)
- [ ] Duplicate ID verification (unique constraint handled)
- [ ] Large image files (compression reduces before upload)
- [ ] Invalid Google Maps API key (fallback or error message)
- [ ] Insufficient credits (submission blocked with clear error)
- [ ] Browser back button (data persists via localStorage)
- [ ] Page refresh mid-form (data recovered from localStorage)

---

## 11. DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Create `.env` file with all keys (Supabase URL, anon key, Google Maps API)
- [ ] Add `.env` to `.gitignore`
- [ ] Execute all SQL schema scripts in Supabase
- [ ] Create storage buckets (property-images, id-documents)
- [ ] Set up storage policies (public/private access)
- [ ] Enable RLS on all tables
- [ ] Test RLS policies with test user account
- [ ] Install all npm dependencies
- [ ] Test build process (`npm run build`)

### Post-Deployment
- [ ] Monitor Supabase Dashboard for errors
- [ ] Check storage usage and costs
- [ ] Review credit transaction logs
- [ ] Collect user feedback on form usability
- [ ] Monitor property submission success rate
- [ ] Track average time to complete form

---

## 12. CRITICAL FILES FOR IMPLEMENTATION

### Critical Files (Priority Order):

1. **C:\Users\Jahan\Downloads\Git Clone\eight\src\config\supabaseClient.js**
   - Foundation for all backend communication
   - Required before any Supabase operations

2. **C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\FormContext.jsx**
   - Core state management for entire form
   - Required by all screen components

3. **C:\Users\Jahan\Downloads\Git Clone\eight\src\services\propertyService.js**
   - Handles complete submission logic and database insertions
   - Critical for form functionality

4. **C:\Users\Jahan\Downloads\Git Clone\eight\src\services\imageUploadService.js**
   - Manages image uploads to Supabase Storage
   - Required for property images and ID documents

5. **C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\components\ImageUploader.jsx**
   - Complex component with compression and preview
   - Used in Screen 4, reusable pattern

6. **C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\components\LocationPicker.jsx**
   - Google Maps integration
   - Used in Screen 3, requires API key configuration

7. **C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\AddProperty\utils\formValidation.js**
   - All validation logic centralized
   - Used across all screens

8. **C:\Users\Jahan\Downloads\Git Clone\eight\src\Component\Navber\Addproperty.jsx**
   - Main container component
   - Orchestrates all screens and providers

---

## END OF IMPLEMENTATION PLAN

This plan provides a complete roadmap for implementing the Add Property workflow. Follow the implementation sequence systematically, testing each phase before moving to the next. The multi-step form architecture ensures a smooth user experience while the Supabase integration provides a robust backend solution.
