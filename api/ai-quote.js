/* ============================================================
   JTProQuotes — /api/ai-quote
   Job photos and/or a lead in, a drafted quote out: what needs
   doing, the scope, crew and days, materials at cost, what to ask
   the client, and a ready-to-send first reply.

   The price is not chosen by the AI. The app runs the drafted
   labor and materials through the company's own rate, overhead
   and margin, exactly as for a hand-built quote.

   Only signed-in, approved team members can call it, and the
   Claude key lives only in Vercel's environment variables.

   IT KEEPS GOING IF THE PHONE LOCKS. Drafting takes up to a minute
   or two, and a phone that sleeps or switches apps drops the
   connection. So the finished draft is also saved to aiJobs/<jobId>
   in the database and a phone alert is sent — the app picks it up
   the moment it's back, even after a full reload.
============================================================ */

const { bad, parseBody, verifyCaller, getDocAs, setDocAs, setDocAsServer, listDocsAs, draftQuote, checkImages } = require("./_lib");
const { sendToPeople } = require("./_push");

const MAX_PHOTOS = 8;
// Vercel caps a request body at 4.5 MB. The app shrinks photos to ~1280px
// before sending, which keeps eight comfortably under this.
const MAX_TOTAL_BASE64 = 4_000_000;

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");

  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");

  if (!process.env.ANTHROPIC_API_KEY) {
    return bad(res, 503, "AI quoting isn't switched on yet — ANTHROPIC_API_KEY is not set in Vercel.");
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) return bad(res, 401, "Sign in again — no session token was sent.");

  let caller;
  try { caller = await verifyCaller(idToken); }
  catch { return bad(res, 503, "Couldn't check your sign-in just now. Try again in a moment."); }
  if (!caller) return bad(res, 403, "Your account isn't approved to use this yet. Ask the owner to approve it.");

  const text = typeof body.text === "string" ? body.text.slice(0, 20000) : "";
  const checked = checkImages(body.images, MAX_PHOTOS, MAX_TOTAL_BASE64);
  if (checked.error) return bad(res, 400, checked.error);
  const images = checked.images;

  if (!text.trim() && images.length === 0) return bad(res, 400, "Add at least one photo or a description of the job.");

  // The company's own numbers go into the brief so labor is sized against them.
  let settings = null;
  try { settings = await getDocAs(idToken, "settings/company"); } catch { /* defaults are fine */ }

  const jobId = typeof body.jobId === "string" && /^[\w-]{6,40}$/.test(body.jobId) ? body.jobId : "";
  const quoteId = typeof body.quoteId === "string" ? body.quoteId.slice(0, 60) : "";
  const quoteNo = typeof body.quoteNo === "string" ? body.quoteNo.slice(0, 40) : "";
  const attIds = Array.isArray(body.attIds) ? body.attIds.filter((x) => typeof x === "string").slice(0, 8) : [];
  const saveJob = async (fields) => {
    if (!jobId) return;
    // The server's own key when it has one (no database rule needed),
    // otherwise as the caller.
    const write = process.env.FIREBASE_SERVICE_ACCOUNT
      ? (path, data) => setDocAsServer(path, data)
      : (path, data) => setDocAs(idToken, path, data);
    try {
      await write("aiJobs/" + jobId, Object.assign({
        uid: caller.uid, quoteId, quoteNo, attIds, photoCount: images.length, startedAt: new Date().toISOString(),
      }, fields));
    } catch (e) { console.error("[ai-quote] couldn't save job " + jobId + ":", e.message); }
  };
  await saveJob({ status: "running", at: new Date().toISOString() });

  try {
    const out = await draftQuote({ text, images, settings });
    await saveJob({ status: "done", at: new Date().toISOString(), draft: out.draft, applied: false });
    // Let the phone know, in case the app isn't on screen any more.
    try {
      const subs = await listDocsAs(idToken, "pushSubs");
      await sendToPeople(subs, [caller.uid], {
        title: "AI quote ready ✅",
        body: (out.draft.jobTitle || out.draft.category) + (quoteNo ? " · " + quoteNo : "") + " — tap to review and apply.",
        tag: "ai-" + jobId, url: quoteId ? "/?quote=" + encodeURIComponent(quoteId) : "/",
      });
    } catch (e) { console.error("[ai-quote] push failed:", e.message); }
    console.log("[ai-quote] ok uid=" + caller.uid + " photos=" + images.length
      + " findings=" + out.draft.findings.length + " conf=" + out.draft.confidence
      + (out.usage ? " in=" + out.usage.input_tokens + " out=" + out.usage.output_tokens : ""));
    return res.status(200).json(out);
  } catch (e) {
    console.error("[ai-quote] failed:", e.message);
    await saveJob({ status: "error", at: new Date().toISOString(), error: e.message || "The AI draft failed." });
    return bad(res, e.code || 502, e.message || "That didn't work. Try again.");
  }
};
