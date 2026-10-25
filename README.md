# WurstWerk

Website for WurstWerk — German style sausage, dropped off to your door. Live at **https://wurstwerk.party**.

The code lives on GitHub. A Cloudflare **Worker** named `wurstwerk` (Workers Builds, connected to this repo) runs `npx wrangler deploy` on every push to `main`, so commits go live in about a minute. Cloudflare also runs the domain's DNS and forwards the site's email addresses.

## What's here

| Path | Purpose |
|---|---|
| `public/index.html` | The whole site: landing, drop-off ordering, event booking |
| `public/menu.json` | Menu items, prices and descriptions (read by the page *and* the payment code) |
| `public/img/` | Logos (emblem, neon badge, butcher badge, favicon) |
| `worker.js` | Worker entry: sends `/api/*` to the payment code, everything else to `public/` |
| `functions/api/config.js` | Tells the page whether Square payments are switched on |
| `functions/api/pay.js` | Charges the card through Square; prices the cart from `public/menu.json` |
| `wrangler.jsonc` | Worker config: name, custom domains, static files folder |

Only the `public/` folder is published as website files. No build step.

## Editing the menu, prices and emails

- **Menu and prices:** edit `public/menu.json`. Prices are in dollars (e.g. `"price": 10`). Keep each item's `id` unchanged once orders are live.
- **Emails and drop-off hours:** open `public/index.html` and find the `EDIT ME` block near the bottom:
  - `orderEmail` — where orders are sent when online payment is off
  - `eventEmail` — where event inquiries go
  - `dropoffStart` / `dropoffEnd` / `slotMinutes` — drop-off time slots

To change a file on github.com: open it, click the pencil icon, edit, then **Commit changes**. Cloudflare deploys the update within about a minute.

## Cloudflare setup (already done)

- **Worker:** `wurstwerk`, connected to `ayoho3-cmyk/wurstwerk`, branch `main`, deploy command `npx wrangler deploy`, root `/`.
- **Custom domains:** `wurstwerk.party`, `www.wurstwerk.party`, `wurstwerk.wurstwerk.party` — declared in `wrangler.jsonc`. Add or remove domains there, not in the dashboard, or the next deploy will put them back.
- **Email routing:** Cloudflare → `wurstwerk.party` → **Email → Email Routing**. Route `orders@` and `events@` to your inbox (verify the destination address once). Forwarding is receive-only.

## Square payments

Until all four values are set, the site automatically falls back to email ordering (pay at drop-off).

1. Square Developer Console → app **WurstWerk Website** → **Credentials** / **Locations**.
2. Cloudflare → **Workers & Pages → wurstwerk → Settings → Variables and Secrets → Add**:

   | Name | Type | Sandbox value | Production value |
   |---|---|---|---|
   | `SQUARE_ENV` | Text | `sandbox` | `production` |
   | `SQUARE_APPLICATION_ID` | Text | `sandbox-sq0idb-dtEmvQIwCGr-_wmu23Oorw` | Production Application ID (`sq0idp-…`) |
   | `SQUARE_LOCATION_ID` | Text | `L16S2BCG76PAJ` (Default Test Account) | Your real location's ID |
   | `SQUARE_ACCESS_TOKEN` | **Secret** | Sandbox access token | Production access token |

   All four must come from the same mode. `wrangler.jsonc` sets `keep_vars: true`, so deploys never wipe these.
3. **Deploy** (save the variables with *Deploy*, or push any commit).
4. Test on the live site with Square's sandbox card `4111 1111 1111 1111`, any future expiry, any CVV, any ZIP. Payments appear in the Square **Sandbox** dashboard.
5. To go live, replace all four with the production values and deploy.

Never put the access token in the code or the repository — it only goes in Cloudflare as a Secret.

## How orders work

**With Square on:** the customer pays by card in the cart. The Worker re-prices the cart from `public/menu.json` and charges it through Square. The payment's note in your Square dashboard holds everything for the drop-off: time, items, name, phone, address and notes.

**With Square off:** "Send Order" opens the customer's email app with the full order addressed to `orderEmail`, and customers pay at drop-off.

## Local testing

```bash
npx wrangler dev
```

Put test values in a `.dev.vars` file (git-ignored) using the same four names.
