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
const PAGES = ["home", "how", "pricing", "help", "about"];
const PT = {
  how: { en: "How it works", es: "Cómo funciona", fr: "Comment ça marche" },
  pricing: { en: "Pricing", es: "Precios", fr: "Tarifs" },
  help: { en: "Help and contact", es: "Ayuda y contacto", fr: "Aide et contact" },
  about: { en: "About", es: "Nosotros", fr: "À propos" },
};
const langBase = (lang) => (lang === "en" ? "" : "/" + lang);
const pageUrl = (lang, page) => (page === "home" ? langBase(lang) + "/" : langBase(lang) + "/" + page);
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

function build(lang, prev, page = "home") {
  let src = fs.readFileSync(path.join(dir, "src/home.html"), "utf8");
  src = translate(src, lang);
  // keep only this page's sections (data-page="all" sections appear on every page)
  if (!prev) {
    src = src.replace(/<section data-page="(\w+)"([\s\S]*?)<\/section>\n?/g, (m, pg, rest) => (pg === page || pg === "all") ? "<section" + rest + "</section>\n" : "");
  } else {
    src = src.replace(/<section data-page="\w+"/g, "<section");
  }
  src = src.replace("{{MAINCLASS}}", page === "home" ? "" : "sub");
  src = src.replace(/\{\{P:(\w+)\}\}/g, (_, k) => (prev ? LIVE : "") + pageUrl(lang, k));
  const map = { "#how": "how", "#learn": "how#learn", "#pricing": "pricing", "#help": "help", "#contact": "help#contact", "#about": "about", "#reviews": "about#reviews" };
  const hm = {}; for (const [h, pg] of Object.entries(map)) hm[h] = langBase(lang) + "/" + pg;
  src = src.replace("{{HASHMAP}}", page === "home" && !prev ? `<script>(function(){var m=${JSON.stringify(hm)};var t=m[location.hash];if(t)location.replace(t)})();</script>` : "");
  if (!prev) {
    const cur = pageUrl(lang, page);
    src = src.replace(/(<a class="[^"]*?)("[^>]*href=")([^"#]*)"/g, (m, a, b, h) => (page !== "home" && h === cur ? a + " on" + b + h + '" aria-current="page"' : m));
  }
  // JS strings, as JSON literals
  src = src.replace(/\{\{J:(\w+)\}\}/g, (_, k) => JSON.stringify(meta.js[k][lang]));
  src = src.replace(/\{\{APP\}\}/g, prev ? LIVE : "").replace(/\{\{API\}\}/g, prev ? LIVE : "");
  src = src.replace(/\{\{IMG:([\w-]+)\}\}/g, (_, n) => prev
    ? "data:image/jpeg;base64," + fs.readFileSync(path.join(dir, "img", n + ".jpg")).toString("base64")
    : "/site/img/" + n + ".jpg");
  src = src.split("{{L}}").join(lang);
  src = src.replace("{{LANGS}}", LANGS.map(([c, label]) => { const href = pageUrl(c, page); return `<a href="${prev ? LIVE + href : href}" hreflang="${c}" lang="${c}"${c === lang ? ' class="on" aria-current="true"' : ""}>${label}</a>`; }).join(""));
  const poster = prev ? "data:image/jpeg;base64," + fs.readFileSync(path.join(dir, "img/tutorial-poster.jpg")).toString("base64") : "/site/img/tutorial-poster.jpg";
  const tvid = `/site/media/training-${lang}.mp4`;
  src = src.replace("{{TRAINING}}", prev
    ? `<a class="video" href="${LIVE}/how#learn" style="display:block"><img src="${poster}" alt="${TRAIN_ALT[lang]}"></a>`
    : `<div class="video" style="max-width:960px"><video controls playsinline preload="none"><source src="${tvid}" type="video/mp4"></video></div>`);
  src = src.replace("{{VIDEO}}", prev
    ? `<a class="video" href="${LIVE}/help" style="display:block"><img src="${poster}" alt="Video: how to sign up and connect Thumbtack"></a>`
    : `<div class="video"><video controls playsinline preload="none" poster="${poster}"><source src="/site/media/tutorial.mp4" type="video/mp4"></video></div>`);
  if (prev) return src;
  src = src.replace(/<title>[\s\S]*?<\/title>/, "");
  const cut = src.indexOf("</style>") + "</style>".length;
  const url = LIVE + pageUrl(lang, page);
  const alts = LANGS.map(([c]) => `<link rel="alternate" hreflang="${c}" href="${LIVE + pageUrl(c, page)}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${LIVE + pageUrl("en", page)}">`;
  const ptitle = page === "home" ? OG[lang][0] : PT[page][lang] + " · S-I-Quotespro";

  return `<!doctype html>\n<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#0B1F3A">\n<link rel="icon" href="/icons/icon-192.png">\n<link rel="canonical" href="${url}">\n${alts}\n<title>${ptitle}</title>\n<meta property="og:title" content="${ptitle}">\n<meta property="og:description" content="${OG[lang][1]}">\n<meta property="og:image" content="${LIVE}/site/img/manphone.jpg">\n<meta property="og:url" content="${url}">\n<meta property="og:locale" content="${{ en: "en_US", es: "es_US", fr: "fr_CA" }[lang]}">\n` + src.slice(0, cut) + "\n</head>\n<body>\n" + src.slice(cut) + "\n</body>\n</html>\n";
}

if (preview) {
  const dest = process.argv[process.argv.indexOf("--preview") + 1] || path.join(dir, "preview.html");
  fs.writeFileSync(dest, build("en", true)); console.log("wrote", dest);
} else {
  for (const [lang] of LANGS) {
    for (const page of PAGES) {
      const html = build(lang, false, page);
      const root = path.join(dir, "..");
      const out = page === "home" ? path.join(root, langBase(lang).slice(1)) : path.join(root, langBase(lang).slice(1), page);
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, "index.html"), html);
      if (lang === "en" && page === "home") fs.writeFileSync(path.join(dir, "index.html"), html);
      console.log("wrote", lang, page, (html.length / 1024).toFixed(0) + " KB");
    }
  }
}
