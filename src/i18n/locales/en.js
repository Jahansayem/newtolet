import { mergeDictionaries } from './merge.js'
import home from './en/home.js'
import search from './en/search.js'
import listing from './en/listing.js'
import orders from './en/orders.js'
import auth from './en/auth.js'
import payments from './en/payments.js'
import dashboard from './en/dashboard.js'
import addProperty from './en/addProperty.js'
import policy from './en/policy.js'
import earn from './en/earn.js'

const core = {
  common: {
    language: 'Language',
    english: 'English',
    bengali: 'Bengali',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    submit: 'Submit',
    loading: 'Loading...',
    retry: 'Retry',
    search: 'Search',
    viewAll: 'View all',
    seeMore: 'See more',
    na: 'N/A',
    yes: 'Yes',
    no: 'No',
    perMonth: 'month',
    home: 'Home',
    edit: 'Edit',
    delete: 'Delete',
    confirm: 'Confirm',
    optional: 'Optional',
    required: 'Required',
    all: 'All',
    none: 'None',
    status: 'Status',
    date: 'Date',
    amount: 'Amount',
    actions: 'Actions',
    details: 'Details',
    tk: 'Tk',
    skipToContent: 'Skip to main content',
    linkCopied: 'Link copied',
  },

  nav: {
    home: 'Home',
    career: 'Career',
    propertyList: 'Property list',
    properties: 'Properties',
    allProperty: 'All property',
    divisionItem: '{division} division',
    profile: 'Profile',
    savedProperty: 'Saved Property',
    earnMoney: 'Earn Money',
    article: 'Article',
    addProperty: 'Add Property',
    orderHome: 'Order Home',
    search: 'Search',
    openSearch: 'Open search',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menuDialog: 'Site menu',
    openAccountMenu: 'Open account menu',
    mainNavigation: 'Main navigation',
    logoAlt: 'NewTolet',
    myProperties: 'My Properties',
    buyCredits: 'Buy Credits',
    adminPanel: 'Admin Panel',
    logout: 'Log out',
    login: 'Login',
    language: 'Language',
  },

  footer: {
    logoAlt: 'Company Logo',
    tagline:
      'Your trusted partner in finding the right rental property. Search with clearer filters, browse verified listings, and move faster with tools built for real tenants.',
    quickLinks: 'Quick Links',
    propertyTypes: 'Property Types',
    getInTouch: 'Get In Touch',
    address: 'Jugidor, Moulvibazar, Sylhet',
    links: {
      home: 'Home',
      propertyList: 'Property List',
      addProperty: 'Add Property',
      aboutUs: 'About Us',
      contact: 'Contact',
    },
    types: {
      apartments: 'Apartments',
      houses: 'Houses',
      villas: 'Villas',
      commercial: 'Commercial',
      land: 'Land',
    },
    copyright: '© {year} NewTolet. All rights reserved.',
    developedBy: 'Developed by',
    payWithEps: 'Pay with EPS: Visa, Mastercard, American Express, bKash, Nagad, Rocket and more. Verified by EPS.',
    scrollToTop: 'Scroll to top',
  },

  quickRail: {
    openQuickActions: 'Open quick actions',
    quickAccess: 'Quick Access',
    addProperty: 'Add Property',
    orderHome: 'Order Home',
    propertyList: 'Property List',
    property: 'Property',
    buyCredits: 'Buy Credits',
    contact: 'Contact',
    savedProperties: 'Saved Properties',
    call: 'Call',
    earnMoney: 'Earn Money',
    profile: 'Profile',
    openSearch: 'Open search',
    home: 'Home',
    search: 'Search',
    saved: 'Saved',
    account: 'Account',
    add: 'Add',
  },

  notFound: {
    title: 'Page not found',
    description: 'The page you requested does not exist or has been moved.',
    goHome: 'Go to homepage',
  },

  values: {
    divisions: {
      Dhaka: 'Dhaka',
      Chattogram: 'Chattogram',
      Chittagong: 'Chittagong',
      Rajshahi: 'Rajshahi',
      Khulna: 'Khulna',
      Barishal: 'Barishal',
      Barisal: 'Barisal',
      Sylhet: 'Sylhet',
      Rangpur: 'Rangpur',
      Mymensingh: 'Mymensingh',
    },
    categories: {
      Family: 'Family',
      Bachelor: 'Bachelor',
      Office: 'Office',
      Sublet: 'Sublet',
      Hostel: 'Hostel',
      Shop: 'Shop',
    },
  },
}

const en = mergeDictionaries(core, [
  home,
  search,
  listing,
  orders,
  auth,
  payments,
  dashboard,
  addProperty,
  policy,
  earn,
])

export default en
