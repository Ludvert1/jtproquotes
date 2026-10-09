/* ============================================================
   S-I-Quotespro — Thumbtack lead connector (Google Apps Script)

   Watches your Gmail for new Thumbtack lead emails (and Angi /
   HomeAdvisor / Yelp / Bark ones too). Each lead becomes an
   AI-drafted quote in S-I-Quotespro, with a reply written for the
   customer and a phone alert to you.

   Runs inside your own Google account. No password is shared with
   anyone, and you can stop it any time (see the bottom of this file).

   SETUP — the S-I-Quotespro app fills in the two lines below for you
   when you press "Copy my lead script". Then:
     1. Go to script.google.com → New project.
     2. Delete everything in the editor and paste this whole script.
     3. Click Save (disk icon).
     4. In the menu next to "Debug", choose  setup  and click Run.
     5. Google asks you to allow access → choose your account →
        Advanced → Go to project → Allow.
   Done. It now checks for new leads every 5 minutes.
============================================================ */

var ENDPOINT = "PASTE_ENDPOINT_HERE";
var COMPANY_KEY = "PASTE_COMPANY_KEY_HERE";

// Which emails count as leads. Marketing and billing mail is skipped.
var SEARCHES = [
  'from:thumbtack.com newer_than:2d -label:SIQ-Filed -subject:(receipt OR invoice OR weekly OR tips OR budget OR payment OR review)',
  '(from:angi.com OR from:homeadvisor.com) newer_than:2d -label:SIQ-Filed -subject:(receipt OR invoice OR payment)',
  '(from:yelp.com subject:(request OR quote)) newer_than:2d -label:SIQ-Filed',
  '(from:bark.com subject:(lead OR request)) newer_than:2d -label:SIQ-Filed',
];

var LABEL_DONE = "SIQ-Filed";
var LABEL_FAILED = "SIQ-Failed";
var MAX_PER_RUN = 10;
var MAX_PHOTOS = 4, MIN_PHOTO_BYTES = 15000, MAX_PHOTO_BYTES = 800000;

/* Run this once. It checks the connection and starts the 5-minute timer. */
function setup() {
  if (ENDPOINT.indexOf("http") !== 0 || COMPANY_KEY.indexOf(".") < 0) {
    throw new Error("Paste the script from S-I-Quotespro → Settings → Lead inbox (Copy my lead script) — the two lines at the top are not filled in.");
  }
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "checkForLeads") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("checkForLeads").timeBased().everyMinutes(5).create();
  var result = checkForLeads();
  Logger.log("Connected. Checking for new leads every 5 minutes.\n" + result);
  return result;
}

/* The timer calls this. */
function checkForLeads() {
  var done = labelNamed(LABEL_DONE), failed = labelNamed(LABEL_FAILED);
  var handled = 0, report = [];
  for (var s = 0; s < SEARCHES.length; s++) {
    var threads = GmailApp.search(SEARCHES[s], 0, MAX_PER_RUN);
    for (var t = 0; t < threads.length && handled < MAX_PER_RUN; t++) {
      var msgs = threads[t].getMessages();
      var msg = msgs[msgs.length - 1];
      handled++;
      var outcome = fileOneLead(msg);
      report.push(outcome.line);
      threads[t].addLabel(outcome.ok ? done : failed);
    }
  }
  var summary = handled === 0 ? "No new leads." : report.join("\n");
  Logger.log(summary);
  return summary;
}

function fileOneLead(msg) {
  var subject = msg.getSubject() || "";
  var payload = {
    companyKey: COMPANY_KEY,
    subject: subject,
    from: msg.getFrom() || "",
    text: (msg.getPlainBody() || "").slice(0, 18000),
    messageId: msg.getId(),
    receivedAt: msg.getDate().toISOString(),
    leadUrl: leadLinkFrom(msg),
    images: photosFrom(msg)
  };
  try {
    var res = UrlFetchApp.fetch(ENDPOINT, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var code = res.getResponseCode(), text = res.getContentText();
    if (code !== 200) return { ok: false, line: "FAILED (" + code + ") " + subject.slice(0, 60) + " — " + text.slice(0, 160) };
    var out = {};
    try { out = JSON.parse(text); } catch (e) {}
    if (out.duplicate) return { ok: true, line: "ALREADY FILED " + (out.quoteNo || "") + " — " + subject.slice(0, 60) };
    var extra = "";
    // Reply by email when the lead includes the customer's own address.
    if (out.reply && out.clientEmail) {
      var subj = out.replySubject || "Your project quote";
      try {
        if (out.autoReply) { GmailApp.sendEmail(out.clientEmail, subj, out.reply); extra = " · reply emailed to the customer"; }
        else { GmailApp.createDraft(out.clientEmail, subj, out.reply); extra = " · reply waiting in Gmail Drafts"; }
      } catch (e) { extra = " · couldn't prepare the email: " + e.message; }
    }
    return { ok: true, line: "FILED " + (out.quoteNo || "") + (out.range ? " " + out.range : "") + " — " + subject.slice(0, 60) + extra };
  } catch (e) {
    return { ok: false, line: "FAILED (network) " + subject.slice(0, 60) + " — " + e.message };
  }
}

function leadLinkFrom(msg) {
  var html = "";
  try { html = msg.getBody() || ""; } catch (e) { return ""; }
  var links = html.match(/href="(https:\/\/[^"]*thumbtack\.com[^"]*)"/gi) || [];
  var best = "";
  for (var i = 0; i < links.length; i++) {
    var u = links[i].replace(/^href="/i, "").replace(/"$/, "").replace(/&amp;/g, "&");
    if (/unsubscribe|settings|privacy|terms|help|preferences|app-store|play\.google/i.test(u)) continue;
    if (/lead|request|message|inbox|conversation|reply|view/i.test(u)) return u;
    if (!best) best = u;
  }
  return best;
}

function photosFrom(msg) {
  var out = [], atts = [];
  try { atts = msg.getAttachments({ includeInlineImages: true, includeAttachments: true }); } catch (e) { return out; }
  for (var i = 0; i < atts.length && out.length < MAX_PHOTOS; i++) {
    var a = atts[i], type = String(a.getContentType() || "").toLowerCase();
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].indexOf(type) < 0) continue;
    var size = a.getSize();
    if (size < MIN_PHOTO_BYTES || size > MAX_PHOTO_BYTES) continue;
    out.push({ mediaType: type, data: Utilities.base64Encode(a.getBytes()) });
  }
  return out;
}

function labelNamed(name) { return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name); }

/* To stop the connector: choose  stopConnector  and click Run. */
function stopConnector() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log("Stopped. No more leads will be filed until you run setup again.");
}
