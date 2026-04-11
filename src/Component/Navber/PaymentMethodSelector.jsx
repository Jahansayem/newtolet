import React, { useState } from 'react'
import { FiPhone, FiX } from 'react-icons/fi'

const getFinalPrice = (package_) =>
  Number(package_?.price || 0) - (Number(package_?.price || 0) * Number(package_?.discount || 0)) / 100

const PaymentMethodSelector = ({ package_, gateways, onGatewaySelected, onClose }) => {
  const [selectedGateway, setSelectedGateway] = useState(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneError, setPhoneError] = useState('')
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
      setPhoneError('Please select a payment method')
      return
    }

    if (!phoneNumber.trim()) {
      setPhoneError('Please enter your phone number')
      return
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError('Please enter a valid Bangladesh phone number (01XXXXXXXXX)')
      return
    }

    onGatewaySelected({
      ...selectedGateway,
      phoneNumber: phoneNumber.replace(/\s/g, ''),
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto my-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Select Payment Method</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            <FiX />
          </button>
        </div>

        <div className="bg-gray-50 border-l-4 border-gray-900 p-4 mb-8 rounded">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Package</p>
              <p className="text-lg font-bold text-gray-900">{package_.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Amount</p>
              <p className="text-2xl font-bold text-gray-900">৳{finalPrice}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Credits</p>
              <p className="text-2xl font-bold text-gray-900">{package_.credits}</p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Payment Gateway</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gateways.map((gateway) => (
              <button
                key={gateway.id}
                onClick={() => handleSelectGateway(gateway)}
                className={`p-6 rounded-lg border-2 transition cursor-pointer text-center ${
                  selectedGateway?.id === gateway.id
                    ? 'border-gray-900 bg-gray-100'
                    : 'border-gray-200 bg-white hover:border-gray-900'
                }`}
              >
                <div className="text-4xl mb-3">{gateway.icon}</div>
                <h4 className="font-bold text-gray-900 mb-2">{gateway.name}</h4>
                <p className="text-xs text-gray-600">Hosted checkout</p>
                {selectedGateway?.id === gateway.id ? (
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-xs font-bold text-gray-900 bg-gray-200 px-2 py-1 rounded">
                      Selected
                    </span>
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {selectedGateway ? (
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              <FiPhone className="inline-block mr-2" />
              {selectedGateway.name} Phone Number
            </label>
            <div className="relative">
              <input
                type="tel"
                placeholder="01XXXXXXXXX"
                value={phoneNumber}
                onChange={(event) => {
                  const cleaned = event.target.value.replace(/[^\d+]/g, '')
                  setPhoneNumber(cleaned)
                  setPhoneError(
                    cleaned && !validatePhoneNumber(cleaned)
                      ? 'Please enter a valid Bangladesh phone number (01XXXXXXXXX)'
                      : ''
                  )
                }}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none text-lg text-black placeholder:text-gray-400 ${
                  phoneError
                    ? 'border-gray-900 focus:border-gray-900'
                    : phoneNumber && validatePhoneNumber(phoneNumber)
                      ? 'border-gray-900 focus:border-gray-900'
                      : 'border-gray-300 focus:border-gray-900'
                }`}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Enter the {selectedGateway.name} number you will use on the hosted checkout page.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Valid formats: 017XXXXXXXX, 018XXXXXXXX, 019XXXXXXXX, etc.
            </p>
          </div>
        ) : null}

        {phoneError ? (
          <div className="bg-gray-100 border border-gray-900 text-gray-900 px-4 py-3 rounded-lg mb-6 text-sm">
            {phoneError}
          </div>
        ) : null}

        <div className="bg-gray-50 border-l-4 border-gray-900 p-4 mb-8 rounded">
          <h4 className="font-bold text-gray-900 mb-2">How Payment Works</h4>
          <ol className="text-sm text-gray-700 space-y-1">
            <li>1. Click &quot;Continue to Payment&quot;.</li>
            <li>2. You will be redirected to the {selectedGateway?.name || 'selected'} checkout page.</li>
            <li>3. Complete the payment using your phone.</li>
            <li>4. NewTolet verifies the invoice after you return.</li>
            <li>5. Credits are added after admin approval.</li>
          </ol>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedGateway || !phoneNumber || !validatePhoneNumber(phoneNumber)}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to {selectedGateway?.name || 'Payment'}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            All transactions are processed on a secure encrypted checkout page.
          </p>
        </div>
      </div>
    </div>
  )
}

export default PaymentMethodSelector
