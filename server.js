// server.js
// A minimal, production-shaped Stripe Checkout backend for a gift-card store.
//
// What it does:
//   1. Serves the storefront (public/index.html).
//   2. POST /api/checkout  -> builds a Stripe Checkout Session from server-side prices
//                             and returns the hosted-checkout URL to redirect to.
//   3. POST /api/webhook   -> Stripe calls this after payment; we verify the signature
//                             and record the paid order to data/orders.json.
//
// What it deliberately does NOT do:
//   - It never trusts a price sent by the browser. Prices come from catalog.js.
//   - It never touches your Stripe secret key in client code. The key stays here.
//   - Fulfillment (handing out real card codes) is manual: orders are recorded,
//     and you fill them from your own supplier. Swapping in auto-fulfillment later
//     is a change to the webhook handler only (see the TODO there).

import "dotenv/config";
import express from "express";
import Stripe from "stripe";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { DENOMS, PRODUCT, STORE_NAME, isSellable, labelFor } from "./catalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Required config (set these in .env) ----
const {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  PUBLIC_URL = "http://localhost:4242",
  PORT = 4242,
  CURRENCY = "usd",
} = process.env;

if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);
const app = express();
const ORDERS_FILE = join(__dirname, "data", "orders.json");

// ---------------------------------------------------------------------------
// Webhook route MUST come before express.json(), because Stripe signature
// verification needs the raw, unparsed request body.
// ---------------------------------------------------------------------------
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;
    try {
      if (!STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET not set");
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // We only act once payment is actually complete and paid.
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const order = {
          orderId: session.id,
          paidAt: new Date().toISOString(),
          email: session.customer_details?.email || session.customer_email || null,
          name: session.customer_details?.name || null,
          amountTotal: session.amount_total, // in the smallest currency unit (cents)
          currency: session.currency,
          // the line items we encoded at checkout time, so we know what to fulfill
          items: safeParse(session.metadata?.items) || [],
          fulfilled: false, // <- you flip this to true after you hand out codes
        };
        await recordOrder(order);
        console.log(`✓ Recorded paid order ${order.orderId} (${order.email})`);

        // TODO (auto-fulfillment, later): this is the exact spot to pull real codes
        // from your supplier / code pool and email them. For now orders.json is
        // your fulfillment queue — ship codes manually, then mark fulfilled.
      }
    }

    res.json({ received: true });
  }
);

// JSON parsing for the rest of the API
app.use(express.json());
// Serve the storefront
app.use(express.static(join(__dirname, "public")));

// ---------------------------------------------------------------------------
// Create a Checkout Session.
// Body: { items: [ { id: "vault", denom: 500, qty: 2 }, ... ] }
// Returns: { url: "https://checkout.stripe.com/..." }
// ---------------------------------------------------------------------------
app.post("/api/checkout", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const line_items = [];
    const recorded = []; // compact list stored in metadata for fulfillment

    for (const raw of items) {
      const id = String(raw.id || "");
      const denom = Number(raw.denom);
      const qty = Math.max(1, Math.min(50, parseInt(raw.qty, 10) || 0));

      // Validate against the SERVER catalog — never trust client prices.
      if (!isSellable(id, denom)) {
        return res
          .status(400)
          .json({ error: `Item not available: ${id} ${denom}` });
      }

      line_items.push({
        quantity: qty,
        price_data: {
          currency: CURRENCY,
          unit_amount: denom * 100, // dollars -> cents, from the trusted catalog
          product_data: {
            name: labelFor(denom),
            description: PRODUCT.description,
          },
        },
      });
      recorded.push({ id, denom, qty });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      // Collect the buyer's email so we can send codes / a receipt.
      customer_creation: "if_required",
      billing_address_collection: "auto",
      success_url: `${PUBLIC_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/?canceled=1`,
      metadata: {
        // Stripe metadata values must be strings; we JSON-encode the cart.
        items: JSON.stringify(recorded),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Could not start checkout." });
  }
});

// Small helper endpoint so the storefront can read the catalog from one place.
app.get("/api/catalog", (_req, res) => {
  res.json({
    store: STORE_NAME,
    productId: PRODUCT.id,
    denoms: DENOMS,
    stock: PRODUCT.stock,
  });
});

// ---- helpers ----
function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

async function recordOrder(order) {
  await mkdir(join(__dirname, "data"), { recursive: true });
  let orders = [];
  try {
    orders = JSON.parse(await readFile(ORDERS_FILE, "utf8"));
  } catch {
    orders = [];
  }
  orders.push(order);
  await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

app.listen(PORT, () => {
  console.log(`${STORE_NAME} running on ${PUBLIC_URL} (port ${PORT})`);
  console.log(`Stripe mode: ${STRIPE_SECRET_KEY.startsWith("sk_live") ? "LIVE ⚠️" : "test"}`);
});
