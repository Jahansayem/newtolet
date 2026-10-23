export const PIN_PROPERTY_COST = 50
export const PIN_PROPERTY_DURATION_HOURS = 24

export const getPinnedUntilTime = (property) => {
  const pinnedUntil = property?.pinned_until || property?.pinnedUntil

  if (!pinnedUntil) {
    return 0
  }

  const time = new Date(pinnedUntil).getTime()
  return Number.isFinite(time) ? time : 0
}

export const isPropertyActivelyPinned = (property, now = Date.now()) =>
  getPinnedUntilTime(property) > now

export const compareActivePinnedFirst = (left, right, now = Date.now()) => {
  const leftPinned = isPropertyActivelyPinned(left, now)
  const rightPinned = isPropertyActivelyPinned(right, now)

  if (leftPinned !== rightPinned) {
    return leftPinned ? -1 : 1
  }

  if (leftPinned && rightPinned) {
    return getPinnedUntilTime(right) - getPinnedUntilTime(left)
  }

  return 0
}

export const formatPinnedUntil = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
