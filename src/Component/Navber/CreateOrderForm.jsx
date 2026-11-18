import React, { useEffect, useMemo, useState, useId } from 'react'
import { Link } from 'react-router-dom'
import {
  FiAlertCircle,
  FiMapPin,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi'
import { supabase } from '../../services/supabaseClient'
import { createOrder, validateOrderData } from '../../services/orderService'
import { createOrderPaymentCheckout } from '../../services/paymentService'
import { getOrderPricing } from '../../lib/orderPricing'
import {
  categories,
  divisions,
  getAreasByDistrict,
  getDistrictsByDivision,
  roomOptions,
} from '../../utils/bangladeshLocations'
import { useLanguage } from '../../i18n/useLanguage'

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

const ORDER_PRICING = getOrderPricing()
const formatBdt = (amount) => `৳${Number(amount).toLocaleString('en-BD')}`

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

// Maps validateOrderData() error fields to dictionary keys.
const VALIDATION_MESSAGE_KEYS = {
  division: 'orders.create.validation.division',
  district: 'orders.create.validation.district',
  area: 'orders.create.validation.area',
  category: 'orders.create.validation.category',
  gender: 'orders.create.validation.gender',
  rooms: 'orders.create.validation.rooms',
  propertyNeedFrom: 'orders.create.validation.propertyNeedFrom',
  maxBudget: 'orders.create.validation.maxBudget',
  agreedToTerms: 'orders.create.validation.agreedToTerms',
}

// Replaces `{token}` placeholders in a translated sentence with React nodes.
const renderTemplate = (template, nodes) =>
  template.split(/(\{\w+\})/g).map((part, index) => {
    const match = part.match(/^\{(\w+)\}$/)
    if (match && nodes[match[1]] !== undefined) {
      return <React.Fragment key={index}>{nodes[match[1]]}</React.Fragment>
    }
    return part
  })

const SectionCard = ({ title, subtitle, children }) => (
  <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-100 px-6 py-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
    </div>
    <div className="px-6 py-5">{children}</div>
  </section>
)

const FieldShell = ({ id, label, required = false, error, errorId, children }) => (
  <div>
    <label htmlFor={id} className="ui-label">
      {label}
      {required ? <span className="ui-required" aria-hidden="true">*</span> : null}
    </label>
    {children}
    {error ? <p id={errorId} className="ui-error">{error}</p> : null}
  </div>
)

const SelectField = ({
  label,
  value,
  options,
  onChange,
  required = false,
  error,
  placeholder,
  optionNamespace,
}) => {
  const { t, tv } = useLanguage()
  const id = useId()
  const errorId = `${id}-error`

  return (
    <FieldShell id={id} label={label} required={required} error={error} errorId={errorId}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          className="ui-field"
        >
          <option value="">{placeholder || t('orders.create.selectOption')}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {optionNamespace ? tv(optionNamespace, option) : option}
            </option>
          ))}
        </select>
      </div>
    </FieldShell>
  )
}

const InputField = ({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  error,
  placeholder,
  min,
}) => {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <FieldShell id={id} label={label} required={required} error={error} errorId={errorId}>
      <input
        id={id}
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className="ui-field"
      />
    </FieldShell>
  )
}

const RequirementBadge = ({ title, value }) => (
  <div className="rounded-2xl border border-brand/10 bg-brand/5 px-4 py-3">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{title}</p>
    <p className="mt-2 text-sm font-semibold text-gray-900">{value}</p>
  </div>
)

export default function CreateOrderForm() {
  const { t } = useLanguage()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
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
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validation = validateOrderData(formData)
    if (!validation.isValid) {
      setErrors(
        Object.fromEntries(
          Object.entries(validation.errors).map(([field, message]) => [
            field,
            VALIDATION_MESSAGE_KEYS[field] ? t(VALIDATION_MESSAGE_KEYS[field]) : message,
          ])
        )
      )
      return
    }

    if (!user) {
      setErrors({ submit: t('orders.create.errors.loginRequired') })
      return
    }

    setSubmitting(true)
    let redirecting = false

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

      // The order is saved as "pending payment"; hand the customer to EPS.
      const { data: checkout, error: checkoutError } = await createOrderPaymentCheckout(data.id)

      if (checkoutError || !checkout?.payment_url) {
        console.error('Error starting order payment:', checkoutError)
        // The order exists, so clear the form (a second submit would duplicate
        // it) and point the customer to My Orders, where they can pay for it.
        resetForm()
        setErrors({ submit: t('orders.create.errors.checkoutFailed') })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      // Keep the button disabled while the browser leaves for the gateway.
      redirecting = true
      window.location.assign(checkout.payment_url)
    } catch (error) {
      console.error('Error creating order:', error)
      setErrors({ submit: t('orders.create.errors.createFailed') })
    } finally {
      if (!redirecting) {
        setSubmitting(false)
      }
    }
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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <FiMapPin className="text-2xl" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">{t('orders.create.title')}</h1>
          <p className="mt-3 text-gray-600">
            {t('orders.create.loginPrompt')}
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
          >
            {t('orders.create.loginNow')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <nav className="text-sm text-gray-500">
          <Link to="/" className="font-medium text-brand hover:text-brand-hover">
            {t('common.home')}
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <span>{t('orders.create.title')}</span>
        </nav>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('orders.create.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            {t('orders.create.description')}
          </p>
        </div>

        {errors.submit ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            <FiAlertCircle className="mt-0.5 flex-shrink-0 text-lg" />
            <div className="text-sm font-medium">
              <p>{errors.submit}</p>
              <Link to="/my-orders" className="mt-1 inline-block underline hover:no-underline">
                {t('orders.create.goToMyOrders')}
              </Link>
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-brand/10 bg-brand/5 px-5 py-4">
          <p className="text-sm leading-6 text-[#16395f]">
            {t('orders.create.locationHint')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard
            title={t('orders.create.location.title')}
            subtitle={t('orders.create.location.subtitle')}
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
                          {index === 0
                            ? t('orders.create.location.primary')
                            : t('orders.create.location.additional', { number: index })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {index === 0
                            ? t('orders.create.location.primaryHint')
                            : t('orders.create.location.additionalHint')}
                        </p>
                      </div>
                      {normalizedLocations.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeLocationRow(index)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <FiTrash2 />
                          {t('orders.create.location.remove')}
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <SelectField
                        label={t('orders.create.location.division')}
                        value={location.division}
                        options={divisions}
                        optionNamespace="divisions"
                        onChange={(value) => updateLocationField(index, 'division', value)}
                        required={index === 0}
                        error={index === 0 ? errors.division : ''}
                      />
                      <SelectField
                        label={t('orders.create.location.district')}
                        value={location.district}
                        options={districtOptions}
                        onChange={(value) => updateLocationField(index, 'district', value)}
                        required={index === 0}
                        error={index === 0 ? errors.district : ''}
                      />
                      <SelectField
                        label={t('orders.create.location.area')}
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
                className="inline-flex items-center gap-2 rounded-2xl border border-brand/20 bg-white px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/5"
              >
                <FiPlus />
                {t('orders.create.location.addMore')}
              </button>
            </div>
          </SectionCard>

          <SectionCard title={t('orders.create.primary.title')}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label={t('orders.create.primary.category')}
                value={formData.category}
                options={categories}
                optionNamespace="categories"
                onChange={(value) => updateField('category', value)}
                required
                error={errors.category}
              />
              <SelectField
                label={t('orders.create.primary.gender')}
                value={formData.gender}
                options={GENDER_OPTIONS}
                optionNamespace="orderPreferences"
                onChange={(value) => updateField('gender', value)}
                required
                error={errors.gender}
              />
              <SelectField
                label={t('orders.create.primary.room')}
                value={formData.rooms}
                options={roomOptions}
                onChange={(value) => updateField('rooms', value)}
                required
                error={errors.rooms}
              />
              <SelectField
                label={t('orders.create.primary.bathRoom')}
                value={formData.bathRoom}
                options={BATH_ROOM_OPTIONS}
                onChange={(value) => updateField('bathRoom', value)}
              />
              <InputField
                label={t('orders.create.primary.needFrom')}
                type="date"
                value={formData.propertyNeedFrom}
                onChange={(value) => updateField('propertyNeedFrom', value)}
                required
                error={errors.propertyNeedFrom}
              />
              <InputField
                label={t('orders.create.primary.maxBudget')}
                type="number"
                min="0"
                value={formData.maxBudget}
                onChange={(value) => updateField('maxBudget', value)}
                placeholder={t('orders.create.primary.budgetPlaceholder')}
                required
                error={errors.maxBudget}
              />
            </div>
          </SectionCard>

          <SectionCard title={t('orders.create.additional.title')}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label={t('orders.create.additional.kitchen')}
                value={formData.kitchenFacility}
                options={KITCHEN_OPTIONS}
                optionNamespace="orderPreferences"
                onChange={(value) => updateField('kitchenFacility', value)}
              />
              <SelectField
                label={t('orders.create.additional.gas')}
                value={formData.gasFacility}
                options={GAS_OPTIONS}
                optionNamespace="orderPreferences"
                onChange={(value) => updateField('gasFacility', value)}
              />
              <SelectField
                label={t('orders.create.additional.livingSpace')}
                value={formData.livingSpace}
                options={LIVING_SPACE_OPTIONS}
                optionNamespace="orderPreferences"
                onChange={(value) => updateField('livingSpace', value)}
              />
              <SelectField
                label={t('orders.create.additional.roomSharing')}
                value={formData.roomSharing}
                options={SHARING_OPTIONS}
                optionNamespace="orderPreferences"
                onChange={(value) => updateField('roomSharing', value)}
              />
              <SelectField
                label={t('orders.create.additional.floor')}
                value={formData.floorPreference}
                options={FLOOR_OPTIONS}
                optionNamespace="orderPreferences"
                onChange={(value) => updateField('floorPreference', value)}
              />
              <SelectField
                label={t('orders.create.additional.lift')}
                value={formData.liftFacility}
                options={BINARY_PREFERENCE_OPTIONS}
                optionNamespace="orderPreferences"
                onChange={(value) => updateField('liftFacility', value)}
              />
              <SelectField
                label={t('orders.create.additional.parking')}
                value={formData.parkingFacility}
                options={BINARY_PREFERENCE_OPTIONS}
                optionNamespace="orderPreferences"
                onChange={(value) => updateField('parkingFacility', value)}
              />
            </div>
          </SectionCard>

          <SectionCard title={t('orders.create.package.title')}>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                <RequirementBadge
                  title={t('orders.create.package.packageLabel')}
                  value={t('orders.create.package.duration')}
                />
                <div className="rounded-2xl border border-brand/10 bg-brand/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                    {t('orders.create.package.price')}
                  </p>
                  {ORDER_PRICING.hasDiscount ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-gray-500 line-through">{formatBdt(ORDER_PRICING.regular)}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {t('orders.create.package.discountBadge', { percent: ORDER_PRICING.discountPercent })}
                      </span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {t('orders.create.package.youPay', { amount: formatBdt(ORDER_PRICING.payable) })}
                  </p>
                </div>
                <p className="text-xs leading-5 text-gray-500 sm:col-span-2">
                  {t('orders.create.package.paymentNote')}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.agreedToTerms}
                    onChange={(event) => updateField('agreedToTerms', event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span>
                    {renderTemplate(t('orders.create.package.agree'), {
                      terms: (
                        <Link to="/terms" className="font-medium text-brand hover:underline">
                          {t('orders.create.package.terms')}
                        </Link>
                      ),
                      privacy: (
                        <Link to="/privacy" className="font-medium text-brand hover:underline">
                          {t('orders.create.package.privacy')}
                        </Link>
                      ),
                      refund: (
                        <Link to="/refund" className="font-medium text-brand hover:underline">
                          {t('orders.create.package.refund')}
                        </Link>
                      ),
                    })}
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
              className="inline-flex min-w-[180px] justify-center rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? t('orders.create.processing')
                : t('orders.create.payWithEps', { amount: formatBdt(ORDER_PRICING.payable) })}
            </button>
            <Link
              to="/dashboard?tab=orders"
              className="inline-flex rounded-2xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 transition hover:border-brand hover:text-brand"
            >
              {t('common.cancel')}
            </Link>
          </div>
        </form>
      </div>

    </div>
  )
}
