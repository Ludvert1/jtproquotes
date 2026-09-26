/* ============================================================
   JTProQuotes — Gmail lead watcher (Google Apps Script)

   Checks your Gmail for new lead emails and files each one as a draft
   quote in JTProQuotes. Runs on Google's servers as you, so it needs
   no Google Cloud project, no OAuth app, and no password anywhere.

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
  'from:thumbtack.com newer_than:2d -label:JTPQ-Filed',
  // Add more as you need them, one per line, each in quotes and comma-ended:
  // 'from:angi.com newer_than:2d -label:JTPQ-Filed',
  // 'subject:"new quote request" newer_than:2d -label:JTPQ-Filed',
];
// -------------------------------------------------------------

var LABEL_DONE = "JTPQ-Filed";
var LABEL_FAILED = "JTPQ-Failed";
var MAX_PER_RUN = 10; // a safety net — a flooded inbox can't run up a bill

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
    receivedAt: msg.getDate().toISOString()
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
      return { ok: true, line: "FILED  " + (out.quoteNo || "?") + "  —  " + subject.slice(0, 60) };
    }
    return { ok: false, line: "FAILED (" + code + ")  " + subject.slice(0, 60) + "  —  " + text.slice(0, 160) };
  } catch (e) {
    return { ok: false, line: "FAILED (network)  " + subject.slice(0, 60) + "  —  " + e.message };
  }
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
