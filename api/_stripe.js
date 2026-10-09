/* ============================================================
   S-I-Quotespro — Stripe billing helpers (no SDK: plain HTTPS)

   Plans (monthly, after a 14-day free trial):
     starter $49 · pro $99 · team $199
   Prices are found by lookup key and created on first use, so the
   Stripe account needs no manual product setup.

   Environment:
     STRIPE_SECRET_KEY   sk_test_… while testing, sk_live_… when live
============================================================ */

const PLANS = {
  starter: { name: "S-I-Quotespro Starter", amount: 4900, users: 1, blurb: "1 user · AI quotes from photos and leads · branded PDFs" },
  pro: { name: "S-I-Quotespro Pro", amount: 9900, users: 3, blurb: "Up to 3 users · lead inbox · phone alerts · property lookup" },
  team: { name: "S-I-Quotespro Team", amount: 19900, users: 10, blurb: "Up to 10 users · owner approvals · activity log" },
};
const TRIAL_DAYS = 14;
const lookupKey = (plan) => "siq_" + plan + "_monthly";
const stripeOn = () => !!process.env.STRIPE_SECRET_KEY;
const testMode = () => String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");

/* Stripe takes form-encoded bodies with bracketed keys: a[b][0]=c. */
function encode(obj, prefix, out) {
  out = out || [];
  if (obj === undefined || obj === null) return out;
  if (typeof obj !== "object") { out.push(encodeURIComponent(prefix) + "=" + encodeURIComponent(String(obj))); return out; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => encode(v, prefix + "[" + i + "]", out)); return out; }
  Object.keys(obj).forEach((k) => encode(obj[k], prefix ? prefix + "[" + k + "]" : k, out));
  return out;
}

async function stripe(method, path, params, idempotencyKey) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error("Billing isn't switched on yet — STRIPE_SECRET_KEY is not set in Vercel."), { code: 503 });
  let url = "https://api.stripe.com/v1/" + path;
  const headers = { Authorization: "Bearer " + key };
  let body;
  if (method === "GET") { const q = encode(params || {}).join("&"); if (q) url += "?" + q; }
  else { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = encode(params || {}).join("&"); }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const r = await fetch(url, { method, headers, body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || ("Stripe error " + r.status);
    console.error("[stripe] " + method + " " + path + " → " + r.status + " " + msg);
    throw Object.assign(new Error(msg), { code: r.status === 402 ? 402 : 502, stripe: data && data.error });
  }
  return data;
}

/* The monthly price for a plan, created the first time it's needed. */
async function priceFor(plan) {
  const p = PLANS[plan];
  if (!p) throw Object.assign(new Error("Unknown plan."), { code: 400 });
  const found = await stripe("GET", "prices", { lookup_keys: [lookupKey(plan)], active: true, limit: 1 });
  if (found.data && found.data[0]) return found.data[0].id;
  const product = await stripe("POST", "products", { name: p.name, description: p.blurb, metadata: { siq_plan: plan } }, "siq-product-" + plan);
  const price = await stripe("POST", "prices", {
    product: product.id, unit_amount: p.amount, currency: "usd", recurring: { interval: "month" },
    lookup_key: lookupKey(plan), transfer_lookup_key: true, metadata: { siq_plan: plan },
  }, "siq-price-" + plan + "-" + p.amount);
  return price.id;
}

/* A customer-portal setup, so owners can change card, switch plan or cancel. */
async function portalConfig() {
  const list = await stripe("GET", "billing_portal/configurations", { is_default: true, limit: 1 });
  if (list.data && list.data[0]) return list.data[0].id;
  const prices = await Promise.all(Object.keys(PLANS).map(priceFor));
  const prod = await Promise.all(prices.map((id) => stripe("GET", "prices/" + id)));
  const cfg = await stripe("POST", "billing_portal/configurations", {
    business_profile: { headline: "S-I-Quotespro billing" },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true, default_allowed_updates: ["price"], proration_behavior: "create_prorations",
        products: prod.map((p) => ({ product: p.product, prices: [p.id] })),
      },
    },
  });
  return cfg.id;
}

/* Which plan a subscription is on, from its price's lookup key. */
function planOf(sub) {
  const item = sub && sub.items && sub.items.data && sub.items.data[0];
  const lk = item && item.price && item.price.lookup_key;
  const m = /^siq_(\w+)_monthly$/.exec(lk || "");
  return m ? m[1] : "";
}

/* What the app stores on the company record about billing. */
function billingFields(sub) {
  return {
    plan: planOf(sub) || "starter",
    billingStatus: sub.status, // trialing · active · past_due · canceled · unpaid · incomplete
    stripeSubscriptionId: sub.id,
    trialEnds: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : "",
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString()
      : (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end ? new Date(sub.items.data[0].current_period_end * 1000).toISOString() : ""),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    billingSyncedAt: new Date().toISOString(),
  };
}

module.exports = { PLANS, TRIAL_DAYS, stripe, stripeOn, testMode, priceFor, portalConfig, planOf, billingFields };
