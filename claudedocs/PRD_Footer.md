# PRD: Footer Component

## Overview
**Component**: Footer.jsx
**Location**: `src/Component/Home/Footer.jsx`
**Purpose**: Site-wide footer providing navigation, contact info, social links, and brand presence

## Requirements

### 1. Brand Section
- Display company logo (existing asset: `../../assets/logo.png`)
- Tagline/description about the property platform
- Social media icons (Facebook, Twitter, Instagram, LinkedIn)

### 2. Navigation Links

#### Quick Links
- Home
- Property List
- Add Property
- About Us
- Contact

#### Property Categories
- Apartments
- Houses
- Villas
- Commercial

#### Support
- FAQ
- Privacy Policy
- Terms of Service
- Help Center

### 3. Contact Information
- Phone number
- Email address
- Physical address
- Operating hours (optional)

### 4. Newsletter Subscription
- Email input field
- Subscribe button
- Brief CTA text

### 5. Bottom Bar
- Copyright notice with dynamic year
- Payment method icons (optional)
- Back to top button (optional)

## Design Specifications

### Colors (matching existing design system)
- Primary: `#4454e9` (indigo/blue from Navbar)
- Text: `text-zinc-600`, `text-gray-500`
- Backgrounds: `bg-gray-900` (dark footer) or `bg-gray-100` (light)
- Accent: `#3144f7`

### Typography
- Headings: `text-xl font-medium`
- Body: `text-sm text-gray-500`
- Links: hover states with color transition

### Spacing
- Container: `px-6 md:px-20 lg:px-32` (matching Navbar)
- Section gaps: `space-y-5`, `gap-5`
- Vertical padding: `py-20`

### Responsive Behavior
- Desktop: 4-column grid layout
- Tablet: 2-column grid
- Mobile: Single column, stacked

## Technical Requirements

### Dependencies
- `react-icons` (already in project)
- `react-router-dom` for navigation Links

### Accessibility
- Semantic HTML (`<footer>`, `<nav>`, `<address>`)
- Proper heading hierarchy
- Focus states for interactive elements
- ARIA labels where needed

### Performance
- Lazy load social icons
- Optimize for minimal re-renders

## Success Criteria
- [x] Matches existing design language
- [x] Fully responsive across breakpoints
- [x] All links functional
- [x] Accessible to screen readers
- [x] Newsletter form validated

## Implementation Notes
- Use existing Tailwind classes from Navbar for consistency
- Follow existing component patterns in codebase
- Integrate with React Router for internal links
