/* ============================================================
   JTProQuotes — /api/read-lead
   Reads a pasted lead (screenshot and/or text) and returns the
   fields for a draft quote.

   WHY THIS IS A SERVER FUNCTION AND NOT BROWSER CODE:
   the Claude API key must never reach the browser. index.html is
   public and anyone could read a key out of it and spend it. The
   key lives only in Vercel's environment variables, and the
   functions in this folder are the only things that ever see it.

   Set ANTHROPIC_API_KEY in Vercel > Settings > Environment
   Variables. Until it is set, the panel in the app reports that
   the feature is switched off and nothing else changes.
============================================================ */

const { bad, parseBody, verifyCaller, extractLead } = require("./_lib");

const MAX_IMAGES = 3;
const MAX_TOTAL_BASE64 = 3_600_000; // ~2.7 MB of image data, inside Vercel's body limit
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");

  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");

  if (!process.env.ANTHROPIC_API_KEY) {
    return bad(res, 503, "Reading leads isn't switched on yet — ANTHROPIC_API_KEY is not set on this deployment.");
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) return bad(res, 401, "Sign in again — no session token was sent.");

  let caller;
  try { caller = await verifyCaller(idToken); }
  catch { return bad(res, 503, "Couldn't check your sign-in just now. Try again in a moment."); }
  if (!caller) return bad(res, 403, "Your account isn't approved to use this yet. Ask the owner to approve it.");

  const text = typeof body.text === "string" ? body.text.slice(0, 20000) : "";
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];

  if (!text.trim() && images.length === 0) return bad(res, 400, "Nothing to read — add a screenshot or paste the lead text.");

  let total = 0;
  for (const im of images) {
    if (!im || typeof im.data !== "string" || !ALLOWED_MEDIA.includes(im.mediaType)) {
      return bad(res, 400, "Screenshots must be JPEG, PNG, WebP or GIF.");
    }
    total += im.data.length;
  }
  if (total > MAX_TOTAL_BASE64) return bad(res, 413, "Those screenshots are too large. Send up to three, or crop them tighter.");

  try {
    const out = await extractLead({ text, images });
    console.log("[read-lead] ok uid=" + caller.uid + " images=" + images.length + " text=" + (text ? "yes" : "no"));
    return res.status(200).json(out);
  } catch (e) {
    return bad(res, e.code || 502, e.message || "That didn't work. Try again, or type the details in.");
  }
};
