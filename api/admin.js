/* ============================================================
   S-I-Quotespro — /api/admin  (platform admin portal + help requests)

   Admin (JTProconstruction's owner account only; optionally narrowed with
   ADMIN_EMAILS in Vercel, comma-separated):
     overview                          every company, its plan, setup and open help requests
     company      { cid }              one company in detail: profile, team, quotes, billing, notes
     saveProfile  { cid, profile }     fix their company name / phone / email / cities / signer
     setUser      { cid, uid, active?, role? }   turn a person on/off or change their role
     resetPassword{ cid, uid }         email that person a password-reset link
     extendTrial  { cid, days }        give extra free days (also moves the Stripe trial)
     suspend      { cid, on, reason }  put an account on hold / lift the hold
     note         { cid, text }        private support note (they never see these)
     resolveHelp  { cid, id }          close a help request

   Any signed-in member of a company:
     help         { message, phone? }  ask S-I-Quotespro for help → you get a phone alert + email
============================================================ */

const { bad, parseBody, verifyCaller, DOCS, adminToken, fromFields, toFields, getDocAsServer, setDocAsServer, createDocAsServer, listDocsAsServer, sendEmail } = require("./_lib");
const { sendToPeople } = require("./_push");
const { stripe, stripeOn, testMode } = require("./_stripe");

const FB_KEY = process.env.FIREBASE_API_KEY || "AIzaSyCG6AJn66iGzK0cChgNTnRDSTMZrasdNbc";
const DAY = 864e5;
const ROLES = ["owner", "assistant", "associate"];
const CID = /^c[a-z0-9]{6,40}$/;

/* ---------- Firestore reads that keep document ids ---------- */
async function listWithIds(collection, max) {
  const token = await adminToken();
  const out = [];
  let page = "";
  do {
    const r = await fetch(`${DOCS}/${collection}?pageSize=300${page ? "&pageToken=" + encodeURIComponent(page) : ""}`, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) break;
    const d = await r.json();
    (d.documents || []).forEach((doc) => out.push(Object.assign({ id: doc.name.split("/").pop(), _created: doc.createTime || "" }, fromFields(doc.fields || {}))));
    page = d.nextPageToken || "";
  } while (page && out.length < (max || 2000));
  return out;
}
async function countOf(parent, collectionId) {
  const token = await adminToken();
  const r = await fetch(`${DOCS}/${parent}:runAggregationQuery`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId }] }, aggregations: [{ alias: "n", count: {} }] } }),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  const v = rows && rows[0] && rows[0].result && rows[0].result.aggregateFields && rows[0].result.aggregateFields.n;
  return v ? Number(v.integerValue || 0) : 0;
}
async function latest(parent, collectionId, field, n) {
  const token = await adminToken();
  const r = await fetch(`${DOCS}/${parent}:runQuery`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], orderBy: [{ field: { fieldPath: field }, direction: "DESCENDING" }], limit: n } }),
  });
  if (!r.ok) return [];
  const rows = await r.json();
  return (rows || []).filter((x) => x.document).map((x) => Object.assign({ id: x.document.name.split("/").pop() }, fromFields(x.document.fields || {})));
}
async function patch(path, fields) {
  const cur = (await getDocAsServer(path)) || {};
  await setDocAsServer(path, Object.assign({}, cur, fields));
}

/* ---------- who's who ---------- */
function isAdmin(caller) {
  if (!caller || caller.companyId || caller.role !== "owner") return false;
  const list = String(process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !list.length || list.includes(String(caller.email || "").toLowerCase());
}
const supportId = (cid) => String(cid).slice(1, 7).toUpperCase();

function trialInfo(co, created) {
  const born = created ? new Date(created).getTime() : Date.now();
  let ends = born + 14 * DAY;
  const claimed = co.trialEnds ? new Date(co.trialEnds).getTime() : ends;
  if (!co.stripeSubscriptionId) ends = Math.min(ends, isNaN(claimed) ? ends : claimed); else ends = claimed;
  if (co.trialOverride) ends = Math.max(ends, new Date(co.trialOverride).getTime());
  return new Date(ends).toISOString();
}

async function summary(co) {
  const cid = co.id;
  const [settings, users, quotes, help] = await Promise.all([
    getDocAsServer(`companies/${cid}/settings/company`).catch(() => null),
    listWithIds(`companies/${cid}/users`, 100).catch(() => []),
    countOf(`companies/${cid}`, "quotes").catch(() => null),
    listWithIds(`companies/${cid}/supportRequests`, 100).catch(() => []),
  ]);
  const p = (settings && settings.profile) || {};
  const owner = users.find((u) => u.role === "owner") || {};
  return {
    cid, supportId: supportId(cid), name: co.name || p.name || "(no name)",
    ownerName: owner.name || "", ownerEmail: co.ownerEmail || owner.email || "", phone: p.phone || "",
    createdAt: co.createdAt || co._created, plan: co.plan || "trial", billingStatus: co.billingStatus || "",
    trialEnds: trialInfo(co, co._created), hasCard: !!co.stripeSubscriptionId, suspended: !!co.suspended,
    users: users.length, pendingUsers: users.filter((u) => !u.active && !u.declined).length, quotes,
    leadConnected: !!(settings && settings.leadSetup && settings.leadSetup.done), leadReplyMode: (settings && settings.leadReplyMode) || "",
    openHelp: help.filter((h) => !h.resolved).length,
  };
}

/* ---------- help request from a contractor ---------- */
async function askForHelp(caller, body, res) {
  const message = String(body.message || "").trim().slice(0, 1500);
  const phone = String(body.phone || "").trim().slice(0, 40);
  if (message.length < 3) return bad(res, 400, "Tell us briefly what you need help with.");
  const cid = caller.companyId;
  const co = (await getDocAsServer("companies/" + cid)) || {};
  const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const at = new Date().toISOString();
  await createDocAsServer(`companies/${cid}/supportRequests`, id, { message, phone, at, byUid: caller.uid, byName: caller.name, byEmail: caller.email, role: caller.role, resolved: false });
  const title = "Help request — " + (co.name || "a company");
  const text = `${caller.name} (${caller.email}${phone ? ", " + phone : ""}) at ${co.name || cid}, Support ID ${supportId(cid)}:\n\n${message}`;
  // Tell the platform owner(s): phone alert + email.
  try {
    const top = await listWithIds("users", 300);
    const owners = top.filter((u) => u.role === "owner" && u.active).map((u) => u.id);
    const subs = await listDocsAsServer("pushSubs");
    await sendToPeople(subs, owners, { title, body: text.slice(0, 180), url: "/?admin=" + cid });
  } catch (e) { console.error("[admin] help push:", e.message); }
  try { await sendEmail({ subject: "[S-I-Quotespro] " + title, message: text, replyTo: caller.email }); } catch (e) { console.error("[admin] help email:", e.message); }
  return res.status(200).json({ ok: true, supportId: supportId(cid) });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");
  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");
  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) return bad(res, 401, "Sign in again.");
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return bad(res, 503, "Needs FIREBASE_SERVICE_ACCOUNT in Vercel.");
  let caller;
  try { caller = await verifyCaller(idToken); } catch { return bad(res, 503, "Couldn't check your sign-in just now."); }
  if (!caller) return bad(res, 403, "Your account isn't approved.");
  const action = String(body.action || "");

  try {
    if (action === "help") {
      if (!caller.companyId) return bad(res, 400, "Help requests are for contractor accounts.");
      return await askForHelp(caller, body, res);
    }

    if (!isAdmin(caller)) return bad(res, 403, "Admin only.");

    if (action === "overview") {
      const cos = await listWithIds("companies", 2000);
      const rows = [];
      for (let i = 0; i < cos.length; i += 10) rows.push(...(await Promise.all(cos.slice(i, i + 10).map(summary))));
      rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return res.status(200).json({ companies: rows, testMode: testMode(), stripe: stripeOn() });
    }

    const cid = String(body.cid || "");
    if (!CID.test(cid)) return bad(res, 400, "Pick a company.");
    const coPath = "companies/" + cid;
    const co = await getDocAsServer(coPath, { meta: true });
    if (!co) return bad(res, 404, "Company not found.");

    if (action === "company") {
      const base = Object.assign({ id: cid, _created: co.createTime }, co.data);
      const [sum, settings, users, quotes, activity, notes, help] = await Promise.all([
        summary(base),
        getDocAsServer(coPath + "/settings/company").catch(() => null),
        listWithIds(coPath + "/users", 100),
        latest(coPath, "quotes", "createdAt", 12).catch(() => []),
        latest(coPath, "activity", "at", 15).catch(() => []),
        latest(coPath, "supportNotes", "at", 50).catch(() => []),
        latest(coPath, "supportRequests", "at", 30).catch(() => []),
      ]);
      const s = settings || {};
      return res.status(200).json({
        summary: sum,
        company: Object.assign({}, co.data, { createdAt: co.data.createdAt || co.createTime }),
        profile: s.profile || {}, leadSetup: s.leadSetup || {}, leadReplyMode: s.leadReplyMode || "", usesThumbtack: s.usesThumbtack,
        teamCode: s.teamCode || "",
        users: users.map((u) => ({ id: u.id, name: u.name, email: u.email || u.username, role: u.role, active: !!u.active, declined: !!u.declined, createdAt: u.createdAt || u._created })),
        quotes: quotes.map((q) => ({ id: q.id, quoteNo: q.quoteNo, clientName: q.clientName, jobTitle: q.jobTitle, status: q.status, createdAt: q.createdAt, fromInbox: !!q.fromInbox, finalAmount: q.finalAmount || 0 })),
        activity: activity.map((a) => ({ at: a.at, who: a.by || "", what: a.action || "", detail: a.quoteNo || "" })),
        notes, help,
        stripeUrl: co.data.stripeCustomerId ? `https://dashboard.stripe.com/${testMode() ? "test/" : ""}customers/${co.data.stripeCustomerId}` : "",
      });
    }

    if (action === "saveProfile") {
      const allowed = ["name", "phone", "email", "site", "cities", "area", "signer", "tag"];
      const p = body.profile || {};
      const clean = {};
      allowed.forEach((k) => { if (typeof p[k] === "string") clean[k] = p[k].trim().slice(0, 300); });
      const sPath = coPath + "/settings/company";
      const s = (await getDocAsServer(sPath)) || {};
      s.profile = Object.assign({}, s.profile || {}, clean);
      await setDocAsServer(sPath, s);
      if (clean.name) await patch(coPath, { name: clean.name, updatedAt: new Date().toISOString() });
      await note(coPath, caller, "Edited company profile: " + Object.keys(clean).join(", "));
      return res.status(200).json({ ok: true });
    }

    if (action === "setUser") {
      const uid = String(body.uid || "");
      if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) return bad(res, 400, "Pick a person.");
      const uPath = coPath + "/users/" + uid;
      const u = await getDocAsServer(uPath);
      if (!u) return bad(res, 404, "Person not found.");
      const change = {};
      if (typeof body.active === "boolean") { change.active = body.active; if (body.active) change.declined = false; }
      if (typeof body.role === "string" && ROLES.includes(body.role)) change.role = body.role;
      if (u.role === "owner" && (change.active === false || (change.role && change.role !== "owner"))) {
        const others = (await listWithIds(coPath + "/users", 100)).filter((x) => x.id !== uid && x.role === "owner" && x.active);
        if (!others.length) return bad(res, 400, "That's the company's only owner. Make someone else owner first.");
      }
      await setDocAsServer(uPath, Object.assign({}, u, change));
      await note(coPath, caller, `${u.name || u.email}: ${Object.entries(change).map(([k, v]) => k + " → " + v).join(", ")}`);
      return res.status(200).json({ ok: true });
    }

    if (action === "resetPassword") {
      const u = await getDocAsServer(coPath + "/users/" + String(body.uid || ""));
      const email = u && (u.email || u.username);
      if (!email) return bad(res, 404, "No email on file for that person.");
      const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=" + FB_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
      });
      if (!r.ok) return bad(res, 502, "Google didn't send the reset email. Try again.");
      await note(coPath, caller, "Sent a password-reset email to " + email);
      return res.status(200).json({ ok: true, email });
    }

    if (action === "extendTrial") {
      const days = Math.round(Number(body.days));
      if (!(days >= 1 && days <= 90)) return bad(res, 400, "Between 1 and 90 days.");
      const cur = new Date(trialInfo(co.data, co.createTime)).getTime();
      const until = new Date(Math.max(cur, Date.now()) + days * DAY).toISOString();
      const change = { trialOverride: until, trialEnds: until };
      if (co.data.stripeSubscriptionId && co.data.billingStatus === "trialing" && stripeOn()) {
        await stripe("POST", "subscriptions/" + co.data.stripeSubscriptionId, { trial_end: Math.floor(new Date(until).getTime() / 1000), proration_behavior: "none" });
        change.billingSyncedAt = "";
      }
      await patch(coPath, change);
      await note(coPath, caller, `Extended free trial by ${days} days (now ends ${until.slice(0, 10)})`);
      return res.status(200).json({ ok: true, trialEnds: until });
    }

    if (action === "suspend") {
      const on = !!body.on;
      const reason = String(body.reason || "").trim().slice(0, 300);
      await patch(coPath, { suspended: on, suspendReason: on ? reason : "" });
      await note(coPath, caller, on ? "Put account ON HOLD" + (reason ? ": " + reason : "") : "Lifted the hold");
      return res.status(200).json({ ok: true });
    }

    if (action === "note") {
      const text = String(body.text || "").trim().slice(0, 2000);
      if (!text) return bad(res, 400, "Write the note first.");
      await note(coPath, caller, text, true);
      return res.status(200).json({ ok: true });
    }

    if (action === "resolveHelp") {
      const id = String(body.id || "");
      if (!/^h[a-z0-9]{6,30}$/.test(id)) return bad(res, 400, "Pick a request.");
      await patch(coPath + "/supportRequests/" + id, { resolved: true, resolvedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true });
    }

    return bad(res, 400, "Unknown action.");
  } catch (e) {
    console.error("[admin]", action, e.message);
    return bad(res, e.code && e.code < 600 ? e.code : 502, e.message || "Something went wrong.");
  }
};

async function note(coPath, caller, text, manual) {
  const id = "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try { await createDocAsServer(coPath + "/supportNotes", id, { text, at: new Date().toISOString(), by: caller.name || caller.email, kind: manual ? "note" : "action" }); }
  catch (e) { console.error("[admin] note:", e.message); }
}
