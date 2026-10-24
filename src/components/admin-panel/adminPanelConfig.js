import {
  FiBarChart2,
  FiCreditCard,
  FiFileText,
  FiGrid,
  FiHome,
  FiImage,
  FiMail,
  FiMessageSquare,
  FiPackage,
  FiRotateCcw,
  FiSearch,
  FiSettings,
  FiShare2,
  FiTag,
  FiUsers,
} from 'react-icons/fi'
import { buildPageHref } from '../../lib/routePaths'
import { PERMISSIONS } from '../../lib/adminPermissions'

export const ADMIN_SECTION_ORDER = ['Overview', 'Moderation', 'Operations', 'Finance', 'Platform', 'Insights']

const tabHref = (tab) => buildPageHref('admin', { tab })

/**
 * Navigation items. `permission` gates visibility; `badgeKey` maps to a field
 * of getAdminQueueCounts(); `stage` marks sections that ship later (hidden
 * until their component exists).
 */
export const ADMIN_NAV_ITEMS = [
  { key: 'home', label: 'Go to homepage', href: '/', icon: FiHome },
  {
    key: 'dashboard',
    label: 'Dashboard',
    section: 'Overview',
    icon: FiGrid,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    description: 'Queues, health and recent activity.',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    section: 'Overview',
    icon: FiBarChart2,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    description: 'Listing trends, moderation backlog and payment totals.',
  },
  {
    key: 'properties',
    label: 'Properties',
    section: 'Moderation',
    icon: FiHome,
    permission: PERMISSIONS.PROPERTIES_VIEW,
    badgeKey: 'pendingProperties',
    description: 'Review, approve and reject listings.',
  },
  {
    key: 'users',
    label: 'Users',
    section: 'Moderation',
    icon: FiUsers,
    permission: PERMISSIONS.USERS_VIEW,
    description: 'Accounts, roles, blacklist and credits.',
  },
  {
    key: 'feedback',
    label: 'Feedback',
    section: 'Moderation',
    icon: FiMessageSquare,
    permission: PERMISSIONS.FEEDBACK_REVIEW,
    badgeKey: 'pendingFeedback',
    description: 'Approve testimonials shown on the homepage.',
  },
  {
    key: 'orders',
    label: 'Orders',
    section: 'Operations',
    icon: FiPackage,
    permission: PERMISSIONS.ORDERS_MANAGE,
    description: 'Rental requests and job-feed publishing.',
  },
  {
    key: 'inquiries',
    label: 'Inquiries',
    section: 'Operations',
    icon: FiMail,
    permission: PERMISSIONS.INQUIRIES_MANAGE,
    badgeKey: 'pendingInquiries',
    description: 'Messages sent to listing owners.',
  },
  {
    key: 'search-history',
    label: 'Search history',
    section: 'Operations',
    icon: FiSearch,
    permission: PERMISSIONS.USERS_VIEW,
    description: 'What visitors searched for.',
  },
  {
    key: 'payments',
    label: 'Payments',
    section: 'Finance',
    icon: FiCreditCard,
    permission: PERMISSIONS.PAYMENTS_VIEW,
    badgeKey: 'awaitingPayments',
    description: 'Credit purchases awaiting approval.',
  },
  {
    key: 'refunds',
    label: 'Refunds',
    section: 'Finance',
    icon: FiRotateCcw,
    permission: PERMISSIONS.REFUNDS_REVIEW,
    badgeKey: 'requestedRefunds',
    description: 'Contact-unlock refund requests.',
  },
  {
    key: 'credits',
    label: 'Credits & pricing',
    section: 'Finance',
    icon: FiTag,
    permission: PERMISSIONS.PRICING_MANAGE,
    description: 'Packages, unlock costs and manual adjustments.',
  },
  {
    key: 'referrals',
    label: 'Referrals & withdrawals',
    section: 'Finance',
    icon: FiShare2,
    permission: PERMISSIONS.PAYMENTS_VIEW,
    description: 'Referral settings and payout requests.',
  },
  {
    key: 'content',
    label: 'Content',
    section: 'Platform',
    icon: FiImage,
    permission: PERMISSIONS.CONTENT_MANAGE,
    description: 'Homepage cover photos and public content.',
  },
  {
    key: 'settings',
    label: 'Settings',
    section: 'Platform',
    icon: FiSettings,
    permission: PERMISSIONS.SETTINGS_MANAGE,
    description: 'Roles, theme and platform switches.',
  },
  {
    key: 'audit',
    label: 'Audit log',
    section: 'Insights',
    icon: FiFileText,
    permission: PERMISSIONS.AUDIT_VIEW,
    description: 'Who changed what, and why.',
  },
].map((item) => (item.key === 'home' ? item : { ...item, href: tabHref(item.key) }))

/** Old `?tab=` values that still need to resolve (bookmarks, nginx-less hosts). */
export const ADMIN_TAB_ALIASES = {
  'cover-photos': { tab: 'content', view: 'cover-photos' },
  'unlock-refunds': { tab: 'refunds' },
  pricing: { tab: 'credits' },
}

const SUPPORTED_TABS = new Set(ADMIN_NAV_ITEMS.filter((item) => item.key !== 'home').map((item) => item.key))

export const resolveAdminTab = (raw) => {
  if (raw && ADMIN_TAB_ALIASES[raw]) return { ...ADMIN_TAB_ALIASES[raw], aliased: true }
  if (raw && SUPPORTED_TABS.has(raw)) return { tab: raw, aliased: false }
  return { tab: 'dashboard', aliased: Boolean(raw) }
}

export const getAdminNavItem = (key) => ADMIN_NAV_ITEMS.find((item) => item.key === key) || null

export const getAdminPanelTitle = (activeKey) => getAdminNavItem(activeKey)?.label || 'Dashboard'

// Backwards-compatible helpers (the `page` argument is ignored: /admin is canonical).
export const getAdminPanelNavItems = () => ADMIN_NAV_ITEMS
export const getSupportedAdminTabs = () => Array.from(SUPPORTED_TABS)
