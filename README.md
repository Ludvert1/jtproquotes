# JTProQuotes

Quoting platform for **JTProconstruction LLC**. Crew-based pricing, owner review and approval, client-ready quote documents.

Live site: _(add your Vercel URL here after the first deploy)_

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

**Owner**

- Sees every quote from every associate
- Approves, requests changes, marks quotes sent / won / declined
- Manages the team, deactivates accounts, sets the team join code
- Sets labor rate, overhead and target margin
- Reads the full activity log

**Associate**

- Sees only their own quotes
- Can edit their work while it is a draft, pending review, or sent back for changes
- Loses edit access the moment a quote is approved
- Cannot see pricing settings, other people's quotes, or the activity log

Nobody — including the Owner — can delete a quote. This is enforced in the database rules, not just the interface.

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
- Quote documents print to PDF from the browser (Ctrl/Cmd + P). Unapproved quotes carry a **DRAFT · NOT APPROVED** watermark and cannot be printed clean.
- If something isn't saving in cloud mode, open the browser console (F12). Permission problems from the database rules are logged there with a `[JTProQuotes]` prefix.
