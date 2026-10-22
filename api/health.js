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
const { getDocAsServer, setDocAsServer, adminToken, parseBody, fromFields, DOCS } = require("./_lib");
const { pushEnabled, sendToPeople } = require("./_push");
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


/* ---- Daily follow-up nudge (Scout) ----
   Runs with the daily cron. For every company: quotes sent with no answer for
   2 / 5 / 10 days get one phone alert to the owner, assistants and the person
   who wrote the quote. Same rules as the Follow-ups panel in the app. It never
   contacts a customer. */
const FOLLOW_GAPS = [2, 5, 10];
const DAY = 86400000;
async function listIds(collection) {
  const token = await adminToken();
  const out = []; let page = "";
  do {
    const r = await fetch(`${DOCS}/${collection}?pageSize=300${page ? "&pageToken=" + encodeURIComponent(page) : ""}`, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) break;
    const d = await r.json();
    (d.documents || []).forEach((doc) => out.push(Object.assign({ id: doc.name.split("/").pop() }, fromFields(doc.fields || {}))));
    page = d.nextPageToken || "";
  } while (page && out.length < 1500);
  return out;
}
function dueStage(q, now) {
  if (!q || !["sent", "negotiating"].includes(q.status) || q.followStop) return 0;
  const done = Array.isArray(q.followUps) ? q.followUps : [];
  if (done.length >= FOLLOW_GAPS.length) return 0;
  const sent = (q.history || []).filter((x) => x && x.action === "Sent to client");
  const sentAt = (sent.length && sent[sent.length - 1].at) || q.updatedAt || q.createdAt;
  const last = (done.length && done[done.length - 1].at) || sentAt;
  const t = new Date(last).getTime();
  if (!t) return 0;
  const sn = q.followSnooze ? new Date(q.followSnooze).getTime() : 0;
  return Math.max(t + FOLLOW_GAPS[done.length] * DAY, sn || 0) <= now ? done.length + 1 : 0;
}
async function followUpNudges() {
  if (!pushEnabled()) return { skipped: "push not configured" };
  const subs = await listIds("pushSubs");
  const now = Date.now();
  const scopes = [{ base: "" }].concat((await listIds("companies")).map((c) => ({ base: "companies/" + c.id + "/" })));
  let alerts = 0;
  for (const sc of scopes) {
    try {
      const quotes = await listIds(sc.base + "quotes");
      const due = quotes.filter((q) => dueStage(q, now));
      if (!due.length) continue;
      const users = await listIds(sc.base + "users");
      const active = users.filter((u) => u.active === true);
      const managers = active.filter((u) => u.role === "owner" || u.role === "assistant").map((u) => u.id);
      const activeIds = new Set(active.map((u) => u.id));
      const targets = new Set(managers);
      due.forEach((q) => { if (q.createdBy && activeIds.has(q.createdBy)) targets.add(q.createdBy); });
      const n = due.length;
      const who = due.slice(0, 2).map((q) => q.clientName || "a client").join(", ");
      const r = await sendToPeople(subs, Array.from(targets), {
        title: n + " quote" + (n === 1 ? "" : "s") + " need a follow-up",
        body: who + (n > 2 ? " and " + (n - 2) + " more" : "") + " — open the app to send a quick text.",
        tag: "jtpq-followups", url: "/",
      });
      alerts += (r && r.devices) || 0;
    } catch (e) { console.error("[health] follow-ups:", e.message); }
  }
  return { alerts };
}

/* ---- POST: a problem reported by the app in someone's browser (also reached as /api/report) ---- */
const perIp = new Map();
const NOISE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection captured|Load failed$|NetworkError when attempting|The operation was aborted|AbortError/i;

async function handleReport(req, res) {
  const b = parseBody(req);
  if (!b) return res.status(204).end();
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const now = Date.now();
  const hits = (perIp.get(ip) || []).filter((t) => now - t < 60e3);
  if (hits.length >= 20) return res.status(204).end();
  hits.push(now); perIp.set(ip, hits);

  const message = String(b.message || "").slice(0, 500);
  if (!message || NOISE.test(message) || NOISE.test(String(b.stack || ""))) return res.status(204).end();
  await report({
    source: "browser", where: String(b.where || "app").slice(0, 120), message,
    stack: b.stack, cid: b.cid, url: b.url, ua: req.headers["user-agent"],
  });
  return res.status(204).end();
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") return handleReport(req, res);
  const deep = /[?&]deep=1\b/.test(req.url || "") || /vercel-cron/i.test(String(req.headers["user-agent"] || ""));
  if (!deep) return res.status(200).json({ ok: true, at: new Date().toISOString() });
  if (lastRun && Date.now() - lastRun.at < 60e3) return res.status(lastRun.state.ok ? 200 : 503).json(publicView(lastRun.state));
  const state = await runAndRecord();
  if (/vercel-cron/i.test(String(req.headers["user-agent"] || ""))) { try { await followUpNudges(); } catch (e) { console.error("[health] nudges:", e.message); } }
  return res.status(state.ok ? 200 : 503).json(publicView(state));
};
function publicView(s) { return { ok: s.ok, at: s.at, checks: s.checks.map((c) => ({ name: c.name, ok: c.ok, ms: c.ms, detail: c.ok ? c.detail : "failing" })) }; }
module.exports.runAndRecord = runAndRecord;
