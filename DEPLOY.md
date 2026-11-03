# Taking giffycardsLLC live

This is the step-by-step path from the downloaded folder to a real website people
can visit, pay on, and that works with a keyboard and screen reader.

The project is a normal Node/Express app, so it runs on any host that runs Node.
Because it writes orders to a file and needs a long-running server, pick a host that
runs a **persistent server** (Render, Railway, Fly.io, or your own VPS) rather than a
serverless-only platform. Three ready-made options are included.

---

## Option A — Render (easiest, uses the included blueprint)

1. Put this folder in a GitHub repository (see "Getting it into GitHub" below).
2. Go to https://render.com, sign in, and choose **New + → Blueprint**.
3. Point it at your repo. Render reads `render.yaml` and sets the service up for you,
   including a persistent disk so your orders file survives restarts.
4. When it asks, paste your secrets:
   - `STRIPE_SECRET_KEY` — your `sk_test_...` (switch to `sk_live_...` when ready)
   - `PUBLIC_URL` — the URL Render gives you (e.g. `https://giffycards.onrender.com`)
   - `STRIPE_WEBHOOK_SECRET` — fill this after step 6 below
5. Deploy. Your site is now live at the Render URL.
6. **Webhook:** in the Stripe Dashboard → Developers → Webhooks → Add endpoint, use
   `https://YOUR-RENDER-URL/api/webhook`, subscribe to `checkout.session.completed`,
   copy its signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` in Render, and
   redeploy.

## Option B — Any Docker host (Fly.io, a VPS, etc.)

A `Dockerfile` is included.
```bash
docker build -t giffycards .
docker run -p 4242:4242 --env-file .env giffycards
```
Set the same environment variables (`.env.example` lists them). On Fly.io,
`fly launch` detects the Dockerfile; add your secrets with `fly secrets set`.

## Option C — Railway / Heroku-style

A `Procfile` is included (`web: node server.js`). Create a project from your repo,
add the environment variables in the dashboard, and deploy.

---

## Getting it into GitHub

```bash
cd giffycards            # this folder
git init
git add .
git commit -m "giffycardsLLC store"
# create an empty repo on github.com, then:
git remote add origin https://github.com/YOUR-USERNAME/giffycards.git
git push -u origin main
```
`.gitignore` already keeps your `.env` and `node_modules` out of the repo.

## Your custom domain

Every host above has a "Custom Domain" setting. Buy a domain (Namecheap, Cloudflare,
Porkbun), add it in the host's dashboard, and follow its DNS instructions (usually one
CNAME record). Then set `PUBLIC_URL` to `https://yourdomain.com` and redeploy so
Stripe's success/cancel links point at the real domain.

---

## Accessibility (already built in)

The storefront is built to be usable without a mouse or with a screen reader:

- A **"Skip to gift cards"** link appears when you press Tab first.
- Every control has a **visible keyboard focus ring**.
- The cart is a proper **modal dialog**: opening it moves focus inside, Tab is trapped
  within it, Escape closes it, and focus returns to the Cart button afterward.
- The cart button announces its item count to screen readers, and updates live.
- Animations respect the **"reduce motion"** OS setting.
- Colors meet contrast in both light and dark themes.

Worth a quick manual check before launch: tab through the whole page, open and close the
cart with the keyboard only, and run a free audit (Chrome DevTools → Lighthouse →
Accessibility, or the axe DevTools extension).

---

## Before you sell for real — read this

- **Test mode first.** Keep `sk_test_...` until a full test purchase (card
  `4242 4242 4242 4242`) flows through and lands in `data/orders.json`. Only then switch
  to live keys.
- **Fulfillment is manual.** Paid orders queue in `data/orders.json` with the buyer's
  email and what they bought. You deliver the real card codes, then mark the order
  `"fulfilled": true`. The `TODO` in `server.js` marks where to automate this later.
- **On ephemeral hosts, the orders file can reset on redeploy.** Render's included disk
  avoids this; on other hosts attach a persistent volume or move orders to a database
  before taking real money.
- **High-value digital goods draw payment-processor scrutiny.** Large gift-card orders on
  a new Stripe account commonly trigger holds or reviews. Build history gradually.
- **Regulations.** Selling prepaid/stored-value at scale can bring money-transmitter and
  anti-money-laundering obligations that vary by state. Check the rules where you operate
  before launching at high denominations. These are pointers, not legal advice.
