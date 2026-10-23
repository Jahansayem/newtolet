import { getRentDisplayParts } from '../utils/rentDisplay'
import { useLanguage } from '../i18n/useLanguage'

const joinClasses = (...classes) => classes.filter(Boolean).join(' ')

export default function RentDisplay({
  pricing = {},
  prefix = 'BDT ',
  fallback,
  suffix = '',
  className = '',
  amountClassName = '',
  negotiableClassName = '',
  fallbackClassName = '',
  suffixClassName = '',
}) {
  const { t } = useLanguage()
  const {
    amountText,
    fallback: fallbackText,
    hasValidAmount,
    isNegotiable,
    negotiableLabel,
  } = getRentDisplayParts(pricing, {
    prefix,
    fallback: fallback ?? t('common.na'),
    negotiableLabel: t('listing.negotiable'),
  })

  if (isNegotiable && !hasValidAmount) {
    return (
      <span className={className}>
        <span className={joinClasses('text-[0.875em] font-semibold text-muted', negotiableClassName)}>
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
      <span className={joinClasses('tabular-nums', amountClassName)}>{amountText}</span>
      {isNegotiable ? (
        <span className={joinClasses('ml-1 align-baseline text-[0.68em] font-semibold text-muted', negotiableClassName)}>
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
