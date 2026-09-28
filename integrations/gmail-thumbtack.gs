/* ============================================================
   JTProQuotes — Gmail lead watcher (Google Apps Script)

   Checks your Gmail for new Thumbtack (and other) lead emails. For
   each one, JTProQuotes drafts a full quote — scope, crew, materials,
   price — plus a first reply to the customer that answers with a
   price range and asks for whatever is missing.

   Nothing is ever sent to a customer automatically. You get an
   email with the reply ready to paste into Thumbtack, and if the
   customer's own email address is in the lead, a Gmail DRAFT to
   them is waiting in your Drafts folder for you to check and send.

   Runs on Google's servers as you, so it needs no Google Cloud
   project, no OAuth app, and no password anywhere.

   ── SETUP (about ten minutes, once) ──────────────────────────
   1. Go to script.google.com and click "New project".
   2. Delete whatever is in the editor and paste this whole file in.
   3. Change ENDPOINT and SECRET below.
        ENDPOINT  your app's address + /api/ingest-lead
        SECRET    the same value you set as INGEST_SECRET in Vercel
   4. Save (the disk icon). Name the project "JTProQuotes leads".
   5. In the function dropdown at the top pick `testOnce`, click Run,
      and approve the permissions Google asks for. It will say what it
      found. Check JTProQuotes for the draft.
   6. Click the clock icon (Triggers) on the left, then
      "Add Trigger": function `checkForLeads`, time-driven,
      minutes timer, every 15 minutes. Save.

   That's it. New leads turn into drafts by themselves.

   ── HOW IT DECIDES WHAT IS A LEAD ────────────────────────────
   The SEARCHES list below. Each entry is an ordinary Gmail search.
   Add your own — Angi, Facebook, your website's form — and they all
   get filed the same way. Anything already processed is labelled, so
   nothing is filed twice even if the script runs again.
============================================================ */

// ---- EDIT THESE THREE ----------------------------------------
var ENDPOINT = "https://jtproquotes.vercel.app/api/ingest-lead";
var SECRET = "paste-the-same-value-as-INGEST_SECRET-in-vercel";

var SEARCHES = [
  // Thumbtack sends new leads and direct requests from thumbtack.com.
  // Skip its marketing and billing mail — only real customer requests.
  'from:thumbtack.com newer_than:2d -label:JTPQ-Filed -subject:(receipt OR invoice OR "weekly" OR "tips" OR "budget" OR "payment")',
  // Add more as you need them, one per line, each in quotes and comma-ended:
  // 'from:angi.com newer_than:2d -label:JTPQ-Filed',
  // 'subject:"new quote request" newer_than:2d -label:JTPQ-Filed',
];
// -------------------------------------------------------------

var LABEL_DONE = "JTPQ-Filed";
var LABEL_FAILED = "JTPQ-Failed";
var MAX_PER_RUN = 10; // a safety net — a flooded inbox can't run up a bill

// Create a Gmail draft to the customer when the lead includes their email.
// It is only a draft — you still read it and press Send yourself.
var DRAFT_CUSTOMER_EMAIL = true;

// Photos the customer attached come along so the AI can see the job.
var MAX_PHOTOS = 4;
var MIN_PHOTO_BYTES = 15000;      // skips logos and tracking pixels
var MAX_PHOTO_BYTES = 800000;     // one big phone photo is plenty per slot

/* The trigger calls this. */
function checkForLeads() {
  var done = labelNamed(LABEL_DONE);
  var failed = labelNamed(LABEL_FAILED);
  var handled = 0;
  var report = [];

  for (var s = 0; s < SEARCHES.length; s++) {
    var threads = GmailApp.search(SEARCHES[s], 0, MAX_PER_RUN);
    for (var t = 0; t < threads.length && handled < MAX_PER_RUN; t++) {
      var msgs = threads[t].getMessages();
      var msg = msgs[msgs.length - 1]; // the newest message in the thread
      handled++;
      var outcome = fileOneLead(msg);
      report.push(outcome.line);
      // Labelling the thread either way stops the same email being retried
      // forever. A failure is labelled separately so you can find it.
      threads[t].addLabel(outcome.ok ? done : failed);
    }
  }

  var summary = handled === 0 ? "No new leads." : report.join("\n");
  Logger.log(summary);
  return summary;
}

/* Sends one email to JTProQuotes. */
function fileOneLead(msg) {
  var subject = msg.getSubject() || "";
  var body = msg.getPlainBody() || "";
  var payload = {
    subject: subject,
    from: msg.getFrom() || "",
    text: body.slice(0, 18000),
    messageId: msg.getId(),
    receivedAt: msg.getDate().toISOString(),
    images: photosFrom(msg)
  };

  try {
    var res = UrlFetchApp.fetch(ENDPOINT, {
      method: "post",
      contentType: "application/json",
      headers: { "x-ingest-secret": SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var text = res.getContentText();

    if (code === 200) {
      var out = {};
      try { out = JSON.parse(text); } catch (e) {}
      var extra = "";
      if (DRAFT_CUSTOMER_EMAIL && out.reply && out.clientEmail) {
        try {
          GmailApp.createDraft(out.clientEmail,
            "Your project quote from JTProconstruction" + (out.quoteNo ? " (" + out.quoteNo + ")" : ""),
            out.reply);
          extra = "  · draft reply waiting in Gmail Drafts";
        } catch (e) { extra = "  · couldn't create the Gmail draft: " + e.message; }
      }
      return { ok: true, line: "FILED  " + (out.quoteNo || "?") + (out.range ? "  " + out.range : "") + "  —  " + subject.slice(0, 60) + extra };
    }
    return { ok: false, line: "FAILED (" + code + ")  " + subject.slice(0, 60) + "  —  " + text.slice(0, 160) };
  } catch (e) {
    return { ok: false, line: "FAILED (network)  " + subject.slice(0, 60) + "  —  " + e.message };
  }
}

/* Image attachments and inline photos on the lead, as base64. Small images
   (logos, icons) are skipped by size. */
function photosFrom(msg) {
  var out = [];
  var atts = [];
  try { atts = msg.getAttachments({ includeInlineImages: true, includeAttachments: true }); } catch (e) { return out; }
  for (var i = 0; i < atts.length && out.length < MAX_PHOTOS; i++) {
    var a = atts[i];
    var type = String(a.getContentType() || "").toLowerCase();
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].indexOf(type) < 0) continue;
    var size = a.getSize();
    if (size < MIN_PHOTO_BYTES || size > MAX_PHOTO_BYTES) continue;
    out.push({ mediaType: type, data: Utilities.base64Encode(a.getBytes()) });
  }
  return out;
}

/* Creates the label the first time it is needed. */
function labelNamed(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/* Run this by hand once from the editor to check the setup. It does the
   same thing as the trigger, and tells you what happened. */
function testOnce() {
  if (SECRET.indexOf("paste-the-same-value") === 0) {
    throw new Error("Set SECRET at the top of the script to the same value as INGEST_SECRET in Vercel.");
  }
  var result = checkForLeads();
  Logger.log("---- result ----\n" + result);
  return result;
}

/* If you ever want to start over: removes the labels so previously
   filed emails become eligible again. Filing them will create fresh
   drafts, so only use this deliberately. */
function resetLabels() {
  [LABEL_DONE, LABEL_FAILED].forEach(function (n) {
    var l = GmailApp.getUserLabelByName(n);
    if (l) l.deleteLabel();
  });
  Logger.log("Labels removed.");
}
