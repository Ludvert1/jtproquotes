const { useState, useEffect, useMemo } = React;

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
  area: "New Caney, TX · Serving the Greater Houston Area",
  email: "info@jtproconstruction.com",
  site: "jtproconstruction.com",
};

const CATEGORIES = [
  "Flooring", "Painting", "Drywall", "Kitchen Remodel", "Bath Remodel",
  "Exterior / Siding", "Concrete", "Covered Structure / Patio",
  "Fencing", "Roofing Repair", "Plumbing Repair", "Electrical (minor)",
  "Water Damage Restoration", "General Repair", "Other",
];

const SCOPE_TEMPLATES = {
  "Flooring": [
    "Protect adjacent rooms, furnishings, and walkways; set dust containment at the work area",
    "Remove and dispose of existing floor covering, shoe molding, and underlayment",
    "Inspect subfloor; refasten loose boards, eliminate squeaks, and clean surface",
    "Level subfloor with patching compound to manufacturer's flatness tolerance",
    "Install moisture barrier and underlayment per flooring manufacturer specification",
    "Install new flooring per manufacturer layout, with required expansion gaps at perimeter",
    "Install new baseboard or reinstall shoe molding, plus transitions at doorways",
    "Caulk and touch up trim, finish all transitions and thresholds",
    "Final clean of installed area and haul away all debris",
  ],
  "Painting": [
    "Protect floors, fixtures, and furnishings with drop cloths and masking",
    "Wash and degloss surfaces; scrape and remove loose or peeling paint",
    "Patch nail holes, cracks, and minor drywall damage; sand smooth",
    "Caulk gaps at trim, corners, and penetrations",
    "Spot-prime all patched, stained, and bare areas",
    "Apply two finish coats to walls in client-selected color and sheen",
    "Cut in ceilings, trim, doors, and casings as specified",
    "Remove masking; reinstall hardware, switch plates, and outlet covers",
    "Final walkthrough touch-up and site cleanup",
  ],
  "Drywall": [
    "Protect adjacent finishes and set up dust containment",
    "Remove damaged drywall back to sound framing",
    "Inspect framing; add blocking or backing where required for support",
    "Hang new drywall of matching thickness, fastened to code spacing",
    "Tape, mud, and sand to a Level 4 finish",
    "Match existing texture (orange peel, knockdown, or smooth)",
    "Prime repaired areas ready for paint",
    "Cleanup and debris haul-off",
  ],
  "Kitchen Remodel": [
    "Protect adjacent rooms, floors, and pathways; set dust containment",
    "Demolish existing cabinets, countertops, backsplash, and flooring as scoped",
    "Coordinate disconnect and reconnect of plumbing, gas, and electrical with licensed trades",
    "Rough-in modifications for new sink, appliance, and outlet locations",
    "Install new base and wall cabinets — leveled, shimmed, and secured to framing",
    "Template, fabricate, and install countertops with sink and cooktop cutouts",
    "Install backsplash tile, grout, and seal",
    "Install sink, faucet, disposal, and reconnect appliances",
    "Install toe kick, crown molding, filler trim, and cabinet hardware",
    "Paint walls and ceiling; final caulk at all seams",
    "Final clean, punch list walkthrough, and debris removal",
  ],
  "Bath Remodel": [
    "Protect adjacent areas; set containment and floor protection",
    "Demolish existing tub or shower, vanity, flooring, and finishes as scoped",
    "Inspect subfloor and wall framing; repair water damage or rot discovered",
    "Plumbing rough-in adjustments performed by licensed plumber",
    "Install cement board and waterproof membrane at all wet areas",
    "Set tub or shower pan, install valve and surround",
    "Tile, grout, and seal walls and floor",
    "Install vanity, countertop, faucet, toilet, and accessories",
    "Install exhaust fan, vanity lighting, and mirror as scoped",
    "Paint, caulk, and install final trim",
    "Final clean and client walkthrough",
  ],
  "Exterior / Siding": [
    "Set staging and protect landscaping, windows, and walkways",
    "Remove damaged siding, trim, and fasteners; dispose properly",
    "Inspect sheathing and framing for rot; replace compromised material",
    "Install weather-resistant barrier and flashing at all openings",
    "Install new siding per manufacturer specification and course alignment",
    "Install corner boards, trim, and channel",
    "Caulk and seal all joints, penetrations, and transitions",
    "Prime and paint new material as scoped",
    "Site cleanup, magnet sweep for fasteners, and debris haul-off",
  ],
  "Concrete": [
    "Layout, mark utilities, and verify grade and drainage slope",
    "Excavate and remove existing concrete or soil to required depth",
    "Install and compact base material",
    "Set forms to specified elevation and slope",
    "Install reinforcement (rebar or wire mesh) properly chaired and spaced",
    "Place, screed, and float concrete at specified mix strength",
    "Finish surface — broom, smooth, or stamped as specified",
    "Cut control joints and apply curing compound",
    "Strip forms, backfill edges, and clean the site",
  ],
  "Covered Structure / Patio": [
    "Verify layout, setbacks, and permit requirements",
    "Excavate and pour footings or piers to code depth",
    "Set posts — plumbed, aligned, and anchored with approved hardware",
    "Frame beams, rafters, and headers to span requirements",
    "Install roof decking, underlayment, and roofing material",
    "Install fascia, trim, and drip edge",
    "Install gutters and downspouts as scoped",
    "Stain, seal, or paint all exposed wood",
    "Final cleanup and debris removal",
  ],
  "Fencing": [
    "Verify property lines and locate underground utilities",
    "Remove and dispose of existing fence",
    "Dig post holes to required depth and diameter",
    "Set posts in concrete — plumbed and aligned to string line",
    "Install rails and pickets or panels at specified spacing",
    "Build and hang gates with heavy-duty hinges and latch hardware",
    "Cut top to level line or follow grade as specified",
    "Apply stain or sealer",
    "Site cleanup and haul-off",
  ],
  "Roofing Repair": [
    "Inspect roof, flashing, and attic to identify the source of the leak",
    "Set ladders and protect landscaping and gutters",
    "Remove damaged shingles, underlayment, and decking as needed",
    "Replace compromised decking with matching material",
    "Install ice-and-water shield and underlayment at the repair area",
    "Install new shingles blended to match existing",
    "Reflash penetrations, valleys, and wall transitions",
    "Seal exposed fasteners and inspect ridge and vents",
    "Magnet sweep and debris removal",
  ],
  "Plumbing Repair": [
    "Isolate water supply and protect surrounding finishes",
    "Diagnose and locate the source of the leak or failure",
    "Open access to affected piping or fixture",
    "Replace failed pipe, valve, or fixture with code-approved material",
    "Pressure test and verify no leaks under normal operation",
    "Insulate and support piping as required",
    "Patch and restore access opening",
    "Verify drainage and clean the work area",
  ],
  "Electrical (minor)": [
    "De-energize the circuit and verify with tester",
    "Diagnose the fault or confirm scope of new device installation",
    "Install or replace devices, fixtures, and covers with code-approved material",
    "Verify grounding, polarity, and secure terminations",
    "Label panel circuit where applicable",
    "Test operation under load and restore power",
    "Patch and clean any access openings",
  ],
  "Water Damage Restoration": [
    "Assess moisture with meter and document all affected areas",
    "Stop the source of water intrusion",
    "Set containment and protect unaffected areas",
    "Remove saturated drywall, insulation, flooring, and trim",
    "Treat affected framing with antimicrobial",
    "Set air movers and dehumidifiers; monitor readings daily",
    "Verify dry standard is met before rebuild",
    "Rebuild removed materials to match existing",
    "Final clean and documentation for insurance if applicable",
  ],
  "General Repair": [
    "Assess the condition and confirm scope with client on site",
    "Protect surrounding finishes and set up the work area",
    "Remove or disassemble damaged components",
    "Repair or replace with matching material and finish",
    "Fasten, seal, and caulk as appropriate",
    "Touch up paint or finish to blend with existing",
    "Test operation and confirm with client",
    "Cleanup and haul away debris",
  ],
  "Other": [
    "Assess site conditions and confirm scope with client",
    "Protect surrounding areas and set up the work zone",
    "Furnish all labor, materials, and equipment described in this quote",
    "Perform work in accordance with manufacturer specifications and applicable code",
    "Clean the work area at the end of each working day",
    "Final walkthrough and debris removal",
  ],
};

const STANDARD_EXCLUSIONS = [
  "Permits and inspection fees, unless expressly listed in the scope above",
  "Concealed damage discovered after demolition (rot, mold, termite, or code violations)",
  "Relocation of plumbing, gas, or electrical lines not listed in the scope",
  "Structural or engineering work, including load-bearing modifications",
  "Asbestos, lead paint, or mold abatement",
  "Moving furniture, appliance disposal, and storage of personal items",
  "Defects or delays arising from client-supplied materials",
  "Landscaping restoration and irrigation repair",
  "Final detail cleaning beyond removal of construction debris",
];

const buildScope = (cat) => (SCOPE_TEMPLATES[cat] || SCOPE_TEMPLATES["Other"]).map((t) => ({ id: uid(), text: t, on: true }));
const buildExclusions = () => STANDARD_EXCLUSIONS.map((t) => ({ id: uid(), text: t, on: true }));

const STATUS = {
  draft:    { label: "Draft", color: BRAND.sub, bg: "#ECEEF1" },
  pending:  { label: "Pending review", color: BRAND.amber,  bg: "#FBF3DE" },
  changes:  { label: "Changes requested", color: BRAND.red, bg: "#F9E5E3" },
  approved: { label: "Approved", color: BRAND.green, bg: "#E2F2E9" },
  sent:     { label: "Sent to client", color: BRAND.navySoft, bg: "#E4EBF6" },
  won:      { label: "Won", color: BRAND.green, bg: "#D7EEDF" },
  lost:     { label: "Declined", color: BRAND.sub, bg: "#ECEEF1" },
  void:     { label: "Void", color: "#7A6A55", bg: "#EDE7DC" },
};

/* Voided quotes are ignored by every money figure and can never be printed,
   but the record stays so there is always proof of what was quoted. */
const isVoid = (q) => q && q.status === "void";

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
let fbAuth = null, db = null;
let cloudInitError = null;
if (CLOUD) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    db = firebase.firestore();
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
    if (CLOUD) { await db.collection("quotes").doc(q.id).set(q); return; }
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
          <QuoteForm key={activeQuote ? activeQuote.id : "new"} me={me} isOwner={isOwner} isManager={isManager} settings={settings} existing={view === "edit" ? activeQuote : null}
            onAutosave={upsertQuote}
            onSave={async (q) => { await upsertQuote(q); notify(q.status === "draft" ? "Draft saved — visible to the owner" : q.status === "approved" ? "Quote saved & approved" : "Quote submitted for owner review"); setView("dashboard"); setActiveQuote(null); }}
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
  const periodQuotes = quotes.filter((q) => inPeriod(q.createdAt, period) && !isVoid(q));
  const totals = useMemo(() => {
    let pipeline = 0, booked = 0, sentOut = 0, count = periodQuotes.length;
    periodQuotes.forEach((q) => {
      const t = computeQuote(q, settings).total;
      if (["pending", "approved", "sent"].includes(q.status)) pipeline += t;
      if (["sent", "won"].includes(q.status)) sentOut += t;
      if (q.status === "won") booked += t;
    });
    return { pipeline, booked, sentOut, count };
  }, [periodQuotes, settings]);

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
          ["Estimated pipeline", money(totals.pipeline), "Pending + approved + sent"],
          ["Sent to clients", money(totals.sentOut), "Sent + won"],
          ["Booked revenue", money(totals.booked), "Quotes marked Won"],
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
                    {q.reviewNote && q.status === "changes" && <div style={{ fontSize: 12, color: BRAND.red, marginTop: 3 }}>Owner note: {q.reviewNote}</div>}
                    {isVoid(q) && <div style={{ fontSize: 12, color: "#7A6A55", marginTop: 3, fontWeight: 600 }}>Voided{q.voidedBy ? " by " + q.voidedBy : ""}{q.voidReason ? " — " + q.voidReason : ""} · does not count toward any total</div>}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: BRAND.navy, textDecoration: isVoid(q) ? "line-through" : "none" }}>{money(c.total)}</div>
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

/* ================= QUOTE FORM ================= */
function QuoteForm({ me, isOwner, isManager, settings, existing, onSave, onAutosave, onPreview, onCancel }) {
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
  const locked = isVoid(q) || (!isManager && ["approved", "sent", "won", "lost"].includes(q.status));
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

  const save = (submit) => {
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
    onSave(next);
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

  return (
    <div className="grid md-grid-cols-3 gap-5">
      <div className="md-col-span-2 flex flex-col gap-5">
        <Card>
          <h3 style={h3Style}>1 · CLIENT</h3>
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
            Standard {q.category} scope loaded. Untick anything the client doesn't need, edit the wording, or add your own steps. Only ticked items print on the quote.
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
      </div>

      {/* Sticky summary */}
      <div>
        <div style={{ position: "sticky", top: 16 }}>
          <Card style={{ borderTop: `4px solid ${BRAND.gold}` }}>
            <h3 style={Object.assign({}, h3Style, { marginBottom: 12 })}>QUOTE SUMMARY</h3>
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
              {!locked && <Btn onClick={() => save(true)}>{isManager ? "Save & approve" : "Submit for review"}</Btn>}
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
    const qs = quotes.filter((q) => q.createdBy === u.id && inPeriod(q.createdAt, period) && !isVoid(q));
    let pipeline = 0, won = 0;
    qs.forEach((q) => {
      const t = computeQuote(q, settings).total;
      if (["pending", "approved", "sent"].includes(q.status)) pipeline += t;
      if (q.status === "won") won += t;
    });
    return { u, count: qs.length, pipeline, won };
  });

  const h2Style = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: BRAND.navy, letterSpacing: "0.03em", marginBottom: 12 };
  const outcomeQuotes = quotes.filter((q) => ["approved", "sent"].includes(q.status));
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
        <h2 style={h2Style}>MARK OUTCOMES</h2>
        <div className="flex flex-col gap-2">
          {outcomeQuotes.map((q) => (
            <Card key={q.id} style={{ padding: 12 }}>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div style={{ fontSize: 14 }}><strong>{q.quoteNo}</strong> · {q.clientName} · {money(computeQuote(q, settings).total)} <Badge status={q.status} /></div>
                <div className="flex gap-2">
                  {q.status === "approved" && <Btn small onClick={() => act(q, "sent")}>Mark sent</Btn>}
                  <Btn small kind="gold" onClick={() => act(q, "won")}>Won</Btn>
                  <Btn small kind="ghost" onClick={() => act(q, "lost")}>Declined</Btn>
                  <Btn small kind="ghost" onClick={() => voidQuote(q)}>Void</Btn>
                </div>
              </div>
            </Card>
          ))}
          {outcomeQuotes.length === 0 && <Card><div style={{ color: BRAND.sub, fontSize: 14 }}>Approved and sent quotes will appear here so you can record whether the client accepted.</div></Card>}
        </div>
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
  const releasable = !voided && ["approved", "sent", "won"].includes(quote.status);
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
  const validUntil = new Date(new Date(quote.createdAt).getTime() + 30 * 864e5);
  const goldLabel = { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: BRAND.gold };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,0.75)", zIndex: 50, overflowY: "auto", padding: "24px 12px" }} onClick={onClose}>
      <div style={{ maxWidth: 720, margin: "0 auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-2 mb-2">
          {canPrint
            ? <Btn small kind="gold" onClick={doPrint}>Print / Save as PDF</Btn>
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
              <div style={{ fontSize: 12, color: BRAND.sub }}>{COMPANY.email} · {COMPANY.site}</div>
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
                  <td style={{ textAlign: "right", padding: "9px 12px" }}>{it.qty}</td>
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

          {quote.notes ? <div style={{ fontSize: 13, marginTop: 10, background: BRAND.paper, padding: "10px 14px", borderRadius: 6 }}><strong>Note:</strong> {quote.notes}</div> : null}

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
