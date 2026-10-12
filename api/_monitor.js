/* ============================================================
   S-I-Quotespro — error tracking and alerts (no outside service needed)

   Every problem — a crash in the browser, an API call that fails, a
   health check that goes red — is grouped by "fingerprint" into
   ops/errors/items/{fp} (server-only; the rules deny everyone else).
   The platform owner gets a phone alert + email the first time a
   problem appears, when a fixed one comes back, and at most once an
   hour while it keeps happening.
============================================================ */
const crypto = require("crypto");
const { getDocAsServer, setDocAsServer, listDocsAsServer, sendEmail } = require("./_lib");
const { sendToPeople } = require("./_push");

const HOUR = 3600e3;
const recent = new Map(); // fp -> last write time (per instance), to absorb bursts

const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
function fingerprint(source, where, message) {
  // Numbers, ids and quoted values vary between occurrences of the same bug.
  const norm = String(message || "").replace(/\b[0-9a-f]{8,}\b/gi, "#").replace(/\d+/g, "#").replace(/"[^"]{0,80}"/g, '"…"').slice(0, 200);
  return crypto.createHash("sha1").update(source + "|" + where + "|" + norm).digest("hex").slice(0, 20);
}

async function ownersToAlert() {
  const users = await listDocsAsServer("users");
  return users.filter((u) => u && u.role === "owner" && u.active).map((u) => u.id).filter(Boolean);
}

async function alertOwner(title, body, url) {
  const out = { push: 0, email: 0 };
  try {
    const [uids, subs] = await Promise.all([ownersToAlert(), listDocsAsServer("pushSubs")]);
    const r = await sendToPeople(subs, uids, { title, body: clip(body, 180), url: url || "/app?admin", tag: "siq-ops" });
    out.push = (r && r.sent) || 0;
  } catch (e) { console.error("[monitor] push:", e.message); }
  try { const r = await sendEmail({ subject: "[S-I-Quotespro alert] " + title, message: body }); out.email = (r && r.sent) || 0; }
  catch (e) { console.error("[monitor] email:", e.message); }
  return out;
}

/* Record one problem. Never throws — monitoring must not break the app. */
async function report(ev) {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
    const source = clip(ev.source || "server", 20);
    const where = clip(ev.where || "unknown", 120);
    const message = clip(ev.message || "Unknown error", 500);
    const fp = fingerprint(source, where, message);
    const now = Date.now();
    const last = recent.get(fp) || 0;
    recent.set(fp, now);
    if (now - last < 10e3) return fp; // same error seconds ago on this instance

    const path = "ops/errors/items/" + fp;
    const cur = (await getDocAsServer(path)) || null;
    const iso = new Date(now).toISOString();
    const reopened = !!(cur && cur.resolved);
    const doc = Object.assign({}, cur || { firstSeen: iso, count: 0, lastAlertAt: "" }, {
      fp, source, where, message,
      stack: clip(ev.stack || (cur && cur.stack) || "", 1500),
      count: ((cur && cur.count) || 0) + 1,
      lastSeen: iso, resolved: false,
      lastCompany: clip(ev.cid || "", 60) || (cur && cur.lastCompany) || "",
      lastUrl: clip(ev.url || "", 200) || (cur && cur.lastUrl) || "",
      lastAgent: clip(ev.ua || "", 160) || (cur && cur.lastAgent) || "",
    });
    if (reopened) doc.reopenedAt = iso;
    const shouldAlert = !cur || reopened || !cur.lastAlertAt || now - new Date(cur.lastAlertAt).getTime() > HOUR;
    if (shouldAlert) doc.lastAlertAt = iso;
    await setDocAsServer(path, doc);
    if (shouldAlert && ev.alert !== false) {
      const head = !cur ? "New problem" : reopened ? "Problem is back" : "Still happening (" + doc.count + "×)";
      await alertOwner(head + ": " + where, `${message}\n\nWhere: ${where} (${source})${doc.lastCompany ? "\nCompany: " + doc.lastCompany : ""}${doc.lastUrl ? "\nPage: " + doc.lastUrl : ""}\nSeen ${doc.count} time(s), first ${doc.firstSeen}.\n\nOpen Admin → System health: https://www.s-i-quotespro.com/admin`);
    }
    return fp;
  } catch (e) { console.error("[monitor] report failed:", e.message); return null; }
}

/* Wrap an API handler: anything it throws, and any 5xx it sends, is recorded. */
function withMonitor(name, handler) {
  return async (req, res) => {
    const origStatus = res.status.bind(res);
    let code = 200;
    res.status = (c) => { code = c; return origStatus(c); };
    const origJson = res.json ? res.json.bind(res) : null;
    if (origJson) res.json = (body) => {
      if (code >= 500) {
        report({ source: "server", where: "api/" + name, message: code + " " + ((body && body.error) || "server error"), url: req.url });
      }
      return origJson(body);
    };
    try { return await handler(req, res); }
    catch (e) {
      console.error("[" + name + "] crashed:", e && e.stack || e);
      await report({ source: "server", where: "api/" + name, message: (e && e.message) || String(e), stack: e && e.stack, url: req.url });
      if (!res.headersSent) { try { origStatus(500); return origJson ? origJson({ error: "Something went wrong on our side. We've been notified." }) : res.end(); } catch {} }
    }
  };
}

module.exports = { report, withMonitor, alertOwner, fingerprint };
