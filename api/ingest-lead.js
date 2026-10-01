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
  bad, uid, parseBody, extractLead, sendEmail, verifyGoogleSender, priceFrom,
  STANDARD_EXCLUSIONS, createDocAsServer, listDocsAsServer, queryAsServer,
  draftQuote, draftToQuoteFields, quoteTotal, renderReply, priceRange, priceToWin,
  uploadImageAsServer, checkImages,
} = require("./_lib");
const { sendToPeople } = require("./_push");
const { lookupProperty } = require("./_property");

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

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
  /* Either the Gmail script's Google identity (preferred — nothing secret to
     copy around) or the older shared secret. */
  const auth = String(req.headers.authorization || "");
  let sender = null;
  if (auth.startsWith("Bearer ")) {
    try { sender = await verifyGoogleSender(auth.slice(7)); } catch { sender = null; }
  }
  if (!sender && !secretMatches(req.headers["x-ingest-secret"])) {
    return bad(res, 401, "Not an approved lead inbox. Run the script from ludvert@gmail.com, or set INGEST_EMAILS in Vercel.");
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return bad(res, 503, "Lead ingest needs FIREBASE_SERVICE_ACCOUNT in Vercel.");

  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");

  const subject = typeof body.subject === "string" ? body.subject.slice(0, 500) : "";
  const from = typeof body.from === "string" ? body.from.slice(0, 300) : "";
  const text = typeof body.text === "string" ? body.text.slice(0, 20000) : "";
  const messageId = typeof body.messageId === "string" ? body.messageId.slice(0, 200) : "";
  // The "View / Reply" link from the Thumbtack email, so one tap opens the lead.
  const leadUrl = typeof body.leadUrl === "string" && /^https:\/\/([\w-]+\.)*thumbtack\.com\//.test(body.leadUrl) ? body.leadUrl.slice(0, 1000) : "";

  // Photos the customer attached to the lead, sent along by the Gmail script.
  const checked = checkImages(body.images, 4, 3_500_000);
  const images = checked.error ? [] : checked.images;

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

  const leadText = (subject ? "Subject: " + subject + "\n\n" : "") + text;

  // The same email filed twice (e.g. the script re-ran) is ignored.
  if (messageId) {
    try {
      const dupes = await queryAsServer("quotes", { leadMessageId: messageId });
      if (dupes.length) return res.status(200).json({ ok: true, duplicate: true, quoteNo: dupes[0].quoteNo, id: dupes[0].id });
    } catch { /* carry on */ }
  }
  const now = new Date().toISOString();
  const id = uid() + uid();
  const quoteNo = "Q-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);

  /* First choice: a full AI draft — scope, crew, materials, questions and a
     reply ready to paste into Thumbtack. If that fails for any reason, fall
     back to the plain read so the lead is never lost. */
  let d = null;
  try {
    d = (await draftQuote({ text: leadText, images, settings })).draft;
  } catch (e) {
    console.error("[ingest-lead] draft failed, falling back to a plain read:", e.message);
  }

  let quote;
  if (d) {
    // Upload the customer's photos so they sit on the quote like any other.
    const urls = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const path = `leads/${ownerUid}/${id}/${Date.now()}-${i}.jpg`;
        urls.push({ path, url: await uploadImageAsServer(path, images[i].data, images[i].mediaType) });
      } catch (e) { console.error("[ingest-lead] photo upload failed:", e.message); urls.push(null); }
    }
    const referenced = new Set(d.findings.map((x) => x.photo).filter((n) => n > 0));
    /* If Storage isn't set up, a photo small enough is kept inside the quote
       instead (Firestore documents cap at 1 MB, so large ones are skipped). */
    let inlineBudget = 600000;
    const attachments = urls.map((u, i) => {
      const base = { id: uid(), at: now, by: "Lead inbox", kind: "photo", show: referenced.has(i + 1) };
      if (u) return Object.assign(base, { path: u.path, url: u.url, thumb: "" });
      const size = images[i].data.length;
      if (size <= 200000 && size <= inlineBudget) {
        inlineBudget -= size;
        return Object.assign(base, { path: "", url: "", thumb: "data:" + images[i].mediaType + ";base64," + images[i].data });
      }
      return null;
    });
    const fields = draftToQuoteFields(d, settings, uid, attachments.map((a) => (a ? a.url || a.thumb : "")));
    quote = Object.assign({
      id, quoteNo, createdBy: ownerUid, createdAt: now, updatedAt: now, status: "draft",
      clientName: d.clientName || (subject ? subject.slice(0, 60) : "Unnamed lead"),
      clientPhone: d.clientPhone, clientEmail: d.clientEmail, clientAddress: d.clientAddress,
      exclusions: STANDARD_EXCLUSIONS.map((t) => ({ id: uid(), text: t, on: true })),
      notes: "", attachments: attachments.filter(Boolean),
      fromInbox: true, leadSource: d.sourcePlatform || "email", leadMessageId: messageId, leadReadAt: now, leadUrl,
      leadText: leadText.slice(0, 8000),
      history: [{ at: now, by: "Lead inbox", action: "Filed from a lead email and drafted by AI" }],
    }, fields);
  } else {
    let read;
    try {
      read = await extractLead({ text: leadText, images: [] });
    } catch (e) {
      return bad(res, e.code || 502, e.message || "Couldn't read that email.");
    }
    const f = read.fields;

    /* Sizes, timing and budget the customer mentioned go in the notes, marked as
       the customer's own words. */
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

    quote = {
      id, quoteNo, createdBy: ownerUid, createdAt: now, updatedAt: now,
      status: "draft",
      clientName: f.clientName || (subject ? subject.slice(0, 60) : "Unnamed lead"),
      clientPhone: f.clientPhone, clientEmail: f.clientEmail, clientAddress: f.clientAddress,
      category: f.category, jobTitle: f.jobTitle, description: f.description,
      scopeItems: (f.scopeSuggestions || []).map((t) => ({ id: uid(), text: t, on: false, fromLead: true })),
      scopeSource: "", scopeEdited: true,
      exclusions: STANDARD_EXCLUSIONS.map((t) => ({ id: uid(), text: t, on: true })),
      crew: 2, days: 1, hoursPerDay: 8,
      laborRate: (settings && settings.laborRate) || 45,
      items: [], pricingMode: "labor",
      overheadPct: (settings && settings.overheadPct) != null ? settings.overheadPct : 12,
      marginPct: (settings && settings.targetMargin) != null ? settings.targetMargin : 25,
      discountPct: 0,
      notes,
      fromInbox: true, leadSource: f.sourcePlatform || "email", leadMessageId: messageId, leadReadAt: now, leadUrl,
      leadText: leadText.slice(0, 8000),
      history: [{ at: now, by: "Lead inbox", action: "Filed from a lead email" }],
    };
  }

  /* A street address in the lead → attach the property facts (drive time,
     roof size, flood zone, lot). Pictures are left off to keep the record
     small; the app fetches them when the quote is opened. */
  if (process.env.GOOGLE_MAPS_API_KEY && /\d+\s+\S+/.test(quote.clientAddress || "")) {
    try {
      const p = await Promise.race([lookupProperty(quote.clientAddress), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 15000))]);
      quote.property = Object.assign({}, p, { streetView: "", satellite: "" });
      quote.history.push({ at: now, by: "Lead inbox", action: "Property looked up: " + p.address });
    } catch (e) { console.error("[ingest-lead] property lookup skipped:", e.message); }
  }

  // Price to win: just under the local market, never below the minimum margin.
  if (d) {
    const win = priceToWin(quote, settings, d.market);
    if (win) { quote.marginPct = win.marginPct; quote.discountPct = 0; quote.aiDraft.pricingNote = win.note; }
  }

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

  const total = d ? quoteTotal(quote, settings) : 0;
  const reply = d ? renderReply(quote.replyTemplate, total, d.confidence, quote.pricingMode === "labor", d.market) : "";

  // Tell the team a lead landed, with the reply ready to paste into Thumbtack.
  await sendEmail({
    subject: d
      ? `New lead drafted — ${quote.clientName} · ${quote.category} · ${priceRange(total, d.confidence)}`
      : `New lead filed — ${quote.clientName} · ${quote.category}`,
    message: [
      d ? "A lead came in and JTProQuotes has drafted a quote for it. Nothing has been sent to the customer."
        : "A lead email came in and is now a draft quote in JTProQuotes, waiting to be priced.",
      "",
      `Quote:    ${quoteNo}`,
      `Client:   ${quote.clientName}`,
      `Phone:    ${quote.clientPhone || "(not in the email)"}`,
      `Address:  ${quote.clientAddress || "(not in the email)"}`,
      `Job:      ${quote.jobTitle || quote.category}`,
      d ? `Draft:    ${money(total)} (${d.confidence} confidence${d.needsSiteVisit ? ", site visit recommended" : ""})` : "",
      d ? `Crew:     ${quote.crew} for ${quote.days} day(s) · ${quote.items.length} material lines · ${images.length} photo(s)` : "",
      "",
      d && d.questions.length ? "Still need from the customer:\n" + d.questions.map((x, i) => `  ${i + 1}. ${x}`).join("\n") + "\n" : "",
      d ? "──── Reply to paste into Thumbtack (review first) ────\n" + reply + "\n────────────────────────────────────\n" : "",
      leadUrl ? "Open the lead in Thumbtack: " + leadUrl + "\n" : "",
      d ? "Open JTProQuotes to check the numbers and approve it." : `Filed under ${ownerName}'s drafts. It has no price on it yet and nothing has been sent.`,
    ].filter((l) => l !== "").join("\n"),
    replyTo: quote.clientEmail || undefined,
  });

  // Phone alert to the owner and assistants.
  try {
    const [users, subs] = await Promise.all([listDocsAsServer("users"), listDocsAsServer("pushSubs")]);
    const managers = users.filter((u) => u && u.active === true && (u.role === "owner" || u.role === "assistant")).map((u) => u.id);
    await sendToPeople(subs, managers, {
      title: "New Thumbtack lead · " + (d ? "from " + priceFrom(total, d.confidence) : quote.category),
      body: `${quote.clientName} — ${quote.jobTitle || quote.category}. ${d ? "Reply is written — tap, copy, send." : "Filed as a draft, needs pricing."}`,
      tag: "q-" + id, url: "/?quote=" + id,
    });
  } catch (e) { console.error("[ingest-lead] push failed:", e.message); }

  console.log("[ingest-lead] filed " + quoteNo + " from " + (quote.leadSource || from || "email") + (d ? " drafted " + d.confidence : " unpriced"));
  return res.status(200).json({
    ok: true, quoteNo, id, drafted: !!d,
    total: Math.round(total), range: d ? priceRange(total, d.confidence) : "",
    reply, clientName: quote.clientName, clientEmail: quote.clientEmail || "",
    questions: d ? d.questions : [],
  });
};
