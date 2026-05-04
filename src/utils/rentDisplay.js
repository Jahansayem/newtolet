export const NEGOTIABLE_RENT_LABEL = 'আলোচনা সাপেক্ষে'

export const isRentNegotiable = (pricing = {}) =>
  pricing?.is_rent_negotiable === true || pricing?.is_rent_negotiable === 'true'

export const getRentDisplayParts = (pricing = {}, options = {}) => {
  const { prefix = 'BDT ', fallback = 'N/A' } = options
  const amount = Number(pricing?.rent_amount_bdt)
  const hasValidAmount = Number.isFinite(amount) && amount > 0
  const negotiable = isRentNegotiable(pricing)

  return {
    amountText: hasValidAmount ? `${prefix}${amount.toLocaleString('en-BD')}` : '',
    fallback,
    hasValidAmount,
    isNegotiable: negotiable,
    negotiableLabel: NEGOTIABLE_RENT_LABEL,
  }
}

export const formatRentAmount = (pricing = {}, options = {}) => {
  const {
    amountText,
    fallback,
    hasValidAmount,
    isNegotiable,
    negotiableLabel,
  } = getRentDisplayParts(pricing, options)

  if (isNegotiable && !hasValidAmount) {
    return negotiableLabel
  }

  if (!hasValidAmount) {
    return fallback
  }

  return isNegotiable ? `${amountText} (${negotiableLabel})` : amountText
}
