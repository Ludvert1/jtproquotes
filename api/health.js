/* ============================================================
   S-I-Quotespro — /api/health
   GET /api/health          quick: is the server up? (for uptime monitors)
   GET /api/health?deep=1   checks every service the app depends on and
                            alerts the owner when something breaks or
                            recovers. Run every 30 minutes by GitHub
                            Actions (.github/workflows/health.yml) and daily
                            by Vercel cron; "Run check now" in Admin too.
   Results are kept in ops/health (server-only). No secrets are returned.
============================================================ */
const { getDocAsServer, setDocAsServer, adminToken } = require("./_lib");
const { report, alertOwner } = require("./_monitor");
const { stripe, stripeOn, testMode } = require("./_stripe");

const SITE = "https://www.s-i-quotespro.com";
let lastRun = null; // per-instance cache so repeated hits don't hammer anything

async function timed(name, fn) {
  const t = Date.now();
  try { const detail = await fn(); return { name, ok: true, ms: Date.now() - t, detail: detail || "" }; }
  catch (e) { return { name, ok: false, ms: Date.now() - t, detail: String((e && e.message) || e).slice(0, 200) }; }
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after " + ms / 1000 + "s")), ms))]);

async function deepCheck() {
  const checks = await Promise.all([
    timed("Website", async () => { const r = await withTimeout(fetch(SITE + "/", { redirect: "manual" }), 10e3); if (r.status !== 200) throw new Error("home page returned " + r.status); }),
    timed("App", async () => { const r = await withTimeout(fetch(SITE + "/app"), 10e3); if (r.status !== 200) throw new Error("/app returned " + r.status); const t = await r.text(); if (!/S-I-Quotespro/.test(t)) throw new Error("/app page looks wrong"); }),
    timed("Database (Firestore)", async () => {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set in Vercel");
      await withTimeout(adminToken(), 10e3);
      await withTimeout(getDocAsServer("settings/joincode"), 10e3);
    }),
    timed("AI (Anthropic)", async () => {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in Vercel");
      const r = await withTimeout(fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } }), 10e3);
      if (r.status === 401) throw new Error("the AI key was rejected (check ANTHROPIC_API_KEY)");
      if (!r.ok) throw new Error("AI service returned " + r.status);
    }),
    timed("Payments (Stripe)", async () => {
      if (!stripeOn()) return "not switched on (no STRIPE_SECRET_KEY)";
      await withTimeout(stripe("GET", "balance"), 10e3);
      return testMode() ? "test mode" : "live mode";
    }),
    timed("Phone alerts", async () => { if (!process.env.VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY is not set in Vercel"); }),
    timed("Email", async () => { if (!String(process.env.WEB3FORMS_KEYS || "").trim()) throw new Error("WEB3FORMS_KEYS is not set in Vercel"); }),
    timed("Maps / property lookup", async () => { if (!process.env.GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY is not set in Vercel"); }),
  ]);
  return checks;
}

async function runAndRecord() {
  const checks = await deepCheck();
  const failing = checks.filter((c) => !c.ok);
  const now = new Date().toISOString();
  const state = { at: now, ok: failing.length === 0, checks };
  let prev = null;
  try { prev = await getDocAsServer("ops/health"); } catch {}
  const wasOk = !prev || prev.ok !== false;
  const lastAlert = prev && prev.lastAlertAt ? new Date(prev.lastAlertAt).getTime() : 0;
  state.lastAlertAt = (prev && prev.lastAlertAt) || "";
  state.failingSince = failing.length ? ((prev && !wasOk && prev.failingSince) || now) : "";
  // Alert on the way down, every 6 hours while still down, and on recovery.
  if (failing.length && (wasOk || Date.now() - lastAlert > 6 * 3600e3)) {
    state.lastAlertAt = now;
    const list = failing.map((c) => "• " + c.name + ": " + c.detail).join("\n");
    await alertOwner((wasOk ? "Something is down" : "Still down") + " — " + failing.map((c) => c.name).join(", "), list + "\n\nOpen Admin → System health: " + SITE + "/admin");
    for (const c of failing) await report({ source: "health", where: "health/" + c.name, message: c.detail, alert: false });
  } else if (!failing.length && !wasOk) {
    state.lastAlertAt = now;
    await alertOwner("All systems back to normal", "Every health check passed at " + now + ".");
  }
  try { await setDocAsServer("ops/health", state); } catch (e) { console.error("[health] save:", e.message); }
  lastRun = { at: Date.now(), state };
  return state;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const deep = /[?&]deep=1\b/.test(req.url || "");
  if (!deep) return res.status(200).json({ ok: true, at: new Date().toISOString() });
  if (lastRun && Date.now() - lastRun.at < 60e3) return res.status(lastRun.state.ok ? 200 : 503).json(publicView(lastRun.state));
  const state = await runAndRecord();
  return res.status(state.ok ? 200 : 503).json(publicView(state));
};
function publicView(s) { return { ok: s.ok, at: s.at, checks: s.checks.map((c) => ({ name: c.name, ok: c.ok, ms: c.ms, detail: c.ok ? c.detail : "failing" })) }; }
module.exports.runAndRecord = runAndRecord;
