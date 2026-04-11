import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiAlertCircle,
  FiCheck,
  FiChevronDown,
  FiMapPin,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi'
import { supabase } from '../../services/supabaseClient'
import {
  createOrder,
  getOrderCost,
  validateOrderData,
  updateOrderStatus,
} from '../../services/orderService'
import PaymentMethodSelector from './PaymentMethodSelector'
import {
  categories,
  divisions,
  getAreasByDistrict,
  getDistrictsByDivision,
  roomOptions,
} from '../../utils/bangladeshLocations'

const EMPTY_LOCATION = {
  division: '',
  district: '',
  area: '',
}

const getInitialFormData = () => ({
  locations: [{ ...EMPTY_LOCATION }],
  category: '',
  gender: '',
  rooms: '',
  bathRoom: '',
  propertyNeedFrom: '',
  maxBudget: '',
  kitchenFacility: '',
  gasFacility: '',
  livingSpace: '',
  roomSharing: '',
  floorPreference: '',
  liftFacility: '',
  parkingFacility: '',
  agreedToTerms: false,
})

const PAYMENT_GATEWAYS = [
  { id: 'bkash', name: 'bKash', icon: 'BK' },
  { id: 'nagad', name: 'Nagad', icon: 'NG' },
  { id: 'rocket', name: 'Rocket', icon: 'RK' },
]

const GENDER_OPTIONS = ['Any', 'Male', 'Female']
const BATH_ROOM_OPTIONS = ['1', '2', '3', '4', '5+']
const BINARY_PREFERENCE_OPTIONS = ['Required', 'Not Required', 'No Preference']
const SHARING_OPTIONS = ['Private', 'Shared', 'No Preference']
const KITCHEN_OPTIONS = ['Attached', 'Shared', 'No Preference']
const GAS_OPTIONS = ['Pipeline', 'Cylinder', 'No Preference']
const LIVING_SPACE_OPTIONS = ['Separate', 'Shared', 'No Preference']
const FLOOR_OPTIONS = [
  'Ground Floor',
  'Lower Floor',
  'Middle Floor',
  'Upper Floor',
  'No Preference',
]

const SectionCard = ({ title, subtitle, children }) => (
  <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-100 px-6 py-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
    </div>
    <div className="px-6 py-5">{children}</div>
  </section>
)

const FieldShell = ({ label, required = false, error, children }) => (
  <div className="space-y-2">
    <label className="block text-sm font-semibold text-gray-700">
      {label}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
    {children}
    {error ? <p className="text-xs text-red-600">{error}</p> : null}
  </div>
)

const SelectField = ({ label, value, options, onChange, required = false, error, placeholder }) => (
  <FieldShell label={label} required={required} error={error}>
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full appearance-none rounded-2xl border bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-[#1E73B8] focus:ring-2 focus:ring-[#1E73B8]/15 ${
          error ? 'border-red-300' : 'border-gray-200'
        }`}
      >
        <option value="">{placeholder || 'Select an option'}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  </FieldShell>
)

const InputField = ({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  error,
  placeholder,
  min,
}) => (
  <FieldShell label={label} required={required} error={error}>
    <input
      type={type}
      min={min}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-[#1E73B8] focus:ring-2 focus:ring-[#1E73B8]/15 ${
        error ? 'border-red-300' : 'border-gray-200'
      }`}
    />
  </FieldShell>
)

const RequirementBadge = ({ title, value }) => (
  <div className="rounded-2xl border border-[#1E73B8]/10 bg-[#1E73B8]/5 px-4 py-3">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1E73B8]">{title}</p>
    <p className="mt-2 text-sm font-semibold text-gray-900">{value}</p>
  </div>
)

export default function CreateOrderForm() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [currentOrderId, setCurrentOrderId] = useState(null)
  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')
  const [formData, setFormData] = useState(getInitialFormData)

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (isMounted) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const normalizedLocations = useMemo(
    () => formData.locations.map((location) => ({ ...EMPTY_LOCATION, ...location })),
    [formData.locations]
  )

  const updateField = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))

    setErrors((current) => ({
      ...current,
      [field]: '',
      submit: '',
    }))
  }

  const updateLocationField = (index, field, value) => {
    setFormData((current) => {
      const nextLocations = current.locations.map((location, locationIndex) => {
        if (locationIndex !== index) {
          return location
        }

        if (field === 'division') {
          return {
            division: value,
            district: '',
            area: '',
          }
        }

        if (field === 'district') {
          return {
            ...location,
            district: value,
            area: '',
          }
        }

        return {
          ...location,
          [field]: value,
        }
      })

      return {
        ...current,
        locations: nextLocations,
      }
    })

    if (index === 0) {
      setErrors((current) => ({
        ...current,
        [field]: '',
        submit: '',
      }))
    }
  }

  const addLocationRow = () => {
    setFormData((current) => ({
      ...current,
      locations: [...current.locations, { ...EMPTY_LOCATION }],
    }))
  }

  const removeLocationRow = (index) => {
    setFormData((current) => ({
      ...current,
      locations: current.locations.filter((_, locationIndex) => locationIndex !== index),
    }))
  }

  const resetForm = () => {
    setFormData(getInitialFormData())
    setErrors({})
    setCurrentOrderId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSuccessMessage('')

    const validation = validateOrderData(formData)
    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }

    if (!user) {
      setErrors({ submit: 'Please login to create an order.' })
      return
    }

    setSubmitting(true)

    try {
      const primaryLocation = normalizedLocations[0]
      const orderData = {
        userId: user.id,
        division: primaryLocation.division,
        district: primaryLocation.district,
        area: primaryLocation.area,
        locations: normalizedLocations,
        category: formData.category,
        gender: formData.gender,
        rooms: formData.rooms,
        bathRoom: formData.bathRoom,
        propertyNeedFrom: formData.propertyNeedFrom,
        maxBudget: formData.maxBudget,
        kitchenFacility: formData.kitchenFacility,
        gasFacility: formData.gasFacility,
        livingSpace: formData.livingSpace,
        roomSharing: formData.roomSharing,
        floorPreference: formData.floorPreference,
        liftFacility: formData.liftFacility,
        parkingFacility: formData.parkingFacility,
        agreedToTerms: formData.agreedToTerms,
      }

      const { data, error } = await createOrder(orderData)

      if (error) {
        throw error
      }

      setCurrentOrderId(data.id)
      setShowPaymentModal(true)
      setErrors({})
    } catch (error) {
      console.error('Error creating order:', error)
      setErrors({ submit: 'Failed to create order. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handlePaymentComplete = async () => {
    try {
      await updateOrderStatus(currentOrderId, 'confirmed')
      setShowPaymentModal(false)
      setSuccessMessage('Order placed successfully. We will contact you soon.')
      resetForm()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Error completing payment:', error)
      setErrors({ submit: 'Payment processing failed. Please contact support.' })
    }
  }

  const handlePaymentClose = () => {
    setShowPaymentModal(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-7 w-40 rounded bg-gray-200" />
          <div className="h-24 rounded-3xl bg-gray-200" />
          <div className="h-96 rounded-3xl bg-gray-200" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1E73B8]/10 text-[#1E73B8]">
            <FiMapPin className="text-2xl" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">Create Order</h1>
          <p className="mt-3 text-gray-600">
            Please login first to create a property requirement and continue to payment.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex rounded-2xl bg-[#1E73B8] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1665a0]"
          >
            Login Now
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <nav className="text-sm text-gray-500">
          <Link to="/" className="font-medium text-[#1E73B8] hover:text-[#1665a0]">
            Home
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <span>Create Order</span>
        </nav>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Create Order</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            Share your preferred location and requirements. We will use this order to match
            you with suitable homes and confirm the request after payment.
          </p>
        </div>

        {successMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-green-800">
            <FiCheck className="mt-0.5 flex-shrink-0 text-lg" />
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
        ) : null}

        {errors.submit ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            <FiAlertCircle className="mt-0.5 flex-shrink-0 text-lg" />
            <p className="text-sm font-medium">{errors.submit}</p>
          </div>
        ) : null}

        <div className="rounded-3xl border border-[#1E73B8]/10 bg-[#1E73B8]/5 px-5 py-4">
          <p className="text-sm leading-6 text-[#16395f]">
            If your exact location is not listed, choose the nearest area and add another
            location row. We will review all selected locations when processing the order.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard
            title="Location"
            subtitle="If you cannot find your exact location, choose the nearest match and add another row."
          >
            <div className="space-y-4">
              {normalizedLocations.map((location, index) => {
                const districtOptions = location.division
                  ? getDistrictsByDivision(location.division)
                  : []
                const areaOptions = location.district ? getAreasByDistrict(location.district) : []

                return (
                  <div
                    key={`location-${index}`}
                    className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {index === 0 ? 'Primary Location' : `Additional Location ${index}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {index === 0
                            ? 'This location will be used as the main order address.'
                            : 'Optional extra location preference.'}
                        </p>
                      </div>
                      {normalizedLocations.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeLocationRow(index)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <FiTrash2 />
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <SelectField
                        label="Division"
                        value={location.division}
                        options={divisions}
                        onChange={(value) => updateLocationField(index, 'division', value)}
                        required={index === 0}
                        error={index === 0 ? errors.division : ''}
                      />
                      <SelectField
                        label="District"
                        value={location.district}
                        options={districtOptions}
                        onChange={(value) => updateLocationField(index, 'district', value)}
                        required={index === 0}
                        error={index === 0 ? errors.district : ''}
                      />
                      <SelectField
                        label="Area"
                        value={location.area}
                        options={areaOptions}
                        onChange={(value) => updateLocationField(index, 'area', value)}
                        required={index === 0}
                        error={index === 0 ? errors.area : ''}
                      />
                    </div>
                  </div>
                )
              })}

              <button
                type="button"
                onClick={addLocationRow}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#1E73B8]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E73B8] transition hover:bg-[#1E73B8]/5"
              >
                <FiPlus />
                Add More Location
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Primary Requirements">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Category"
                value={formData.category}
                options={categories}
                onChange={(value) => updateField('category', value)}
                required
                error={errors.category}
              />
              <SelectField
                label="Gender"
                value={formData.gender}
                options={GENDER_OPTIONS}
                onChange={(value) => updateField('gender', value)}
                required
                error={errors.gender}
              />
              <SelectField
                label="Room"
                value={formData.rooms}
                options={roomOptions}
                onChange={(value) => updateField('rooms', value)}
                required
                error={errors.rooms}
              />
              <SelectField
                label="Bath Room"
                value={formData.bathRoom}
                options={BATH_ROOM_OPTIONS}
                onChange={(value) => updateField('bathRoom', value)}
              />
              <InputField
                label="Need From"
                type="date"
                value={formData.propertyNeedFrom}
                onChange={(value) => updateField('propertyNeedFrom', value)}
                required
                error={errors.propertyNeedFrom}
              />
              <InputField
                label="Maximum Total Budget"
                type="number"
                min="0"
                value={formData.maxBudget}
                onChange={(value) => updateField('maxBudget', value)}
                placeholder="BDT"
                required
                error={errors.maxBudget}
              />
            </div>
          </SectionCard>

          <SectionCard title="Additional Requirements">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Kitchen Facility"
                value={formData.kitchenFacility}
                options={KITCHEN_OPTIONS}
                onChange={(value) => updateField('kitchenFacility', value)}
              />
              <SelectField
                label="Gas Facility"
                value={formData.gasFacility}
                options={GAS_OPTIONS}
                onChange={(value) => updateField('gasFacility', value)}
              />
              <SelectField
                label="Living Space"
                value={formData.livingSpace}
                options={LIVING_SPACE_OPTIONS}
                onChange={(value) => updateField('livingSpace', value)}
              />
              <SelectField
                label="Room Sharing"
                value={formData.roomSharing}
                options={SHARING_OPTIONS}
                onChange={(value) => updateField('roomSharing', value)}
              />
              <SelectField
                label="Floor Preference"
                value={formData.floorPreference}
                options={FLOOR_OPTIONS}
                onChange={(value) => updateField('floorPreference', value)}
              />
              <SelectField
                label="Lift Facility"
                value={formData.liftFacility}
                options={BINARY_PREFERENCE_OPTIONS}
                onChange={(value) => updateField('liftFacility', value)}
              />
              <SelectField
                label="Parking Facility"
                value={formData.parkingFacility}
                options={BINARY_PREFERENCE_OPTIONS}
                onChange={(value) => updateField('parkingFacility', value)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Package">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                <RequirementBadge title="Package" value="7 Days" />
                <RequirementBadge title="Price" value={`${getOrderCost()} BDT`} />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.agreedToTerms}
                    onChange={(event) => updateField('agreedToTerms', event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#1E73B8] focus:ring-[#1E73B8]"
                  />
                  <span>
                    I agree to the{' '}
                    <Link to="/terms" className="font-medium text-[#1E73B8] hover:underline">
                      Terms & Conditions
                    </Link>
                    ,{' '}
                    <Link to="/privacy" className="font-medium text-[#1E73B8] hover:underline">
                      Privacy Policy
                    </Link>
                    , and{' '}
                    <Link to="/refund" className="font-medium text-[#1E73B8] hover:underline">
                      Refund Policy
                    </Link>
                    .
                  </span>
                </label>
                {errors.agreedToTerms ? (
                  <p className="mt-2 text-xs text-red-600">{errors.agreedToTerms}</p>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-w-[180px] justify-center rounded-2xl bg-[#1E73B8] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1665a0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Processing...' : 'Create'}
            </button>
            <Link
              to="/dashboard?tab=orders"
              className="inline-flex rounded-2xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 transition hover:border-[#1E73B8] hover:text-[#1E73B8]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {showPaymentModal ? (
        <PaymentMethodSelector
          package_={{
            name: '7 Days Property Order',
            price: getOrderCost(),
            credits: 0,
          }}
          gateways={PAYMENT_GATEWAYS}
          onGatewaySelected={handlePaymentComplete}
          onClose={handlePaymentClose}
        />
      ) : null}
    </div>
  )
}
