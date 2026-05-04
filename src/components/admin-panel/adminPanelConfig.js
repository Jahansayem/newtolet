import {
  BiEnvelope,
  BiHome,
  BiImage,
  BiPackage,
  BiUser,
} from 'react-icons/bi'
import { FiLink } from 'react-icons/fi'
import { GiHouse } from 'react-icons/gi'
import {
  MdAttachMoney,
  MdCreditCard,
  MdDashboard,
  MdFeedback,
  MdPayments,
} from 'react-icons/md'
import { buildPageHref } from '../../lib/routePaths'

const buildAdminTabHref = (page, tab) => buildPageHref(page, { tab })

export const getAdminPanelNavItems = (page = 'admin') => [
  { key: 'home', label: 'Go to Homepage', href: '/', icon: BiHome },
  { key: 'dashboard', label: 'Dashboard', href: buildAdminTabHref(page, 'dashboard'), icon: MdDashboard },
  {
    key: 'payments',
    label: 'Payments',
    href: buildAdminTabHref(page, 'payments'),
    icon: MdPayments,
    section: 'Operations',
  },
  {
    key: 'referrals',
    label: 'Referrals',
    href: buildAdminTabHref(page, 'referrals'),
    icon: MdCreditCard,
    section: 'Operations',
  },
  {
    key: 'pricing',
    label: 'Pricing & Credits',
    href: buildAdminTabHref(page, 'pricing'),
    icon: MdAttachMoney,
    section: 'Operations',
  },
  {
    key: 'cover-photos',
    label: 'Cover Photos',
    href: buildAdminTabHref(page, 'cover-photos'),
    icon: BiImage,
    section: 'Operations',
  },
  {
    key: 'users',
    label: 'Users',
    href: buildAdminTabHref(page, 'users'),
    icon: BiUser,
    section: 'Management',
  },
  {
    key: 'properties',
    label: 'Properties',
    href: buildAdminTabHref(page, 'properties'),
    icon: GiHouse,
    section: 'Management',
  },
  {
    key: 'orders',
    label: 'Orders',
    href: buildAdminTabHref(page, 'orders'),
    icon: BiPackage,
    section: 'Management',
  },
  {
    key: 'inquiries',
    label: 'Inquiries',
    href: buildAdminTabHref(page, 'inquiries'),
    icon: BiEnvelope,
    section: 'Management',
  },
  {
    key: 'search-history',
    label: 'Search History',
    href: buildAdminTabHref(page, 'search-history'),
    icon: FiLink,
    section: 'Management',
  },
  {
    key: 'feedback',
    label: 'Feedback',
    href: buildAdminTabHref(page, 'feedback'),
    icon: MdFeedback,
    section: 'Management',
  },
  {
    key: 'unlock-refunds',
    label: 'Unlock Refunds',
    href: buildAdminTabHref(page, 'unlock-refunds'),
    icon: MdAttachMoney,
    section: 'Management',
  },
]

export const getAdminPanelTitle = (activeKey, page = 'admin') =>
  getAdminPanelNavItems(page).find((item) => item.key === activeKey)?.label || 'Dashboard'

export const getSupportedAdminTabs = (page = 'admin') =>
  getAdminPanelNavItems(page)
    .filter((item) => item.key !== 'home')
    .map((item) => item.key)
