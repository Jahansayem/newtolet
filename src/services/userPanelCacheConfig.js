export const USER_PANEL_DEFAULT_CACHE_POLICY = Object.freeze({
  staleTimeMs: 60 * 1000,
  expiresInMs: 15 * 60 * 1000,
})

const POLICY_BY_RESOURCE = Object.freeze({
  dashboard: USER_PANEL_DEFAULT_CACHE_POLICY,
  profile: {
    staleTimeMs: 5 * 60 * 1000,
    expiresInMs: 24 * 60 * 60 * 1000,
  },
  'saved-property-ids': USER_PANEL_DEFAULT_CACHE_POLICY,
  'saved-properties': USER_PANEL_DEFAULT_CACHE_POLICY,
  'unlocked-properties': USER_PANEL_DEFAULT_CACHE_POLICY,
  'recently-viewed': USER_PANEL_DEFAULT_CACHE_POLICY,
  orders: USER_PANEL_DEFAULT_CACHE_POLICY,
  'my-properties': USER_PANEL_DEFAULT_CACHE_POLICY,
  'job-feed': {
    staleTimeMs: 60 * 1000,
    expiresInMs: 5 * 60 * 1000,
  },
  'job-history': USER_PANEL_DEFAULT_CACHE_POLICY,
  invoices: USER_PANEL_DEFAULT_CACHE_POLICY,
  'referral-summary': USER_PANEL_DEFAULT_CACHE_POLICY,
  'earnings-panel': USER_PANEL_DEFAULT_CACHE_POLICY,
  'wallet-panel': USER_PANEL_DEFAULT_CACHE_POLICY,
  'withdrawals-panel': USER_PANEL_DEFAULT_CACHE_POLICY,
  'credit-balance': {
    staleTimeMs: 30 * 1000,
    expiresInMs: 10 * 60 * 1000,
  },
  'credit-history': USER_PANEL_DEFAULT_CACHE_POLICY,
  'payment-history': USER_PANEL_DEFAULT_CACHE_POLICY,
  'referral-earnings': USER_PANEL_DEFAULT_CACHE_POLICY,
  wallets: USER_PANEL_DEFAULT_CACHE_POLICY,
  withdrawals: USER_PANEL_DEFAULT_CACHE_POLICY,
  'referral-settings': {
    staleTimeMs: 5 * 60 * 1000,
    expiresInMs: 60 * 60 * 1000,
  },
  'property-analytics': {
    staleTimeMs: 60 * 1000,
    expiresInMs: 10 * 60 * 1000,
  },
})

const PREFIX_POLICIES = [
  ['payment-history:', POLICY_BY_RESOURCE['payment-history']],
  ['property-analytics:', POLICY_BY_RESOURCE['property-analytics']],
]

export const getUserPanelCachePolicy = (resourceKey) => {
  if (!resourceKey) {
    return USER_PANEL_DEFAULT_CACHE_POLICY
  }

  if (POLICY_BY_RESOURCE[resourceKey]) {
    return POLICY_BY_RESOURCE[resourceKey]
  }

  const matchedPrefix = PREFIX_POLICIES.find(([prefix]) => resourceKey.startsWith(prefix))
  if (matchedPrefix) {
    return matchedPrefix[1]
  }

  return USER_PANEL_DEFAULT_CACHE_POLICY
}
