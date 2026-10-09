/* Builds the S-I-Quotespro website (site/index.html) from site/src/home.html.
   node site/build-site.js            -> site/index.html (served on s-i-quotespro.com/)
   node site/build-site.js --preview  -> a self-contained copy with images inlined */
const fs = require("fs"), path = require("path");
const dir = __dirname;
const preview = process.argv.includes("--preview");
let src = fs.readFileSync(path.join(dir, "src/home.html"), "utf8");
const LIVE = "https://www.s-i-quotespro.com";
src = src.replace(/\{\{APP\}\}/g, preview ? LIVE : "").replace(/\{\{API\}\}/g, preview ? LIVE : "");
src = src.replace(/\{\{IMG:([\w-]+)\}\}/g, (_, n) => preview
  ? "data:image/jpeg;base64," + fs.readFileSync(path.join(dir, "img", n + ".jpg")).toString("base64")
  : "/site/img/" + n + ".jpg");
const poster = preview ? "data:image/jpeg;base64," + fs.readFileSync(path.join(dir, "img/tutorial-poster.jpg")).toString("base64") : "/site/img/tutorial-poster.jpg";
src = src.replace("{{VIDEO}}", preview
  ? `<a class="video" href="${LIVE}/#help" style="display:block"><img src="${poster}" alt="Video: how to sign up and connect Thumbtack"></a><p style="font-size:14px;color:var(--muted);margin-top:8px">Watch the 1-minute sign-up and Thumbtack video on s-i-quotespro.com.</p>`
  : `<div class="video"><video controls playsinline preload="none" poster="${poster}"><source src="/site/media/tutorial.mp4" type="video/mp4"></video></div><p style="font-size:14px;color:var(--muted);margin-top:8px">1-minute video: signing up and connecting Thumbtack.</p>`);
let out;
if (preview) out = src;
else {
  const cut = src.indexOf("</style>") + "</style>".length;
  out = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#0B1F3A">\n<link rel="icon" href="/icons/icon-192.png">\n<meta property="og:title" content="S-I-Quotespro · Fast quotes and leads winner">\n<meta property="og:description" content="AI turns your Thumbtack, Angi and email leads and job photos into branded quotes in minutes. 14 days free.">\n<meta property="og:image" content="${LIVE}/site/img/manphone.jpg">\n<meta property="og:url" content="${LIVE}/">\n` + src.slice(0, cut) + "\n</head>\n<body>\n" + src.slice(cut) + "\n</body>\n</html>\n";
}
const dest = preview ? process.argv[process.argv.indexOf("--preview") + 1] || path.join(dir, "preview.html") : path.join(dir, "index.html");
fs.writeFileSync(dest, out);
if (!preview) fs.writeFileSync(path.join(dir, "..", "index.html"), out); // s-i-quotespro.com/ is the website
console.log("wrote", dest, (out.length / 1024).toFixed(0) + " KB");
