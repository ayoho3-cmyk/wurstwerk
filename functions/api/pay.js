// POST /api/pay — charges a Square card token for the cart.
// The total is always computed here from public/menu.json, never trusted from the browser.
import menu from "../../public/menu.json";

const ITEMS = Object.fromEntries(menu.categories.flatMap(c => c.items).map(i => [i.id, i]));
const SQUARE_VERSION = "2024-10-17";

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  // Trim stray spaces/newlines that sneak in when pasting the token into the dashboard
  const token = String(env.SQUARE_ACCESS_TOKEN || "").trim();
  const locationId = String(env.SQUARE_LOCATION_ID || "").trim();
  if (!token || !locationId) {
    return json({ error: "Online payments are not set up yet." }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request." }, 400); }
  const { sourceId, idempotencyKey, items, customer = {} } = body || {};

  if (typeof sourceId !== "string" || !sourceId || sourceId.length > 500) {
    return json({ error: "Missing card details." }, 400);
  }
  if (typeof idempotencyKey !== "string" || !/^[\w-]{8,45}$/.test(idempotencyKey)) {
    return json({ error: "Bad request." }, 400);
  }

  // Price the cart from the server-side menu
  let cents = 0;
  const lines = [];
  for (const [id, qty] of Object.entries(items || {})) {
    const item = ITEMS[id];
    const q = Number(qty);
    if (!item || !Number.isInteger(q) || q < 1 || q > 50) {
      return json({ error: "Your cart has an invalid item. Please refresh and try again." }, 400);
    }
    cents += Math.round(item.price * 100) * q;
    lines.push(`${q}x ${item.name}`);
  }
  if (!lines.length) return json({ error: "Your cart is empty." }, 400);

  const name = clean(customer.name, 80);
  const phone = clean(customer.phone, 30);
  const email = clean(customer.email, 120);
  const address = clean(customer.address, 200);
  const time = clean(customer.time, 20);
  const notes = clean(customer.notes, 200);
  if (!name || !phone || !address || !time) {
    return json({ error: "Please fill in your name, phone, address and drop-off time." }, 400);
  }

  // Everything you need for the drop-off, visible on the payment in Square
  const note = [
    `DROP-OFF ${time}`,
    lines.join(", "),
    `${name} ${phone}`,
    `Addr: ${address}`,
    notes && `Notes: ${notes}`,
  ].filter(Boolean).join(" | ").slice(0, 500);

  const host = env.SQUARE_ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

  const payment = {
    source_id: sourceId,
    idempotency_key: idempotencyKey,
    amount_money: { amount: cents, currency: "USD" },
    location_id: locationId,
    reference_id: `WW-${idempotencyKey.slice(0, 8)}`,
    note,
  };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) payment.buyer_email_address = email;

  let res, data;
  try {
    res = await fetch(`${host}/v2/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_VERSION,
      },
      body: JSON.stringify(payment),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    return json({ error: "Couldn't reach the payment processor. Please try again." }, 502);
  }

  if (!res.ok || data.payment?.status !== "COMPLETED") {
    const err = data.errors?.[0];
    console.log("Square payment failed", res.status, err?.category, err?.code);
    if (res.status === 401) {
      // Describe the token's shape (never the token) so a bad paste is easy to spot
      const raw = String(env.SQUARE_ACCESS_TOKEN || "");
      console.log("Square token check", {
        length: token.length,
        startsWithEAAA: token.startsWith("EAAA"),
        hadExtraWhitespace: raw !== token,
        looksMasked: /^[•*.\s]+$/.test(token),
        env: env.SQUARE_ENV === "production" ? "production" : "sandbox",
      });
    }
    if (err?.category === "PAYMENT_METHOD_ERROR") {
      return json({ error: "Your card was declined. Please check the details or try another card." }, 402);
    }
    return json({ error: "Payment didn't go through. Your card was not charged — please try again." }, 502);
  }

  return json({
    ok: true,
    total: cents,
    reference: payment.reference_id,
    receiptUrl: data.payment.receipt_url || null,
  });
}
