/* ============================================================
   JTProQuotes — /api/ingest-lead
   Takes a lead email and files it as a draft quote, ready to price.

   Called by the Google Apps Script in integrations/gmail-thumbtack.gs,
   which watches the Gmail inbox for Thumbtack lead emails. There is no
   signed-in person behind this, so it is guarded by a shared secret and
   writes with a Firebase service account.

   Required environment variables:
     INGEST_SECRET              any long random string; the same value
                                goes in the Apps Script
     FIREBASE_SERVICE_ACCOUNT   the service-account JSON, on one line
     ANTHROPIC_API_KEY          to read the email

   The draft is filed under the owner's account, unpriced and unsent.
   Nothing reaches a client without going through the normal review.
============================================================ */

const crypto = require("crypto");
const {
  bad, uid, parseBody, extractLead, sendEmail,
  STANDARD_EXCLUSIONS, createDocAsServer, listDocsAsServer,
} = require("./_lib");

/* Compared in constant time so the secret can't be guessed a character
   at a time by watching how long the comparison takes. */
function secretMatches(given) {
  const want = String(process.env.INGEST_SECRET || "");
  if (!want || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(want);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");
  if (!process.env.INGEST_SECRET) return bad(res, 503, "Lead ingest is not switched on — INGEST_SECRET is not set.");
  if (!secretMatches(req.headers["x-ingest-secret"])) return bad(res, 401, "Bad or missing secret.");

  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");

  const subject = typeof body.subject === "string" ? body.subject.slice(0, 500) : "";
  const from = typeof body.from === "string" ? body.from.slice(0, 300) : "";
  const text = typeof body.text === "string" ? body.text.slice(0, 20000) : "";
  const messageId = typeof body.messageId === "string" ? body.messageId.slice(0, 200) : "";

  if (!text.trim() && !subject.trim()) return bad(res, 400, "Nothing to read — the email had no text.");

  /* The draft has to belong to somebody. It goes to the owner, who can
     reassign it by hand — an automated lead is not any associate's work. */
  let ownerUid = process.env.OWNER_UID || "";
  let ownerName = "Owner";
  let settings = null;
  try {
    const users = await listDocsAsServer("users");
    const owner = users.find((u) => u && u.role === "owner");
    if (owner) { ownerUid = ownerUid || owner.id; ownerName = owner.name || ownerName; }
    if (!ownerUid) return bad(res, 503, "No owner account was found to file the lead under.");
    const all = await listDocsAsServer("settings");
    settings = all.find((s) => s && (s.laborRate != null || s.targetMargin != null)) || null;
  } catch (e) {
    console.error("[ingest-lead] setup read failed:", e.message);
    return bad(res, 503, "Couldn't reach the database. " + e.message);
  }

  let read;
  try {
    read = await extractLead({ text: (subject ? "Subject: " + subject + "\n\n" : "") + text, images: [] });
  } catch (e) {
    return bad(res, e.code || 502, e.message || "Couldn't read that email.");
  }
  const f = read.fields;

  const now = new Date().toISOString();
  const id = uid() + uid();
  const quoteNo = "Q-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);

  /* Sizes, timing and budget the customer mentioned go in the notes, marked as
     the customer's own words. They never touch the pricing — a quote priced off
     an unverified number is a loss waiting to happen. */
  const notes = [
    "— Filed automatically from a lead email —",
    f.sourcePlatform ? "Source: " + f.sourcePlatform : (from ? "From: " + from : ""),
    subject ? "Subject: " + subject : "",
    f.measurements && f.measurements.length ? "Customer stated: " + f.measurements.join("; ") + " (their words — verify on site)" : "",
    f.timeline ? "Timeline: " + f.timeline : "",
    f.budgetMentioned ? "Budget named: " + f.budgetMentioned : "",
    f.missing && f.missing.length ? "Not in the email, still to confirm: " + f.missing.join(", ") : "",
    f.notes ? "Watch out: " + f.notes : "",
  ].filter(Boolean).join("\n");

  const quote = {
    id, quoteNo, createdBy: ownerUid, createdAt: now, updatedAt: now,
    status: "draft",
    clientName: f.clientName || (subject ? subject.slice(0, 60) : "Unnamed lead"),
    clientPhone: f.clientPhone, clientEmail: f.clientEmail, clientAddress: f.clientAddress,
    category: f.category, jobTitle: f.jobTitle, description: f.description,
    // Suggested steps arrive switched off. Somebody agrees to each one before
    // it can appear on a client's quote.
    scopeItems: (f.scopeSuggestions || []).map((t) => ({ id: uid(), text: t, on: false, fromLead: true })),
    scopeSource: "", scopeEdited: true,
    exclusions: STANDARD_EXCLUSIONS.map((t) => ({ id: uid(), text: t, on: true })),
    crew: 2, days: 1, hoursPerDay: 8,
    laborRate: (settings && settings.laborRate) || 45,
    items: [],
    overheadPct: (settings && settings.overheadPct) != null ? settings.overheadPct : 12,
    marginPct: (settings && settings.targetMargin) != null ? settings.targetMargin : 25,
    discountPct: 0,
    notes,
    fromInbox: true, leadSource: f.sourcePlatform || "email", leadMessageId: messageId, leadReadAt: now,
    history: [{ at: now, by: "Lead inbox", action: "Filed from a lead email" }],
  };

  try {
    await createDocAsServer("quotes", id, quote);
  } catch (e) {
    console.error("[ingest-lead] write failed:", e.message);
    return bad(res, 502, "Couldn't save the draft. " + e.message);
  }

  try {
    await createDocAsServer("activity", uid() + uid(), {
      at: now, who: "Lead inbox", action: "Filed a lead as a draft quote", quoteNo,
    });
  } catch { /* the log is useful, not essential */ }

  // Tell the team a lead landed, using the same mail route as approvals.
  await sendEmail({
    subject: `New lead filed — ${quote.clientName} · ${quote.category}`,
    message: [
      `A lead email came in and is now a draft quote in JTProQuotes, waiting to be priced.`,
      "",
      `Quote:    ${quoteNo}`,
      `Client:   ${quote.clientName}`,
      `Phone:    ${quote.clientPhone || "(not in the email)"}`,
      `Address:  ${quote.clientAddress || "(not in the email)"}`,
      `Job:      ${quote.jobTitle || quote.category}`,
      "",
      quote.description ? "What they asked for:\n" + quote.description.slice(0, 800) + "\n" : "",
      `Filed under ${ownerName}'s drafts. It has no price on it yet and nothing has been sent.`,
    ].filter((l) => l !== "").join("\n"),
    replyTo: f.clientEmail || undefined,
  });

  console.log("[ingest-lead] filed " + quoteNo + " from " + (f.sourcePlatform || from || "email"));
  return res.status(200).json({ ok: true, quoteNo, id, missing: f.missing });
};
