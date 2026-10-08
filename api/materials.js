/* ============================================================
   JTProQuotes — /api/materials
   "Labor + materials": the AI lists every material the job needs,
   with quantities and contractor cost, from the quote's scope,
   sizes, findings and photos. With items already on the quote it
   returns only what's missing.
============================================================ */

const { bad, parseBody, verifyCaller, detectMaterials, checkImages, getDocAs, companyFor } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");
  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");
  if (!process.env.ANTHROPIC_API_KEY) return bad(res, 503, "AI isn't switched on yet — ANTHROPIC_API_KEY is not set in Vercel.");

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) return bad(res, 401, "Sign in again — no session token was sent.");
  let caller;
  try { caller = await verifyCaller(idToken); }
  catch { return bad(res, 503, "Couldn't check your sign-in just now. Try again in a moment."); }
  if (!caller) return bad(res, 403, "Your account isn't approved to use this yet.");

  const q = body.quote && typeof body.quote === "object" ? body.quote : {};
  const s = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const list = (v, n, m) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x) => x.slice(0, m)) : []);
  const quote = {
    category: s(q.category, 60), jobTitle: s(q.jobTitle, 160), description: s(q.description, 2000),
    city: s(q.city, 200), clientAddress: s(q.clientAddress, 240),
    scope: list(q.scope, 40, 600), findings: list(q.findings, 15, 600), measurements: list(q.measurements, 20, 200),
    crewPlan: s(q.crewPlan, 200), propertyFacts: s(q.propertyFacts, 800), notes: s(q.notes, 1000),
  };
  if (!quote.jobTitle && !quote.description && !quote.scope.length) return bad(res, 400, "Add a job title, description or scope first, so there's something to list materials for.");

  const checked = checkImages(body.images, 6, 2_500_000);
  if (checked.error) return bad(res, 400, checked.error);
  const existing = list(body.existing, 40, 200);

  try {
    let settings = null;
    try { settings = await getDocAs(idToken, caller.p("settings/company")); } catch { /* defaults */ }
    const out = await detectMaterials({ quote, images: checked.images, existing, company: companyFor(settings, !caller.companyId) });
    console.log("[materials] ok uid=" + caller.uid + " items=" + out.items.length + " existing=" + existing.length + " photos=" + checked.images.length);
    return res.status(200).json(out);
  } catch (e) {
    console.error("[materials] failed:", e.message);
    return bad(res, e.code || 502, e.message || "Couldn't list the materials. Try again.");
  }
};
