import { getRentDisplayParts } from '../utils/rentDisplay'

const joinClasses = (...classes) => classes.filter(Boolean).join(' ')

export default function RentDisplay({
  pricing = {},
  prefix = 'BDT ',
  fallback = 'N/A',
  suffix = '',
  className = '',
  amountClassName = '',
  negotiableClassName = '',
  fallbackClassName = '',
  suffixClassName = '',
}) {
  const {
    amountText,
    fallback: fallbackText,
    hasValidAmount,
    isNegotiable,
    negotiableLabel,
  } = getRentDisplayParts(pricing, { prefix, fallback })

  if (isNegotiable && !hasValidAmount) {
    return (
      <span className={className}>
        <span className={joinClasses('text-[0.875em] font-semibold opacity-75', negotiableClassName)}>
          {negotiableLabel}
        </span>
      </span>
    )
  }

  if (!hasValidAmount) {
    return (
      <span className={joinClasses(className, fallbackClassName)}>
        {fallbackText}
      </span>
    )
  }

  return (
    <span className={className}>
      <span className={amountClassName}>{amountText}</span>
      {isNegotiable ? (
        <span className={joinClasses('ml-1 align-baseline text-[0.68em] font-semibold opacity-70', negotiableClassName)}>
          ({negotiableLabel})
        </span>
      ) : null}
      {suffix ? (
        <span className={joinClasses('ml-1', suffixClassName)}>
          {suffix}
        </span>
      ) : null}
    </span>
  )
}
