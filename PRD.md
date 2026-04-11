# বাসা ভাড়া Platform - Product Requirements Document

## 1. Product Overview

### 1.1 Product Vision
A comprehensive rental property platform that connects property owners with potential tenants through a mobile app (Flutter) and web interface (Next.js), facilitating seamless property listing, discovery, and contact management.

### 1.2 Target Market
- **Primary Users**: Property owners looking to rent out their properties
- **Secondary Users**: Individuals/families seeking rental properties in Bangladesh
- **Geographic Focus**: Bangladesh (initially)

### 1.3 Tech Stack
- **Web Platform**: React.js
- **Backend**: Supabase
- **Push Notifications**: OneSignal
- **Payment Integration**: TBD
- **Maps**: Google Maps API

## 2. Core Features & User Stories

### 2.1 Navigation Structure
**Bottom Navigation Bar:**
- **Property/ToLet**: Browse available properties (Home icon)
- **Order Home**: User's rental orders/bookings
- **Add Property** (+): Center floating action button for adding listings
- **Earn Money**: Referral and earnings section
- **Profile**: User account management

### 2.2 Property Listing Flow

#### 2.2.1 Category Selection
**User Story**: As a property owner, I want to categorize my property so tenants can find relevant listings.

**Categories:**
- Family
- Office
- Sublet
- Bachelor
- Hostel
- Shop

#### 2.2.2 Property Details (Screen 1)
**Property Type Selection:**
- House
- Unit
- Room
- Seat
- Flat
- Floor
- Apartment

**Property Specifications:**
- Total Rooms: Number input
- Total Bathrooms: Number input
- Balcony: Number input
- Floor Level: Dropdown (Ground Level, 1st Floor - 8th Floor)

**Occupancy Restrictions:**
- No Restriction
- Only Family
- Only Male
- Only Female

**Optional Fields:**
- Room Size: Square feet input (optional)

#### 2.2.3 Pricing & Terms (Screen 2)
**Rent Details:**
- Rent Amount: Number input in BDT
- Rent Period: Dropdown (Daily, Weekly, Monthly, Yearly)

#### 2.2.4 Location Details (Screen 3)
**Location Information:**
- State/District: Text input (e.g., "Mumbai or New York")
- Area: Text input (e.g., "Andheri or Chinatown")
- Contact Number: Phone number input (e.g., "+99...")
- Short Description: Textarea (e.g., "house is fresh and cleaned. call me for further questions")
- **SET LOCATION Button**: Google Maps Integration for precise location
- **Optional Details Section:**
  - Sector: Text input (e.g., "uttara-2")
  - Road: Text input (e.g., "Road 5")
  - House/Plot: Text input (e.g., "House 28/9/A")

#### 2.2.5 Amenities & Services (Screen 4)
**Multi-select Facilities:**
- Lift
- Gas Connection
- Generator
- CCTV
- WiFi
- Garage
- Security Alarm

**Availability:**
- Available From: Date picker
- Deadline: Date picker

#### 2.2.6 Photo Upload (Screen 4)
**Image Requirements:**
- Minimum: 2 images
- Maximum: 6 images
- First image serves as thumbnail/display image
- Image compression and optimization
- **SELECT ADDITIONAL IMAGES Button**: Camera/gallery access
- Clear instructions: "First images will be Thumbnails/Display image"
- Visual feedback: Dashed border upload area

#### 2.2.7 Identity Verification (Final Screen)
**ONE-TIME ID PROVE Section:**
- **Purpose**: Verification and trust building
- **Accepted Documents**: 
  - Passport
  - National ID
  - Driving License
- **Upload Requirements**:
  - Front side of ID (SELECT FRONT button)
  - Back side of ID (SELECT BACK button)
- **Submit for Review Button**: Final submission with house icon

### 2.3 Property Discovery & Viewing

#### 2.3.1 Home Screen
**Header:**
- TO LET logo with house icon
- Notification bell icon
- Category filter tabs (Family, Office, Sublet, Bachelor, etc.)

**Filter Bar:**
- Filter icon: Advanced filtering options
- Location icon: Location-based search
- Newest: Sort dropdown (Newest, Price, Distance)

**Property Grid:**
- Card-based layout with property images
- Distance indicator (e.g., "157.48km")
- Property title (e.g., "Family Room", "Family Flat")
- Location subtitle (e.g., "Mohakhali, Dhaka", "North Kafrul, Kachukhet, Dhaka")
- Image thumbnails showing actual property photos

#### 2.3.2 Property Detail View
**Layout:**
1. **Photo Gallery**: Swipeable image carousel
2. **Property Title**: Auto-generated or custom
3. **Specifications**: Room details, amenities, restrictions
4. **Pricing Information**: Rent amount and period
5. **Location**: Map view and address
6. **Contact Access**: Credit-gated contact information

### 2.4 Credit System

#### 2.4.1 Credit Requirements
- **Property Upload**: 20 credits per listing
- **Contact View**: 10 credits per contact number access
- **Photo View**: 10 credits per property photo gallery

#### 2.4.2 Credit Purchase Packages
**Admin-Configurable Packages:**
- Package Name: Customizable
- Credit Amount: Variable
- Price in BDT: Variable
- "Buy Now" button leading to payment gateway

#### 2.4.3 Credit Top-up Flow
1. User selects package
2. Redirected to payment page
3. Payment confirmation
4. Credits added to account
5. Push notification confirmation

### 2.5 Payment Integration

#### 2.5.1 Supported Payment Methods
- **bKash**: Mobile financial service
- **Nagad**: Digital payment platform  
- **Rocket**: Mobile banking service
- **Bank Transfer**: Traditional banking option

#### 2.5.2 Payment Flow
1. User selects credit package
2. Choose payment method (bKash/Nagad/Rocket)
3. Redirect to respective payment gateway
4. Payment confirmation
5. Credits added to user account
6. SMS/Push notification sent
7. Return to app with success message
**Gated Contact Access:**
- Contact numbers hidden behind paywall
- Option 1: Watch advertisement (if implemented)
- Option 2: Spend 10 credits
- After payment/ad viewing, contact number revealed

## 3. User Roles & Permissions

### 3.1 Property Owners
- Create and manage property listings
- Upload photos and descriptions
- Update availability and pricing
- View listing analytics (future feature)

### 3.2 Tenants/Seekers
- Browse available properties
- Filter and search listings
- Purchase credits for contact access
- Save favorite properties (future feature)

### 3.3 Admin
- Manage credit packages (CRUD operations)
- Monitor platform usage and analytics
- Handle disputes and customer support
- Content moderation and listing approval
- Identity verification review
- Payment transaction monitoring
- User management and blocking capabilities

## 4. Technical Requirements

### 4.1 Mobile App (Flutter)
- Cross-platform compatibility (iOS/Android)
- Offline capability for saved listings
- Push notification integration
- Camera/gallery access for photo upload
- Google Maps integration
- Responsive design

### 4.2 Web Platform (Next.js)
- Responsive web design
- SEO optimization
- Server-side rendering
- Progressive Web App capabilities

### 4.3 Backend (Supabase)
- Real-time database
- Authentication system
- File storage for images
- Row Level Security (RLS)
- API endpoints for CRUD operations

### 4.4 Integrations
- **OneSignal**: Push notifications
- **Google Maps API**: Location services
- **Payment Gateway**: Credit purchases (bKash, Nagad, etc.)
- **Image CDN**: Optimized image delivery

## 5. Database Schema Overview

### 5.1 Core Tables
```sql
-- Users
users (id, email, phone, name, credits, verified, created_at, updated_at)

-- Properties  
properties (id, user_id, title, category, property_type, rooms, bathrooms, balcony, floor_level, restrictions, size, rent_amount, rent_period, state, area, contact_number, short_description, sector, road, house_plot, lat, lng, available_from, deadline, status, views, created_at, updated_at)

-- Property Images
property_images (id, property_id, image_url, is_thumbnail, display_order, created_at)

-- Property Amenities
property_amenities (id, property_id, amenity_type, created_at)

-- Credit Packages (Admin Configurable)
credit_packages (id, package_name, credits_amount, price_bdt, active, created_at, updated_at)

-- Credit Transactions
credit_transactions (id, user_id, package_id, credits_purchased, amount_paid, payment_method, transaction_id, status, created_at)

-- Contact Views (Credit Spending Tracking)
contact_views (id, user_id, property_id, credits_spent, viewed_at)

-- Photo Views (Credit Spending Tracking)
photo_views (id, user_id, property_id, credits_spent, viewed_at)

-- User Identity Verification
user_verifications (id, user_id, id_type, front_image_url, back_image_url, verification_status, admin_notes, submitted_at, reviewed_at)

-- Property Categories
categories (id, name, icon_url, active, display_order)

-- User Orders/Bookings
user_orders (id, user_id, property_id, status, inquiry_message, contact_attempted_at, created_at, updated_at)
```

## 6. Success Metrics

### 6.1 User Engagement
- Daily/Monthly Active Users
- Property listing completion rate
- Contact view conversion rate
- Credit purchase rate

### 6.2 Business Metrics
- Revenue from credit sales
- Number of successful property connections
- Average time to rent
- User retention rate

## 7. Future Enhancements

### 7.1 Phase 2 Features
- In-app messaging between owners and tenants
- Property comparison tool
- Advanced filtering (nearby schools, hospitals, etc.)
- Property rating and review system
- Verified property badges

### 7.2 Phase 3 Features
- Virtual property tours
- Rental agreement templates
- Payment processing for rent
- Property management tools for landlords
- AI-powered property recommendations

## 8. Launch Strategy

### 8.1 MVP Scope
- Core property listing and discovery
- Credit system implementation
- Basic user profiles
- Contact gating mechanism

### 8.2 Beta Testing
- Invite select property owners and tenants
- Gather feedback on user experience
- Refine credit pricing strategy
- Optimize search and discovery features

## 9. Risk Assessment

### 9.1 Technical Risks
- Google Maps API rate limiting
- Image storage costs scaling
- Payment gateway integration complexity

### 9.2 Business Risks
- Credit pricing acceptance by users
- Competition from established platforms
- User acquisition costs

### 9.3 Mitigation Strategies
- Implement efficient caching for maps
- Optimize image compression and CDN usage
- A/B test different credit pricing models
- Focus on unique value proposition (local market focus)

---

**Document Version**: 1.0  
**Last Updated**: September 21, 2025  
**Next Review**: October 21, 2025