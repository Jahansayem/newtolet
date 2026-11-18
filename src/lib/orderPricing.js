// Order Home service charge shown on the website. Display only: the amount that
// is actually charged comes from the database function order_home_pricing()
// (supabase/migrations/20261118100000_order_eps_payment.sql). Change both
// together; tests/orderPricing.test.mjs fails when they drift apart.
// Pure module, safe for node --test.

export const ORDER_REGULAR_PRICE_BDT = 1000
export const ORDER_DISCOUNT_PERCENT = 50

export const getOrderPricing = () => {
  const payable = Math.round(ORDER_REGULAR_PRICE_BDT * (100 - ORDER_DISCOUNT_PERCENT) / 100)

  return {
    regular: ORDER_REGULAR_PRICE_BDT,
    discountPercent: ORDER_DISCOUNT_PERCENT,
    payable,
    hasDiscount: payable < ORDER_REGULAR_PRICE_BDT,
  }
}

/** An order the customer still has to pay for. */
export const isOrderAwaitingPayment = (order) => order?.status === 'pending_payment'
