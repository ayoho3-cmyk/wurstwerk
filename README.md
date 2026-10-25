# WurstWerk

Website for WurstWerk — German style sausage, dropped off to your door. Live at **https://wurstwerk.party**.

The code lives on GitHub; Cloudflare Pages hosts it and redeploys automatically on every commit. Cloudflare also runs the domain's DNS and forwards the site's email addresses.

## What's here

| File | Purpose |
|---|---|
| `index.html` | The whole site: landing, drop-off ordering, event booking |
| `img/` | Logos (emblem, neon badge, butcher badge, favicon) |

No build step — it's plain HTML, CSS and JavaScript.

## Editing the menu, prices and emails

Open `index.html` and find the `EDIT ME` block near the bottom:

- `orderEmail` — where drop-off orders are sent
- `eventEmail` — where event inquiries go
- `dropoffStart` / `dropoffEnd` / `slotMinutes` — drop-off time slots
- `menu` — categories, items, prices and descriptions

To change it on github.com: open `index.html`, click the pencil icon, edit, then **Commit changes**. Cloudflare publishes the update within about a minute.

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

## How orders work

There is no server or online payment. "Send Order" opens the customer's email app with the full order (items, total, name, phone, address, drop-off time, notes) addressed to `orderEmail`. Customers pay at drop-off.
