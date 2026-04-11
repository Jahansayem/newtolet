# Payment System Documentation

## Overview
Complete payment integration system for credit purchases with support for bKash, Nagad, and Rocket payment gateways.

## Payment Flow

### 1. User Selects Credit Package
- User navigates to `/orderhome`
- Views available credit packages with pricing and discounts
- Clicks "Buy Now" on desired package

### 2. Choose Payment Method
- Modal opens showing payment gateway options:
  - **bKash** (📱)
  - **Nagad** (💳)
  - **Rocket** (🚀)
- User enters their phone number for the selected gateway
- Validation ensures correct Bangladesh phone format (01XXXXXXXXX)

### 3. Payment Confirmation
- Review order summary with:
  - Package name and credits
  - Original price
  - Discount percentage
  - Final amount
- Shows payment flow steps
- Security assurance message

### 4. Process Payment
- User clicks "Confirm & Pay"
- Redirected to payment gateway (simulated in development)
- Payment is processed
- Transaction status updated in database

### 5. Payment Confirmation
- Success/Error page displays
- If successful:
  - ✓ Credits added to user account
  - ✓ SMS notification sent
  - ✓ Push notification sent
  - ✓ Transaction logged
  - Auto-redirect to home after 5 seconds

### 6. Return to App
- User can view updated credit balance
- Access payment history
- Use credits for properties and features

---

## Credit Packages

### Available Packages

#### 1. **Starter** - 100 Credits
- Price: ৳500
- Discount: 0%
- Final Price: ৳500
- Use: 5 property listings OR 10 contact views

#### 2. **Basic** - 300 Credits
- Price: ৳1,200
- Discount: 5%
- Final Price: ৳1,140
- Use: 15 property listings OR 30 contact views

#### 3. **Professional** - 1,000 Credits ⭐ POPULAR
- Price: ৳3,500
- Discount: 12%
- Final Price: ৳3,080
- Use: 50 property listings OR 100 contact views

#### 4. **Enterprise** - 5,000 Credits
- Price: ৳15,000
- Discount: 20%
- Final Price: ৳12,000
- Use: 250 property listings OR 500 contact views

---

## Credit Usage

### Costs
- **Post Property**: 20 credits
- **View Contact Number**: 10 credits
- **View Photo Gallery**: 10 credits

### Validity
- Credits are valid for 90 days from purchase
- Unused credits expire after 90 days
- Can purchase multiple packages (credits accumulate)

---

## File Structure

### Services
```
src/services/
├── paymentService.js          # Payment logic and gateways
├── creditService.js           # Credit management
└── adminService.js            # Admin operations
```

### Components
```
src/Component/Navber/
├── Orderhome.jsx              # Main payment page
├── PaymentMethodSelector.jsx  # Gateway selection
├── PaymentConfirmation.jsx    # Order confirmation
├── PaymentConfirmPage.jsx     # Payment processing
└── PaymentHistory.jsx         # Transaction history
```

---

## API Endpoints & Services

### Payment Service Functions

#### `getCreditPackages()`
Returns all available credit packages with pricing and details.

```javascript
const packages = getCreditPackages();
// Returns: Array of package objects
```

#### `getPaymentGateways()`
Returns all available payment methods.

```javascript
const gateways = getPaymentGateways();
// Returns: [bKash, Nagad, Rocket]
```

#### `createPaymentTransaction(userId, packageId, paymentMethod)`
Creates a new payment transaction record.

```javascript
const result = await createPaymentTransaction(
  'user-id',
  2,  // package ID
  'bkash'
);
// Returns: { data: transaction, error: null }
```

#### `completePayment(transactionId)`
Completes payment and adds credits to user account.

```javascript
const result = await completePayment('TXN-123-ABC');
// Updates transaction status to 'success'
// Adds credits to user
// Logs the transaction
```

#### `getPaymentHistory(userId, limit)`
Retrieves user's payment history.

```javascript
const result = await getPaymentHistory('user-id', 20);
// Returns: { data: [...payments], error: null }
```

#### `calculatePrice(packageId)`
Calculates final price with discount.

```javascript
const pricing = calculatePrice(1);
// Returns: {
//   originalPrice: 500,
//   discount: 0,
//   discountAmount: 0,
//   finalPrice: 500,
//   credits: 100,
//   pricePerCredit: '5.00'
// }
```

#### `sendSmsNotification(phoneNumber, message)`
Sends SMS notification (integrated with actual SMS service in production).

```javascript
await sendSmsNotification('01712345678', 'Payment successful!');
```

#### `sendPushNotification(userId, title, body)`
Sends push notification to user.

```javascript
await sendPushNotification('user-id', 'Payment Successful', 'Credits added!');
```

---

## Database Schema

### payment_transactions Table
```sql
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  transaction_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10, 2),
  status VARCHAR(50),           -- pending, success, failed, cancelled
  payment_method VARCHAR(100),  -- bkash, nagad, rocket
  description TEXT,
  package_id INTEGER,
  credits_to_add INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### credit_transactions Table
```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  credits_deducted INTEGER,
  transaction_type VARCHAR(100), -- credit_purchase, property_listing, contact_view
  payment_transaction_id UUID,
  created_at TIMESTAMP
)
```

---

## Component Usage

### Orderhome (Main Page)
```javascript
import Orderhome from './Component/Navber/Orderhome';

// Features:
// - Current credit balance display
// - Credit package grid with pricing
// - Payment method selection
// - Payment history tab
// - FAQ section
```

### PaymentMethodSelector Modal
```javascript
<PaymentMethodSelector
  package_={selectedPackage}
  gateways={gateways}
  onGatewaySelected={handleGatewaySelected}
  onClose={handleCloseMethodSelector}
/>
```

### PaymentConfirmation Modal
```javascript
<PaymentConfirmation
  package_={selectedPackage}
  gateway={selectedGateway}
  onConfirm={handleConfirmPayment}
  onCancel={handleCloseConfirmation}
  loading={loading}
/>
```

### PaymentConfirmPage
Routes to `/payment-confirm?transactionId=XXX`

Automatically:
- Processes payment
- Updates transaction status
- Adds credits to user
- Sends notifications
- Redirects after 5 seconds

---

## Integration with Payment Gateways

### Current Implementation (Simulated)
For development/testing, payments are simulated with:
- 2-second delay to simulate processing
- Random reference number generation
- Success response by default

### Production Integration
To integrate real payment gateways:

#### bKash Integration
1. Register at bKash Merchant Portal
2. Get API credentials
3. Update `paymentService.js`:
```javascript
const bkashConfig = {
  appKey: 'YOUR_APP_KEY',
  appSecret: 'YOUR_APP_SECRET',
  baseUrl: 'https://api.bkashapp.com/v1'
}
```

#### Nagad Integration
1. Register at Nagad Merchant Dashboard
2. Get API credentials
3. Implement Nagad API calls

#### Rocket Integration
1. Register at Rocket Money
2. Get API credentials
3. Implement Rocket API calls

---

## Error Handling

### Transaction Errors
- **Insufficient Balance**: User doesn't have enough balance in payment method
- **Invalid Phone Number**: Phone format validation fails
- **Network Error**: Payment gateway unreachable
- **Timeout**: Payment processing takes too long

### Recovery Options
- Retry payment
- Try different payment method
- Contact support with Transaction ID

---

## Security Features

### Data Protection
✓ All payments encrypted (SSL/TLS)
✓ PCI DSS compliance (when integrated with real gateways)
✓ No credit card storage
✓ Secure transaction logging

### User Verification
✓ Phone number validation (Bangladesh format)
✓ User authentication required
✓ Transaction ID generation (unique)
✓ SMS OTP verification (when integrated)

---

## Testing Payment Flow

### Test Credentials
```
bKash:  01717654321
Nagad:  01234567890
Rocket: 01777777777
```

### Test Packages
```
1. Starter (100 credits) - ৳500
2. Basic (300 credits) - ৳1,140
3. Professional (1000 credits) - ৳3,080 ⭐
4. Enterprise (5000 credits) - ৳12,000
```

### Step-by-Step Test
1. Go to `/orderhome`
2. Click on any package
3. Select payment method (bKash/Nagad/Rocket)
4. Enter test phone number
5. Review confirmation
6. Click "Confirm & Pay"
7. Wait for processing
8. See success message
9. Check payment history

---

## Features

### Overview Tab
- Current credit balance
- Feature costs (properties, contacts, photos)
- All credit packages with detailed pricing
- Popular package highlighted
- Discount savings displayed
- FAQ section

### Payment History Tab
- Transaction count
- Total amount spent
- Total credits purchased
- Filter by status (All, Success, Pending, Failed)
- Detailed transaction table with:
  - Date and time
  - Transaction ID
  - Payment method
  - Amount
  - Credits received
  - Status badge
- View detailed transaction info
- Download receipt (future feature)

---

## Settings & Configuration

### Credit Package Configuration
Edit in `paymentService.js`:
```javascript
const CREDIT_PACKAGES = [
  {
    id: 1,
    name: 'Starter',
    credits: 100,
    price: 500,
    discount: 0,
    popular: false
  },
  // ... more packages
]
```

### Payment Gateway Configuration
Edit in `paymentService.js`:
```javascript
const PAYMENT_GATEWAYS = {
  BKASH: { id: 'bkash', name: 'bKash', icon: '📱' },
  NAGAD: { id: 'nagad', name: 'Nagad', icon: '💳' },
  ROCKET: { id: 'rocket', name: 'Rocket', icon: '🚀' }
}
```

---

## Support & Contact

### Error Codes
- `PGRST205`: Database table not found (run migrations)
- `INVALID_PHONE`: Phone number format incorrect
- `INSUFFICIENT_BALANCE`: Payment method has no funds
- `GATEWAY_ERROR`: Payment gateway unavailable

### Contact Support
Users can contact support with:
- Transaction ID (unique identifier)
- Error message
- Payment method used
- Amount attempted

---

## Future Enhancements

### Planned Features
- [ ] Wallet/Balance system
- [ ] Referral bonus credits
- [ ] Auto-renewal subscription
- [ ] Gift card purchases
- [ ] Payment dispute resolution
- [ ] Receipt PDF download
- [ ] Invoice generation
- [ ] Tax calculation
- [ ] Multi-currency support
- [ ] Installment payments

---

## Checklist for Setup

- [ ] Run database migrations (create_missing_tables.sql)
- [ ] Configure payment gateways (future)
- [ ] Set SMS service credentials (Twilio/AWS SNS)
- [ ] Set push notification service (Firebase)
- [ ] Test payment flow end-to-end
- [ ] Configure error notifications
- [ ] Set up transaction logging
- [ ] Enable payment history
- [ ] Test all credit packages
- [ ] Verify credit deduction on usage
