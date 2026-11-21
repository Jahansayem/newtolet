// Order Home service charge shown on the website. Display only.
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
