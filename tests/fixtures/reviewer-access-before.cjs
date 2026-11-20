// Frozen pre-reviewer access policy for compatibility checks.
const DAY = 864e5;
const TRIAL_QUOTES = 7;
function trialCap(co) {
  const born = co._createTime ? new Date(co._createTime).getTime() : Date.now();
  let cap = born + TRIAL_DAYS * DAY;
  if (co.trialOverride) cap = Math.max(cap, new Date(co.trialOverride).getTime() || 0);
  return cap;
}

function accessOf(co) {
  if (co.suspended) return "suspended";
  if (!stripeOn()) return "ok"; // billing not switched on yet
  const used = Number(co.trialQuotesUsed || 0);
  if (co.stripeSubscriptionId) {
    if (["active", "past_due"].includes(co.billingStatus)) return "ok";
    // A paying customer who took "2 extra weeks free" is on a trial again, but not a quote-limited one.
    if (co.billingStatus === "trialing") return used >= TRIAL_QUOTES && !(co.retentionOffers || []).includes("extend14") ? "limit" : "ok";
    return "locked";
  }
  if (trialCap(co) <= Date.now()) return "locked";
  return used >= TRIAL_QUOTES ? "limit" : "trial";
}


module.exports = { accessOf };
