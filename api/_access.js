/* ============================================================
   S-I-Quotespro — can this company use the app right now?
   Shared by billing (what the app shows) and every paid feature
   (AI quotes, materials, lead inbox), so a locked or suspended
   company can't keep spending AI credit through the back door.
============================================================ */
const { getDocAsServer } = require("./_lib");
const { TRIAL_DAYS, stripeOn } = require("./_stripe");

const DAY = 864e5;

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

function accessOf(co) {
  if (co.suspended) return "suspended";
  if (!stripeOn()) return "ok"; // billing not switched on yet
  if (co.stripeSubscriptionId) return ["trialing", "active", "past_due"].includes(co.billingStatus) ? "ok" : "locked";
  return trialCap(co) > Date.now() ? "needs_card" : "locked";
}

/* For paid features: null when allowed, otherwise a message. Cached briefly per instance. */
const cache = new Map();
async function blockedReason(cid) {
  if (!cid) return null; // JTProconstruction's own workspace
  const hit = cache.get(cid);
  if (hit && Date.now() - hit.at < 60e3) return hit.reason;
  let reason = null;
  try {
    const a = accessOf(await loadCompany(cid));
    if (a === "suspended") reason = "This account is on hold. Please contact S-I-Quotespro support.";
    else if (a === "locked") reason = "Your free trial has ended. Ask your company's owner to choose a plan in S-I-Quotespro.";
  } catch (e) { reason = null; } // never block on a read hiccup
  cache.set(cid, { at: Date.now(), reason });
  return reason;
}

module.exports = { loadCompany, accessOf, trialCap, blockedReason };
