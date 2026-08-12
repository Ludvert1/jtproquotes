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
