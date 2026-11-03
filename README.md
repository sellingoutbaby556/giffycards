# giffycardsLLC — Stripe Checkout backend

A small, production-shaped Node/Express app for a gift-card storefront. It serves the
shop, creates **Stripe Checkout** sessions with server-side prices, and records paid
orders so you can fulfill them. Card codes are **fulfilled manually** for now — the app
records each paid order to `data/orders.json`, which acts as your fulfillment queue.

## Why there's a backend at all

A storefront page by itself **cannot** safely take card payments:

- Your Stripe **secret key** must never be in browser code — anyone can read a web
  page's source. It lives only on this server, in `.env`.
- Payment must be **confirmed by Stripe** (via a webhook) before you treat an order as
  paid. The browser saying "I paid" is not proof.
- Prices must be decided by the **server**, not sent from the browser, or a tampered
  client could pay $1 for a $5,000 card. Prices live in `catalog.js`.

The customer's actual card details are entered on **Stripe's own hosted checkout page**,
never on your site, which keeps you out of the heaviest PCI-compliance scope.

## What's in here

```
server.js         Express app: static hosting + /api/checkout + /api/webhook
catalog.js        Products, denominations, stock, and the authoritative prices
public/
  index.html      The storefront (calls /api/checkout)
  success.html    Shown after a successful payment
data/             Paid orders are written here (orders.json) — your fulfillment queue
.env.example      Copy to .env and fill in your Stripe keys
```

## Setup

### 1. Install
```bash
npm install
```

### 2. Add your Stripe keys
Create a Stripe account, then from the Dashboard → Developers → API keys copy your
**test** secret key. Copy the example env file and paste it in:
```bash
cp .env.example .env
# edit .env: set STRIPE_SECRET_KEY=sk_test_...
```
Leave everything in **test mode** until you've tested the whole flow.

### 3. Run it
```bash
npm start
# -> Gift-card store running on http://localhost:4242
```
Open http://localhost:4242, add cards, click Checkout. You'll land on Stripe's hosted
checkout. Use Stripe's test card **4242 4242 4242 4242**, any future expiry, any CVC.

### 4. Receive the webhook locally
Payment confirmation arrives via a webhook. To receive it on your machine, install the
[Stripe CLI](https://stripe.com/docs/stripe-cli), then in a second terminal:
```bash
stripe listen --forward-to localhost:4242/api/webhook
```
The CLI prints a signing secret (`whsec_...`). Put it in `.env` as
`STRIPE_WEBHOOK_SECRET=` and restart the server. Now completed test payments will be
written to `data/orders.json`.

## Fulfilling orders

Each paid order lands in `data/orders.json` with the buyer's email and exactly which
cards + denominations they bought. Deliver the real codes from your supplier, then set
that order's `"fulfilled"` field to `true` so you know it's handled. When you're ready to
automate this, the webhook handler in `server.js` has a clearly marked `TODO` showing the
exact spot to pull and email codes.

## Going live

1. In `.env`, swap the test key for your **live** secret key (`sk_live_...`).
2. Set `PUBLIC_URL` to your real domain.
3. Deploy (any Node host works — Render, Railway, Fly.io, a VPS; or adapt `/api/*` into
   serverless functions for Vercel/Netlify/Cloudflare).
4. In the Stripe Dashboard → Developers → Webhooks, add a **live** endpoint pointing at
   `https://yourdomain.com/api/webhook` and copy its signing secret into your production
   env.
5. Point your domain's DNS at the host.

## Important notes before selling for real

- **High-value digital goods get scrutiny.** Large gift-card transactions on a new Stripe
  account commonly trigger holds or reviews. Build transaction history gradually.
- **Reselling branded cards** (Visa, Amazon, etc.) generally requires being an authorized
  reseller or going through a distributor (Blackhawk Network, InComm). Selling your own
  store credit is simpler.
- **Regulations.** Selling prepaid/stored-value at scale can bring money-transmitter and
  anti-money-laundering obligations, which vary by state. Check with someone who knows the
  rules for where you operate before launching at high denominations.

These are pointers, not legal advice.
