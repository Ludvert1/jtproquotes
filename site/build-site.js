/* Builds the S-I-Quotespro website from site/src/home.html in three languages.
   node site/build-site.js            -> index.html (EN, served at /), es/index.html (/es), fr/index.html (/fr)
   node site/build-site.js --preview  -> a self-contained English copy with images inlined
   Translations live in site/i18n/{es,fr}.json (English text -> translation) and meta.json (JS strings).
   Regenerate them with python3 site/i18n/gen.py. The build stops if any English text has no translation. */
const fs = require("fs"), path = require("path");
const dir = __dirname;
const preview = process.argv.includes("--preview");
const LIVE = "https://www.s-i-quotespro.com";
const LANGS = [["en", "EN", "/"], ["es", "ES", "/es/"], ["fr", "FR", "/fr/"]];
const meta = JSON.parse(fs.readFileSync(path.join(dir, "i18n/meta.json"), "utf8"));
const keep = new Set(meta.keep);
const dict = { es: JSON.parse(fs.readFileSync(path.join(dir, "i18n/es.json"), "utf8")), fr: JSON.parse(fs.readFileSync(path.join(dir, "i18n/fr.json"), "utf8")) };
const OG = {
  en: ["S-I-Quotespro · Fast quotes and leads winner", "AI turns your Thumbtack, Angi and email leads and job photos into branded quotes in minutes. Start free with 7 quotes on us."],
  es: ["S-I-Quotespro · Cotiza rápido y gana clientes", "La IA convierte tus clientes de Thumbtack, Angi y correo, y tus fotos del trabajo, en cotizaciones con tu marca en minutos. Empieza gratis con 7 cotizaciones de regalo."],
  fr: ["S-I-Quotespro · Des devis rapides, des clients gagnés", "L'IA transforme vos clients de Thumbtack, d'Angi et du courriel, ainsi que vos photos de chantier, en devis à vos couleurs en quelques minutes. Essai gratuit avec 7 devis offerts."],
};
const TRAIN_ALT = { en: "Full walkthrough video", es: "Video con el recorrido completo", fr: "Vidéo de la visite guidée complète" };

function translate(src, lang) {
  if (lang === "en") return src;
  const d = dict[lang], missing = [];
  const tr = (raw) => {
    const t = raw.trim();
    if (!t || !/[A-Za-z]{2}/.test(t) || keep.has(t) || /^\{\{.*\}\}$/.test(t)) return raw;
    if (d[t] === undefined) { missing.push(t); return raw; }
    return raw.replace(t, () => d[t]);
  };
  const parts = src.split(/(<script>[\s\S]*?<\/script>|<style>[\s\S]*?<\/style>)/);
  const out = parts.map((p) => {
    if (p.startsWith("<script>") || p.startsWith("<style>")) return p;
    p = p.replace(/>([^<>]+)(?=<)/g, (m, txt) => ">" + tr(txt));
    p = p.replace(/\b(alt|placeholder|aria-label|title|content)="([^"]*)"/g, (m, k, v) => (/[A-Za-z]{3}/.test(v) && !keep.has(v.trim()) && d[v.trim()] !== undefined) ? `${k}="${d[v.trim()].replace(/"/g, "&quot;")}"` : (/[A-Za-z]{3}/.test(v) && !/^[#\w\-.,;=\/: ]*$/.test(v) && d[v.trim()] === undefined && !keep.has(v.trim()) ? (missing.push(v), m) : m));
    return p;
  });
  if (missing.length) { console.error("Missing " + lang + " translations:\n - " + [...new Set(missing)].join("\n - ")); process.exit(1); }
  return out.join("");
}

function build(lang, prev) {
  let src = fs.readFileSync(path.join(dir, "src/home.html"), "utf8");
  src = translate(src, lang);
  // JS strings, as JSON literals
  src = src.replace(/\{\{J:(\w+)\}\}/g, (_, k) => JSON.stringify(meta.js[k][lang]));
  src = src.replace(/\{\{APP\}\}/g, prev ? LIVE : "").replace(/\{\{API\}\}/g, prev ? LIVE : "");
  src = src.replace(/\{\{IMG:([\w-]+)\}\}/g, (_, n) => prev
    ? "data:image/jpeg;base64," + fs.readFileSync(path.join(dir, "img", n + ".jpg")).toString("base64")
    : "/site/img/" + n + ".jpg");
  src = src.replace("{{LANGS}}", LANGS.map(([c, label, href]) => `<a href="${prev ? LIVE + href : href}" hreflang="${c}" lang="${c}"${c === lang ? ' class="on" aria-current="true"' : ""}>${label}</a>`).join(""));
  const poster = prev ? "data:image/jpeg;base64," + fs.readFileSync(path.join(dir, "img/tutorial-poster.jpg")).toString("base64") : "/site/img/tutorial-poster.jpg";
  const tvid = `/site/media/training-${lang}.mp4`;
  src = src.replace("{{TRAINING}}", prev
    ? `<a class="video" href="${LIVE}/#learn" style="display:block"><img src="${poster}" alt="${TRAIN_ALT[lang]}"></a>`
    : `<div class="video" style="max-width:960px"><video controls playsinline preload="none"><source src="${tvid}" type="video/mp4"></video></div>`);
  src = src.replace("{{VIDEO}}", prev
    ? `<a class="video" href="${LIVE}/#help" style="display:block"><img src="${poster}" alt="Video: how to sign up and connect Thumbtack"></a>`
    : `<div class="video"><video controls playsinline preload="none" poster="${poster}"><source src="/site/media/tutorial.mp4" type="video/mp4"></video></div>`);
  if (prev) return src;
  const cut = src.indexOf("</style>") + "</style>".length;
  const url = LIVE + LANGS.find((l) => l[0] === lang)[2];
  const alts = LANGS.map(([c, , h]) => `<link rel="alternate" hreflang="${c}" href="${LIVE + h}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${LIVE}/">`;
  return `<!doctype html>\n<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#0B1F3A">\n<link rel="icon" href="/icons/icon-192.png">\n<link rel="canonical" href="${url}">\n${alts}\n<meta property="og:title" content="${OG[lang][0]}">\n<meta property="og:description" content="${OG[lang][1]}">\n<meta property="og:image" content="${LIVE}/site/img/manphone.jpg">\n<meta property="og:url" content="${url}">\n<meta property="og:locale" content="${{ en: "en_US", es: "es_US", fr: "fr_CA" }[lang]}">\n` + src.slice(0, cut) + "\n</head>\n<body>\n" + src.slice(cut) + "\n</body>\n</html>\n";
}

if (preview) {
  const dest = process.argv[process.argv.indexOf("--preview") + 1] || path.join(dir, "preview.html");
  fs.writeFileSync(dest, build("en", true)); console.log("wrote", dest);
} else {
  for (const [lang] of LANGS) {
    const html = build(lang, false);
    if (lang === "en") { fs.writeFileSync(path.join(dir, "index.html"), html); fs.writeFileSync(path.join(dir, "..", "index.html"), html); }
    else { for (const base of [path.join(dir, "..", lang)]) { fs.mkdirSync(base, { recursive: true }); fs.writeFileSync(path.join(base, "index.html"), html); } }
    console.log("wrote", lang, (html.length / 1024).toFixed(0) + " KB");
  }
}
