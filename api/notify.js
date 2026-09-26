/* ============================================================
   JTProQuotes — /api/notify
   Emails whoever can approve a quote when an associate submits one.

   The app calls this right after the quote is saved. The quote is
   then read back from Firestore as the caller and the email is
   composed here from what is actually stored — so the message can't
   be faked by editing the request, and a caller can't use this to
   send arbitrary mail to the team.

   Set WEB3FORMS_KEYS in Vercel: one Web3Forms access key per person
   who should be told, comma-separated. Web3Forms delivers to the
   address each key belongs to. Until it is set, submitting works
   exactly as before and no email goes out.
============================================================ */

const { bad, parseBody, verifyCaller, getDocAs, listDocsAs, sendEmail } = require("./_lib");

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

/* Recomputed here rather than trusted from the request — the same shape the
   app uses, so the figure in the email matches the figure on the screen. */
function quoteTotal(q, s) {
  const settings = s || {};
  /* Mirrors computeQuote in src/app.jsx line for line, including the fact that
     the labor rate is taken off the quote only — a quote with no rate on it
     prices at zero there, and this has to agree or the email would quote a
     different figure than the screen. */
  const hours = (Number(q.crew) || 0) * (Number(q.days) || 0) * (Number(q.hoursPerDay) || 0);
  const labor = hours * (Number(q.laborRate) || 0);
  const materials = (q.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const base = labor + materials;
  const overhead = base * ((Number(q.overheadPct != null ? q.overheadPct : settings.overheadPct) || 0) / 100);
  const cost = base + overhead;
  const marginPct = Number(q.marginPct != null ? q.marginPct : settings.targetMargin) || 0;
  const withMargin = marginPct >= 100 ? cost : cost / (1 - marginPct / 100);
  const discount = withMargin * ((Number(q.discountPct) || 0) / 100);
  return Math.max(withMargin - discount, 0);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");

  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  const quoteId = typeof body.quoteId === "string" ? body.quoteId : "";
  if (!idToken) return bad(res, 401, "Sign in again — no session token was sent.");
  if (!quoteId) return bad(res, 400, "No quote was named.");

  let caller;
  try { caller = await verifyCaller(idToken); }
  catch { return bad(res, 503, "Couldn't check your sign-in just now."); }
  if (!caller) return bad(res, 403, "Your account isn't approved.");

  // Nothing to do if no keys are configured — not an error worth bothering
  // the person about mid-submission.
  if (!String(process.env.WEB3FORMS_KEYS || "").trim()) {
    return res.status(200).json({ sent: 0, note: "Notifications are not switched on." });
  }

  let quote;
  try { quote = await getDocAs(idToken, "quotes/" + encodeURIComponent(quoteId)); }
  catch { quote = null; }
  if (!quote) return bad(res, 404, "That quote couldn't be read back.");

  /* Only a genuine hand-off gets an email. A saved draft, an approved quote or
     an already-decided one does not — otherwise every autosave would ping. */
  if (quote.status !== "pending") {
    return res.status(200).json({ sent: 0, note: "Nothing to notify — the quote isn't waiting for review." });
  }

  let settings = null, team = [];
  try { settings = await getDocAs(idToken, "settings/company"); } catch { /* defaults are fine */ }
  try { team = await listDocsAs(idToken, "users"); } catch { /* names are optional */ }

  const author = team.find((u) => u && u.id === quote.createdBy);
  const managers = team.filter((u) => u && u.active === true && (u.role === "owner" || u.role === "assistant"));
  const total = quoteTotal(quote, settings);

  const lines = [
    `${author ? author.name : "An associate"} submitted a quote for your approval.`,
    "",
    `Quote:    ${quote.quoteNo || quoteId}`,
    `Client:   ${quote.clientName || "(not named)"}`,
    `Job:      ${quote.jobTitle || quote.category || "(not titled)"}`,
    `Address:  ${quote.clientAddress || "(not given)"}`,
    `Total:    ${money(total)}`,
    `Crew:     ${quote.crew || "?"} for ${quote.days || "?"} day(s)`,
    "",
    quote.description ? "What the client asked for:\n" + String(quote.description).slice(0, 800) + "\n" : "",
    quote.notes ? "Estimator's notes:\n" + String(quote.notes).slice(0, 600) + "\n" : "",
    "Open JTProQuotes to approve it, send it back for changes, or void it.",
    "",
    `Waiting on: ${managers.length ? managers.map((u) => u.name).join(", ") : "the owner"}`,
  ].filter((l) => l !== "");

  const result = await sendEmail({
    subject: `Approval needed — ${quote.quoteNo || quoteId} · ${quote.clientName || "new client"} · ${money(total)}`,
    message: lines.join("\n"),
    replyTo: author && author.email ? author.email : undefined,
  });

  console.log("[notify] quote=" + (quote.quoteNo || quoteId) + " sent=" + result.sent + " failed=" + (result.failed || 0));
  return res.status(200).json(result);
};
