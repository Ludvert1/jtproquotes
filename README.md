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
| `storage.rules` | Rules for the lead screenshots. Paste these into Firebase Storage. |
| `api/_lib.js` | Shared server helpers. Not reachable from the web (Vercel ignores `_` files). |
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

## Reading a lead from a screenshot

On a new quote there is a **Read a lead from a screenshot** panel above the
client fields. Paste a Thumbtack, Facebook or text-message enquiry — as an
image, as text, or both — and it fills in the client details, job title,
description and a set of suggested scope lines, then keeps the screenshot on
the quote as the record of what was asked for.

It is deliberately narrow about two things:

- **It reports only what is written.** A field that isn't in the screenshot is
  left blank and listed under "you'll need to fill these in", rather than
  guessed at.
- **It never measures.** Square footage cannot be read off a photograph. Sizes
  the customer stated in words are copied into the estimator's notes, marked as
  the customer's words, and never touch the pricing. Measurements come from the
  tape.

Everything it produces is a draft that still goes through the normal approval.

### Switching it on

1. Get an API key from [console.anthropic.com](https://console.anthropic.com).
2. In Vercel: **Project → Settings → Environment Variables**, add
   `ANTHROPIC_API_KEY` with that key, for all environments. Redeploy.
3. In Firebase Console → **Storage** → Get started (if you haven't already),
   then **Rules** → paste `storage.rules` → Publish.

Optional environment variables: `CLAUDE_MODEL` to change the model,
`FIREBASE_API_KEY` and `FIREBASE_PROJECT_ID` if the project ever moves.

Until `ANTHROPIC_API_KEY` is set, the panel is there but reading returns a
message saying it isn't switched on. Everything else works as before.

**The key never goes in `config.js` or anywhere under `src/`.** This repository
is readable and anything in the app's JavaScript can be read by anyone and used
to spend your credit. `api/read-lead.js` is the only code that sees the key, it
runs on Vercel's server, and it refuses anyone who isn't a signed-in, approved
team member — so an outsider cannot run up a bill on it.

Rough cost: a fraction of a cent per lead read.

---

## Being told when a quote needs approving

Three things happen the moment an associate submits:

- **The tab title** shows the count — `(2) JTProQuotes` — so an open tab tells
  you without being looked at.
- **A toast** appears if you already have the app open, because the quote list
  is a live listener.
- **An email** goes to everyone who can approve, which is the part that reaches
  you when the app is closed.

Only a real submission sends mail. Saved drafts, autosaves, and a manager
approving their own work do not. The email is composed on the server from the
stored quote, not from anything the browser sends, and the total in it is
calculated with the same formula the app uses — so it always matches the screen.

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

## Filing Thumbtack leads automatically

`integrations/gmail-thumbtack.gs` is a Google Apps Script that checks your Gmail
every 15 minutes for lead emails, reads each one, and files it in JTProQuotes as
an **unpriced draft** under your account. It runs on Google's servers as you —
no Google Cloud project, no OAuth app, and your password never goes anywhere.

Drafts filed this way are tagged **FILED FROM A LEAD EMAIL — needs pricing** in
the quote list. Nothing is priced and nothing is sent; you open it, put real
numbers on it, and it goes through the same review as everything else.

### Setting it up

1. In Firebase Console → **Project settings → Service accounts → Generate new
   private key**. You get a JSON file.
2. In Vercel add these environment variables, then redeploy:
   - `FIREBASE_SERVICE_ACCOUNT` — the whole contents of that JSON file, pasted
     as one line.
   - `INGEST_SECRET` — any long random string you invent.
3. Open `integrations/gmail-thumbtack.gs`, follow the setup comment at the top
   (paste into script.google.com, set `ENDPOINT` and `SECRET`, run `testOnce`,
   add a 15-minute trigger).

The service-account key is a **real secret** — unlike the Firebase web key, it
bypasses your security rules. It belongs only in Vercel's environment
variables. Never put it in `config.js`, anywhere under `src/`, or in this
repository.

Add more lead sources by editing the `SEARCHES` list in the script — Angi,
Facebook, your website's form. They all get filed the same way. Processed
emails are labelled `JTPQ-Filed` so nothing is filed twice.

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
