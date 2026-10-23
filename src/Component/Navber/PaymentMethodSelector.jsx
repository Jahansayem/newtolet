import React, { useId, useState } from 'react'
import { FiPhone } from 'react-icons/fi'
import Dialog from '../../components/ui/Dialog'
import { useLanguage } from '../../i18n/useLanguage'

const getFinalPrice = (package_) =>
  Number(package_?.price || 0) - (Number(package_?.price || 0) * Number(package_?.discount || 0)) / 100

const PaymentMethodSelector = ({ package_, gateways, onGatewaySelected, onClose }) => {
  const { t } = useLanguage()
  const [selectedGateway, setSelectedGateway] = useState(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const phoneId = useId()
  const phoneHintId = useId()
  const finalPrice = getFinalPrice(package_)

  const validatePhoneNumber = (phone) => {
    let cleanPhone = phone.replace(/[\s\-()]/g, '')

    if (cleanPhone.startsWith('+880')) {
      cleanPhone = cleanPhone.substring(4)
    } else if (cleanPhone.startsWith('880')) {
      cleanPhone = cleanPhone.substring(3)
    }

    return /^01[0-9]{9}$/.test(cleanPhone)
  }

  const handleSelectGateway = (gateway) => {
    setSelectedGateway(gateway)
    setPhoneNumber('')
    setPhoneError('')
  }

  const handleContinue = () => {
    if (!selectedGateway) {
      setPhoneError(t('payments.methods.errors.selectMethod'))
      return
    }

    if (!phoneNumber.trim()) {
      setPhoneError(t('payments.methods.errors.phoneRequired'))
      return
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError(t('payments.methods.errors.phoneInvalid'))
      return
    }

    onGatewaySelected({
      ...selectedGateway,
      phoneNumber: phoneNumber.replace(/\s/g, ''),
    })
  }

  const isPhoneValid = Boolean(phoneNumber) && validatePhoneNumber(phoneNumber)

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('payments.methods.title')}
      closeLabel={t('common.close')}
      size="lg"
      footer={(
        <>
          <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedGateway || !isPhoneValid}
            className="ui-btn ui-btn-primary"
          >
            {t('payments.methods.continueTo', {
              gateway: selectedGateway?.name || t('payments.methods.paymentFallback'),
            })}
          </button>
        </>
      )}
    >
      <dl className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-canvas p-4">
        <div>
          <dt className="text-caption text-muted">{t('payments.methods.package')}</dt>
          <dd className="mt-0.5 font-semibold text-ink">{package_.name}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted">{t('common.amount')}</dt>
          <dd className="ui-price mt-0.5 text-xl">৳ {finalPrice.toLocaleString('en-BD')}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted">{t('payments.methods.credits')}</dt>
          <dd className="ui-price mt-0.5 text-xl">{package_.credits}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <h3 className="text-base font-semibold text-ink">{t('payments.methods.chooseGateway')}</h3>
        <div role="group" aria-label={t('payments.methods.chooseGateway')} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {gateways.map((gateway) => {
            const isSelected = selectedGateway?.id === gateway.id

            return (
              <button
                key={gateway.id}
                type="button"
                onClick={() => handleSelectGateway(gateway)}
                aria-pressed={isSelected}
                className={`rounded-xl border-2 p-4 text-center transition-colors ${
                  isSelected
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-white hover:border-brand/50'
                }`}
              >
                <span className="ui-badge ui-badge-brand text-sm" aria-hidden="true">{gateway.icon}</span>
                <span className="mt-2 block font-semibold text-ink">{gateway.name}</span>
                <span className="mt-1 block text-caption text-muted">{t('payments.methods.hostedCheckout')}</span>
                {isSelected ? (
                  <span className="mt-2 block text-caption font-semibold text-brand">{t('payments.methods.selected')}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {selectedGateway ? (
        <div className="mt-6">
          <label htmlFor={phoneId} className="ui-label">
            <FiPhone className="mr-1.5 inline-block" aria-hidden="true" />
            {t('payments.methods.phoneLabel', { gateway: selectedGateway.name })}
          </label>
          <input
            id={phoneId}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            value={phoneNumber}
            aria-invalid={phoneError ? 'true' : undefined}
            aria-describedby={phoneHintId}
            onChange={(event) => {
              const cleaned = event.target.value.replace(/[^\d+]/g, '')
              setPhoneNumber(cleaned)
              setPhoneError(
                cleaned && !validatePhoneNumber(cleaned)
                  ? t('payments.methods.errors.phoneInvalid')
                  : ''
              )
            }}
            className={`ui-field text-lg ${isPhoneValid ? 'border-success' : ''}`}
          />
          <p id={phoneHintId} className="ui-help">
            {t('payments.methods.phoneHint', { gateway: selectedGateway.name })} {t('payments.methods.validFormats')}
          </p>
        </div>
      ) : null}

      {phoneError ? (
        <p role="alert" className="ui-error mt-3">
          {phoneError}
        </p>
      ) : null}

      <div className="ui-note mt-6">
        <p className="font-semibold text-ink">{t('payments.methods.howItWorks')}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>{t('payments.methods.steps.click')}</li>
          <li>
            {t('payments.methods.steps.redirect', {
              gateway: selectedGateway?.name || t('payments.methods.selectedFallback'),
            })}
          </li>
          <li>{t('payments.methods.steps.complete')}</li>
          <li>{t('payments.methods.steps.verify')}</li>
          <li>{t('payments.methods.steps.credited')}</li>
        </ol>
      </div>

      <p className="mt-4 text-center text-caption text-muted">
        {t('payments.methods.secureNote')}
      </p>
    </Dialog>
  )
}

export default PaymentMethodSelector
