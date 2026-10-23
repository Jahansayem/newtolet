import {
  FiBriefcase,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiGrid,
  FiHeart,
  FiHome,
  FiLayers,
  FiMapPin,
  FiPackage,
  FiStar,
  FiUser,
  FiUsers,
} from 'react-icons/fi'
import { buildDashboardHref, buildPageHref } from '../../lib/routePaths'

export const USER_PANEL_NAV_ITEMS = [
  { key: 'dashboard', labelKey: 'dashboard.nav.dashboard', href: buildDashboardHref('dashboard'), icon: FiGrid },
  { key: 'home', labelKey: 'dashboard.nav.home', href: '/', icon: FiHome },
  {
    key: 'orders',
    labelKey: 'dashboard.nav.orders',
    href: '/my-orders',
    icon: FiPackage,
    sectionKey: 'dashboard.sections.ordersPackages',
  },
  {
    key: 'buy-credits',
    labelKey: 'dashboard.nav.buyCredits',
    href: buildPageHref('book-buy-credits'),
    icon: FiCreditCard,
    sectionKey: 'dashboard.sections.ordersPackages',
  },
  {
    key: 'myproperties',
    labelKey: 'dashboard.nav.myProperties',
    href: '/my-properties',
    icon: FiMapPin,
    sectionKey: 'dashboard.sections.properties',
  },
  {
    key: 'saved',
    labelKey: 'dashboard.nav.saved',
    href: buildDashboardHref('saved'),
    icon: FiHeart,
    sectionKey: 'dashboard.sections.properties',
  },
  {
    key: 'unlocked-listings',
    labelKey: 'dashboard.nav.unlockedListings',
    href: buildDashboardHref('unlocked-listings'),
    icon: FiLayers,
    sectionKey: 'dashboard.sections.properties',
  },
  {
    key: 'recently-viewed',
    labelKey: 'dashboard.nav.recentlyViewed',
    href: buildDashboardHref('recently-viewed'),
    icon: FiClock,
    sectionKey: 'dashboard.sections.properties',
  },
  {
    key: 'earnings',
    labelKey: 'dashboard.nav.earnings',
    href: buildDashboardHref('earnings'),
    icon: FiDollarSign,
    sectionKey: 'dashboard.sections.earnWithUs',
  },
  {
    key: 'job-feed',
    labelKey: 'dashboard.nav.jobFeed',
    href: buildDashboardHref('job-feed'),
    icon: FiBriefcase,
    sectionKey: 'dashboard.sections.earnWithUs',
  },
  {
    key: 'job-history',
    labelKey: 'dashboard.nav.jobHistory',
    href: buildDashboardHref('job-history'),
    icon: FiClock,
    sectionKey: 'dashboard.sections.earnWithUs',
  },
  {
    key: 'referrals',
    labelKey: 'dashboard.nav.referrals',
    href: buildDashboardHref('referrals'),
    icon: FiUsers,
    sectionKey: 'dashboard.sections.earnWithUs',
  },
  {
    key: 'withdrawals',
    labelKey: 'dashboard.nav.withdrawals',
    href: buildDashboardHref('withdrawals'),
    icon: FiDollarSign,
    sectionKey: 'dashboard.sections.earnWithUs',
  },
  {
    key: 'wallets',
    labelKey: 'dashboard.nav.wallets',
    href: buildDashboardHref('wallets'),
    icon: FiCreditCard,
    sectionKey: 'dashboard.sections.financials',
  },
  {
    key: 'invoice-history',
    labelKey: 'dashboard.nav.invoiceHistory',
    href: buildDashboardHref('invoice-history'),
    icon: FiFileText,
    sectionKey: 'dashboard.sections.financials',
  },
  {
    key: 'profile',
    labelKey: 'dashboard.nav.profile',
    href: buildDashboardHref('profile'),
    icon: FiUser,
    sectionKey: 'dashboard.sections.account',
  },
]

export const getUserPanelTitle = (activeKey, t) => {
  const labelKey =
    USER_PANEL_NAV_ITEMS.find((item) => item.key === activeKey)?.labelKey || 'dashboard.nav.dashboard'
  return typeof t === 'function' ? t(labelKey) : labelKey
}
