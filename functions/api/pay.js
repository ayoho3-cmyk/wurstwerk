// POST /api/pay — creates an itemized Square order (with sales tax) and charges the card for it.
// Prices and the tax rate always come from public/menu.json, never from the browser.
import menu from "../../public/menu.json";

const ITEMS = Object.fromEntries(menu.categories.flatMap(c => c.items).map(i => [i.id, i]));
const TAX_RATE = Number(menu.taxRate) || 0;            // percent, e.g. 8.25
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

  // Build line items from the server-side menu
  const lineItems = [];
  const lines = [];
  for (const [id, qty] of Object.entries(items || {})) {
    const item = ITEMS[id];
    const q = Number(qty);
    if (!item || !Number.isInteger(q) || q < 1 || q > 50) {
      return json({ error: "Your cart has an invalid item. Please refresh and try again." }, 400);
    }
    lineItems.push({
      uid: id,
      name: item.name,
      quantity: String(q),
      base_price_money: { amount: Math.round(item.price * 100), currency: "USD" },
    });
    lines.push(`${q}x ${item.name}`);
  }
  if (!lineItems.length) return json({ error: "Your cart is empty." }, 400);

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

  const host = env.SQUARE_API_BASE                        // local testing only
    || (env.SQUARE_ENV === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com");
  const reference = `WW-${idempotencyKey.slice(0, 8)}`;

  const square = async (path, payload) => {
    const res = await fetch(`${host}${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_VERSION,
      },
      body: JSON.stringify(payload),
    });
    return { res, data: await res.json().catch(() => ({})) };
  };

  const fail = (step, res, data) => {
    const err = data.errors?.[0];
    console.log(`Square ${step} failed`, res.status, err?.category, err?.code);
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
  };

  try {
    // 1. Itemized order with sales tax — Square calculates the tax and the total
    const order = {
      location_id: locationId,
      reference_id: reference,
      line_items: lineItems,
    };
    if (TAX_RATE > 0) {
      order.taxes = [{ uid: "sales-tax", name: "Sales Tax", percentage: String(TAX_RATE), scope: "ORDER" }];
    }
    const o = await square("/v2/orders", { idempotency_key: `${idempotencyKey}-order`, order });
    const orderId = o.data.order?.id;
    const total = o.data.order?.total_money?.amount;
    if (!o.res.ok || !orderId || !Number.isInteger(total)) return fail("order", o.res, o.data);

    // 2. Charge exactly the order total
    const payment = {
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      amount_money: { amount: total, currency: "USD" },
      order_id: orderId,
      location_id: locationId,
      reference_id: reference,
      note,
    };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) payment.buyer_email_address = email;

    const p = await square("/v2/payments", payment);
    if (!p.res.ok || p.data.payment?.status !== "COMPLETED") return fail("payment", p.res, p.data);

    return json({
      ok: true,
      total,
      tax: o.data.order.total_tax_money?.amount ?? 0,
      reference,
      receiptUrl: p.data.payment.receipt_url || null,
    });
  } catch {
    return json({ error: "Couldn't reach the payment processor. Please try again." }, 502);
  }
}
