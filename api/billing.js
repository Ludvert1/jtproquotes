/* ============================================================
   S-I-Quotespro — /api/billing
   { idToken, action: "status" }              → the company's plan and billing state
   { idToken, action: "checkout", plan }      → a Stripe Checkout link (14-day trial, card saved)
   { idToken, action: "sync", sessionId? }    → refresh from Stripe after checkout / later
   { idToken, action: "portal" }              → Stripe customer portal (card, plan, cancel)

   Only a company's owner can start or change billing. JTProconstruction's
   own workspace is never billed. After checkout, the card is checked with
   a $1 hold that is released straight away (never captured), and the plan
   price is charged automatically when the trial ends.
============================================================ */

const { bad, parseBody, verifyCaller, getDocAsServer, setDocAsServer } = require("./_lib");
const { PLANS, TRIAL_DAYS, stripe, stripeOn, testMode, priceFor, portalConfig, billingFields } = require("./_stripe");

const DAY = 864e5;

function originOf(req) {
  const o = String(req.headers.origin || "");
  if (/^https:\/\/([\w-]+\.)*(s-i-quotespro\.com|jtproconstruction\.com|vercel\.app)$/.test(o)) return o;
  if (/^http:\/\/localhost(:\d+)?$/.test(o)) return o;
  return "https://www.s-i-quotespro.com";
}

async function loadCompany(cid) {
  const got = await getDocAsServer("companies/" + cid, { meta: true });
  if (!got) throw Object.assign(new Error("Company not found."), { code: 404 });
  const co = got.data;
  /* The free trial is 14 days from when the company was really created —
     the trialEnds the browser wrote at sign-up can't stretch it. */
  const born = got.createTime ? new Date(got.createTime).getTime() : Date.now();
  const cap = born + TRIAL_DAYS * DAY;
  const claimed = co.trialEnds ? new Date(co.trialEnds).getTime() : cap;
  if (!co.stripeSubscriptionId) co.trialEnds = new Date(Math.min(cap, isNaN(claimed) ? cap : claimed)).toISOString();
  return co;
}
async function saveCompany(cid, patch) {
  const co = await loadCompany(cid);
  const next = Object.assign({}, co, patch);
  await setDocAsServer("companies/" + cid, next);
  return next;
}

/* Can this company use the app right now? */
function accessOf(co) {
  if (!stripeOn()) return "ok"; // billing not switched on yet
  if (co.stripeSubscriptionId) return ["trialing", "active", "past_due"].includes(co.billingStatus) ? "ok" : "locked";
  return new Date(co.trialEnds).getTime() > Date.now() ? "needs_card" : "locked";
}

function publicView(co) {
  const left = co.trialEnds ? Math.max(0, Math.ceil((new Date(co.trialEnds).getTime() - Date.now()) / DAY)) : 0;
  return {
    access: accessOf(co), trialDaysLeft: left,
    plan: co.plan || "trial", billingStatus: co.billingStatus || "", trialEnds: co.trialEnds || "",
    currentPeriodEnd: co.currentPeriodEnd || "", cancelAtPeriodEnd: !!co.cancelAtPeriodEnd,
    hasCard: !!co.stripeSubscriptionId, cardCheck: co.cardCheck || "",
    testMode: testMode(), enabled: stripeOn(),
    plans: Object.keys(PLANS).map((k) => ({ id: k, name: PLANS[k].name, price: PLANS[k].amount / 100, users: PLANS[k].users, blurb: PLANS[k].blurb })),
  };
}

/* $1 authorization on the saved card, cancelled at once so it is never
   charged — confirms the card is real and has funds. Done once. */
async function cardCheck(cid, co, sub) {
  if (co.cardCheckedAt) return co;
  const pm = sub.default_payment_method && (sub.default_payment_method.id || sub.default_payment_method);
  if (!pm) return co;
  let result = "ok";
  try {
    const pi = await stripe("POST", "payment_intents", {
      amount: 100, currency: "usd", customer: co.stripeCustomerId, payment_method: pm,
      capture_method: "manual", confirm: true, off_session: true,
      description: "S-I-Quotespro card check — $1 hold, released automatically",
      metadata: { siq_company: cid, purpose: "card_check" },
    }, "siq-cardcheck-" + cid + "-" + pm);
    if (pi.status === "requires_capture") await stripe("POST", "payment_intents/" + pi.id + "/cancel", {});
    else result = pi.status === "requires_action" ? "needs_auth" : "failed";
    if (pi.status !== "requires_capture" && pi.status !== "canceled") { try { await stripe("POST", "payment_intents/" + pi.id + "/cancel", {}); } catch {} }
  } catch (e) {
    result = "declined";
  }
  return saveCompany(cid, { cardCheck: result, cardCheckedAt: new Date().toISOString() });
}

async function syncFromStripe(cid, co, sessionId) {
  let subId = co.stripeSubscriptionId || "";
  let customer = co.stripeCustomerId || "";
  if (sessionId) {
    const s = await stripe("GET", "checkout/sessions/" + encodeURIComponent(sessionId));
    if (s.client_reference_id !== cid) throw Object.assign(new Error("That checkout belongs to another account."), { code: 403 });
    subId = s.subscription || subId;
    customer = s.customer || customer;
  }
  if (!subId) return co;
  const sub = await stripe("GET", "subscriptions/" + subId, { expand: ["default_payment_method"] });
  co = await saveCompany(cid, Object.assign({ stripeCustomerId: customer || sub.customer }, billingFields(sub)));
  return cardCheck(cid, co, sub);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");
  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");
  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) return bad(res, 401, "Sign in again.");
  let caller;
  try { caller = await verifyCaller(idToken); } catch { return bad(res, 503, "Couldn't check your sign-in just now."); }
  if (!caller) return bad(res, 403, "Your account isn't approved.");
  if (!caller.companyId) return res.status(200).json({ exempt: true }); // JTProconstruction's own workspace
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return bad(res, 503, "Billing needs FIREBASE_SERVICE_ACCOUNT in Vercel.");

  const cid = caller.companyId;
  const action = String(body.action || "status");
  const isOwner = caller.role === "owner";

  try {
    let co = await loadCompany(cid);

    if (action === "status") {
      // Refresh from Stripe now and then, and whenever a trial or period has run out.
      const stale = !co.billingSyncedAt || Date.now() - new Date(co.billingSyncedAt).getTime() > 6 * 3600e3
        || (co.trialEnds && new Date(co.trialEnds).getTime() < Date.now() && co.billingStatus === "trialing")
        || (co.currentPeriodEnd && new Date(co.currentPeriodEnd).getTime() < Date.now());
      if (stripeOn() && co.stripeSubscriptionId && stale) { try { co = await syncFromStripe(cid, co); } catch (e) { console.error("[billing] sync:", e.message); } }
      return res.status(200).json(publicView(co));
    }

    if (!isOwner) return bad(res, 403, "Only the company's owner can change billing.");

    if (action === "sync") {
      co = await syncFromStripe(cid, co, typeof body.sessionId === "string" ? body.sessionId.slice(0, 200) : "");
      return res.status(200).json(publicView(co));
    }

    if (action === "portal") {
      if (!co.stripeCustomerId) return bad(res, 400, "Choose a plan first.");
      const configuration = await portalConfig();
      const s = await stripe("POST", "billing_portal/sessions", { customer: co.stripeCustomerId, return_url: originOf(req) + "/?billing=back", configuration });
      return res.status(200).json({ url: s.url });
    }

    if (action === "checkout") {
      const plan = String(body.plan || "");
      if (!PLANS[plan]) return bad(res, 400, "Pick a plan: starter, pro or team.");
      if (co.stripeSubscriptionId && ["trialing", "active", "past_due"].includes(co.billingStatus)) {
        return bad(res, 409, "You already have a plan. Use Manage billing to change it.");
      }
      if (!co.stripeCustomerId) {
        const cust = await stripe("POST", "customers", {
          email: co.ownerEmail || caller.email, name: co.name || "", metadata: { siq_company: cid },
        }, "siq-customer-" + cid);
        co = await saveCompany(cid, { stripeCustomerId: cust.id });
      }
      // Whatever is left of the 14-day trial that started at sign-up.
      const ends = co.trialEnds ? new Date(co.trialEnds).getTime() : Date.now() + TRIAL_DAYS * DAY;
      const daysLeft = Math.ceil((ends - Date.now()) / DAY);
      const origin = originOf(req);
      const session = await stripe("POST", "checkout/sessions", {
        mode: "subscription", customer: co.stripeCustomerId, client_reference_id: cid,
        line_items: [{ price: await priceFor(plan), quantity: 1 }],
        payment_method_collection: "always", allow_promotion_codes: true,
        subscription_data: Object.assign({ metadata: { siq_company: cid, siq_plan: plan } }, daysLeft >= 1 ? { trial_period_days: Math.min(daysLeft, TRIAL_DAYS) } : {}),
        custom_text: { submit: { message: daysLeft >= 1
          ? "Nothing is charged today. Your card gets a $1 hold that's released right away, and your plan starts after your free trial ends. Cancel any time before then."
          : "Your plan starts today. Cancel any time." } },
        success_url: origin + "/?billing=done&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: origin + "/?billing=cancel",
      });
      return res.status(200).json({ url: session.url });
    }

    return bad(res, 400, "Unknown action.");
  } catch (e) {
    console.error("[billing]", action, e.message);
    return bad(res, e.code && e.code < 600 ? e.code : 502, e.message || "Billing didn't respond. Try again.");
  }
};
