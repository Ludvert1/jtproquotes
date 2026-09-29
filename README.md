# JTProQuotes

Quoting platform for **JTProconstruction LLC**. Crew-based pricing, owner review and approval, client-ready quote documents.

Live at **https://quotes.jtproconstruction.com** (also on `jtproquotes.vercel.app`).

Hosted on Vercel, data in Firebase (project `jtproquotes`). Pushing to
`main` redeploys automatically.

---

## How it works

The app is a single static page. No server, no build step on Vercel — it deploys as plain files.

It runs in one of two modes, decided by `config.js`:

| Mode | When | Behaviour |
| --- | --- | --- |
| **Offline** | `apiKey` in `config.js` is blank | PIN sign-in, data stored in that browser only. Each device is separate. Good for trying it out. |
| **Cloud** | `apiKey` is filled in | Email/password sign-in, one shared Firestore database for the whole team. |

---

## Files

| File | What it is |
| --- | --- |
| `index.html` | The built app that Vercel serves. **Generated — do not edit by hand.** |
| `config.js` | Firebase settings and the owner's email. The one file you edit to go live. |
| `firestore.rules` | Database security rules. Paste these into Firebase. |
| `src/scope-templates.js` | Standard scope steps and exclusions — shared by the app and the AI. Edit here, then `npm run build`. |
| `api/_push.js` | Phone notifications (Web Push). Key comes from the environment. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Make the app installable and receive phone alerts. |
| `api/img.js` | Serves quote photos from this site so they can be drawn into PDFs. |
| `storage.rules` | Rules for the lead screenshots. Paste these into Firebase Storage. |
| `api/_lib.js` | Shared server helpers. Not reachable from the web (Vercel ignores `_` files). |
| `api/ai-quote.js` | Drafts a full quote from job photos and/or a lead. Holds no secrets. |
| `api/read-lead.js` | Reads a lead screenshot. Holds no secrets — keys come from the environment. |
| `api/notify.js` | Emails the approvers when an associate submits a quote. |
| `api/ingest-lead.js` | Turns a lead email into a draft quote. Called by the Gmail script. |
| `integrations/gmail-thumbtack.gs` | Google Apps Script that watches Gmail for leads. Setup steps are in the file. |
| `src/app.jsx` | The app source. Edit this, then run `npm run build`. |
| `src/index.template.html` | Page shell (fonts, styles, script tags). |
| `build.js` | Compiles `src/app.jsx` into `index.html`. |
| `vercel.json` | Caching and security headers. |

---

## Deploying to Vercel

1. Push this folder to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Framework preset: **Other**. Leave build command and output directory **blank** — it's a static site.
4. Deploy.

Every push to `main` redeploys automatically.

---

## AI quotes from photos and leads

On a new quote, the **AI quote from photos or a lead** panel sits above the
client fields.

1. **📷 Take photo** opens the phone camera; **Upload photos** picks from the
   gallery (up to 8). Paste or drag images on desktop.
2. Paste the customer's Thumbtack message and add your own notes.
3. **Detect work & draft quote.** In 20–60 seconds you get:
   - **What it found** — each issue, tied to the photo that shows it, marked
     urgent / recommended / cosmetic
   - the **scope of work**: every standard step for that job type is ticked
     (and tailored to this job) or unticked if it doesn't apply, plus
     job-specific steps the template doesn't cover. Irrelevant "Not included"
     lines are unticked too.
   - **crew and days**, with the reasoning
   - **materials at contractor cost**, itemised with quantities and units
   - the **sizes the price rests on**, each labelled *customer stated*,
     *estimated from photo* or *assumed*
   - **questions to ask the client**, internal assumptions and risks
   - a **first reply** to the customer with a price range
4. **Use this draft** fills the quote instantly and opens the client-ready
   preview. Photos are kept on the quote as small copies straight away (so they
   show even without Firebase Storage); full-size originals upload to Storage
   in the background when it's set up.
5. **Approve & create PDF** (owner/assistant) approves and opens the finished
   quote. **Download PDF** saves a real PDF file; on a phone, **Share PDF** sends
   it straight to Messages, WhatsApp, email or Thumbtack.

**The AI never sets the price.** It sizes labor and lists materials at cost;
the quote's own labor rate, overhead and margin produce the total, exactly
as for a hand-built quote. The reply's `{{PRICE_RANGE}}` is filled from that
total (±5–30% depending on confidence), so the reply always matches the quote.

Everything it produces is a draft and still goes through approval. For an
associate, copying/sending the reply unlocks only after approval — it carries
a price.

**Just fill client details** is the cheaper, narrower path: it only copies the
client's details out of a lead screenshot.

### Switching it on

1. Get an API key from [console.anthropic.com](https://console.anthropic.com).
2. In Vercel: **Project → Settings → Environment Variables**, add
   `ANTHROPIC_API_KEY` with that key, for all environments. Redeploy.
3. Optional — full-size photo originals: Firebase Console → **Storage** → Get
   started (new projects need the Blaze pay-as-you-go plan for this; usage at
   this size is normally within the free tier), then **Rules** → paste
   `storage.rules` → Publish. Without it, quotes keep small photo copies.

Optional environment variables: `QUOTE_MODEL` for the drafting model
(default `claude-sonnet-5`), `CLAUDE_MODEL` for the lead reader,
`FIREBASE_API_KEY` and `FIREBASE_PROJECT_ID` if the project ever moves.

Until `ANTHROPIC_API_KEY` is set, the panel is there but returns a
message saying it isn't switched on. Everything else works as before.

**The key never goes in `config.js` or anywhere under `src/`.** This repository
is readable and anything in the app's JavaScript can be read by anyone and used
to spend your credit. `api/read-lead.js` is the only code that sees the key, it
runs on Vercel's server, and it refuses anyone who isn't a signed-in, approved
team member — so an outsider cannot run up a bill on it.

Rough cost: a few cents per drafted quote with photos; a fraction of a cent
per plain lead read.

---

## Being told when a quote needs approving

**Phone alerts** (sound, vibration, lock-screen banner, a number on the app
icon — even with the app closed):

| Event | Who is alerted |
| --- | --- |
| Associate submits a quote | Owner + assistants (also by email) |
| Quote approved / sent back | The associate who wrote it |
| New Thumbtack lead drafted | Owner + assistants |

Each person turns it on once per device with **🔔 Turn on alerts** in the top
bar, then **Allow**. On **iPhone** Apple only allows this from the Home Screen
app: Safari → Share → **Add to Home Screen**, open JTProQuotes from that icon,
then tap Turn on alerts. Android (Chrome) and computers (Chrome/Edge) work
straight from the browser. **Send test alert** checks it end to end.

Switching it on (once): in Vercel add `VAPID_PRIVATE_KEY` (the value is in
`VAPID-PRIVATE-KEY-for-Vercel.txt` in the project folder — never committed),
redeploy, and paste the updated `firestore.rules` into Firebase → Firestore →
Rules → Publish. The matching public key is in `config.js`; change both
together. Built on standard Web Push, no extra service or package.

While the app is open you also get a chime, the count in the tab title, and a toast.

### Switching the email on

Web3Forms delivers to whatever address an access key belongs to, and copying in
extra people is a paid feature there. So the free way to reach the assistants is
**one access key per person**:

1. At [web3forms.com](https://web3forms.com), create an access key for each
   person who should be told — your address, then each assistant's.
2. In Vercel, add `WEB3FORMS_KEYS` with the keys separated by commas:
   `abc-123,def-456`. Redeploy.

If you ever go PRO with Web3Forms you can instead set `WEB3FORMS_CC` to a
comma-separated list of addresses and use a single key.

With `WEB3FORMS_KEYS` unset, submitting works exactly as it always did and no
email is attempted.

---

## Thumbtack leads, drafted and answered automatically

Thumbtack's own API is only open to approved software partners, so JTProQuotes
connects through your Gmail instead: `integrations/gmail-thumbtack.gs` is a
Google Apps Script that checks for Thumbtack lead emails every 15 minutes.

For each lead it:

- drafts a **full priced quote** — scope, crew, materials, findings, questions —
  using any photos attached to the email, filed as a draft under your account
  and tagged **FROM A LEAD EMAIL — AI-drafted** in the quote list
- emails you (and assistants, via Web3Forms) the draft price range, the
  questions to ask, and a **reply ready to paste into Thumbtack**
- if the customer's email address is in the lead, leaves a **Gmail draft** to
  them in your Drafts folder

Nothing is ever sent to a customer automatically. If the AI draft fails for
any reason, the lead is still filed as an unpriced draft so it is never lost.

### Setting it up

1. Forward info@jtproconstruction.com to ludvert@gmail.com (Hostinger → Emails → Forwarders).
2. In script.google.com (as ludvert@gmail.com) follow the setup comment at the top of
   `integrations/gmail-thumbtack.gs` — paste it, paste `integrations/appsscript.json`
   as the manifest, run `testOnce`, add a 5-minute trigger.

No shared secret: the script proves who it is with its Google sign-in and the
server only accepts leads from the inboxes in `INGEST_EMAILS` (default
ludvert@gmail.com, info@jtproconstruction.com). Needs `FIREBASE_SERVICE_ACCOUNT`
in Vercel. The old `INGEST_SECRET` header still works if you prefer it.

### The first message

The AI writes a short, specific first message built to win the job: their
project named in the first line, how we'd tackle it, **"projects like yours
start at $X"** (the low end of the estimate), a clear note that the final price
is confirmed at the on-site visit and can go up depending on what's found, why
JTPro (licensed & insured, itemized quote, 90-day warranty), at most two
questions, and a call to book the walk-through. The alert on your phone opens
the quote; **Copy & open this lead** copies it and jumps straight to that lead
in Thumbtack.

Thumbtack only lets approved partner software post into its inbox. For an
instant automatic first touch, set Thumbtack's own **Settings → Auto
responses**; the personalized AI reply follows within minutes.

---

## Going live for the team (Firebase)

Until you do this, everyone's data lives only on their own device.

1. Create a free project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database →** start in production mode.
4. **Firestore → Rules →** replace everything with the contents of `firestore.rules`, then **Publish**.
5. **Project settings (gear icon) → Your apps → Web (`</>`)** → register an app → copy the `firebaseConfig` values.
6. Paste those values into `config.js`, and set `ownerEmail` to the address that should have Owner rights.
7. **Authentication → Settings → Authorized domains →** add your Vercel domain (e.g. `jtproquotes.vercel.app`).
8. Commit and push. Vercel redeploys in about a minute.

The first person to register with the `ownerEmail` address becomes the Owner. Everyone else becomes an associate.

> **On secrecy:** the values in `config.js` are *not* secrets. Firebase web keys are designed to be public — they identify your project, they don't grant access. Access is controlled entirely by `firestore.rules`. This is why the repository can safely be public.

---

## Who can do what

| | Owner | Assistant | Associate |
| --- | :---: | :---: | :---: |
| See every quote | ✓ | ✓ | own only |
| Approve / send back / mark outcomes | ✓ | ✓ | — |
| Void and restore quotes | ✓ | ✓ | — |
| Approve new signups | ✓ | ✓ | — |
| Read the activity log | ✓ | ✓ | — |
| Promote, deactivate, remove people | ✓ | — | — |
| Permanently delete a quote | ✓ | — | — |
| Edit labor rate, overhead, margin | ✓ | — | — |

Associates can edit their own work while it is a draft, pending review, or
sent back for changes, and lose edit access the moment it is approved.

All of this is enforced in `firestore.rules`, not just hidden in the
interface — an unapproved or under-privileged account is refused by the
database itself.

### Accounts need approval

New signups are created inactive. Until the owner or an assistant approves
them they can read nothing at all — no quotes, no pricing, not even the team
list — and see only a waiting screen. Approval unlocks their browser live.

**Decline** locks someone out permanently while keeping their login.
**Remove** deletes the profile but *not* the Firebase login, so a removed
person could sign up again and reappear in the queue. Use Decline to block,
Remove only to tidy up.

### Void vs delete

**Void** marks a quote dead with a reason. It drops out of every money
figure, can never be printed, shows greyed and struck through — but the
record survives, which matters if a client ever disputes what you quoted.
Reversible with **Restore**.

**Delete forever** erases the quote from the database. Owner only, double
confirmed, and only reachable from the voided list.

### Team join code

If "require team code" is on in Settings, the code rotates automatically
every time the queue is cleared, so in practice each code admits one person
and then dies. There is also a **Rotate now** button in Team & review.

Rotation happens when a manager clears the queue, not at the instant of
signup — if two people sign up before anyone is approved, the same code
works for both. Closing that gap requires a server-side function on
Firebase's paid plan.

---

## Editing the app

```bash
npm install      # once
# edit src/app.jsx
npm run build    # regenerates index.html
git commit -am "..." && git push
```

To preview locally: `npm start`, then open <http://localhost:3000>.

Changing `config.js` does **not** require a rebuild — it's loaded directly by the page.

---

## Notes

- The site is set to `noindex` so it won't appear in search results.
- `quotes.jtproconstruction.com` is a CNAME to `cname.vercel-dns.com` in
  Cloudflare. Cloudflare caches `config.js` for 4 hours regardless of what
  Vercel asks — purge the Cloudflare cache after changing Firebase settings.
- Unapproved quotes carry a watermark stamped with the quote number, the
  viewer's name and a timestamp, tiled across the page, so a leaked
  screenshot traces back to whoever had it open. Screenshots cannot be
  blocked in a browser; this is deterrence by attribution.
- Quote documents print to PDF from the browser (Ctrl/Cmd + P). Unapproved quotes carry a **DRAFT · NOT APPROVED** watermark and cannot be printed clean.
- If something isn't saving in cloud mode, open the browser console (F12). Permission problems from the database rules are logged there with a `[JTProQuotes]` prefix.
