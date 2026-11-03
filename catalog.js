// catalog.js
// Single source of truth for products and prices.
// IMPORTANT: prices are defined here on the SERVER, never trusted from the browser.
// The client only sends which items it wants; the server looks up the real price.
// This prevents a tampered client from paying $1 for a $5,000 card.

// giffycardsLLC sells one generic gift card in six denominations.
export const DENOMS = [100, 250, 500, 1000, 2500, 5000];

// 25 of every amount in stock.
const PER_DENOM_STOCK = 25;

export const STORE_NAME = "giffycardsLLC";

// One product line; each denomination is its own sellable SKU.
export const PRODUCT = {
  id: "giftcard",
  name: "giffycardsLLC Gift Card",
  description: "A giffycardsLLC gift card. Redeemable in store and online.",
  stock: DENOMS.reduce((acc, d) => { acc[d] = PER_DENOM_STOCK; return acc; }, {}),
};

// Helper: is this denomination a real, in-stock, sellable amount?
export function isSellable(id, denom) {
  if (id !== PRODUCT.id) return false;
  if (!DENOMS.includes(Number(denom))) return false;
  return (PRODUCT.stock[denom] || 0) > 0;
}

// Helper: human label for a line item.
export function labelFor(denom) {
  return `${STORE_NAME} $${Number(denom).toLocaleString("en-US")} Gift Card`;
}
