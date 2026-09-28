const { useState, useEffect, useMemo, useRef } = React;

/* ================= JTProQuotes =================
   Quote platform for JTProconstruction LLC
   Navy & gold brand · crew-based pricing · owner review
================================================== */

const BRAND = {
  navy: "#0B1F3A", navyMid: "#13294B", navySoft: "#1D3A66",
  gold: "#C9A227", goldBright: "#E3B93C",
  paper: "#F7F5F0", line: "#D9D4C8",
  ink: "#1C2733", sub: "#5B6B7C",
  green: "#1E7F4F", amber: "#B07D10", red: "#B3372E",
};

const COMPANY = {
  name: "JTProconstruction LLC",
  tag: "Licensed & Insured · Residential & Commercial",
  area: "New Caney, TX · Serving Greater Houston & Texas",
  cities: "Houston · Austin · Dallas · San Antonio · Corpus Christi",
  phone: "(713) 835-8245",
  email: "info@jtproconstruction.com",
  site: "jtproconstruction.com",
};

const CATEGORIES = [
  "Flooring", "Painting", "Drywall", "Kitchen Remodel", "Bath Remodel",
  "Exterior / Siding", "Concrete", "Covered Structure / Patio",
  "Fencing", "Roofing Repair", "Plumbing Repair", "Electrical (minor)",
  "Water Damage Restoration", "General Repair", "Other",
];

/* SCOPE_TEMPLATES and STANDARD_EXCLUSIONS live in src/scope-templates.js,
   shared with the server. build.js inlines that file above this one. */

const buildScope = (cat) => (SCOPE_TEMPLATES[cat] || SCOPE_TEMPLATES["Other"]).map((t) => ({ id: uid(), text: t, on: true }));
const buildExclusions = () => STANDARD_EXCLUSIONS.map((t) => ({ id: uid(), text: t, on: true }));

const STATUS = {
  draft:    { label: "Draft", color: BRAND.sub, bg: "#ECEEF1" },
  pending:  { label: "Pending review", color: BRAND.amber,  bg: "#FBF3DE" },
  changes:  { label: "Changes requested", color: BRAND.red, bg: "#F9E5E3" },
  approved: { label: "Approved", color: BRAND.green, bg: "#E2F2E9" },
  sent:     { label: "Sent to client", color: BRAND.navySoft, bg: "#E4EBF6" },
  negotiating: { label: "In negotiation", color: BRAND.gold, bg: "#F6EDD4" },
  won:      { label: "Won", color: BRAND.green, bg: "#D7EEDF" },
  lost:     { label: "Declined", color: BRAND.sub, bg: "#ECEEF1" },
  void:     { label: "Void", color: "#7A6A55", bg: "#EDE7DC" },
};

/* Voided quotes are ignored by every money figure and can never be printed,
   but the record stays so there is always proof of what was quoted. */
const isVoid = (q) => q && q.status === "void";

/* ---------- outcomes ----------
   A quote is open once it has left the associate's hands and before the
   client has decided. Everything here counts toward pipeline. */
const OPEN_STATUSES = ["pending", "approved", "sent", "negotiating"];
const DECIDED_STATUSES = ["won", "lost"];
const isDecided = (q) => !!q && DECIDED_STATUSES.includes(q.status);

/* What a won job is actually worth. If the price moved during negotiation and
   the final figure was recorded, that is the real number — the quoted total
   is only what we asked for, not what we agreed to. */
const wonValue = (q, settings) =>
  typeof q.finalAmount === "number" && isFinite(q.finalAmount) && q.finalAmount >= 0
    ? q.finalAmount
    : computeQuote(q, settings).total;

/* Booked revenue belongs to the period the client signed, not the period the
   quote was written — a June quote signed in September is September money.
   Records made before outcome dates existed fall back to the quote date. */
const decidedDate = (q) => (q && q.decidedAt) || (q && q.createdAt);

/* ---------- roles ---------- */
const ROLE_LABEL = { owner: "Owner", assistant: "Assistant", associate: "Associate" };
const roleOf = (u) => (u && u.role) || "associate";
const canManage = (u) => roleOf(u) === "owner" || roleOf(u) === "assistant";
const isOwnerRole = (u) => roleOf(u) === "owner";

/* ---------- helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const hashPin = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "h" + h.toString(36); };
const money = (n) => (isNaN(n) ? "$0.00" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ---------- config ----------
   Firebase settings live in config.js so you can edit them without
   rebuilding the app. Leave apiKey blank to run in offline
   single-device mode (localStorage). */
const FIREBASE_CONFIG = (window.JTPQ_CONFIG && window.JTPQ_CONFIG.firebase) || {};
const OWNER_EMAIL = (window.JTPQ_CONFIG && window.JTPQ_CONFIG.ownerEmail) || "info@jtproconstruction.com";

const CLOUD = !!FIREBASE_CONFIG.apiKey;
let fbAuth = null, db = null, fbStorage = null;
let cloudInitError = null;
if (CLOUD) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    db = firebase.firestore();
    /* Storage holds the lead screenshots attached to a quote. It is optional —
       if the SDK or the bucket is missing, reading a lead still works and only
       the "keep the screenshot" part is skipped. */
    try {
      fbStorage = firebase.storage ? firebase.storage() : null;
      /* The SDK retries a failed upload for up to ten minutes by default. With
         no bucket set up that looked like a frozen button, so give up fast. */
      if (fbStorage && fbStorage.setMaxUploadRetryTime) fbStorage.setMaxUploadRetryTime(12000);
      if (fbStorage && fbStorage.setMaxOperationRetryTime) fbStorage.setMaxOperationRetryTime(12000);
    }
    catch (e) { console.warn("[JTProQuotes] Storage unavailable:", e && e.message); }
  } catch (e) {
    cloudInitError = e.message || String(e);
    console.error("[JTProQuotes] Firebase failed to start:", e);
  }
}

/* Surfaces Firestore permission problems in the console instead of
   swallowing them silently — makes rule mismatches debuggable. */
const warn = (where) => (e) => console.warn("[JTProQuotes] " + where + ":", (e && e.message) || e);

const hasClaudeStore = typeof window.storage !== "undefined" && window.storage && typeof window.storage.get === "function";

async function sGet(key, fallback) {
  if (hasClaudeStore) {
    try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : fallback; }
    catch { return fallback; }
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
async function sSet(key, val) {
  if (hasClaudeStore) {
    try { await window.storage.set(key, JSON.stringify(val), true); return true; } catch { return false; }
  }
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
async function sessionGet() {
  if (hasClaudeStore) {
    try { const r = await window.storage.get("jtpq:session", false); return r ? JSON.parse(r.value) : null; } catch { return null; }
  }
  try { const v = localStorage.getItem("jtpq:session"); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function sessionSet(id) {
  if (hasClaudeStore) { try { await window.storage.set("jtpq:session", JSON.stringify(id), false); } catch {} return; }
  try { localStorage.setItem("jtpq:session", JSON.stringify(id)); } catch {}
}
async function sessionClear() {
  if (hasClaudeStore) { try { await window.storage.delete("jtpq:session", false); } catch {} return; }
  try { localStorage.removeItem("jtpq:session"); } catch {}
}
async function logActivity(by, action, quoteNo) {
  if (CLOUD) {
    try { await db.collection("activity").add({ at: new Date().toISOString(), by: by, action: action, quoteNo: quoteNo || "" }); } catch {}
    return;
  }
  try {
    const list = await sGet("jtpq:activity", []);
    list.unshift({ at: new Date().toISOString(), by: by, action: action, quoteNo: quoteNo || "" });
    await sSet("jtpq:activity", list.slice(0, 300));
  } catch {}
}

function computeQuote(q, settings) {
  const labor = (q.crew || 0) * (q.days || 0) * (q.hoursPerDay || 0) * (q.laborRate || 0);
  const materials = (q.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const baseCost = labor + materials;
  const overhead = baseCost * ((q.overheadPct != null ? q.overheadPct : settings.overheadPct) / 100);
  const totalCost = baseCost + overhead;
  const marginPct = q.marginPct != null ? q.marginPct : settings.targetMargin;
  const rawPrice = marginPct >= 100 ? totalCost : totalCost / (1 - marginPct / 100);
  const discount = rawPrice * ((q.discountPct || 0) / 100);
  const total = Math.max(rawPrice - discount, 0);
  const profit = total - totalCost;
  const realMargin = total > 0 ? (profit / total) * 100 : 0;
  return { labor, materials, baseCost, overhead, totalCost, rawPrice, discount, total, profit, realMargin, deposit: total * 0.5 };
}

function marginHealth(m) {
  if (m < 10) return { color: BRAND.red, label: "Too thin — you're barely covering costs" };
  if (m < 20) return { color: BRAND.amber, label: "Thin margin — fine for repeat clients" };
  if (m <= 38) return { color: BRAND.green, label: "Healthy — profitable and competitive" };
  return { color: BRAND.amber, label: "High margin — double-check competitiveness" };
}

/* ---------- shared UI ---------- */
const Field = ({ label, children, hint }) => (
  <label className="block mb-4">
    <span className="block text-xs mb-1" style={{ color: BRAND.sub, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
    {children}
    {hint && <span className="block text-xs mt-1" style={{ color: BRAND.sub }}>{hint}</span>}
  </label>
);

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${BRAND.line}`,
  background: "#fff", color: BRAND.ink, fontSize: 15, fontFamily: "'Barlow', sans-serif", outline: "none",
};

const Btn = ({ children, onClick, kind = "primary", disabled, small }) => {
  const styles = {
    primary: { background: BRAND.navy, color: "#fff", border: `1.5px solid ${BRAND.navy}` },
    gold: { background: BRAND.gold, color: BRAND.navy, border: `1.5px solid ${BRAND.gold}`, fontWeight: 700 },
    ghost: { background: "transparent", color: BRAND.navy, border: `1.5px solid ${BRAND.line}` },
    danger: { background: "transparent", color: BRAND.red, border: `1.5px solid ${BRAND.red}` },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={Object.assign({}, styles[kind], { padding: small ? "6px 14px" : "11px 20px", borderRadius: 8, fontSize: small ? 13 : 15, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 })}>
      {children}
    </button>
  );
};

const Badge = ({ status }) => {
  const s = STATUS[status] || STATUS.pending;
  return <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{s.label}</span>;
};

const Card = ({ children, style }) => (
  <div style={Object.assign({ background: "#fff", border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 20 }, style)}>{children}</div>
);

/* ================= PHONE ALERTS =================
   Real notifications — sound, vibration, lock screen, a badge on the app
   icon — through standard Web Push. The private key lives in Vercel; this
   public half is safe to ship.

   iPhone: Apple only allows this for web apps added to the Home Screen
   (Share → Add to Home Screen), opened from that icon. Android and desktop
   Chrome/Edge work straight from the browser. */
const VAPID_PUBLIC = (window.JTPQ_CONFIG && window.JTPQ_CONFIG.vapidPublicKey)
  || "BHJZrgFysdU8GUtlP0FM04D_brRVTjfNOdYX-VBnEBzWewiM0g7tpksbZkKF0snEyVBHPxPcxAK31Frtap6bMSY";

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

let swReg = null;
async function getSW() {
  if (swReg) return swReg;
  if (!("serviceWorker" in navigator)) return null;
  try { swReg = await navigator.serviceWorker.register("/sw.js", { scope: "/" }); await navigator.serviceWorker.ready; }
  catch (e) { warn("service worker")(e); swReg = null; }
  return swReg;
}

const b64uToBytes = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const deviceKey = (endpoint) => { let h = 5381; for (let i = 0; i < endpoint.length; i++) h = ((h << 5) + h + endpoint.charCodeAt(i)) >>> 0; return "d" + h.toString(36); };

/* Subscribes this device and files it under your name. `ask` = allowed to
   show the permission prompt (must come from a tap). */
async function enablePush(me, ask) {
  if (!CLOUD || !pushSupported()) return "unsupported";
  if (isIOS() && !isStandalone()) return "needs-install";
  let perm = Notification.permission;
  if (perm === "default" && ask) perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "default";
  const reg = await getSW();
  if (!reg) return "unsupported";
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC) });
  const j = sub.toJSON();
  await db.collection("pushSubs").doc(me.id).set({
    uid: me.id, name: me.name || "", updatedAt: new Date().toISOString(),
    subs: { [deviceKey(j.endpoint)]: { endpoint: j.endpoint, keys: j.keys, ua: navigator.userAgent.slice(0, 160), at: new Date().toISOString() } },
  }, { merge: true });
  return "on";
}

async function tellServer(payload) {
  if (!CLOUD || !fbAuth || !fbAuth.currentUser) return null;
  try {
    const idToken = await fbAuth.currentUser.getIdToken();
    const r = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ idToken }, payload)) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  } catch (e) { warn("notify")(e); return null; }
}

/* A short two-tone chime + vibration for alerts that arrive while the app is
   open (the phone's own notification covers it when the app is closed). */
function chime() {
  try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch {}
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ac = new AC(); const t = ac.currentTime;
    [[880, 0], [1320, 0.16]].forEach(([f, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.28);
      o.connect(g); g.connect(ac.destination); o.start(t + d); o.stop(t + d + 0.3);
    });
    setTimeout(() => ac.close && ac.close(), 800);
  } catch {}
}

function AlertsBell({ me }) {
  const [state, setState] = useState("checking");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!CLOUD || !pushSupported()) { if (alive) setState(isIOS() && !isStandalone() ? "needs-install" : "unsupported"); return; }
      if (isIOS() && !isStandalone()) { if (alive) setState("needs-install"); return; }
      if (Notification.permission === "granted") {
        // Quietly refresh this device's registration on every visit.
        try { const s = await enablePush(me, false); if (alive) setState(s); } catch (e) { warn("push refresh")(e); if (alive) setState("default"); }
      } else if (alive) setState(Notification.permission === "denied" ? "denied" : "default");
    })();
    return () => { alive = false; };
  }, [me && me.id]);

  const turnOn = async () => {
    setBusy(true); setMsg("");
    try {
      const s = await enablePush(me, true);
      setState(s);
      if (s === "on") {
        const r = await tellServer({ test: true });
        setMsg(r && r.ok ? "Alerts are on — a test alert is on its way." : "Alerts are on for this device. " + ((r && r.data && r.data.error) || ""));
        logActivity(me.name, "Turned on phone alerts");
      }
    } catch (e) { setMsg(e.message || "Couldn't turn alerts on."); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true); setMsg("");
    const r = await tellServer({ test: true });
    setMsg(r && r.ok ? "Test sent — it should arrive in a few seconds." : ((r && r.data && r.data.error) || "Couldn't send the test."));
    setBusy(false);
  };

  if (!CLOUD) return null;
  const on = state === "on";
  const p = { fontSize: 13, color: BRAND.ink, lineHeight: 1.5, marginBottom: 8 };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} title={on ? "Phone alerts are on" : "Turn on phone alerts"}
        style={{ background: on ? "transparent" : BRAND.gold, color: on ? BRAND.goldBright : BRAND.navy, border: on ? "1px solid rgba(227,185,60,0.5)" : "none", padding: "6px 11px", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
        {on ? "🔔 Alerts on" : "🔔 Turn on alerts"}
      </button>
      {open && (
        <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", top: 72, width: 320, maxWidth: "calc(100vw - 32px)", background: "#fff", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", padding: 16, zIndex: 40 }}>
          <div style={{ fontWeight: 700, color: BRAND.navy, marginBottom: 8 }}>Phone alerts</div>
          {state === "on" && <div style={p}>This device will ring and vibrate for {canManage(me) ? "quotes waiting for your approval and new Thumbtack leads" : "quotes that are approved or sent back to you"} — even with the app closed.</div>}
          {state === "default" && <div style={p}>Get a sound, vibration and a badge on your phone for {canManage(me) ? "quotes waiting for approval and new leads" : "approved and sent-back quotes"}. Tap below, then choose <strong>Allow</strong>.</div>}
          {state === "needs-install" && (
            <div style={p}>
              On iPhone, alerts only work from the Home Screen app:
              <ol style={{ paddingLeft: 18, margin: "6px 0" }}>
                <li style={{ listStyle: "decimal" }}>Tap the <strong>Share</strong> button (square with an arrow) in Safari</li>
                <li style={{ listStyle: "decimal" }}>Choose <strong>Add to Home Screen</strong> → Add</li>
                <li style={{ listStyle: "decimal" }}>Open <strong>JTProQuotes</strong> from the new icon, sign in, and tap <strong>Turn on alerts</strong></li>
              </ol>
            </div>
          )}
          {state === "denied" && <div style={p}>Notifications are blocked for this site. Allow them in your phone's settings (Chrome: ⋮ → Settings → Site settings → Notifications; iPhone: Settings → Notifications → JTProQuotes), then reload.</div>}
          {state === "unsupported" && <div style={p}>This browser can't receive alerts. Use Chrome on Android, Safari from the Home Screen on iPhone, or Chrome/Edge on a computer.</div>}
          {state === "checking" && <div style={p}>Checking…</div>}
          {msg && <div style={{ fontSize: 12.5, fontWeight: 600, color: msg.indexOf("on") >= 0 || msg.indexOf("sent") >= 0 ? BRAND.green : BRAND.red, marginBottom: 8 }}>{msg}</div>}
          <div className="flex gap-2 flex-wrap">
            {state === "default" && <Btn small kind="gold" onClick={turnOn} disabled={busy}>{busy ? "Turning on…" : "Turn on alerts"}</Btn>}
            {state === "on" && <Btn small kind="ghost" onClick={test} disabled={busy}>{busy ? "Sending…" : "Send test alert"}</Btn>}
            <Btn small kind="ghost" onClick={() => setOpen(false)}>Close</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= ROOT ================= */
function App() {
  const [users, setUsers] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [settings, setSettings] = useState(null);
  const [me, setMe] = useState(null);
  const [view, setView] = useState("dashboard");
  const [activeQuote, setActiveQuote] = useState(null);
  const [previewQuote, setPreviewQuote] = useState(null);
  const [toast, setToast] = useState(null);
  const [joinGate, setJoinGate] = useState(null);
  const [pending, setPending] = useState(null);

  const DEFAULT_SETTINGS ={ laborRate: 35, overheadPct: 10, targetMargin: 25, requireTeamCode: false, teamCode: "JTPRO-" + Math.random().toString(36).slice(2, 6).toUpperCase() };

  useEffect(() => {
    if (CLOUD) {
      let unsubQ = null, unsubU = null, unsubS = null;

      /* The sign-up screen needs the team code before anyone is signed in,
         so it lives in its own publicly-readable document. Pricing settings
         stay private. */
      db.collection("settings").doc("joincode").onSnapshot((d) => {
        setJoinGate(d.exists ? d.data() : { requireTeamCode: false, teamCode: "" });
      }, (e) => { warn("join code")(e); setJoinGate({ requireTeamCode: false, teamCode: "" }); });

      fbAuth.onAuthStateChanged(async (fu) => {
        if (unsubQ) { unsubQ(); unsubQ = null; }
        if (unsubU) { unsubU(); unsubU = null; }
        if (unsubS) { unsubS(); unsubS = null; }
        if (!fu) { setMe(null); setPending(null); setUsers({}); setQuotes({}); setSettings(DEFAULT_SETTINGS); return; }

        let profile;
        const ref = db.collection("users").doc(fu.uid);
        try {
          let snap = await ref.get();
          if (!snap.exists) {
            const isTheOwner = fu.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
            await ref.set({ id: fu.uid, name: fu.displayName || fu.email, username: fu.email, email: fu.email,
              role: isTheOwner ? "owner" : "associate",
              // New associates wait for the owner to approve them.
              active: isTheOwner, createdAt: new Date().toISOString() });
            snap = await ref.get();
          }
          profile = snap.data();
        } catch (e) {
          warn("could not load your profile")(e);
          alert("Could not reach the database. Check your connection and try again.");
          fbAuth.signOut(); return;
        }
        // Not approved yet (or switched off again) — park them on a waiting
        // screen and subscribe to their own profile so approval lands live.
        if (profile.active !== true) {
          setPending(profile);
          setUsers({}); setQuotes({}); setSettings(DEFAULT_SETTINGS);
          unsubU = ref.onSnapshot((d) => {
            const p = d.data();
            if (p && p.active === true) window.location.reload();
            else setPending(p || profile);
          }, warn("pending profile"));
          return;
        }
        setPending(null);
        const owner = isOwnerRole(profile);
        const manager = canManage(profile);

        // Settings are readable only once signed in, so subscribe here.
        unsubS = db.collection("settings").doc("company").onSnapshot((d) => {
          if (d.exists) setSettings(d.data());
          else {
            // Only the owner is allowed to seed the settings document.
            if (owner) db.collection("settings").doc("company").set(DEFAULT_SETTINGS).catch(warn("seed settings"));
            setSettings(DEFAULT_SETTINGS);
          }
        }, (e) => { warn("settings")(e); setSettings(DEFAULT_SETTINGS); });

        unsubU = db.collection("users").onSnapshot((s) => {
          const o = {}; s.forEach((d) => (o[d.id] = d.data())); setUsers(o);
        }, (e) => { warn("team list")(e); setUsers({ [profile.id]: profile }); });

        const qref = manager ? db.collection("quotes") : db.collection("quotes").where("createdBy", "==", fu.uid);
        unsubQ = qref.onSnapshot((s) => {
          const o = {}; s.forEach((d) => (o[d.id] = d.data())); setQuotes(o);
        }, (e) => { warn("quotes")(e); setQuotes({}); });

        setMe(profile);
      });
      return;
    }
    (async () => {
      const u = await sGet("jtpq:users", {});
      const q = await sGet("jtpq:quotes", {});
      const s = await sGet("jtpq:settings", DEFAULT_SETTINGS);
      setUsers(u); setQuotes(q); setSettings(s);
      if (Object.keys(u).length === 0) await sSet("jtpq:settings", s);
      const sessId = await sessionGet();
      if (sessId && u[sessId] && u[sessId].active !== false) setMe(u[sessId]);
    })();
  }, []);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const saveUsers = async (u) => {
    if (CLOUD) { const cur = users || {}; for (const id in u) { if (JSON.stringify(u[id]) !== JSON.stringify(cur[id])) await db.collection("users").doc(id).set(u[id]); } return; }
    setUsers(u); await sSet("jtpq:users", u);
  };
  const saveQuotes = async (q) => { setQuotes(q); await sSet("jtpq:quotes", q); };
  /* Removes a person's profile. Their quotes are untouched — those are
     permanent by design and stay attributed to their name. */
  const deleteUser = async (id) => {
    if (CLOUD) { await db.collection("users").doc(id).delete(); return; }
    const next = Object.assign({}, users); delete next[id];
    setUsers(next); await sSet("jtpq:users", next);
  };
  const saveSettings = async (s) => {
    if (CLOUD) {
      await db.collection("settings").doc("company").set(s);
      // Mirror the join gate to the public doc the sign-up screen reads.
      await db.collection("settings").doc("joincode")
        .set({ requireTeamCode: !!s.requireTeamCode, teamCode: s.teamCode || "" })
        .catch(warn("save join code"));
      return;
    }
    setSettings(s); await sSet("jtpq:settings", s);
  };

  /* ---- WAITING-FOR-REVIEW ALERT ----
     The quote list is a live Firestore listener, so a submission from an
     associate arrives here the moment they send it. The count goes in the
     browser tab title, which is what you notice when the app is open in
     another tab, and a new arrival raises a toast. The email from
     /api/notify is what reaches you when the app is closed.

     These hooks must sit ABOVE the early returns below: React needs the
     same hooks called on every render, and the loading / sign-in screens
     return early. Declared after them, the app crashed the moment the
     data finished loading. */
  const managerNow = !!me && canManage(me);
  const pendingCount = managerNow && quotes ? Object.values(quotes).filter((q) => q.status === "pending").length : 0;
  const seenPending = useRef(null);
  useEffect(() => {
    if (!me) { document.title = "JTProQuotes"; seenPending.current = null; return; }
    document.title = (pendingCount > 0 && managerNow ? "(" + pendingCount + ") " : "") + "JTProQuotes";
    if (!managerNow) return;
    // The first pass after signing in only records where things stand — it
    // must not announce quotes that were already waiting.
    if (seenPending.current === null) { seenPending.current = pendingCount; return; }
    if (pendingCount > seenPending.current) {
      const n = pendingCount - seenPending.current;
      chime();
      notify(n === 1 ? "A quote was just submitted for your approval." : n + " quotes were just submitted for your approval.");
    }
    seenPending.current = pendingCount;
  }, [pendingCount, managerNow, me]);

  /* Tapping a notification opens the quote it was about (?quote=<id>). */
  useEffect(() => {
    if (!me || !quotes) return;
    const id = new URLSearchParams(window.location.search).get("quote");
    if (!id) return;
    const target = quotes[id];
    if (target) { setActiveQuote(target); setView("edit"); }
    try { window.history.replaceState(null, "", window.location.pathname); } catch {}
  }, [me && me.id, !!quotes]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e) => { if (e.data && e.data.type === "open-url" && e.data.url) window.location.href = e.data.url; };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  // The number on the app icon: quotes waiting for you.
  useEffect(() => {
    try {
      if (!navigator.setAppBadge) return;
      if (me && managerNow && pendingCount > 0) navigator.setAppBadge(pendingCount);
      else navigator.clearAppBadge && navigator.clearAppBadge();
    } catch {}
  }, [pendingCount, managerNow, me]);

  if (cloudInitError) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: BRAND.navy }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 26, maxWidth: 460 }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, color: BRAND.navy, marginBottom: 8 }}>CONFIGURATION PROBLEM</h2>
        <p style={{ fontSize: 14, color: BRAND.sub }}>The database settings in <code>config.js</code> are not valid, so the app cannot start.</p>
        <p style={{ fontSize: 13, color: BRAND.red, marginTop: 10 }}>{cloudInitError}</p>
      </div>
    </div>
  );

  // quotes must be loaded too — rendering before it arrives crashes the dashboard.
  if (!users || !settings || (me && !quotes)) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.navy }}>
      <div style={{ color: BRAND.gold, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, letterSpacing: "0.15em" }}>LOADING JTPROQUOTES…</div>
    </div>
  );

  if (pending) return <PendingApproval profile={pending} onSignOut={() => fbAuth.signOut()} />;

  if (!me) return CLOUD
    ? <CloudAuth gate={joinGate} />
    : <Auth users={users} settings={settings} onSaveUsers={saveUsers} onLogin={async (u) => { setMe(u); await sessionSet(u.id); logActivity(u.name, "Signed in"); }} />;

  const isOwner = isOwnerRole(me);
  const isManager = canManage(me);
  const myQuotes = Object.values(quotes).filter((q) => q.createdBy === me.id);
  const visibleQuotes = isManager ? Object.values(quotes) : myQuotes;

  const upsertQuote = async (q) => {
    if (CLOUD) {
      const before = quotes && quotes[q.id];
      await db.collection("quotes").doc(q.id).set(q);
      /* A quote changing hands tells the right people — submitted → the
         approvers, approved or sent back → the associate. Fired after the
         save so the server reads the real stored quote, never trusting what
         the browser says. Autosaves don't change status, so they never ping. */
      if ((!before || before.status !== q.status) && ["pending", "approved", "changes"].includes(q.status)) {
        tellServer({ quoteId: q.id });
      }
      return;
    }
    const next = Object.assign({}, quotes); next[q.id] = q; await saveQuotes(next);
  };
  /* Permanent erase. Owner only, and deliberately separate from voiding. */
  const deleteQuote = async (id) => {
    if (CLOUD) { await db.collection("quotes").doc(id).delete(); return; }
    const next = Object.assign({}, quotes); delete next[id]; await saveQuotes(next);
  };
  const logout = async () => {
    if (CLOUD) { await fbAuth.signOut(); setMe(null); setView("dashboard"); return; }
    setMe(null); setView("dashboard"); await sessionClear();
  };

  const navItems = [["dashboard", "Dashboard"], ["new", "New quote"]];
  if (isManager) navItems.push(["team", "Team & review"]);
  if (isOwner) navItems.push(["settings", "Settings"]);

  return (
    <div className="min-h-screen" style={{ background: BRAND.paper, color: BRAND.ink }}>
      <header style={{ background: BRAND.navy, borderBottom: `3px solid ${BRAND.gold}` }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div style={{ width: 38, height: 38, background: BRAND.gold, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, color: BRAND.navy }}>JT</div>
            <div>
              <div style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: "0.05em", lineHeight: 1 }}>JTPROQUOTES</div>
              <div style={{ color: BRAND.goldBright, fontSize: 11, letterSpacing: "0.1em" }}>JTPROCONSTRUCTION LLC</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 flex-wrap">
            {navItems.map(([k, l]) => (
              <button key={k} onClick={() => { setView(k); setActiveQuote(null); }}
                style={{ background: view === k ? BRAND.gold : "transparent", color: view === k ? BRAND.navy : "#D8DEE9", border: "none", padding: "7px 14px", borderRadius: 7, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{l}</button>
            ))}
            <AlertsBell me={me} />
            <button onClick={logout} style={{ background: "transparent", color: "#8FA0B8", border: "none", padding: "7px 10px", fontSize: 13, cursor: "pointer" }}>Sign out</button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-4 text-sm" style={{ color: BRAND.sub }}>
          Signed in as <strong style={{ color: BRAND.ink }}>{me.name}</strong> · {ROLE_LABEL[roleOf(me)]}
        </div>

        {view === "dashboard" && <Dashboard me={me} isOwner={isOwner} isManager={isManager} quotes={visibleQuotes} users={users} settings={settings}
          onOpen={(q) => { setActiveQuote(q); setView("edit"); }} onPreview={setPreviewQuote} onNew={() => setView("new")}
          onDelete={async (q) => {
            if (!window.confirm("Permanently delete quote " + q.quoteNo + " for " + (q.clientName || "this client") + "?\n\nThis erases it from the database. It cannot be undone and leaves no record of what was quoted.\n\nIf you only want it out of the way, cancel and use Void instead.")) return;
            if (!window.confirm("Last check — delete " + q.quoteNo + " forever?")) return;
            try {
              await deleteQuote(q.id);
              logActivity(me.name, "Permanently deleted quote", q.quoteNo);
              notify(`Quote ${q.quoteNo} deleted`);
            } catch (e) { warn("delete quote")(e); notify("Could not delete that quote."); }
          }} />}

        {(view === "new" || view === "edit") && (
          <QuoteForm key={activeQuote ? activeQuote.id : "new"} me={me} isOwner={isOwner} isManager={isManager} settings={settings} notify={notify} existing={view === "edit" ? activeQuote : null}
            onAutosave={upsertQuote}
            onSave={async (q, opts) => {
              await upsertQuote(q);
              notify(q.status === "draft" ? "Draft saved — visible to the owner"
                : q.status === "approved" ? "Quote saved & approved"
                : q.status === "changes" ? "Sent back to " + ((users[q.createdBy] && users[q.createdBy].name) || "the associate")
                : q.status === "void" ? "Quote voided"
                : "Quote submitted for review");
              setView("dashboard"); setActiveQuote(null);
              // "Approve & create PDF" lands straight on the finished document.
              if (opts && opts.preview) setPreviewQuote(q);
            }}
            onPreview={setPreviewQuote} onCancel={() => { setView("dashboard"); setActiveQuote(null); }} />
        )}

        {view === "team" && isManager && <TeamView quotes={Object.values(quotes)} users={users} settings={settings} me={me}
          onUpdateQuote={upsertQuote} onSaveUsers={saveUsers} onDeleteUser={deleteUser} onDeleteQuote={deleteQuote} onSaveSettings={saveSettings} onPreview={setPreviewQuote}
          onOpen={(q) => { setActiveQuote(q); setView("edit"); }} notify={notify} />}

        {view === "settings" && isOwner && <SettingsView settings={settings} onSave={async (s) => { await saveSettings(s); notify("Settings saved"); }} />}
      </main>

      {previewQuote && <PreviewModal quote={previewQuote} settings={settings} users={users} me={me} onClose={() => setPreviewQuote(null)} />}

      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: BRAND.navy, color: BRAND.goldBright, padding: "10px 22px", borderRadius: 99, fontWeight: 600, fontSize: 14, boxShadow: "0 6px 20px rgba(0,0,0,0.25)", zIndex: 60 }}>{toast}</div>}
    </div>
  );
}

/* ================= AWAITING OWNER APPROVAL ================= */
function PendingApproval({ profile, onSignOut }) {
  const declined = profile && profile.declined === true;
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: BRAND.navy }}>
      <div className="w-full" style={{ maxWidth: 440 }}>
        <div className="text-center mb-6">
          <div style={{ display: "inline-flex", width: 56, height: 56, background: BRAND.gold, borderRadius: 12, alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, color: BRAND.navy }}>JT</div>
          <h1 style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34, fontWeight: 700, letterSpacing: "0.08em", margin: "12px 0 2px" }}>JTPROQUOTES</h1>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>{declined ? "🔒" : "⏳"}</div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 25, fontWeight: 700, color: BRAND.navy, letterSpacing: "0.04em", marginBottom: 10 }}>
            {declined ? "ACCESS TURNED OFF" : "WAITING FOR APPROVAL"}
          </h2>
          <p style={{ fontSize: 14, color: BRAND.sub, lineHeight: 1.55 }}>
            {declined
              ? "This account no longer has access to JTProQuotes. Contact the owner if you think that's a mistake."
              : "Your account was created and the owner has been notified. Once it's approved you'll be able to build quotes — this page unlocks on its own, no need to sign in again."}
          </p>
          <div style={{ background: BRAND.paper, borderRadius: 10, padding: "12px 14px", marginTop: 16, fontSize: 13, color: BRAND.ink }}>
            <div style={{ fontWeight: 700 }}>{profile && profile.name}</div>
            <div style={{ color: BRAND.sub }}>{profile && profile.email}</div>
          </div>
          <div className="mt-4"><Btn kind="ghost" onClick={onSignOut}>Sign out</Btn></div>
        </div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center", marginTop: 14 }}>
          {COMPANY.name} · {COMPANY.area}
        </p>
      </div>
    </div>
  );
}

/* ================= CLOUD AUTH (Firebase) ================= */
function CloudAuth({ gate }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setMsg(""); setBusy(true);
    try {
      if (mode === "login") {
        await fbAuth.signInWithEmailAndPassword(email.trim(), pw);
        logActivity(email.trim(), "Signed in");
      } else {
        if (!name.trim()) throw new Error("Enter your full name.");
        if (!gate) throw new Error("Still connecting — try again in a moment.");
        if (gate.requireTeamCode && code.trim().toUpperCase() !== String(gate.teamCode || "").toUpperCase())
          throw new Error("Invalid team code. Ask the owner for the current code.");
        const isTheOwner = email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
        const cred = await fbAuth.createUserWithEmailAndPassword(email.trim(), pw);
        await cred.user.updateProfile({ displayName: name.trim() });
        await db.collection("users").doc(cred.user.uid).set({
          id: cred.user.uid, name: name.trim(), username: email.trim(), email: email.trim(),
          role: isTheOwner ? "owner" : "associate",
          // Associates start locked until the owner approves them.
          active: isTheOwner, createdAt: new Date().toISOString(),
        });
        if (isTheOwner) logActivity(name.trim(), "Created account");
      }
    } catch (e) {
      setErr((e.message || "Something went wrong.").replace("Firebase: ", "").replace(/\(auth.*\)\.?/, "").trim());
    }
    setBusy(false);
  };

  const resetPw = async () => {
    setErr(""); setMsg("");
    if (!email.trim()) return setErr("Enter your email address first, then tap this again.");
    try { await fbAuth.sendPasswordResetEmail(email.trim()); setMsg("Password reset link sent. Check your email."); }
    catch (e) { setErr((e.message || "Could not send reset email.").replace("Firebase: ", "")); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: BRAND.navy }}>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="text-center mb-6">
          <div style={{ display: "inline-flex", width: 56, height: 56, background: BRAND.gold, borderRadius: 12, alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, color: BRAND.navy }}>JT</div>
          <h1 style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34, fontWeight: 700, letterSpacing: "0.08em", margin: "12px 0 2px" }}>JTPROQUOTES</h1>
          <p style={{ color: BRAND.goldBright, fontSize: 13, letterSpacing: "0.08em" }}>PROFESSIONAL QUOTES · JTPROCONSTRUCTION LLC</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 26 }}>
          {mode === "register" && <Field label="Full name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stephanie Snead" /></Field>}
          <Field label="Email"><input style={inputStyle} type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" /></Field>
          <Field label="Password" hint={mode === "register" ? "At least 6 characters." : null}>
            <input style={inputStyle} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
          </Field>
          {mode === "register" && gate && gate.requireTeamCode && <Field label="Team code" hint="Provided by the owner."><input style={inputStyle} value={code} onChange={(e) => setCode(e.target.value)} placeholder="JTPRO-XXXX" /></Field>}
          {mode === "register" && <div style={{ background: "#FBF3DE", color: BRAND.amber, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>New accounts need the owner's approval before you can build quotes.</div>}
          {err && <div style={{ color: BRAND.red, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
          {msg && <div style={{ color: BRAND.green, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{msg}</div>}
          <Btn kind="gold" onClick={submit} disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Btn>
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); setMsg(""); }}
            style={{ display: "block", marginTop: 14, background: "none", border: "none", color: BRAND.navySoft, fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            {mode === "login" ? "New associate? Create your profile" : "Already have an account? Sign in"}
          </button>
          {mode === "login" && (
            <button onClick={resetPw} style={{ display: "block", marginTop: 8, background: "none", border: "none", color: BRAND.sub, fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Forgot your password? Email me a reset link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= LOCAL AUTH (offline mode) ================= */
function Auth({ users, settings, onSaveUsers, onLogin }) {
  const firstUser = Object.keys(users).length === 0;
  const [mode, setMode] = useState(firstUser ? "register" : "login");
  const [msgPending, setMsgPending] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [recovery, setRecovery] = useState("");
  const [mode2, setMode2] = useState("closed");
  const hasRecoveryKey = !!settings.recoveryKey;

  const doRecover = async () => {
    setErr("");
    const entry = recovery.trim().toUpperCase();
    if (hasRecoveryKey) {
      if (entry !== String(settings.recoveryKey).toUpperCase()) return setErr("That recovery key doesn't match.");
      const owner = Object.values(users).find((x) => x.role === "owner");
      if (!owner) return setErr("No owner account found.");
      if (pin.length < 4) return setErr("Enter the new PIN you want (at least 4 digits) in the PIN field above.");
      const next = Object.assign({}, users);
      next[owner.id] = Object.assign({}, owner, { pinHash: hashPin(pin) });
      await onSaveUsers(next);
      logActivity(owner.name, "Owner PIN reset via recovery key");
      setErr("");
      onLogin(next[owner.id]);
    } else {
      if (entry !== "RESET-JTPRO") return setErr("Type RESET-JTPRO exactly to erase and start over.");
      if (!window.confirm("This erases ALL accounts and quotes on this device and starts fresh. Continue?")) return;
      await sSet("jtpq:users", {});
      await sSet("jtpq:quotes", {});
      await sSet("jtpq:activity", []);
      await sessionClear();
      window.location.reload();
    }
  };

  const submit = async () => {
    setErr("");
    const uname = username.trim().toLowerCase();
    if (mode === "login") {
      const u = Object.values(users).find((x) => x.username === uname);
      if (!u || u.pinHash !== hashPin(pin)) return setErr("Username or PIN doesn't match.");
      if (u.active !== true) return setErr(u.declined
        ? "This account has been turned off. Contact the owner."
        : "This account is waiting for the owner to approve it.");
      onLogin(u);
    } else {
      if (!name.trim() || !uname || pin.length < 4) return setErr("Enter your name, a username, and a PIN of at least 4 digits.");
      if (Object.values(users).some((x) => x.username === uname)) return setErr("That username is taken.");
      if (!firstUser && settings.requireTeamCode && code.trim().toUpperCase() !== settings.teamCode) return setErr("Invalid team code. Ask the owner for the current code.");
      // The first account is the owner and is live immediately. Everyone
      // after that waits for the owner to approve them.
      const u = { id: uid(), name: name.trim(), username: uname, pinHash: hashPin(pin), role: firstUser ? "owner" : "associate", active: !!firstUser, createdAt: new Date().toISOString() };
      const next = Object.assign({}, users); next[u.id] = u;
      await onSaveUsers(next);
      if (!firstUser) { setMode("login"); setErr(""); return setMsgPending(true); }
      onLogin(u);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: BRAND.navy }}>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="text-center mb-6">
          <div style={{ display: "inline-flex", width: 56, height: 56, background: BRAND.gold, borderRadius: 12, alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, color: BRAND.navy }}>JT</div>
          <h1 style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34, fontWeight: 700, letterSpacing: "0.08em", margin: "12px 0 2px" }}>JTPROQUOTES</h1>
          <p style={{ color: BRAND.goldBright, fontSize: 13, letterSpacing: "0.08em" }}>PROFESSIONAL QUOTES · JTPROCONSTRUCTION LLC</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 26 }}>
          {firstUser && <div style={{ background: "#FBF3DE", color: BRAND.amber, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>First account setup — this account becomes the Owner account.</div>}
          {mode === "register" && <Field label="Full name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stephanie Snead" /></Field>}
          <Field label="Username"><input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoCapitalize="none" /></Field>
          <Field label="PIN" hint="At least 4 digits — you'll use it to sign in."><input style={inputStyle} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" /></Field>
          {mode === "register" && !firstUser && settings.requireTeamCode && <Field label="Team code" hint="Provided by the owner. Keeps outsiders from creating accounts."><input style={inputStyle} value={code} onChange={(e) => setCode(e.target.value)} placeholder="JTPRO-XXXX" /></Field>}
          {err && <div style={{ color: BRAND.red, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
          {msgPending && <div style={{ background: "#FBF3DE", color: BRAND.amber, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Account created. The owner has to approve it before you can sign in.</div>}
          <Btn kind="gold" onClick={submit}>{mode === "login" ? "Sign in" : "Create account"}</Btn>
          {!firstUser && (
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
              style={{ display: "block", marginTop: 14, background: "none", border: "none", color: BRAND.navySoft, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
              {mode === "login" ? "New associate? Create your profile" : "Already have an account? Sign in"}
            </button>
          )}
          {!firstUser && mode === "login" && (
            <div style={{ marginTop: 16, borderTop: `1px solid ${BRAND.line}`, paddingTop: 14 }}>
              {mode2 === "closed" ? (
                <button onClick={() => setMode2("open")} style={{ background: "none", border: "none", color: BRAND.sub, fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                  Owner: forgot your PIN?
                </button>
              ) : (
                <div>
                  <Field
                    label={hasRecoveryKey ? "Owner recovery key" : "Emergency reset"}
                    hint={hasRecoveryKey
                      ? "Enter your recovery key, plus the new PIN you want in the PIN field above."
                      : "No recovery key was ever set, so the only way back in is a full reset. Type RESET-JTPRO to erase all accounts and quotes on this device and start over. Set a recovery key in Settings afterward so this can't happen again."}>
                    <input style={inputStyle} value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder={hasRecoveryKey ? "Recovery key" : "RESET-JTPRO"} />
                  </Field>
                  <Btn small kind={hasRecoveryKey ? "gold" : "danger"} onClick={doRecover}>
                    {hasRecoveryKey ? "Reset my PIN and sign in" : "Erase everything and start over"}
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= DASHBOARD ================= */
const PERIODS = [["month", "This month"], ["quarter", "This quarter"], ["year", "This year"], ["all", "All time"]];
function inPeriod(iso, p) {
  const d = new Date(iso), n = new Date();
  if (p === "all") return true;
  if (p === "year") return d.getFullYear() === n.getFullYear();
  if (p === "quarter") return d.getFullYear() === n.getFullYear() && Math.floor(d.getMonth() / 3) === Math.floor(n.getMonth() / 3);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

function Dashboard({ me, isOwner, isManager, quotes, users, settings, onOpen, onPreview, onNew, onDelete }) {
  const [period, setPeriod] = useState("month");
  const [filter, setFilter] = useState("all");

  // Voided quotes never count toward any figure.
  const totals = useMemo(() => {
    const live = quotes.filter((q) => !isVoid(q));
    // Work written in this period: how much we quoted and how much is still open.
    const written = live.filter((q) => inPeriod(q.createdAt, period));
    let pipeline = 0, sentOut = 0;
    written.forEach((q) => {
      const t = computeQuote(q, settings).total;
      if (OPEN_STATUSES.includes(q.status)) pipeline += t;
      if (["sent", "negotiating", "won"].includes(q.status)) sentOut += t;
    });
    // Money actually booked in this period — dated by when the client signed,
    // not by when the quote was written, and valued at the agreed figure.
    const booked = live
      .filter((q) => q.status === "won" && inPeriod(decidedDate(q), period))
      .reduce((sum, q) => sum + wonValue(q, settings), 0);
    return { pipeline, booked, sentOut, count: written.length };
  }, [quotes, period, settings]);

  /* Voided quotes are excluded from the money figures above, but they still
     belong in the list — otherwise a quote appears to vanish and nobody
     knows what happened to it. */
  const list = quotes
    .filter((q) => inPeriod(q.createdAt, period))
    .filter((q) => filter === "all" || q.status === filter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: BRAND.navy, letterSpacing: "0.03em" }}>
          {isManager ? "COMPANY OVERVIEW" : "MY QUOTES"}
        </h2>
        <div className="flex gap-2 items-center flex-wrap">
          <select style={Object.assign({}, inputStyle, { width: "auto", padding: "8px 10px" })} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Btn kind="gold" onClick={onNew}>+ New quote</Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 md-grid-cols-4 gap-3 mb-6">
        {[
          ["Quotes created", totals.count, null],
          ["Estimated pipeline", money(totals.pipeline), "Pending + approved + sent + negotiating"],
          ["Sent to clients", money(totals.sentOut), "Sent + negotiating + won"],
          ["Booked revenue", money(totals.booked), "Won — counted when signed"],
        ].map(([l, v, h]) => (
          <Card key={l} style={{ borderTop: `3px solid ${BRAND.gold}` }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: BRAND.sub, fontWeight: 700 }}>{l}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: BRAND.navy, marginTop: 4 }}>{v}</div>
            {h && <div style={{ fontSize: 11, color: BRAND.sub }}>{h}</div>}
          </Card>
        ))}
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {["all"].concat(Object.keys(STATUS)).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ background: filter === k ? BRAND.navy : "#fff", color: filter === k ? "#fff" : BRAND.sub, border: `1px solid ${BRAND.line}`, padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {k === "all" ? "All" : STATUS[k].label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 15, color: BRAND.sub }}>No quotes here yet. Create your first one — it takes about two minutes.</div>
          <div className="mt-4"><Btn kind="gold" onClick={onNew}>Create a quote</Btn></div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((q) => {
            const c = computeQuote(q, settings);
            return (
              <Card key={q.id} style={isVoid(q) ? { padding: 14, opacity: 0.6, background: "#FAF9F6" } : { padding: 14 }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, textDecoration: isVoid(q) ? "line-through" : "none" }}>{q.quoteNo} · {q.clientName || "Unnamed client"}</div>
                    <div style={{ fontSize: 13, color: BRAND.sub }}>{q.jobTitle || q.category} · {fmtDate(q.createdAt)}{isManager && users[q.createdBy] ? ` · by ${users[q.createdBy].name}` : ""}</div>
                    {q.fromInbox && <div style={{ fontSize: 11.5, color: BRAND.gold, marginTop: 3, fontWeight: 700, letterSpacing: "0.04em" }}>FROM A LEAD EMAIL{q.leadSource ? " · " + String(q.leadSource).toUpperCase() : ""} — {q.aiDrafted ? "AI-drafted, review & send reply" : "needs pricing"}</div>}
                    {!q.fromInbox && q.aiDrafted && q.status === "draft" && <div style={{ fontSize: 11.5, color: BRAND.gold, marginTop: 3, fontWeight: 700, letterSpacing: "0.04em" }}>AI-DRAFTED{q.aiDraft ? " · " + String(q.aiDraft.confidence).toUpperCase() + " CONFIDENCE" : ""}</div>}
                    {q.reviewNote && q.status === "changes" && <div style={{ fontSize: 12, color: BRAND.red, marginTop: 3 }}>Owner note: {q.reviewNote}</div>}
                    {isVoid(q) && <div style={{ fontSize: 12, color: "#7A6A55", marginTop: 3, fontWeight: 600 }}>Voided{q.voidedBy ? " by " + q.voidedBy : ""}{q.voidReason ? " — " + q.voidReason : ""} · does not count toward any total</div>}
                    {isDecided(q) && !isVoid(q) && (
                      <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 3 }}>
                        {q.status === "won" ? "Won" : "Declined"} {fmtDate(decidedDate(q))}{q.decidedBy ? " · recorded by " + q.decidedBy : ""}
                        {q.status === "won" && typeof q.finalAmount === "number" && q.finalAmount !== c.total
                          ? " · agreed at " + money(q.finalAmount) + " (quoted " + money(c.total) + ")" : ""}
                        {q.outcomeNote ? " — " + q.outcomeNote : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: BRAND.navy, textDecoration: isVoid(q) ? "line-through" : "none" }}>{money(q.status === "won" ? wonValue(q, settings) : c.total)}</div>
                    <Badge status={q.status} />
                    <Btn small kind="ghost" onClick={() => onPreview(q)}>Preview</Btn>
                    {(q.createdBy === me.id || isManager) && !isVoid(q) && <Btn small kind="ghost" onClick={() => onOpen(q)}>Open</Btn>}
                    {isOwner && onDelete && <Btn small kind="danger" onClick={() => onDelete(q)}>Delete</Btn>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================= AI QUOTE ASSISTANT =================
   Take photos on site (or upload them), paste the customer's message, and it
   drafts the whole quote: what needs doing, a detailed scope, crew and days,
   materials at cost, questions for the client, and a first reply.

   The drafting runs in /api/ai-quote on the server, because the API key must
   never be in this file — index.html is public.

   What keeps it honest:
   - The AI never picks the price. It sizes the labor and lists materials at
     cost; the company's own rate, overhead and margin make the price, the same
     formula as a hand-built quote.
   - Every size is labelled: the customer's words, estimated from a photo, or
     assumed. Estimates from photos are for a first reply — verify with a tape
     before the quote is approved.
   - Everything lands as a draft and goes through the normal approval. */

/* Phones produce 4 MB photos; the request body has to stay small, and a job
   photo still shows everything that matters at ~1280px. */
function shrinkImage(file, maxEdge) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Could not read that file."));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't an image we can read. (iPhone HEIC photos: set Camera → Formats → Most Compatible, or take the photo from here.)"));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = cv.toDataURL("image/jpeg", 0.8);
        /* A small copy is kept inside the quote itself. It means the photos show
           on the quote and in the PDF even when Firebase Storage isn't set up,
           and the PDF never has to fetch an image from another site. */
        const ts = Math.min(1, 560 / Math.max(img.width, img.height));
        const tc = document.createElement("canvas");
        tc.width = Math.max(1, Math.round(img.width * ts)); tc.height = Math.max(1, Math.round(img.height * ts));
        const tx = tc.getContext("2d"); tx.fillStyle = "#fff"; tx.fillRect(0, 0, tc.width, tc.height);
        tx.drawImage(img, 0, 0, tc.width, tc.height);
        const thumb = tc.toDataURL("image/jpeg", 0.68);
        resolve({ name: file.name || "photo.jpg", mediaType: "image/jpeg", data: dataUrl.split(",")[1], dataUrl, thumb });
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

const dataUrlToBlob = (dataUrl) => {
  const [head, b64] = dataUrl.split(",");
  const mime = (head.match(/:(.*?);/) || [null, "image/jpeg"])[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/* The reply never states one firm figure off a photo — it gives a range whose
   width follows how sure the draft is. Mirrors priceRange in api/_lib.js. */
const RANGE_BY_CONFIDENCE = { high: [0.95, 1.08], medium: [0.9, 1.15], low: [0.85, 1.3] };
function priceRange(total, confidence) {
  const [lo, hi] = RANGE_BY_CONFIDENCE[confidence] || RANGE_BY_CONFIDENCE.medium;
  const r50 = (n) => Math.max(50, Math.round(n / 50) * 50);
  const f = (n) => "$" + r50(n).toLocaleString("en-US");
  return f(total * lo) + "–" + f(total * hi);
}
function renderReply(template, total, confidence) {
  const t = String(template || "");
  const range = priceRange(total, confidence);
  return t.includes("{{PRICE_RANGE}}") ? t.split("{{PRICE_RANGE}}").join(range) : t;
}

/* A photo on a quote may have a full-size copy in Storage (url), a small copy
   kept in the quote itself (thumb), or both. */
/* Remote photos go through our own /api/img when a PDF is drawn, because the
   PDF renderer can only paint images served from this site. */
const pdfSrc = (u) => (/^https:\/\/firebasestorage\.googleapis\.com\//.test(u || "") ? "/api/img?u=" + encodeURIComponent(u) : u);

/* The PDF library is ~900 KB, so it loads only the first time someone makes a PDF. */
let html2pdfLoading = null;
function loadHtml2pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (!html2pdfLoading) {
    html2pdfLoading = new Promise((resolve, reject) => {
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      sc.onload = () => resolve(window.html2pdf);
      sc.onerror = () => { html2pdfLoading = null; reject(new Error("Couldn't load the PDF maker. Check your connection.")); };
      document.head.appendChild(sc);
    });
  }
  return html2pdfLoading;
}

const attSrc = (a) => (a && (a.url || a.thumb)) || "";
const findingPhoto = (f, quote) => (f && f.photoUrl) || (f && f.attId ? attSrc(((quote && quote.attachments) || []).find((x) => x.id === f.attId)) : "");

const PRIORITY = {
  urgent: { label: "Urgent", color: BRAND.red, bg: "#F9E5E3" },
  recommended: { label: "Recommended", color: BRAND.amber, bg: "#FBF3DE" },
  cosmetic: { label: "Cosmetic", color: BRAND.sub, bg: "#ECEEF1" },
};
const SOURCE_COLOR = { "customer stated": BRAND.green, "estimated from photo": BRAND.amber, "assumed": BRAND.red };

const MAX_PHOTOS = 8;

function AiAssistant({ me, q, settings, disabled, onApplyDraft, onApplyLead, notify }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(null); // "draft" | "read" | "apply" | null
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(null);
  const camRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!busy || busy === "apply") return;
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const addFiles = async (fileList) => {
    setErr("");
    const picked = Array.from(fileList || []).filter((f) => f && ((f.type && f.type.indexOf("image/") === 0) || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name || "")));
    if (!picked.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setErr(MAX_PHOTOS + " photos is the limit. Remove one first.");
    try {
      const shrunk = [];
      for (const f of picked.slice(0, room)) shrunk.push(await shrinkImage(f, 1280));
      setPhotos((p) => p.concat(shrunk));
      if (picked.length > room) setErr("Only the first " + room + " were added — " + MAX_PHOTOS + " is the limit.");
    } catch (e) { setErr(e.message || "Couldn't read that image."); }
  };

  const onPaste = (e) => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const files = [];
    for (const it of items) if (it.kind === "file") { const f = it.getAsFile(); if (f) files.push(f); }
    if (files.length) { e.preventDefault(); addFiles(files); }
  };
  const onDrop = (e) => { e.preventDefault(); addFiles(e.dataTransfer && e.dataTransfer.files); };

  const token = async () => {
    if (!fbAuth || !fbAuth.currentUser) throw new Error("This needs the cloud version. Sign in again.");
    return fbAuth.currentUser.getIdToken();
  };

  /* What's already typed on the quote helps the draft — a job title or a
     description the estimator wrote on site is better than any guess. */
  const context = () => {
    const bits = [];
    if (q.jobTitle) bits.push("Job title on the quote: " + q.jobTitle);
    if (q.category && q.scopeEdited) bits.push("Category chosen: " + q.category);
    if (q.description) bits.push("Description on the quote: " + q.description);
    if (q.clientAddress) bits.push("Job address: " + q.clientAddress);
    return bits.join("\n");
  };

  const runDraft = async () => {
    setErr(""); setDraft(null);
    if (!text.trim() && !photos.length && !context()) return setErr("Add at least one photo or describe the job first.");
    setBusy("draft");
    try {
      const idToken = await token();
      const body = { idToken, text: [text.trim(), context()].filter(Boolean).join("\n\n"), images: photos.map((s) => ({ mediaType: s.mediaType, data: s.data })) };
      const r = await fetch("/api/ai-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || (r.status === 504 ? "That took too long. Try fewer photos." : r.status === 413 ? "Those photos are too large together. Send fewer." : "That didn't work. Try again."));
      setDraft(data.draft);
      logActivity(me.name, "Drafted a quote with AI (" + photos.length + " photo" + (photos.length === 1 ? "" : "s") + ")", q.quoteNo);
    } catch (e) { setErr(e.message || "That didn't work. Try again."); }
    setBusy(null);
  };

  /* The cheap path: just lift the client's details out of a lead screenshot. */
  const runRead = async () => {
    setErr("");
    if (!text.trim() && !photos.length) return setErr("Add the lead screenshot or paste its text first.");
    setBusy("read");
    try {
      const idToken = await token();
      const r = await fetch("/api/read-lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, text, images: photos.slice(0, 3).map((s) => ({ mediaType: s.mediaType, data: s.data })) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "That didn't work. Try again.");
      onApplyLead(data.fields, false, photos);
      logActivity(me.name, "Read a lead from a screenshot", q.quoteNo);
      reset();
    } catch (e) { setErr(e.message || "That didn't work. Try again."); }
    setBusy(null);
  };

  const reset = () => { setOpen(false); setDraft(null); setPhotos([]); setText(""); setErr(""); };

  const apply = async () => {
    if (!draft) return;
    const hasWork = (q.items || []).length > 0 || (q.scopeEdited && (q.scopeItems || []).some((s) => s.on && s.text.trim() && !s.ai));
    if (hasWork && !window.confirm("Replace the scope, materials and crew already on this quote with the AI draft?\n\nClient details you've typed are kept.")) return;
    setBusy("apply");
    try { onApplyDraft(draft, photos); reset(); }
    catch (e) { setErr(e.message || "Couldn't apply the draft."); }
    setBusy(null);
  };

  if (!CLOUD) return null;

  const label = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: BRAND.sub, fontWeight: 700, marginBottom: 4 };
  const box = { background: "#fff", border: `1px solid ${BRAND.line}`, borderRadius: 8, padding: 12, marginBottom: 10 };

  // Preview the price exactly as the quote will compute it.
  const preview = draft ? computeQuote({
    crew: draft.labor.crew, days: draft.labor.days, hoursPerDay: draft.labor.hoursPerDay,
    laborRate: q.laborRate, overheadPct: q.overheadPct, marginPct: q.marginPct, discountPct: q.discountPct,
    items: draft.materials.map((m) => ({ qty: m.qty, price: m.unitCost })),
  }, settings) : null;

  return (
    <div style={{ border: `1.5px dashed ${BRAND.gold}`, borderRadius: 10, padding: 14, marginBottom: 16, background: "#FDFBF4" }}>
      {!open ? (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontWeight: 700, color: BRAND.navy, fontSize: 15 }}>AI quote from photos or a lead</div>
            <div style={{ fontSize: 12.5, color: BRAND.sub, marginTop: 2 }}>Snap the job site or upload photos, paste the customer's Thumbtack message, and get the work detected, scoped and priced as a draft — with the questions to ask and a reply ready to send.</div>
          </div>
          <Btn small kind="gold" onClick={() => setOpen(true)} disabled={disabled}>Start</Btn>
        </div>
      ) : (
        <div onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <div className="flex items-center justify-between mb-3">
            <div style={{ fontWeight: 700, color: BRAND.navy, fontSize: 15 }}>AI quote assistant</div>
            <button onClick={reset} disabled={!!busy}
              style={{ background: "none", border: "none", color: BRAND.sub, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Close</button>
          </div>

          {!draft && (
            <div>
              <div style={label}>Job photos · lead screenshots ({photos.length}/{MAX_PHOTOS})</div>
              <div className="flex gap-2 flex-wrap items-center mb-2">
                {photos.map((s, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={s.dataUrl} alt={"Photo " + (i + 1)} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: `1px solid ${BRAND.line}` }} />
                    <span style={{ position: "absolute", left: 3, bottom: 3, background: "rgba(11,31,58,0.8)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "0 4px" }}>{i + 1}</span>
                    <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="Remove photo"
                      style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 99, border: "none", background: BRAND.red, color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap mb-2">
                <Btn small kind="primary" onClick={() => camRef.current && camRef.current.click()} disabled={photos.length >= MAX_PHOTOS || !!busy}>📷 Take photo</Btn>
                <Btn small kind="ghost" onClick={() => fileRef.current && fileRef.current.click()} disabled={photos.length >= MAX_PHOTOS || !!busy}>Upload photos</Btn>
                <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </div>
              <div style={{ fontSize: 11.5, color: BRAND.sub, marginBottom: 12 }}>
                Wide shots for context, close-ups of the damage. Something of known size in frame (a door, an outlet, a tape measure) makes sizes far more accurate. You can also paste or drag images here.
              </div>

              <Field label="Customer's message and your notes" hint="Paste the Thumbtack request, and add anything you know — measurements, the finish they want, access, timing.">
                <textarea style={Object.assign({}, inputStyle, { minHeight: 100, resize: "vertical" })} value={text}
                  onChange={(e) => setText(e.target.value)} placeholder={"e.g. Thumbtack: \"Need the hallway ceiling fixed after a roof leak, about 10x4 ft stain…\"\nMy notes: roof already repaired, attic insulation wet."} />
              </Field>

              {err && <div style={{ color: BRAND.red, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{err}</div>}
              {busy === "draft" ? (
                <div style={{ background: BRAND.navy, color: "#fff", borderRadius: 8, padding: "12px 14px", fontSize: 13.5 }}>
                  <strong style={{ color: BRAND.goldBright }}>Drafting…</strong> {secs < 8 ? "Looking at the photos" : secs < 20 ? "Identifying the work and sizing it" : secs < 40 ? "Writing the scope and pricing materials" : "Almost there — detailed jobs take up to a minute or two"} · {secs}s
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap items-center">
                  <Btn kind="gold" onClick={runDraft} disabled={!!busy}>Detect work & draft quote</Btn>
                  <Btn small kind="ghost" onClick={runRead} disabled={!!busy}>{busy === "read" ? "Reading…" : "Just fill client details"}</Btn>
                </div>
              )}
            </div>
          )}

          {draft && (
            <div>
              <div style={Object.assign({}, box, { borderLeft: `4px solid ${draft.confidence === "high" ? BRAND.green : draft.confidence === "medium" ? BRAND.amber : BRAND.red}` })}>
                <div className="flex justify-between items-baseline flex-wrap gap-2">
                  <div>
                    <div style={{ fontWeight: 700, color: BRAND.navy, fontSize: 16 }}>{draft.jobTitle || draft.category}</div>
                    <div style={{ fontSize: 12.5, color: BRAND.sub }}>{draft.category} · crew of {draft.labor.crew} · {draft.labor.days} day{draft.labor.days === 1 ? "" : "s"} · {draft.materials.length} material lines</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: BRAND.navy }}>{money(preview.total)}</div>
                    <div style={{ fontSize: 11.5, color: BRAND.sub }}>Reply range {priceRange(preview.total, draft.confidence)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, marginTop: 8, fontWeight: 600, color: draft.confidence === "high" ? BRAND.green : draft.confidence === "medium" ? BRAND.amber : BRAND.red }}>
                  {draft.confidence.toUpperCase()} CONFIDENCE — {draft.confidenceReason}{draft.needsSiteVisit ? " · Site visit recommended before a firm price." : ""}
                </div>
                {draft.projectSummary && <div style={{ fontSize: 13, marginTop: 8, color: BRAND.ink }}>{draft.projectSummary}</div>}
              </div>

              {draft.findings.length > 0 && (
                <div style={box}>
                  <div style={label}>What it found ({draft.findings.length})</div>
                  {draft.findings.map((f, i) => (
                    <div key={i} className="flex gap-2 items-start" style={{ marginBottom: 8 }}>
                      {f.photo > 0 && photos[f.photo - 1]
                        ? <img src={photos[f.photo - 1].dataUrl} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />
                        : <div style={{ width: 46, height: 46, borderRadius: 5, background: BRAND.paper, flexShrink: 0 }} />}
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                          {f.title} <span style={{ fontSize: 10.5, fontWeight: 700, color: PRIORITY[f.priority].color, background: PRIORITY[f.priority].bg, borderRadius: 99, padding: "1px 7px", marginLeft: 4 }}>{PRIORITY[f.priority].label}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: BRAND.sub }}>{f.detail}{f.photo > 0 ? " (photo " + f.photo + ")" : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={box}>
                <div style={label}>Scope of work — {draft.scope.filter((x) => x.on).length} steps included, {draft.scope.filter((x) => !x.on).length} standard steps left unticked</div>
                {draft.scope.map((x, i) => (
                  <div key={i} className="flex gap-2 items-start" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 3, opacity: x.on ? 1 : 0.5 }}>
                    <span style={{ flexShrink: 0, width: 16, color: x.on ? BRAND.green : BRAND.sub, fontWeight: 700 }}>{x.on ? "✓" : "–"}</span>
                    <span style={{ textDecoration: x.on ? "none" : "line-through" }}>{x.text}{!x.standard && x.on ? <span style={{ fontSize: 10.5, color: BRAND.gold, fontWeight: 700, marginLeft: 6 }}>JOB-SPECIFIC</span> : null}</span>
                  </div>
                ))}
              </div>

              <div style={box}>
                <div style={label}>Labor</div>
                <div style={{ fontSize: 13 }}>{draft.labor.crew} × {draft.labor.days} day{draft.labor.days === 1 ? "" : "s"} × {draft.labor.hoursPerDay} hrs × {money(q.laborRate)} = <strong>{money(preview.labor)}</strong></div>
                {draft.labor.basis && <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 2 }}>{draft.labor.basis}</div>}
                <div style={Object.assign({}, label, { marginTop: 10 })}>Materials at cost</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                    <tbody>
                      {draft.materials.map((m, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${BRAND.line}` }}>
                          <td style={{ padding: "4px 4px 4px 0" }}>{m.desc}</td>
                          <td style={{ padding: 4, textAlign: "right", whiteSpace: "nowrap" }}>{m.qty} {m.unit}</td>
                          <td style={{ padding: 4, textAlign: "right", whiteSpace: "nowrap" }}>{money(m.unitCost)}</td>
                          <td style={{ padding: "4px 0 4px 4px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{money(m.qty * m.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 6 }}>
                  Materials {money(preview.materials)} + overhead {money(preview.overhead)} + your {q.marginPct}% margin = <strong style={{ color: BRAND.navy }}>{money(preview.total)}</strong>
                </div>
              </div>

              {draft.measurements.length > 0 && (
                <div style={box}>
                  <div style={label}>Sizes the price rests on</div>
                  {draft.measurements.map((m, i) => (
                    <div key={i} style={{ fontSize: 12.5, marginBottom: 3 }}>
                      {m.what}: <strong>{m.value}</strong> <span style={{ fontSize: 10.5, fontWeight: 700, color: SOURCE_COLOR[m.source] }}>· {m.source}</span>
                    </div>
                  ))}
                  {draft.measurements.some((m) => m.source !== "customer stated") && (
                    <div style={{ fontSize: 11.5, color: BRAND.amber, marginTop: 5, fontWeight: 600 }}>Sizes not from the customer are estimates. Fine for a first reply — verify with a tape before this quote is approved.</div>
                  )}
                </div>
              )}

              {draft.questions.length > 0 && (
                <div style={box}>
                  <div style={label}>Still need from the client</div>
                  <ol style={{ fontSize: 13, paddingLeft: 20, margin: 0 }}>{draft.questions.map((x, i) => <li key={i}>{x}</li>)}</ol>
                </div>
              )}

              {(draft.risks || draft.assumptions.length > 0) && (
                <div style={Object.assign({}, box, { background: "#FBF3DE", borderColor: "#EAD9A8" })}>
                  <div style={label}>Internal — assumptions & risks</div>
                  {draft.assumptions.length > 0 && <ul style={{ fontSize: 12.5, paddingLeft: 18, margin: 0 }}>{draft.assumptions.map((x, i) => <li key={i} style={{ listStyle: "disc" }}>{x}</li>)}</ul>}
                  {draft.risks && <div style={{ fontSize: 12.5, marginTop: 6, color: BRAND.red, fontWeight: 600 }}>{draft.risks}</div>}
                </div>
              )}

              {draft.replyTemplate && (
                <div style={box}>
                  <div style={label}>First reply to the customer (saved on the quote)</div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: BRAND.ink }}>{renderReply(draft.replyTemplate, preview.total, draft.confidence)}</div>
                </div>
              )}

              {err && <div style={{ color: BRAND.red, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{err}</div>}
              <div className="flex gap-2 flex-wrap">
                <Btn kind="gold" onClick={apply} disabled={!!busy}>{busy === "apply" ? "Applying…" : "Use this draft"}</Btn>
                <Btn kind="ghost" onClick={() => setDraft(null)} disabled={!!busy}>Adjust photos / notes</Btn>
              </div>
              <div style={{ fontSize: 11.5, color: BRAND.sub, marginTop: 8 }}>
                Applying fills the quote and opens the client-ready preview. Everything stays editable, and it still goes through approval.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= QUOTE FORM ================= */
function QuoteForm({ me, isOwner, isManager, settings, notify, existing, onSave, onAutosave, onPreview, onCancel }) {
  const [q, setQ] = useState(existing || {
    id: uid(),
    quoteNo: "Q-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
    createdBy: me.id, createdAt: new Date().toISOString(), status: "draft",
    clientName: "", clientPhone: "", clientEmail: "", clientAddress: "",
    category: CATEGORIES[0], jobTitle: "", description: "",
    scopeItems: buildScope(CATEGORIES[0]), scopeSource: CATEGORIES[0], scopeEdited: false,
    exclusions: buildExclusions(),
    crew: 2, days: 1, hoursPerDay: 8, laborRate: settings.laborRate,
    items: [], overheadPct: settings.overheadPct, marginPct: settings.targetMargin,
    discountPct: 0, notes: "", history: [{ at: new Date().toISOString(), by: me.name, action: "Created" }],
  });
  const [dirty, setDirty] = useState(false);
  const [loggedStart, setLoggedStart] = useState(false);
  const set = (k, v) => { setDirty(true); setQ((p) => Object.assign({}, p, { [k]: v })); };
  const locked = isVoid(q) || (!isManager && ["approved", "sent", "negotiating", "won", "lost"].includes(q.status));
  useEffect(() => {
    if (!dirty) return;
    if (!existing && !loggedStart) { logActivity(me.name, "Started a new draft", q.quoteNo); setLoggedStart(true); }
    if (locked) return; // approved/sent/won/lost quotes are read-only for associates
    const t = setTimeout(() => { onAutosave(Object.assign({}, q, { updatedAt: new Date().toISOString() })); }, 1200);
    return () => clearTimeout(t);
  }, [q, dirty]);
  const c = computeQuote(q, settings);
  const health = marginHealth(c.realMargin);

  const scopeItems = q.scopeItems || [];
  const exclusions = q.exclusions || [];
  const setScope = (arr, edited) => setQ((p) => Object.assign({}, p, { scopeItems: arr, scopeEdited: edited === undefined ? true : edited }));
  const toggleScope = (id) => { setDirty(true); setScope(scopeItems.map((s) => (s.id === id ? Object.assign({}, s, { on: !s.on }) : s))); };
  const editScope = (id, text) => { setDirty(true); setScope(scopeItems.map((s) => (s.id === id ? Object.assign({}, s, { text }) : s))); };
  const rmScope = (id) => { setDirty(true); setScope(scopeItems.filter((s) => s.id !== id)); };
  const addScope = () => { setDirty(true); setScope(scopeItems.concat([{ id: uid(), text: "", on: true }])); };
  const loadScope = () => { setDirty(true); setQ((p) => Object.assign({}, p, { scopeItems: buildScope(p.category), scopeSource: p.category, scopeEdited: false })); };
  const toggleExcl = (id) => { setDirty(true); setQ((p) => Object.assign({}, p, { exclusions: exclusions.map((s) => (s.id === id ? Object.assign({}, s, { on: !s.on }) : s)) })); };

  const changeCategory = (cat) => {
    setDirty(true);
    setQ((p) => {
      const fresh = !p.scopeEdited || !(p.scopeItems || []).length;
      return Object.assign({}, p, { category: cat }, fresh ? { scopeItems: buildScope(cat), scopeSource: cat, scopeEdited: false } : {});
    });
  };

  const addItem = () => set("items", q.items.concat([{ id: uid(), desc: "", qty: 1, price: 0 }]));  const setItem = (id, k, v) => set("items", q.items.map((it) => (it.id === id ? Object.assign({}, it, { [k]: v }) : it)));
  const rmItem = (id) => set("items", q.items.filter((it) => it.id !== id));

  const save = async (submit, opts) => {
    if (!q.clientName.trim()) return alert("Enter the client's name.");
    const next = Object.assign({}, q, { updatedAt: new Date().toISOString() });
    if (submit) {
      next.status = isManager ? "approved" : "pending";
      next.history = (q.history || []).concat([{ at: new Date().toISOString(), by: me.name, action: isManager ? "Saved & approved" : "Submitted for review" }]);
      logActivity(me.name, isManager ? "Saved & approved quote" : "Submitted quote for review", q.quoteNo);
    } else {
      next.history = (q.history || []).concat([{ at: new Date().toISOString(), by: me.name, action: "Saved draft" }]);
      logActivity(me.name, "Saved draft", q.quoteNo);
    }
    await onSave(next, opts);
    // Who gets told (and how) is decided in upsertQuote, for every save path.
  };

  /* A manager looking at someone else's submitted work can bounce it back
     with a note, or void it, right here — no need to leave the editor. */
  const canReview = isManager && existing && q.createdBy !== me.id
    && ["pending", "changes", "draft"].includes(q.status);

  const sendBack = () => {
    const note = window.prompt("What should they change?\n(e.g. Margin too thin — raise to 22%)", q.reviewNote || "");
    if (note === null) return;
    onSave(Object.assign({}, q, {
      status: "changes",
      reviewNote: note.trim(),
      updatedAt: new Date().toISOString(),
      history: (q.history || []).concat([{ at: new Date().toISOString(), by: me.name, action: "Requested changes" + (note.trim() ? " — " + note.trim() : "") }]),
    }));
    logActivity(me.name, "Requested changes on quote", q.quoteNo);
  };

  const voidThis = () => {
    if (!window.confirm("Void quote " + q.quoteNo + "?\n\nVoiding is permanent. The quote is frozen for good — it can't be edited, printed, or brought back, and it stops counting toward any total.")) return;
    const reason = window.prompt("Why is this quote being voided?\n(e.g. duplicate, client cancelled, priced in error)");
    if (reason === null) return;
    onSave(Object.assign({}, q, {
      status: "void", voidReason: reason.trim(), voidedAt: new Date().toISOString(),
      voidedBy: me.name, prevStatus: q.status,
      history: (q.history || []).concat([{ at: new Date().toISOString(), by: me.name, action: "Voided" + (reason.trim() ? " — " + reason.trim() : "") }]),
    }));
    logActivity(me.name, "Voided quote", q.quoteNo);
  };

  const Stepper = ({ label, value, min, onChange, unit }) => (
    <div>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: BRAND.sub, fontWeight: 700, marginBottom: 6, fontFamily: "'Barlow Condensed', sans-serif" }}>{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={locked} style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${BRAND.line}`, background: "#fff", fontSize: 18, cursor: "pointer", color: BRAND.navy }}>−</button>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: BRAND.navy, minWidth: 44, textAlign: "center" }}>{value}<span style={{ fontSize: 13, color: BRAND.sub, fontWeight: 500 }}> {unit}</span></div>
        <button onClick={() => onChange(value + 1)} disabled={locked} style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${BRAND.gold}`, background: BRAND.gold, fontSize: 18, cursor: "pointer", color: BRAND.navy, fontWeight: 700 }}>+</button>
      </div>
    </div>
  );

  const h3Style = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: BRAND.navy, marginBottom: 14, letterSpacing: "0.04em" };

  /* Fills the form from a read lead. By default it only touches fields that
     are still empty, so a half-typed quote never gets clobbered. Scope lines
     it suggests are added switched off — somebody has to agree to each one
     before it reaches the client. */
  const applyLead = (f, overwrite, shots) => {
    if (shots && shots.length) attachShots(shots, "lead");
    setDirty(true);
    setQ((p) => {
      const take = (key, val) => (val && (overwrite || !String(p[key] || "").trim()) ? val : p[key]);
      const next = Object.assign({}, p, {
        clientName: take("clientName", f.clientName),
        clientPhone: take("clientPhone", f.clientPhone),
        clientEmail: take("clientEmail", f.clientEmail),
        clientAddress: take("clientAddress", f.clientAddress),
        jobTitle: take("jobTitle", f.jobTitle),
        description: take("description", f.description),
      });
      // Changing the category swaps in that trade's scope template.
      if (f.category && (overwrite || p.category === CATEGORIES[0]) && f.category !== p.category) {
        next.category = f.category;
        if (!p.scopeEdited) { next.scopeItems = buildScope(f.category); next.scopeSource = f.category; }
      }
      const suggestions = (f.scopeSuggestions || []).map((t) => ({ id: uid(), text: t, on: false, fromLead: true }));
      if (suggestions.length) next.scopeItems = (next.scopeItems || []).concat(suggestions);
      // What the customer said about size, timing and budget belongs in the
      // estimator's notes — never in the pricing.
      const extra = [
        f.measurements && f.measurements.length ? "Customer stated: " + f.measurements.join("; ") : "",
        f.timeline ? "Timeline: " + f.timeline : "",
        f.budgetMentioned ? "Budget named: " + f.budgetMentioned : "",
        f.sourcePlatform ? "Lead source: " + f.sourcePlatform : "",
      ].filter(Boolean).join("\n");
      if (extra) next.notes = (p.notes ? p.notes.trim() + "\n\n" : "") + extra;
      next.leadReadAt = new Date().toISOString();
      return next;
    });
    notify("Form filled from the lead — check every field before submitting.");
  };

  /* Photos and lead screenshots live with the quote — the record of what the
     site looked like and what the customer asked for.

     Each photo is attached straight away as a small copy inside the quote, so
     nothing waits on the network. The full-size original then uploads to
     Firebase Storage in the background; if Storage isn't set up, or the upload
     fails, the quote simply keeps the small copy. */
  const attachFrom = (shots, kind, showSet) => shots.map((sh, i) => ({
    id: uid(), thumb: sh.thumb || "", url: "", path: "", kind: kind || "photo",
    show: !!(showSet && showSet.has(i + 1)), at: new Date().toISOString(), by: me.name,
  }));

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);

  const uploadInBackground = (shots, atts) => {
    if (!fbStorage) return;
    shots.forEach(async (sh, i) => {
      const att = atts[i];
      try {
        const path = `leads/${me.id}/${q.id}/${Date.now()}-${i}.jpg`;
        const ref = fbStorage.ref().child(path);
        await withTimeout(ref.put(dataUrlToBlob(sh.dataUrl), { contentType: "image/jpeg" }), 25000);
        const url = await withTimeout(ref.getDownloadURL(), 10000);
        setDirty(true);
        setQ((p) => Object.assign({}, p, {
          attachments: (p.attachments || []).map((a) => (a.id === att.id ? Object.assign({}, a, { url, path }) : a)),
        }));
      } catch (e) {
        warn("full-size photo upload (the small copy is kept)")(e);
      }
    });
  };

  const attachShots = (shots, kind) => {
    const atts = attachFrom(shots, kind);
    setDirty(true);
    setQ((p) => Object.assign({}, p, { attachments: (p.attachments || []).concat(atts) }));
    uploadInBackground(shots, atts);
  };

  /* Applies an AI draft to the quote, then opens the client-ready preview.
     Client fields only fill blanks; the work — scope, crew, materials,
     assessment, exclusions — comes from the draft. */
  const applyDraft = (d, shots) => {
    const referenced = new Set(d.findings.map((f) => f.photo).filter((n) => n > 0));
    const atts = attachFrom(shots || [], "photo", referenced);
    const blank = (k) => !String(q[k] || "").trim();
    const off = new Set(d.exclusionsOff || []);
    const next = Object.assign({}, q, {
      clientName: blank("clientName") && d.clientName ? d.clientName : q.clientName,
      clientPhone: blank("clientPhone") && d.clientPhone ? d.clientPhone : q.clientPhone,
      clientEmail: blank("clientEmail") && d.clientEmail ? d.clientEmail : q.clientEmail,
      clientAddress: blank("clientAddress") && d.clientAddress ? d.clientAddress : q.clientAddress,
      category: d.category, jobTitle: d.jobTitle || q.jobTitle,
      description: d.projectSummary || q.description,
      scopeItems: d.scope.map((x) => (typeof x === "string"
        ? { id: uid(), text: x, on: true, ai: true, standard: 0 }
        : { id: uid(), text: x.text, on: x.on !== false, ai: true, standard: x.standard || 0 })),
      scopeSource: d.category, scopeEdited: true,
      exclusions: STANDARD_EXCLUSIONS.map((t, i) => ({ id: uid(), text: t, on: !off.has(i + 1) })),
      crew: d.labor.crew, days: d.labor.days, hoursPerDay: d.labor.hoursPerDay,
      items: d.materials.map((m) => ({ id: uid(), desc: m.desc, qty: m.qty, unit: m.unit, price: m.unitCost, ai: true })),
      assessment: d.findings.map((f) => ({
        id: uid(), title: f.title, detail: f.detail, priority: f.priority, photo: f.photo,
        attId: f.photo > 0 && atts[f.photo - 1] ? atts[f.photo - 1].id : "", photoUrl: "", on: true,
      })),
      attachments: (q.attachments || []).concat(atts),
      aiDraft: {
        at: new Date().toISOString(), by: me.name, model: d.model, confidence: d.confidence, confidenceReason: d.confidenceReason,
        needsSiteVisit: d.needsSiteVisit, measurements: d.measurements, assumptions: d.assumptions,
        questions: d.questions, risks: d.risks, laborBasis: d.labor.basis, photoCount: d.photoCount,
        timeline: d.timeline || "", budgetMentioned: d.budgetMentioned || "",
      },
      replyTemplate: d.replyTemplate || q.replyTemplate || "",
      aiDrafted: true,
      updatedAt: new Date().toISOString(),
      history: (q.history || []).concat([{ at: new Date().toISOString(), by: me.name, action: "Applied AI draft (" + d.confidence + " confidence, " + (d.photoCount || 0) + " photos)" }]),
    });
    setDirty(true);
    setQ(next);
    // Save it right away rather than waiting for the autosave tick.
    if (!locked) onAutosave(next);
    uploadInBackground(shots || [], atts);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    notify("AI draft applied — here's the client-ready quote.");
    setTimeout(() => onPreview(next), 250);
  };

  const assessment = q.assessment || [];
  const setAssess = (id, patch) => { setDirty(true); setQ((p) => Object.assign({}, p, { assessment: (p.assessment || []).map((a) => (a.id === id ? Object.assign({}, a, patch) : a)) })); };
  const rmAssess = (id) => { setDirty(true); setQ((p) => Object.assign({}, p, { assessment: (p.assessment || []).filter((a) => a.id !== id) })); };
  const addAssess = () => { setDirty(true); setQ((p) => Object.assign({}, p, { assessment: (p.assessment || []).concat([{ id: uid(), title: "", detail: "", priority: "recommended", photo: 0, photoUrl: "", on: true }]) })); };
  const togglePhoto = (i) => { setDirty(true); setQ((p) => Object.assign({}, p, { attachments: (p.attachments || []).map((a, j) => (j === i ? Object.assign({}, a, { show: !a.show }) : a)) })); };

  /* The reply carries a price range, so for an associate it unlocks with
     approval — same rule as printing the quote. */
  const releasable = ["approved", "sent", "negotiating", "won"].includes(q.status);
  const canSendReply = !isVoid(q) && (isManager || releasable);
  const replyText = renderReply(q.replyTemplate, c.total, (q.aiDraft && q.aiDraft.confidence) || "medium");
  const copyReply = async () => {
    try { await navigator.clipboard.writeText(replyText); notify("Reply copied — paste it into Thumbtack."); }
    catch { window.prompt("Copy the reply:", replyText); }
    logActivity(me.name, "Copied the client reply", q.quoteNo);
  };
  const phoneDigits = String(q.clientPhone || "").replace(/[^0-9+]/g, "");
  const startReply = () => {
    setDirty(true);
    const first = (q.clientName || "").split(" ")[0];
    set("replyTemplate", "Hi" + (first ? " " + first : "") + ", thanks for reaching out to JTProconstruction about " + (q.jobTitle || "your project").toLowerCase() + ".\n\nBased on what you've described, the estimated investment is {{PRICE_RANGE}}, covering labor, materials, cleanup and haul-off, with a 90-day workmanship warranty.\n\nWould you be open to a quick call or a short site visit so we can confirm measurements and give you a firm price?\n\n— Joel, JTProconstruction LLC");
  };

  const attachments = q.attachments || [];

  return (
    <div className="grid md-grid-cols-3 gap-5">
      <div className="md-col-span-2 flex flex-col gap-5">
        <Card>
          <h3 style={h3Style}>1 · CLIENT</h3>
          <AiAssistant me={me} q={q} settings={settings} disabled={locked} onApplyDraft={applyDraft} onApplyLead={applyLead} notify={notify} />
          {attachments.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: BRAND.sub, fontWeight: 700, marginBottom: 6 }}>Photos & screenshots on file ({attachments.length})</div>
              <div className="flex gap-2 flex-wrap">
                {attachments.map((a, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <a href={a.url || undefined} target="_blank" rel="noopener noreferrer" title={"Added by " + (a.by || "unknown") + " · " + fmtDate(a.at) + (a.url ? "" : " · small copy only")}>
                      <img src={attSrc(a)} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: `2px solid ${a.show ? BRAND.gold : BRAND.line}` }} />
                    </a>
                    {!locked && (
                      <label style={{ display: "block", fontSize: 10.5, color: a.show ? BRAND.navy : BRAND.sub, fontWeight: 700, cursor: "pointer", marginTop: 2 }}>
                        <input type="checkbox" checked={!!a.show} onChange={() => togglePhoto(i)} style={{ marginRight: 3, verticalAlign: "middle" }} />On quote
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: BRAND.sub, marginTop: 4 }}>Ticked photos print on the client's quote as a photo reference. Screenshots of the lead stay internal.</div>
            </div>
          )}
          <div className="grid md-grid-cols-2 gap-x-4">
            <Field label="Client name"><input style={inputStyle} disabled={locked} value={q.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Full name" /></Field>
            <Field label="Phone"><input style={inputStyle} disabled={locked} value={q.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="(832) 000-0000" /></Field>
            <Field label="Email"><input style={inputStyle} disabled={locked} value={q.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} placeholder="client@email.com" /></Field>
            <Field label="Job address"><input style={inputStyle} disabled={locked} value={q.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} placeholder="Street, City, TX" /></Field>
          </div>
        </Card>

        <Card>
          <h3 style={h3Style}>2 · THE WORK</h3>
          <div className="grid md-grid-cols-2 gap-x-4">
            <Field label="Category">
              <select style={inputStyle} disabled={locked} value={q.category} onChange={(e) => changeCategory(e.target.value)}>
                {CATEGORIES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Job title"><input style={inputStyle} disabled={locked} value={q.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="e.g. Master bath tile & vanity replacement" /></Field>
          </div>
          <Field label="Extra detail for the client (optional)" hint="Sizes, colors, brands, or anything specific to this job. Appears above the scope list.">
            <textarea style={Object.assign({}, inputStyle, { minHeight: 70 })} disabled={locked} value={q.description} onChange={(e) => set("description", e.target.value)} placeholder="Approx. 120 sq ft of porcelain tile in master bath; client selecting 12x24 in matte finish…" />
          </Field>
        </Card>

        {(assessment.length > 0 || q.aiDrafted) && (
          <Card>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h3 style={Object.assign({}, h3Style, { marginBottom: 0 })}>SITE ASSESSMENT</h3>
              {!locked && <Btn small kind="ghost" onClick={addAssess}>+ Add finding</Btn>}
            </div>
            <div style={{ fontSize: 13, color: BRAND.sub, marginBottom: 12 }}>
              What was found on site. Ticked findings print on the quote above the scope, so the client sees why each piece of work is needed.
            </div>
            {assessment.map((a) => (
              <div key={a.id} className="flex gap-2 mb-3 items-start">
                <input type="checkbox" disabled={locked} checked={a.on} onChange={() => setAssess(a.id, { on: !a.on })} style={{ width: 18, height: 18, flexShrink: 0, marginTop: 10, cursor: "pointer" }} />
                {findingPhoto(a, q) ? <img src={findingPhoto(a, q)} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} /> : null}
                <div style={{ flex: 1, opacity: a.on ? 1 : 0.45 }}>
                  <div className="flex gap-2 mb-1">
                    <input style={Object.assign({}, inputStyle, { flex: 1, padding: "7px 10px", fontSize: 14, fontWeight: 600 })} disabled={locked} value={a.title} onChange={(e) => setAssess(a.id, { title: e.target.value })} placeholder="What was found" />
                    <select style={Object.assign({}, inputStyle, { width: 128, padding: "7px 6px", fontSize: 13 })} disabled={locked} value={a.priority} onChange={(e) => setAssess(a.id, { priority: e.target.value })}>
                      {Object.keys(PRIORITY).map((k) => <option key={k} value={k}>{PRIORITY[k].label}</option>)}
                    </select>
                  </div>
                  <textarea style={Object.assign({}, inputStyle, { minHeight: 44, padding: "7px 10px", fontSize: 13 })} disabled={locked} value={a.detail} onChange={(e) => setAssess(a.id, { detail: e.target.value })} placeholder="Why it matters" />
                </div>
                {!locked && <button onClick={() => rmAssess(a.id)} style={{ background: "none", border: "none", color: BRAND.red, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>}
              </div>
            ))}
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h3 style={Object.assign({}, h3Style, { marginBottom: 0 })}>3 · SCOPE OF WORK</h3>
            {!locked && (
              <div className="flex gap-2">
                <Btn small kind="ghost" onClick={loadScope}>Reload standard scope</Btn>
                <Btn small kind="ghost" onClick={addScope}>+ Add step</Btn>
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, color: BRAND.sub, marginBottom: 12 }}>
            {q.aiDrafted ? "Scope drafted for this job." : "Standard " + q.category + " scope loaded."} Untick anything the client doesn't need, edit the wording, or add your own steps. Only ticked items print on the quote.
          </div>
          {scopeItems.map((s) => (
            <div key={s.id} className="flex items-center gap-2 mb-2">
              <input type="checkbox" disabled={locked} checked={s.on} onChange={() => toggleScope(s.id)} style={{ width: 18, height: 18, flexShrink: 0, cursor: "pointer" }} />
              <input
                style={Object.assign({}, inputStyle, { flex: 1, opacity: s.on ? 1 : 0.45, textDecoration: s.on ? "none" : "line-through", padding: "8px 10px", fontSize: 14 })}
                disabled={locked} value={s.text} onChange={(e) => editScope(s.id, e.target.value)} placeholder="Describe this step…" />
              {!locked && <button onClick={() => rmScope(s.id)} style={{ background: "none", border: "none", color: BRAND.red, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>}
            </div>
          ))}
          <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 6 }}>
            {scopeItems.filter((s) => s.on).length} of {scopeItems.length} steps will appear on the client's quote.
          </div>
        </Card>

        <Card>
          <h3 style={h3Style}>4 · NOT INCLUDED</h3>
          <div style={{ fontSize: 13, color: BRAND.sub, marginBottom: 12 }}>
            These print on the quote to protect you from scope creep. Untick any that don't apply to this job.
          </div>
          {exclusions.map((s) => (
            <label key={s.id} className="flex items-center gap-2 mb-2" style={{ cursor: locked ? "default" : "pointer" }}>
              <input type="checkbox" disabled={locked} checked={s.on} onChange={() => toggleExcl(s.id)} style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span style={{ fontSize: 14, opacity: s.on ? 1 : 0.45, textDecoration: s.on ? "none" : "line-through" }}>{s.text}</span>
            </label>
          ))}
        </Card>

        <Card>
          <h3 style={h3Style}>5 · CREW & LABOR</h3>
          <div className="grid grid-cols-2 md-grid-cols-3 gap-4 mb-4">
            <Stepper label="Crew members" value={q.crew} min={1} unit={q.crew === 1 ? "person" : "people"} onChange={(v) => set("crew", v)} />
            <Stepper label="Days on site" value={q.days} min={1} unit={q.days === 1 ? "day" : "days"} onChange={(v) => set("days", v)} />
            <Stepper label="Hours per day" value={q.hoursPerDay} min={1} unit="hrs" onChange={(v) => set("hoursPerDay", v)} />
          </div>
          <div className="grid md-grid-cols-2 gap-x-4 items-end">
            <Field label="Labor rate ($/hr per person)"><input style={inputStyle} disabled={locked} type="number" value={q.laborRate} onChange={(e) => set("laborRate", Number(e.target.value))} /></Field>
            <div style={{ background: BRAND.paper, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14 }}>
              Labor: {q.crew} × {q.days} × {q.hoursPerDay} hrs × {money(q.laborRate)} = <strong style={{ color: BRAND.navy }}>{money(c.labor)}</strong>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 style={Object.assign({}, h3Style, { marginBottom: 0 })}>6 · MATERIALS & EXTRAS</h3>
            {!locked && <Btn small kind="ghost" onClick={addItem}>+ Add item</Btn>}
          </div>
          {q.items.length === 0 && <div style={{ fontSize: 13, color: BRAND.sub }}>No materials yet. For labor-only jobs, leave this empty.</div>}
          {q.items.map((it) => (
            <div key={it.id} className="flex gap-2 mb-2 items-center flex-wrap">
              <input style={Object.assign({}, inputStyle, { flex: "2 1 180px" })} disabled={locked} placeholder="Item — e.g. Porcelain tile 12x24" value={it.desc} onChange={(e) => setItem(it.id, "desc", e.target.value)} />
              <input style={Object.assign({}, inputStyle, { flex: "0 1 70px" })} disabled={locked} type="number" placeholder="Qty" value={it.qty} onChange={(e) => setItem(it.id, "qty", e.target.value)} />
              <input style={Object.assign({}, inputStyle, { flex: "0 1 64px" })} disabled={locked} placeholder="unit" value={it.unit || ""} onChange={(e) => setItem(it.id, "unit", e.target.value)} />
              <input style={Object.assign({}, inputStyle, { flex: "0 1 110px" })} disabled={locked} type="number" placeholder="Unit $" value={it.price} onChange={(e) => setItem(it.id, "price", e.target.value)} />
              <div style={{ width: 90, textAlign: "right", fontWeight: 600, fontSize: 14 }}>{money((Number(it.qty) || 0) * (Number(it.price) || 0))}</div>
              {!locked && <button onClick={() => rmItem(it.id)} style={{ background: "none", border: "none", color: BRAND.red, cursor: "pointer", fontSize: 18 }}>×</button>}
            </div>
          ))}
        </Card>

        <Card>
          <h3 style={h3Style}>7 · PRICING</h3>
          <div className="grid grid-cols-2 md-grid-cols-3 gap-x-4">
            <Field label="Overhead %" hint="Fuel, insurance, tools, admin."><input style={inputStyle} disabled={locked} type="number" value={q.overheadPct} onChange={(e) => set("overheadPct", Number(e.target.value))} /></Field>
            <Field label="Profit margin %" hint="Company default: 25%"><input style={inputStyle} disabled={locked} type="number" value={q.marginPct} onChange={(e) => set("marginPct", Number(e.target.value))} /></Field>
            <Field label="Discount %" hint="e.g. loyalty or referral"><input style={inputStyle} disabled={locked} type="number" value={q.discountPct} onChange={(e) => set("discountPct", Number(e.target.value))} /></Field>
          </div>
          <Field label="Notes for the client (optional)"><textarea style={Object.assign({}, inputStyle, { minHeight: 60 })} disabled={locked} value={q.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Client to select tile color before start date…" /></Field>
        </Card>

        <Card>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h3 style={Object.assign({}, h3Style, { marginBottom: 0 })}>8 · REPLY TO THE CLIENT</h3>
            {!q.replyTemplate && !locked && <Btn small kind="ghost" onClick={startReply}>Write a reply</Btn>}
          </div>
          {!q.replyTemplate ? (
            <div style={{ fontSize: 13, color: BRAND.sub }}>A first message for Thumbtack, text or email — with the price range and your questions. The AI assistant writes one for you, or start from the standard reply.</div>
          ) : (
            <div>
              {q.aiDraft && q.aiDraft.questions && q.aiDraft.questions.length > 0 && (
                <div style={{ background: BRAND.paper, borderRadius: 8, padding: "9px 12px", fontSize: 12.5, marginBottom: 10 }}>
                  <strong>Still to find out:</strong> {q.aiDraft.questions.join(" · ")}
                </div>
              )}
              <Field label="Message" hint="{{PRICE_RANGE}} fills itself in from the quote total, so the reply always matches the numbers.">
                <textarea style={Object.assign({}, inputStyle, { minHeight: 170, fontSize: 14 })} disabled={locked} value={q.replyTemplate} onChange={(e) => set("replyTemplate", e.target.value)} />
              </Field>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: BRAND.sub, fontWeight: 700, marginBottom: 4 }}>What the client will read</div>
              <div style={{ background: "#F4F7FB", border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: 12, fontSize: 13.5, whiteSpace: "pre-wrap", marginBottom: 12 }}>{replyText}</div>
              {canSendReply ? (
                <div className="flex gap-2 flex-wrap">
                  <Btn small kind="gold" onClick={copyReply}>Copy for Thumbtack</Btn>
                  <a href="https://www.thumbtack.com/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}><Btn small kind="ghost">Open Thumbtack</Btn></a>
                  {phoneDigits && <a href={"sms:" + phoneDigits + "?&body=" + encodeURIComponent(replyText)} style={{ textDecoration: "none" }}><Btn small kind="ghost">Text it</Btn></a>}
                  {q.clientEmail && <a href={"mailto:" + q.clientEmail + "?subject=" + encodeURIComponent("Your project quote from JTProconstruction (" + q.quoteNo + ")") + "&body=" + encodeURIComponent(replyText)} style={{ textDecoration: "none" }}><Btn small kind="ghost">Email it</Btn></a>}
                </div>
              ) : (
                <div style={{ background: "#FBF3DE", color: BRAND.amber, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700 }}>Sending unlocks after owner approval — the reply carries a price.</div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Sticky summary */}
      <div>
        <div style={{ position: "sticky", top: 16 }}>
          <Card style={{ borderTop: `4px solid ${BRAND.gold}` }}>
            <h3 style={Object.assign({}, h3Style, { marginBottom: 12 })}>QUOTE SUMMARY</h3>
            {q.aiDraft && (
              <div style={{ background: q.aiDraft.confidence === "high" ? "#E2F2E9" : q.aiDraft.confidence === "medium" ? "#FBF3DE" : "#F9E5E3", borderRadius: 8, padding: "8px 10px", fontSize: 12, marginBottom: 12, color: BRAND.ink }}>
                <strong>AI draft · {q.aiDraft.confidence} confidence.</strong> {q.aiDraft.needsSiteVisit ? "Site visit recommended. " : ""}
                {(q.aiDraft.measurements || []).filter((m) => m.source !== "customer stated").length > 0
                  ? "Verify: " + q.aiDraft.measurements.filter((m) => m.source !== "customer stated").map((m) => m.what + " " + m.value).join("; ") + "."
                  : ""}
                {q.aiDraft.timeline ? <div style={{ marginTop: 4 }}>Customer timing: {q.aiDraft.timeline}</div> : null}
                {q.aiDraft.budgetMentioned ? <div style={{ marginTop: 2 }}>Customer budget: {q.aiDraft.budgetMentioned}</div> : null}
                {q.aiDraft.risks ? <div style={{ color: BRAND.red, marginTop: 4, fontWeight: 600 }}>{q.aiDraft.risks}</div> : null}
              </div>
            )}
            {[["Labor", c.labor], ["Materials & extras", c.materials], ["Overhead", c.overhead]].map(([l, v]) => (
              <div key={l} className="flex justify-between text-sm mb-1"><span style={{ color: BRAND.sub }}>{l}</span><span>{money(v)}</span></div>
            ))}
            {c.discount > 0 && <div className="flex justify-between text-sm mb-1" style={{ color: BRAND.green }}><span>Discount ({q.discountPct}%)</span><span>−{money(c.discount)}</span></div>}
            <div style={{ borderTop: `1.5px solid ${BRAND.line}`, margin: "10px 0" }} />
            <div className="flex justify-between items-baseline">
              <span style={{ fontWeight: 700 }}>Client total</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: BRAND.navy }}>{money(c.total)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1" style={{ color: BRAND.sub }}><span>Deposit due (50%)</span><span>{money(c.deposit)}</span></div>

            <div style={{ marginTop: 14, background: BRAND.paper, borderRadius: 10, padding: 12 }}>
              <div className="flex justify-between text-sm"><span style={{ color: BRAND.sub }}>Your cost</span><span>{money(c.totalCost)}</span></div>
              <div className="flex justify-between text-sm"><span style={{ color: BRAND.sub }}>Profit</span><span style={{ fontWeight: 700 }}>{money(c.profit)}</span></div>
              <div style={{ marginTop: 8, height: 8, background: "#E6E2D8", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: Math.min(Math.max(c.realMargin, 0), 50) * 2 + "%", height: "100%", background: health.color, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700, color: health.color }}>{c.realMargin.toFixed(1)}% margin — {health.label}</div>
              <div style={{ fontSize: 11, color: BRAND.sub, marginTop: 2 }}>Profit numbers are internal only — they never appear on the client's quote.</div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <Btn kind="gold" onClick={() => onPreview(Object.assign({}, q))}>Preview client quote</Btn>
              {!locked && isManager && <Btn onClick={() => save(true, { preview: true })}>Approve & create PDF</Btn>}
              {!locked && <Btn kind={isManager ? "ghost" : "primary"} onClick={() => save(true)}>{isManager ? "Save & approve" : "Submit for review"}</Btn>}
              {/* Reviewing someone else's work: send it back or kill it,
                  without having to go to the Team & review tab. */}
              {canReview && <Btn kind="danger" onClick={sendBack}>Request changes</Btn>}
              {canReview && <Btn kind="ghost" onClick={voidThis}>Void quote</Btn>}
              {!locked && <Btn kind="ghost" onClick={() => save(false)}>Save as draft</Btn>}
              <Btn kind="ghost" onClick={onCancel}>Back</Btn>
            </div>
            {locked && <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 10 }}>This quote is {STATUS[q.status].label.toLowerCase()} and locked. Ask the owner to reopen it for edits.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ================= OWNER: TEAM & REVIEW ================= */
function TeamView({ quotes, users, settings, me, onUpdateQuote, onSaveUsers, onDeleteUser, onDeleteQuote, onSaveSettings, onPreview, onOpen, notify }) {
  const [period, setPeriod] = useState("month");
  const [activity, setActivity] = useState([]);
  useEffect(() => {
    if (CLOUD) {
      const un = db.collection("activity").orderBy("at", "desc").limit(300)
        .onSnapshot((s) => { const a = []; s.forEach((d) => a.push(d.data())); setActivity(a); }, () => {});
      return () => un();
    }
    (async () => setActivity(await sGet("jtpq:activity", [])))();
  }, []);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState("");
  const pending = quotes.filter((q) => q.status === "pending").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const who = me ? me.name : "Owner";
  const myRole = roleOf(me);
  const iAmOwner = myRole === "owner";

  /* The join code burns after each use. Clearing someone from the queue
     rotates it, so in practice a code gets one person in and then dies.
     (A true rotate-on-signup would need a server-side function.) */
  const rotateTeamCode = async (reason) => {
    const fresh = "JTPRO-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    try {
      await onSaveSettings(Object.assign({}, settings, { teamCode: fresh }));
      logActivity(who, "Team code rotated" + (reason ? " (" + reason + ")" : ""));
      return fresh;
    } catch (e) { warn("rotate team code")(e); return null; }
  };

  const act = async (q, status, extra) => {
    const upd = Object.assign({}, q, extra || {}, { status, history: (q.history || []).concat([{ at: new Date().toISOString(), by: who, action: STATUS[status].label }]) });
    await onUpdateQuote(upd);
    notify(`Quote ${q.quoteNo}: ${STATUS[status].label}`);
  };

  /* ---- RECORDING AN OUTCOME ----
     Won and Declined are the two figures the revenue account rests on, so both
     are stamped with the date the client decided and with who recorded it.
     Marking Won asks for the agreed amount, because a price that moved during
     negotiation is the number that actually gets invoiced. */
  const markWon = async (q) => {
    const quoted = computeQuote(q, settings).total;
    const current = typeof q.finalAmount === "number" ? q.finalAmount : quoted;
    const raw = window.prompt(
      "Quote " + q.quoteNo + " — " + (q.clientName || "client") + " accepted and signed.\n\n"
      + "Quoted total: " + money(quoted) + "\n\n"
      + "Enter the final agreed amount. Leave it as it is if the price didn't change.",
      String(Math.round(current * 100) / 100)
    );
    if (raw === null) return;
    const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
    const amount = parseFloat(cleaned);
    if (!isFinite(amount) || amount < 0) return notify("That isn't a valid amount — nothing was changed.");
    await act(q, "won", {
      finalAmount: Math.round(amount * 100) / 100,
      decidedAt: new Date().toISOString(),
      decidedBy: who,
      outcomeNote: "",
    });
    logActivity(who, "Marked won" + (amount !== quoted ? " at " + money(amount) : ""), q.quoteNo);
  };

  const markLost = async (q) => {
    const reason = window.prompt(
      "Quote " + q.quoteNo + " — " + (q.clientName || "client") + " declined.\n\n"
      + "Why? (e.g. price, timing, went with another contractor)"
    );
    if (reason === null) return;
    await act(q, "lost", {
      decidedAt: new Date().toISOString(),
      decidedBy: who,
      outcomeNote: reason.trim(),
      finalAmount: null,
    });
    logActivity(who, "Marked declined" + (reason.trim() ? " — " + reason.trim() : ""), q.quoteNo);
  };

  /* The client came back to the table, or the outcome was recorded in error.
     Reopening clears the decision so it stops counting as booked revenue. */
  const reopen = async (q, status) => {
    if (isDecided(q) && !window.confirm(
      "Reopen quote " + q.quoteNo + "?\n\nIt goes back to " + STATUS[status].label.toLowerCase()
      + " and stops counting as " + (q.status === "won" ? "booked revenue" : "a loss")
      + ". The change is stamped in the quote's history."
    )) return;
    await act(q, status, { decidedAt: null, decidedBy: null, finalAmount: null, outcomeNote: "" });
    logActivity(who, "Reopened to " + STATUS[status].label.toLowerCase(), q.quoteNo);
  };

  /* Void keeps the record but takes the quote out of circulation: no
     printing, no pipeline, no revenue. Reversible, unlike delete. */
  const voidQuote = async (q) => {
    if (!window.confirm("Void quote " + q.quoteNo + " for " + (q.clientName || "this client") + "?\n\nVoiding is permanent. The quote is frozen for good — it can't be edited, printed, or brought back, and it stops counting toward any total. The record stays so you can always show what was quoted.\n\nOnly deleting it (owner only) removes it entirely.")) return;
    const reason = window.prompt("Why is quote " + q.quoteNo + " being voided?\n(e.g. duplicate, client cancelled, priced in error)");
    if (reason === null) return;
    const upd = Object.assign({}, q, {
      status: "void",
      voidReason: reason.trim(),
      voidedAt: new Date().toISOString(),
      voidedBy: who,
      prevStatus: q.status,
      history: (q.history || []).concat([{ at: new Date().toISOString(), by: who, action: "Voided" + (reason.trim() ? " — " + reason.trim() : "") }]),
    });
    await onUpdateQuote(upd);
    logActivity(who, "Voided quote", q.quoteNo);
    notify(`Quote ${q.quoteNo} voided`);
  };

  /* Erases the quote outright. Owner only — assistants void instead. */
  const removeQuote = async (q) => {
    if (!iAmOwner) return notify("Only the owner can permanently delete a quote.");
    if (!window.confirm("Permanently delete quote " + q.quoteNo + " for " + (q.clientName || "this client") + "?\n\nThis erases it from the database. It cannot be undone and leaves no record of what was quoted.\n\nIf you only want it out of the way, cancel and use Void instead.")) return;
    if (!window.confirm("Last check — delete " + q.quoteNo + " forever?")) return;
    try {
      await onDeleteQuote(q.id);
      logActivity(who, "Permanently deleted quote", q.quoteNo);
      notify(`Quote ${q.quoteNo} deleted`);
    } catch (e) { warn("delete quote")(e); notify("Could not delete that quote."); }
  };

  /* Deleting a profile is for tidying up junk accounts. It does NOT revoke
     a sign-in — the person could register again and land back in the queue.
     To keep someone out for good, Decline instead. */
  const removeUser = async (u) => {
    if (!iAmOwner) return notify("Only the owner can remove team members.");
    if (u.role === "owner") return notify("The owner account can't be removed.");
    if (me && u.id === me.id) return notify("You can't remove your own account.");
    const theirs = quotes.filter((q) => q.createdBy === u.id).length;
    const msg = "Remove " + u.name + " from the team?\n\n"
      + (theirs ? "Their " + theirs + " quote(s) stay in the system and keep their name on them.\n\n" : "")
      + "This clears the profile but does not delete their login. If they sign up again they'll reappear as a pending request. To keep them locked out permanently, use Decline instead.";
    if (!window.confirm(msg)) return;
    try {
      await onDeleteUser(u.id);
      logActivity(who, "Removed account: " + u.name);
      notify(`${u.name} removed`);
    } catch (e) {
      warn("remove user")(e);
      notify("Could not remove that account.");
    }
  };

  // Never approved yet: inactive and not explicitly declined.
  const awaiting = Object.values(users)
    .filter((u) => u.role !== "owner" && u.active !== true && u.declined !== true)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const associates = Object.values(users);
  const perAssociate = associates.map((u) => {
    const mine = quotes.filter((q) => q.createdBy === u.id && !isVoid(q));
    const qs = mine.filter((q) => inPeriod(q.createdAt, period));
    let pipeline = 0;
    qs.forEach((q) => {
      if (OPEN_STATUSES.includes(q.status)) pipeline += computeQuote(q, settings).total;
    });
    // Credited in the period they closed it, at the amount actually agreed.
    const won = mine
      .filter((q) => q.status === "won" && inPeriod(decidedDate(q), period))
      .reduce((sum, q) => sum + wonValue(q, settings), 0);
    return { u, count: qs.length, pipeline, won };
  });

  const h2Style = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: BRAND.navy, letterSpacing: "0.03em", marginBottom: 12 };
  /* Still waiting on the client — these are the ones needing a decision. */
  const outcomeQuotes = quotes
    .filter((q) => ["approved", "sent", "negotiating"].includes(q.status))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  /* Already decided, newest first, so a wrong call can be corrected. */
  const decided = quotes
    .filter((q) => isDecided(q) && !isVoid(q))
    .sort((a, b) => new Date(decidedDate(b)) - new Date(decidedDate(a)));
  const voided = quotes.filter(isVoid).sort((a, b) => new Date(b.voidedAt || 0) - new Date(a.voidedAt || 0));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 style={h2Style}>
          NEEDS YOUR REVIEW {pending.length > 0 && <span style={{ background: BRAND.gold, color: BRAND.navy, borderRadius: 99, padding: "2px 12px", fontSize: 16, marginLeft: 6 }}>{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <Card><div style={{ color: BRAND.sub, fontSize: 14 }}>Nothing waiting. New quotes from associates will appear here for approval before they can be sent.</div></Card>
        ) : pending.map((q) => {
          const c = computeQuote(q, settings);
          const health = marginHealth(c.realMargin);
          return (
            <Card key={q.id} style={{ marginBottom: 10 }}>
              <div className="flex justify-between flex-wrap gap-2 items-start">
                <div>
                  <div style={{ fontWeight: 700 }}>{q.quoteNo} · {q.clientName} — {q.jobTitle || q.category}</div>
                  <div style={{ fontSize: 13, color: BRAND.sub }}>By {users[q.createdBy] ? users[q.createdBy].name : "Unknown"} · {fmtDate(q.createdAt)} · Crew of {q.crew}, {q.days} day(s)</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Total <strong>{money(c.total)}</strong> · Cost {money(c.totalCost)} · <span style={{ color: health.color, fontWeight: 700 }}>{c.realMargin.toFixed(1)}% margin</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Btn small kind="ghost" onClick={() => onPreview(q)}>Preview</Btn>
                  <Btn small kind="ghost" onClick={() => onOpen(q)}>Edit</Btn>
                  <Btn small kind="gold" onClick={() => act(q, "approved", { reviewNote: "" })}>Approve</Btn>
                  <Btn small kind="danger" onClick={() => { setNoteFor(q.id); setNote(""); }}>Request changes</Btn>
                  <Btn small kind="ghost" onClick={() => voidQuote(q)}>Void</Btn>
                </div>
              </div>
              {noteFor === q.id && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  <input style={Object.assign({}, inputStyle, { flex: 1, minWidth: 200 })} placeholder="What should they change? e.g. Margin too thin — raise to 22%" value={note} onChange={(e) => setNote(e.target.value)} />
                  <Btn small onClick={() => { act(q, "changes", { reviewNote: note }); setNoteFor(null); }}>Send back</Btn>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ---- ACCOUNTS AWAITING APPROVAL ---- */}
      <div>
        <h2 style={h2Style}>
          ACCOUNTS AWAITING APPROVAL
          {awaiting.length > 0 && <span style={{ background: BRAND.gold, color: BRAND.navy, borderRadius: 99, padding: "2px 10px", fontSize: 13, marginLeft: 10 }}>{awaiting.length}</span>}
        </h2>
        <Card style={{ padding: 14, marginBottom: 12, background: "#FBF3DE", border: "none" }}>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: BRAND.sub, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>Current team code</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: BRAND.navy, letterSpacing: "0.06em" }}>
                {settings && settings.requireTeamCode ? (settings.teamCode || "—") : "Not required"}
              </div>
              <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 2 }}>
                {settings && settings.requireTeamCode
                  ? "Changes automatically each time you approve or decline someone. Give the current code to one new hire at a time."
                  : "Turn on “require team code” in Settings to stop strangers from signing up at all."}
              </div>
            </div>
            {settings && settings.requireTeamCode && (
              <Btn small kind="ghost" onClick={async () => {
                const nc = await rotateTeamCode("manual");
                notify(nc ? `New team code: ${nc}` : "Could not change the code.");
              }}>Rotate now</Btn>
            )}
          </div>
        </Card>
        {awaiting.length === 0 ? (
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 14, color: BRAND.sub }}>Nobody is waiting. New sign-ups land here and can't see or build anything until you approve them.</div>
          </Card>
        ) : (
          <div className="grid md-grid-cols-2 gap-3">
            {awaiting.map((u) => (
              <Card key={u.id} style={{ borderLeft: `4px solid ${BRAND.gold}` }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</div>
                <div style={{ fontSize: 13, color: BRAND.sub, marginBottom: 2 }}>{u.email || u.username}</div>
                <div style={{ fontSize: 12, color: BRAND.sub }}>Signed up {fmtDate(u.createdAt)}</div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Btn small kind="gold" onClick={async () => {
                    const next = Object.assign({}, users);
                    next[u.id] = Object.assign({}, u, { active: true, declined: false, approvedAt: new Date().toISOString() });
                    await onSaveUsers(next);
                    logActivity(who, "Approved account: " + u.name);
                    const nc = await rotateTeamCode("after approving " + u.name);
                    notify(nc ? `${u.name} approved · new team code ${nc}` : `${u.name} approved — they can build quotes now`);
                  }}>Approve</Btn>
                  <Btn small kind="ghost" onClick={async () => {
                    if (!window.confirm(`Decline ${u.name}? They keep their login but stay locked out.`)) return;
                    const next = Object.assign({}, users);
                    next[u.id] = Object.assign({}, u, { active: false, declined: true });
                    await onSaveUsers(next);
                    logActivity(who, "Declined account: " + u.name);
                    const nc = await rotateTeamCode("after declining " + u.name);
                    notify(nc ? `${u.name} declined · new team code ${nc}` : `${u.name} declined`);
                  }}>Decline</Btn>
                  {iAmOwner && <Btn small kind="ghost" onClick={() => removeUser(u)}>Remove</Btn>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 style={Object.assign({}, h2Style, { marginBottom: 0 })}>TEAM PERFORMANCE</h2>
          <select style={Object.assign({}, inputStyle, { width: "auto", padding: "8px 10px" })} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="grid md-grid-cols-2 gap-3">
          {perAssociate.map(({ u, count, pipeline, won }) => (
            <Card key={u.id}>
              <div className="flex justify-between items-start">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {u.name}{" "}
                    {u.role === "owner" && <span style={{ color: BRAND.gold, fontSize: 12 }}>★ Owner</span>}
                    {u.role === "assistant" && <span style={{ background: BRAND.navySoft, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 99, padding: "2px 8px", letterSpacing: "0.04em" }}>ASSISTANT</span>}
                  </div>
                  <div style={{ fontSize: 12, color: BRAND.sub }}>@{u.username} · joined {fmtDate(u.createdAt)}</div>
                </div>
                {/* Deactivating, promoting and removing are the owner's alone. */}
                {u.role !== "owner" && iAmOwner && (
                  <div className="flex gap-2 flex-wrap justify-end">
                  <Btn small kind={u.active !== true ? "gold" : "danger"} onClick={async () => {
                    const turningOn = u.active !== true;
                    const next = Object.assign({}, users);
                    // `declined` keeps a switched-off account out of the
                    // approval queue, so it can't quietly reappear there.
                    next[u.id] = Object.assign({}, u, { active: turningOn, declined: !turningOn });
                    await onSaveUsers(next);
                    logActivity(who, (turningOn ? "Reactivated" : "Deactivated") + " account: " + u.name);
                    notify(turningOn ? `${u.name} reactivated` : `${u.name} deactivated`);
                  }}>{u.active !== true ? "Reactivate" : "Deactivate"}</Btn>
                  <Btn small kind="ghost" onClick={async () => {
                    const up = u.role === "assistant";
                    const nextRole = up ? "associate" : "assistant";
                    if (!window.confirm(up
                      ? `Return ${u.name} to a regular associate?\n\nThey'll lose the ability to review and approve quotes, and will only see their own work again.`
                      : `Make ${u.name} an assistant?\n\nThey'll be able to see and approve every associate's quotes, clear the signup queue, and read the activity log.\n\nThey will NOT be able to change roles, remove people, edit pricing, or delete quotes — those stay yours.`)) return;
                    const next = Object.assign({}, users);
                    next[u.id] = Object.assign({}, u, { role: nextRole });
                    await onSaveUsers(next);
                    logActivity(who, (up ? "Demoted to associate: " : "Promoted to assistant: ") + u.name);
                    notify(up ? `${u.name} is now an associate` : `${u.name} is now an assistant`);
                  }}>{u.role === "assistant" ? "Make associate" : "Make assistant"}</Btn>
                  <Btn small kind="ghost" onClick={() => removeUser(u)}>Remove</Btn>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                {[["Quotes", count], ["Pipeline", money(pipeline)], ["Won", money(won)]].map(([l, v]) => (
                  <div key={l} style={{ background: BRAND.paper, borderRadius: 8, padding: "8px 4px" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, color: BRAND.navy }}>{v}</div>
                    <div style={{ fontSize: 11, color: BRAND.sub, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                  </div>
                ))}
              </div>
              {u.active === false && <div style={{ fontSize: 12, color: BRAND.red, marginTop: 8, fontWeight: 600 }}>Account deactivated — cannot sign in.</div>}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 style={h2Style}>
          AWAITING A DECISION
          {outcomeQuotes.length > 0 && <span style={{ background: BRAND.gold, color: BRAND.navy, borderRadius: 99, padding: "2px 12px", fontSize: 16, marginLeft: 10 }}>{outcomeQuotes.length}</span>}
        </h2>
        <div className="flex flex-col gap-2">
          {outcomeQuotes.map((q) => {
            const age = Math.floor((Date.now() - new Date(q.createdAt)) / 864e5);
            return (
              <Card key={q.id} style={{ padding: 12 }}>
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div style={{ fontSize: 14 }}>
                    <div><strong>{q.quoteNo}</strong> · {q.clientName} · {money(computeQuote(q, settings).total)} <Badge status={q.status} /></div>
                    <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 2 }}>
                      Quoted {fmtDate(q.createdAt)}{age > 0 ? " · " + age + " day" + (age === 1 ? "" : "s") + " ago" : ""}
                      {users[q.createdBy] ? " · by " + users[q.createdBy].name : ""}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {q.status === "approved" && <Btn small onClick={() => act(q, "sent")}>Mark sent</Btn>}
                    {q.status !== "negotiating" && <Btn small kind="ghost" onClick={() => act(q, "negotiating")}>Negotiating</Btn>}
                    <Btn small kind="gold" onClick={() => markWon(q)}>Won</Btn>
                    <Btn small kind="ghost" onClick={() => markLost(q)}>Declined</Btn>
                    <Btn small kind="ghost" onClick={() => voidQuote(q)}>Void</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
          {outcomeQuotes.length === 0 && <Card><div style={{ color: BRAND.sub, fontSize: 14 }}>Nothing waiting on a client. Approved, sent and in-negotiation quotes appear here until you record whether the job was won or declined.</div></Card>}
        </div>
      </div>

      {/* ---- RECORDED OUTCOMES ---- */}
      <div>
        <h2 style={h2Style}>RECORDED OUTCOMES</h2>
        {decided.length === 0 ? (
          <Card><div style={{ color: BRAND.sub, fontSize: 14 }}>Nothing decided yet. Once a job is marked Won it counts as booked revenue in the month the client signed — not the month the quote was written.</div></Card>
        ) : (
          <div className="flex flex-col gap-2">
            {decided.slice(0, 25).map((q) => {
              const quoted = computeQuote(q, settings).total;
              const value = wonValue(q, settings);
              const moved = q.status === "won" && typeof q.finalAmount === "number" && q.finalAmount !== quoted;
              return (
                <Card key={q.id} style={{ padding: 12, borderLeft: `4px solid ${q.status === "won" ? BRAND.green : BRAND.line}` }}>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div style={{ fontSize: 14 }}>
                      <div>
                        <strong>{q.quoteNo}</strong> · {q.clientName} · {money(q.status === "won" ? value : quoted)} <Badge status={q.status} />
                      </div>
                      <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 2 }}>
                        {q.status === "won" ? "Signed" : "Declined"} {fmtDate(decidedDate(q))}
                        {q.decidedBy ? " · recorded by " + q.decidedBy : ""}
                        {moved ? " · quoted " + money(quoted) : ""}
                        {q.outcomeNote ? " — " + q.outcomeNote : ""}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {q.status === "won" && <Btn small kind="ghost" onClick={() => markWon(q)}>Edit amount</Btn>}
                      {q.status === "lost" && <Btn small kind="gold" onClick={() => markWon(q)}>Actually won</Btn>}
                      <Btn small kind="ghost" onClick={() => reopen(q, "negotiating")}>Reopen</Btn>
                    </div>
                  </div>
                </Card>
              );
            })}
            {decided.length > 25 && (
              <div style={{ fontSize: 12, color: BRAND.sub, padding: "4px 2px" }}>
                Showing the 25 most recent. Everything else is in the quote list, filtered by Won or Declined.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- VOIDED QUOTES ---- */}
      <div>
        <h2 style={h2Style}>
          VOIDED QUOTES
          {voided.length > 0 && <span style={{ background: "#EDE7DC", color: "#7A6A55", borderRadius: 99, padding: "2px 10px", fontSize: 13, marginLeft: 10 }}>{voided.length}</span>}
        </h2>
        {voided.length === 0 ? (
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 14, color: BRAND.sub }}>Nothing voided. Voiding is permanent — a voided quote is frozen for good, drops out of every total, and can't be printed or reopened. The record stays so you can always show what was quoted and why it was pulled.</div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {voided.map((q) => (
              <Card key={q.id} style={{ padding: 12, opacity: 0.85, borderLeft: "4px solid #C9BDA6" }}>
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div style={{ fontSize: 14 }}>
                    <div><strong style={{ textDecoration: "line-through" }}>{q.quoteNo}</strong> · {q.clientName} · {money(computeQuote(q, settings).total)} <Badge status="void" /></div>
                    <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 3 }}>
                      Voided by {q.voidedBy || "—"}{q.voidedAt ? " · " + fmtDate(q.voidedAt) : ""}{q.voidReason ? " · " + q.voidReason : ""}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <span style={{ fontSize: 12, color: "#7A6A55", fontWeight: 600 }}>Permanently voided</span>
                    {iAmOwner && <Btn small kind="danger" onClick={() => removeQuote(q)}>Delete forever</Btn>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 style={h2Style}>ACTIVITY LOG</h2>
        <Card style={{ maxHeight: 340, overflowY: "auto", padding: 0 }}>
          {activity.length === 0
            ? <div style={{ padding: 16, color: BRAND.sub, fontSize: 14 }}>Every sign-in, draft, edit, preview, and print will be recorded here — nothing happens in JTProQuotes without a trace.</div>
            : activity.map((a, i) => (
              <div key={i} style={{ padding: "8px 16px", borderBottom: `1px solid ${BRAND.line}`, fontSize: 13 }}>
                <strong>{a.by}</strong> — {a.action}{a.quoteNo ? ` (${a.quoteNo})` : ""} <span style={{ color: BRAND.sub, fontSize: 12 }}>· {new Date(a.at).toLocaleString()}</span>
              </div>
            ))}
        </Card>
      </div>
    </div>
  );
}

/* ================= OWNER: SETTINGS ================= */
function SettingsView({ settings, onSave }) {
  const [s, setS] = useState(settings);
  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: BRAND.navy, letterSpacing: "0.03em", marginBottom: 14 }}>COMPANY SETTINGS</h2>
      <Card>
        <Field label="Default labor rate ($/hr per crew member)"><input style={inputStyle} type="number" value={s.laborRate} onChange={(e) => setS(Object.assign({}, s, { laborRate: Number(e.target.value) }))} /></Field>
        <Field label="Default overhead %" hint="Applied on top of labor + materials before profit."><input style={inputStyle} type="number" value={s.overheadPct} onChange={(e) => setS(Object.assign({}, s, { overheadPct: Number(e.target.value) }))} /></Field>
        <Field label="Default profit margin %"><input style={inputStyle} type="number" value={s.targetMargin} onChange={(e) => setS(Object.assign({}, s, { targetMargin: Number(e.target.value) }))} /></Field>
        <div style={{ background: BRAND.paper, borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" style={{ width: 18, height: 18 }} checked={!!s.requireTeamCode} onChange={(e) => setS(Object.assign({}, s, { requireTeamCode: e.target.checked }))} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Require a team code to create an account</span>
          </label>
          <div style={{ fontSize: 12, color: BRAND.sub, marginTop: 6 }}>
            {s.requireTeamCode
              ? "ON — new associates must enter the code below. Recommended once you go live."
              : "OFF — anyone who opens the app can create an account. Fine while you're testing; turn this on before you deploy."}
          </div>
        </div>
        <Field label="Team code" hint="Used only when the setting above is ON. Change it any time to lock out unwanted signups.">
          <input style={inputStyle} value={s.teamCode} onChange={(e) => setS(Object.assign({}, s, { teamCode: e.target.value.toUpperCase() }))} />
        </Field>
        <Field label="Owner recovery key" hint="Set this now and write it down somewhere safe. If you ever forget your PIN, this is how you get back in without erasing your quotes. Keep it private — do not give it to associates.">
          <input style={inputStyle} value={s.recoveryKey || ""} onChange={(e) => setS(Object.assign({}, s, { recoveryKey: e.target.value.toUpperCase() }))} placeholder="e.g. JTPRO-RECOVER-9142" />
        </Field>
        <Btn kind="gold" onClick={() => onSave(s)}>Save settings</Btn>
      </Card>
      <Card style={{ marginTop: 14, background: "#FBF3DE", border: "none" }}>
        <div style={{ fontSize: 13, color: BRAND.ink }}>
          <strong>Control & security in place:</strong> PIN sign-in with a team code required to register · drafts autosave to your view the moment an associate starts typing · quotes carry a DRAFT · NOT APPROVED watermark and cannot be printed or saved as PDF until you approve them · no one can delete a quote · every sign-in, draft, edit, preview, and print is recorded in the activity log · internal cost/profit figures never appear on client documents.
        </div>
      </Card>
    </div>
  );
}

/* ================= CLIENT-FACING PREVIEW ================= */
function PreviewModal({ quote, settings, users, me, onClose }) {
  const c = computeQuote(quote, settings);
  const author = users[quote.createdBy];
  const isOwnerViewer = me && canManage(me);
  const voided = isVoid(quote);
  const releasable = !voided && ["approved", "sent", "negotiating", "won"].includes(quote.status);
  // A voided quote can never be printed or sent, by anyone.
  const canPrint = !voided && (isOwnerViewer || releasable);
  /* Stamped across every unapproved quote so a leaked screenshot identifies
     whoever had it open. Fixed at open time so it matches the activity log. */
  const viewerTag = useMemo(() => {
    const who = me ? me.name : "Unknown";
    const when = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    return quote.quoteNo + " · " + who + " · " + when;
  }, [quote.quoteNo, me]);
  useEffect(() => { logActivity(me ? me.name : "Unknown", "Previewed quote", quote.quoteNo); }, []);
  const doPrint = () => { logActivity(me ? me.name : "Unknown", "Printed / saved PDF", quote.quoteNo); window.print(); };

  /* A real PDF file, ready to attach to a text, email or Thumbtack message. */
  const [pdfBusy, setPdfBusy] = useState("");
  const [pdfErr, setPdfErr] = useState("");
  const fileName = (quote.quoteNo + " " + (quote.clientName || "Client") + " - JTProconstruction Quote").replace(/[^\w .\-]+/g, "").trim() + ".pdf";
  const makePdf = async () => {
    const lib = await loadHtml2pdf();
    const el = document.getElementById("print-doc");
    return lib().set({
      margin: [6, 6, 8, 6],
      filename: fileName,
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "li", ".keep-together"] },
    }).from(el).outputPdf("blob");
  };
  const downloadPdf = async () => {
    setPdfErr(""); setPdfBusy("download");
    try {
      const blob = await makePdf();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      logActivity(me ? me.name : "Unknown", "Downloaded PDF", quote.quoteNo);
    } catch (e) { setPdfErr(e.message || "Couldn't make the PDF."); }
    setPdfBusy("");
  };
  const canShareFiles = typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;
  const sharePdf = async () => {
    setPdfErr(""); setPdfBusy("share");
    try {
      const blob = await makePdf();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (!navigator.canShare({ files: [file] })) throw new Error("This device can't share files — use Download PDF instead.");
      const first = (quote.clientName || "").split(" ")[0];
      await navigator.share({
        files: [file], title: fileName,
        text: "Hi" + (first ? " " + first : "") + ", here is your quote from JTProconstruction (" + quote.quoteNo + "). Let me know if you have any questions. — Joel",
      });
      logActivity(me ? me.name : "Unknown", "Shared PDF", quote.quoteNo);
    } catch (e) {
      if (e && e.name !== "AbortError") setPdfErr(e.message || "Couldn't share the PDF.");
    }
    setPdfBusy("");
  };
  const validUntil = new Date(new Date(quote.createdAt).getTime() + 30 * 864e5);
  const goldLabel = { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: BRAND.gold };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,0.75)", zIndex: 50, overflowY: "auto", padding: "24px 12px" }} onClick={onClose}>
      <div style={{ maxWidth: 720, margin: "0 auto" }} onClick={(e) => e.stopPropagation()}>
        {pdfErr && <div style={{ background: "#F9E5E3", color: BRAND.red, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{pdfErr}</div>}
        {!releasable && !voided && isOwnerViewer && (
          <div style={{ background: "#FBF3DE", color: BRAND.amber, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
            Not approved yet — a PDF made now carries the DRAFT watermark. Close this, click "Approve & create PDF", and you get a clean copy to send.
          </div>
        )}
        <div className="flex justify-end gap-2 mb-2 flex-wrap">
          {canPrint
            ? <React.Fragment>
                {canShareFiles && <Btn small kind="gold" onClick={sharePdf} disabled={!!pdfBusy}>{pdfBusy === "share" ? "Making PDF…" : "Share PDF"}</Btn>}
                <Btn small kind={canShareFiles ? "primary" : "gold"} onClick={downloadPdf} disabled={!!pdfBusy}>{pdfBusy === "download" ? "Making PDF…" : "Download PDF"}</Btn>
                <button onClick={doPrint} style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)", padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Print</button>
              </React.Fragment>
            : <span style={{ background: voided ? "#EDE7DC" : "#FBF3DE", color: voided ? "#7A6A55" : BRAND.amber, padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{voided ? "This quote is void and cannot be printed" : "Printing unlocks after owner approval"}</span>}
          <button onClick={onClose} style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)", padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
        </div>
        <div id="print-doc" style={{ background: "#fff", padding: "42px 46px", color: BRAND.ink, position: "relative" }}>
          {!releasable && (
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}>
              {/* Centre stamp */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ transform: "rotate(-24deg)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 700, color: "rgba(179,55,46,0.16)", border: "5px solid rgba(179,55,46,0.16)", padding: "8px 28px", borderRadius: 10, letterSpacing: "0.08em", whiteSpace: "nowrap", textAlign: "center" }}>
                  {voided ? "VOID · NOT VALID" : "DRAFT · NOT APPROVED"}
                  <div style={{ fontSize: 15, letterSpacing: "0.04em", marginTop: 4, fontFamily: "'Barlow', sans-serif" }}>{viewerTag}</div>
                </div>
              </div>
              {/* Tiled trace marks — a cropped screenshot still carries the name. */}
              <div style={{ position: "absolute", inset: "-20%", transform: "rotate(-24deg)", display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
                  <div key={r} style={{ display: "flex", justifyContent: "space-around", whiteSpace: "nowrap" }}>
                    {[0, 1, 2].map((col) => (
                      <span key={col} style={{ fontSize: 11, fontWeight: 600, color: "rgba(179,55,46,0.13)", letterSpacing: "0.06em" }}>{viewerTag}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Letterhead */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `4px solid ${BRAND.gold}`, paddingBottom: 18, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: BRAND.navy, letterSpacing: "0.04em" }}>{COMPANY.name.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: BRAND.sub }}>{COMPANY.tag}</div>
              <div style={{ fontSize: 12, color: BRAND.sub }}>{COMPANY.area}</div>
              <div style={{ fontSize: 12, color: BRAND.navy, fontWeight: 600 }}>{COMPANY.cities}</div>
              <div style={{ fontSize: 12, color: BRAND.sub }}>{COMPANY.phone} · {COMPANY.email} · {COMPANY.site}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: BRAND.gold, letterSpacing: "0.1em" }}>QUOTE</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{quote.quoteNo}</div>
              <div style={{ fontSize: 12, color: BRAND.sub }}>Date: {fmtDate(quote.createdAt)}</div>
              <div style={{ fontSize: 12, color: BRAND.sub }}>Valid until: {fmtDate(validUntil)}</div>
            </div>
          </div>

          {/* Client + job */}
          <div style={{ display: "flex", gap: 40, margin: "20px 0", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <div style={goldLabel}>PREPARED FOR</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{quote.clientName}</div>
              {quote.clientAddress ? <div style={{ fontSize: 13 }}>{quote.clientAddress}</div> : null}
              {quote.clientPhone ? <div style={{ fontSize: 13 }}>{quote.clientPhone}</div> : null}
              {quote.clientEmail ? <div style={{ fontSize: 13 }}>{quote.clientEmail}</div> : null}
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <div style={goldLabel}>PROJECT</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{quote.jobTitle || quote.category}</div>
              <div style={{ fontSize: 13, color: BRAND.sub }}>{quote.category} · Crew of {quote.crew} · Est. {quote.days} working day{quote.days > 1 ? "s" : ""}</div>
              {author ? <div style={{ fontSize: 13, color: BRAND.sub }}>Prepared by: {author.name}</div> : null}
            </div>
          </div>

          {(quote.assessment || []).some((a) => a.on && a.title.trim()) ? (
            <div style={{ marginBottom: 18 }}>
              <div style={Object.assign({}, goldLabel, { marginBottom: 6 })}>SITE ASSESSMENT</div>
              {(quote.assessment || []).filter((a) => a.on && a.title.trim()).map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, breakInside: "avoid" }}>
                  {findingPhoto(a, quote) ? <img src={pdfSrc(findingPhoto(a, quote))} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} /> : null}
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <strong>{a.title}</strong>
                    {PRIORITY[a.priority] ? <span style={{ fontSize: 10.5, fontWeight: 700, color: PRIORITY[a.priority].color, marginLeft: 6, letterSpacing: "0.04em" }}>{PRIORITY[a.priority].label.toUpperCase()}</span> : null}
                    {a.detail ? <div style={{ color: BRAND.sub }}>{a.detail}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {(quote.description || (quote.scopeItems || []).some((s) => s.on && s.text.trim())) ? (
            <div style={{ marginBottom: 18 }}>
              <div style={Object.assign({}, goldLabel, { marginBottom: 4 })}>SCOPE OF WORK</div>
              {quote.description ? <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>{quote.description}</div> : null}
              {(quote.scopeItems || []).some((s) => s.on && s.text.trim()) ? (
                <ol style={{ fontSize: 13, lineHeight: 1.65, paddingLeft: 20, margin: 0 }}>
                  {(quote.scopeItems || []).filter((s) => s.on && s.text.trim()).map((s) => (
                    <li key={s.id} style={{ marginBottom: 2 }}>{s.text}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}

          {/* Line items */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: BRAND.navy, color: "#fff" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}>DESCRIPTION</th>
                <th style={{ textAlign: "right", padding: "8px 12px", width: 70 }}>QTY</th>
                <th style={{ textAlign: "right", padding: "8px 12px", width: 100 }}>UNIT</th>
                <th style={{ textAlign: "right", padding: "8px 12px", width: 110 }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${BRAND.line}` }}>
                <td style={{ padding: "9px 12px" }}>Professional labor — crew of {quote.crew}, {quote.days} day{quote.days > 1 ? "s" : ""} × {quote.hoursPerDay} hrs</td>
                <td style={{ textAlign: "right", padding: "9px 12px" }}>{quote.crew * quote.days * quote.hoursPerDay} hrs</td>
                <td style={{ textAlign: "right", padding: "9px 12px" }}>{money(quote.laborRate)}</td>
                <td style={{ textAlign: "right", padding: "9px 12px", fontWeight: 600 }}>{money(c.labor)}</td>
              </tr>
              {quote.items.map((it) => (
                <tr key={it.id} style={{ borderBottom: `1px solid ${BRAND.line}` }}>
                  <td style={{ padding: "9px 12px" }}>{it.desc || "Item"}</td>
                  <td style={{ textAlign: "right", padding: "9px 12px", whiteSpace: "nowrap" }}>{it.qty}{it.unit ? " " + it.unit : ""}</td>
                  <td style={{ textAlign: "right", padding: "9px 12px" }}>{money(Number(it.price))}</td>
                  <td style={{ textAlign: "right", padding: "9px 12px", fontWeight: 600 }}>{money((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                </tr>
              ))}
              <tr style={{ borderBottom: `1px solid ${BRAND.line}` }}>
                <td style={{ padding: "9px 12px" }}>Project management, equipment & site overhead</td>
                <td style={{ textAlign: "right", padding: "9px 12px" }}>—</td>
                <td style={{ textAlign: "right", padding: "9px 12px" }}>—</td>
                <td style={{ textAlign: "right", padding: "9px 12px", fontWeight: 600 }}>{money(c.rawPrice - c.labor - c.materials)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <div style={{ width: 280 }}>
              {c.discount > 0 ? (
                <React.Fragment>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}><span>Subtotal</span><span>{money(c.rawPrice)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0", color: BRAND.green }}><span>Discount ({quote.discountPct}%)</span><span>−{money(c.discount)}</span></div>
                </React.Fragment>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", background: BRAND.navy, color: "#fff", padding: "10px 14px", borderRadius: 6, marginTop: 6 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em", fontSize: 16 }}>TOTAL INVESTMENT</span>
                <span style={{ fontWeight: 700, fontSize: 18 }}>{money(c.total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 2px", color: BRAND.sub }}>
                <span>Deposit to schedule (50%)</span><span style={{ fontWeight: 700, color: BRAND.ink }}>{money(c.deposit)}</span>
              </div>
            </div>
          </div>

          {quote.notes ? <div style={{ fontSize: 13, marginTop: 10, background: BRAND.paper, padding: "10px 14px", borderRadius: 6, whiteSpace: "pre-wrap" }}><strong>Note:</strong> {quote.notes}</div> : null}

          {(quote.attachments || []).some((a) => a.show) ? (
            <div style={{ marginTop: 18, breakInside: "avoid" }}>
              <div style={Object.assign({}, goldLabel, { marginBottom: 6 })}>PHOTO REFERENCE</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                {(quote.attachments || []).filter((a) => a.show && attSrc(a)).map((a, i) => (
                  <img key={i} src={a.thumb || pdfSrc(a.url)} alt={"Site photo " + (i + 1)} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 4, border: `1px solid ${BRAND.line}` }} />
                ))}
              </div>
            </div>
          ) : null}

          {(quote.exclusions || []).some((s) => s.on) ? (
            <div style={{ marginTop: 18 }}>
              <div style={Object.assign({}, goldLabel, { marginBottom: 6 })}>NOT INCLUDED IN THIS QUOTE</div>
              <ul style={{ fontSize: 12, lineHeight: 1.65, color: BRAND.sub, paddingLeft: 18, margin: 0 }}>
                {(quote.exclusions || []).filter((s) => s.on).map((s) => <li key={s.id}>{s.text}</li>)}
              </ul>
            </div>
          ) : null}

          {/* Terms */}
          <div style={{ marginTop: 22, borderTop: `1px solid ${BRAND.line}`, paddingTop: 14 }}>
            <div style={Object.assign({}, goldLabel, { marginBottom: 6 })}>TERMS &amp; WHAT YOU CAN EXPECT</div>
            <ul style={{ fontSize: 12, lineHeight: 1.7, color: BRAND.sub, paddingLeft: 18, margin: 0 }}>
              <li>50% deposit due upon acceptance to reserve your project dates; balance due upon completion and walkthrough.</li>
              <li>All workmanship is backed by our 90-day workmanship warranty.</li>
              <li>Pricing is itemized and transparent — any change in scope will be quoted and approved in writing before extra work begins.</li>
              <li>{COMPANY.name} is licensed and insured. Job site is left clean at the end of each working day.</li>
              <li>This quote is valid for 30 days from the date above.</li>
            </ul>
          </div>

          {/* Signatures */}
          <div style={{ display: "flex", gap: 40, marginTop: 34 }}>
            {["Client acceptance", COMPANY.name].map((who) => (
              <div key={who} style={{ flex: 1 }}>
                <div style={{ borderBottom: `1.5px solid ${BRAND.ink}`, height: 34 }} />
                <div style={{ fontSize: 11, color: BRAND.sub, marginTop: 4 }}>{who} — signature &amp; date</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 28, fontSize: 11, color: BRAND.sub }}>
            Thank you for the opportunity to earn your business. — {COMPANY.name}
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
