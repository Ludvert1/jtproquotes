/* ============================================================
   S-I-Quotespro — can this company use the app right now?
   Shared by billing (what the app shows) and every paid feature
   (AI quotes, materials, lead inbox), so a locked or suspended
   company can't keep spending AI credit through the back door.
============================================================ */
const { getDocAsServer, setDocAsServer, adminToken, DOCS } = require("./_lib");
const { TRIAL_DAYS, stripeOn } = require("./_stripe");

const DAY = 864e5;
const TRIAL_QUOTES = 7; // free quotes in the trial (14 days or 7 quotes, whichever comes first)

async function loadCompany(cid) {
  const got = await getDocAsServer("companies/" + cid, { meta: true });
  if (!got) throw Object.assign(new Error("Company not found."), { code: 404 });
  const co = got.data;
  co._createTime = got.createTime || "";
  /* The free trial is 14 days from when Firestore really created the
     company — the trialEnds the browser wrote at sign-up can't stretch it. */
  if (!co.stripeSubscriptionId) co.trialEnds = new Date(trialCap(co)).toISOString();
  return co;
}

/* Last moment of the free trial: 14 days from creation, plus any extra days support gave. */
function trialCap(co) {
  const born = co._createTime ? new Date(co._createTime).getTime() : Date.now();
  let cap = born + TRIAL_DAYS * DAY;
  if (co.trialOverride) cap = Math.max(cap, new Date(co.trialOverride).getTime() || 0);
  return cap;
}

/* How many quotes the company has made. Kept as a high-water mark on the
   company, so deleting quotes doesn't buy more free ones. */
async function countQuotes(cid) {
  const token = await adminToken();
  const r = await fetch(`${DOCS}/companies/${cid}:runAggregationQuery`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: "quotes" }] }, aggregations: [{ alias: "n", count: {} }] } }),
  });
  if (!r.ok) throw new Error("count failed " + r.status);
  const rows = await r.json();
  const v = rows && rows[0] && rows[0].result && rows[0].result.aggregateFields && rows[0].result.aggregateFields.n;
  return v ? Number(v.integerValue || 0) : 0;
}
async function quotesUsed(cid, co) {
  const stored = Number(co.trialQuotesUsed || 0);
  let n = stored;
  try { n = Math.max(stored, await countQuotes(cid)); } catch (e) { console.error("[access] count:", e.message); }
  if (n > stored) {
    try {
      const fresh = (await getDocAsServer("companies/" + cid)) || {};
      if (n > Number(fresh.trialQuotesUsed || 0)) await setDocAsServer("companies/" + cid, Object.assign({}, fresh, { trialQuotesUsed: n }));
    } catch (e) { console.error("[access] save count:", e.message); }
  }
  co.trialQuotesUsed = n;
  return n;
}

/* ok · trial (free, still allowed) · limit (7 free quotes used) · locked · suspended */
function accessOf(co) {
  if (co.suspended) return "suspended";
  if (!stripeOn()) return "ok"; // billing not switched on yet
  const used = Number(co.trialQuotesUsed || 0);
  if (co.stripeSubscriptionId) {
    if (["active", "past_due"].includes(co.billingStatus)) return "ok";
    if (co.billingStatus === "trialing") return used >= TRIAL_QUOTES ? "limit" : "ok";
    return "locked";
  }
  if (trialCap(co) <= Date.now()) return "locked";
  return used >= TRIAL_QUOTES ? "limit" : "trial";
}

/* For paid features: null when allowed, otherwise a message. Cached briefly per instance. */
const cache = new Map();
async function blockedReason(cid) {
  if (!cid) return null; // JTProconstruction's own workspace
  const hit = cache.get(cid);
  if (hit && Date.now() - hit.at < 60e3) return hit.reason;
  let reason = null;
  try {
    const co = await loadCompany(cid);
    await quotesUsed(cid, co);
    const a = accessOf(co);
    if (a === "limit") reason = "You've used your 7 free quotes. Choose a plan in S-I-Quotespro to keep quoting.";
    else if (a === "suspended") reason = "This account is on hold. Please contact S-I-Quotespro support.";
    else if (a === "locked") reason = "Your free trial has ended. Ask your company's owner to choose a plan in S-I-Quotespro.";
  } catch (e) { reason = null; } // never block on a read hiccup
  cache.set(cid, { at: Date.now(), reason });
  return reason;
}

module.exports = { loadCompany, accessOf, trialCap, blockedReason, quotesUsed, TRIAL_QUOTES };
