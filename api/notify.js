/* ============================================================
   JTProQuotes — /api/notify
   Tells the right people when a quote changes hands:
     submitted for review  -> owner + assistants (phone alert + email)
     approved              -> the associate who wrote it (phone alert)
     sent back for changes -> the associate who wrote it (phone alert)
   and { test: true } sends a test alert to the caller's own devices.

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

const { bad, parseBody, verifyCaller, getDocAs, listDocsAs, sendEmail, quoteTotal } = require("./_lib");
const { pushEnabled, sendToPeople } = require("./_push");

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

/* The total is recomputed from the stored quote with the shared formula in
   _lib.js, never trusted from the request. */

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");

  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  const quoteId = typeof body.quoteId === "string" ? body.quoteId : "";
  if (!idToken) return bad(res, 401, "Sign in again — no session token was sent.");

  let caller;
  try { caller = await verifyCaller(idToken); }
  catch { return bad(res, 503, "Couldn't check your sign-in just now."); }
  if (!caller) return bad(res, 403, "Your account isn't approved.");

  let subs = [];
  const loadSubs = async () => { try { subs = await listDocsAs(idToken, caller.p("pushSubs")); } catch { subs = []; } };

  /* ---- test alert to your own devices ---- */
  if (body.test === true) {
    if (!pushEnabled()) return bad(res, 503, "Phone alerts aren't switched on yet — VAPID_PRIVATE_KEY is not set in Vercel.");
    await loadSubs();
    const r = await sendToPeople(subs, [caller.uid], {
      title: "Phone alerts are on ✅",
      body: "This is how you'll hear about quotes waiting for approval and new leads.",
      tag: "jtpq-test", url: "/",
    });
    if (!r.devices) return bad(res, 404, "No device is registered for you yet. Tap 'Turn on alerts' on this phone first.");
    return res.status(200).json(r);
  }

  if (!quoteId) return bad(res, 400, "No quote was named.");

  let quote;
  try { quote = await getDocAs(idToken, caller.p("quotes/" + encodeURIComponent(quoteId))); }
  catch { quote = null; }
  if (!quote) return bad(res, 404, "That quote couldn't be read back.");

  let settings = null, team = [];
  try { settings = await getDocAs(idToken, caller.p("settings/company")); } catch { /* defaults are fine */ }
  try { team = await listDocsAs(idToken, caller.p("users")); } catch { /* names are optional */ }

  const author = team.find((u) => u && u.id === quote.createdBy);
  const managers = team.filter((u) => u && u.active === true && (u.role === "owner" || u.role === "assistant"));
  const total = quoteTotal(quote, settings);
  const isManager = caller.role === "owner" || caller.role === "assistant";
  const label = `${quote.quoteNo || quoteId} · ${quote.clientName || "new client"}`;
  const out = { email: null, push: null };

  /* ---- approved / sent back: tell the associate who wrote it ---- */
  if (quote.status === "approved" || quote.status === "changes") {
    if (!isManager || !author || author.id === caller.uid) return res.status(200).json({ note: "Nobody else to tell." });
    await loadSubs();
    out.push = await sendToPeople(subs, [author.id], quote.status === "approved"
      ? { title: "Quote approved ✅", body: `${label} · ${money(total)} is approved — you can send it to the client now.`, tag: "q-" + quoteId, url: "/?quote=" + quoteId }
      : { title: "Changes requested", body: `${label}${quote.reviewNote ? " — " + String(quote.reviewNote).slice(0, 140) : ""}`, tag: "q-" + quoteId, url: "/?quote=" + quoteId });
    return res.status(200).json(out);
  }

  /* Only a genuine hand-off gets an email. A saved draft or an already-decided
     quote does not — otherwise every autosave would ping. */
  if (quote.status !== "pending") {
    return res.status(200).json({ sent: 0, note: "Nothing to notify — the quote isn't waiting for review." });
  }

  // Phone alert to everyone who can approve (except the person who submitted).
  await loadSubs();
  out.push = await sendToPeople(subs, managers.map((u) => u.id).filter((id) => id !== caller.uid), {
    title: "Approval needed · " + money(total),
    body: `${author ? author.name : "An associate"} submitted ${label}${quote.jobTitle ? " — " + quote.jobTitle : ""}`,
    tag: "q-" + quoteId, url: "/?quote=" + quoteId,
  });

  // Email copies go to JTProconstruction's inbox only; other companies get phone alerts.
  if (caller.companyId || !String(process.env.WEB3FORMS_KEYS || "").trim()) {
    return res.status(200).json(out);
  }

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
    "Open JTProQuotes to approve it, send it back for changes, or void it.",
    "",
    `Waiting on: ${managers.length ? managers.map((u) => u.name).join(", ") : "the owner"}`,
  ].filter((l) => l !== "");

  out.email = await sendEmail({
    subject: `Approval needed — ${quote.quoteNo || quoteId} · ${quote.clientName || "new client"} · ${money(total)}`,
    message: lines.join("\n"),
    replyTo: author && author.email ? author.email : undefined,
  });

  console.log("[notify] quote=" + (quote.quoteNo || quoteId) + " email=" + (out.email && out.email.sent) + " push=" + (out.push && out.push.sent));
  return res.status(200).json(out);
};
