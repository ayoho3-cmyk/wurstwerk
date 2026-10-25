# WurstWerk

Website for WurstWerk — German style sausage, dropped off to your door. Live at **https://wurstwerk.party**.

The code lives on GitHub; Cloudflare Pages hosts it and redeploys automatically on every commit. Cloudflare also runs the domain's DNS and forwards the site's email addresses.

## What's here

| File | Purpose |
|---|---|
| `index.html` | The whole site: landing, drop-off ordering, event booking |
| `menu.json` | Menu items, prices and descriptions (read by the page *and* the payment code) |
| `functions/api/config.js` | Tells the page whether Square payments are switched on |
| `functions/api/pay.js` | Charges the card through Square; prices the cart from `menu.json` |
| `img/` | Logos (emblem, neon badge, butcher badge, favicon) |

No build step — plain HTML/CSS/JS plus two Cloudflare Pages Functions.

## Editing the menu, prices and emails

- **Menu and prices:** edit `menu.json`. Prices are in dollars (e.g. `"price": 10`). Keep each item's `id` unchanged once orders are live.
- **Emails and drop-off hours:** open `index.html` and find the `EDIT ME` block near the bottom:
  - `orderEmail` — where orders are sent when online payment is off
  - `eventEmail` — where event inquiries go
  - `dropoffStart` / `dropoffEnd` / `slotMinutes` — drop-off time slots

To change a file on github.com: open it, click the pencil icon, edit, then **Commit changes**. Cloudflare publishes the update within about a minute.

## Setup (one time)

### 1. GitHub
1. Create a repository (e.g. `wurstwerk`; private is fine).
2. **Add file → Upload files**, drag in the contents of this folder, and commit.

### 2. Domain on Cloudflare
Skip if `wurstwerk.party` was bought through Cloudflare.
1. Cloudflare dashboard → **Add a domain** → `wurstwerk.party` → **Free** plan.
2. At the registrar, replace the nameservers with the two Cloudflare provides.
3. Wait for Cloudflare's "domain is active" email (minutes to a day).

### 3. Cloudflare Pages
1. **Workers & Pages → Create → Pages → Connect to Git**, authorize GitHub, pick the repo.
2. Build settings:
   - Framework preset: **None**
   - Build command: *(empty)*
   - Build output directory: `/`
3. **Save and Deploy** — the site goes live at `<project>.pages.dev`.

### 4. Custom domain
In the Pages project → **Custom domains → Set up a custom domain**: add `wurstwerk.party`, then `www.wurstwerk.party`. Cloudflare creates the DNS records and HTTPS certificate automatically.

### 5. Email forwarding
1. **Email → Email Routing** → enable (Cloudflare adds the MX/TXT records).
2. Add routes:
   - `orders@wurstwerk.party` → your personal inbox
   - `events@wurstwerk.party` → your personal inbox
3. Click the verification link Cloudflare emails you.

Forwarding is receive-only; replies go out from your personal address.

### 6. Square payments
Until these are set, the site automatically falls back to email ordering (pay at drop-off).

1. Sign in at **developer.squareup.com** with your Square account → **Create an application** (e.g. "WurstWerk Website").
2. In Cloudflare: Pages project → **Settings → Variables and Secrets**, add for **Production**:

   | Name | Value | Type |
   |---|---|---|
   | `SQUARE_ENV` | `sandbox` (switch to `production` when ready) | Text |
   | `SQUARE_APPLICATION_ID` | Application ID (Credentials page) | Text |
   | `SQUARE_LOCATION_ID` | Location ID (Locations page) | Text |
   | `SQUARE_ACCESS_TOKEN` | Access token (Credentials page) | **Secret** |

   Use the **Sandbox** credentials and sandbox location while `SQUARE_ENV` is `sandbox`, and the **Production** ones once it's `production` — they must match.
3. **Deployments → Retry deployment** (variables apply on the next deploy).
4. Test on the live site with Square's sandbox card `4111 1111 1111 1111`, any future expiry, any CVV, any ZIP. Payments show up in the Square **Sandbox** dashboard.
5. When it works, swap all three IDs/token to production, set `SQUARE_ENV` to `production`, and redeploy.

Never put the access token in the code or the repository — it only goes in Cloudflare as a Secret.

## How orders work

**With Square on:** the customer pays by card in the cart. The server re-prices the cart from `menu.json` and charges it through Square. The payment's note in your Square dashboard holds everything for the drop-off: time, items, name, phone, address and notes.

**With Square off:** "Send Order" opens the customer's email app with the full order addressed to `orderEmail`, and customers pay at drop-off.
