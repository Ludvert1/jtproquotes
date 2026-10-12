/* ============================================================
   S-I-Quotespro — /api/contact
   The public contact form on s-i-quotespro.com. Emails the message to
   S-I-Quotespro support (WEB3FORMS_KEYS). No sign-in needed, so the
   input is length-limited, and a hidden "website" field catches bots.
============================================================ */
const { bad, parseBody, sendEmail } = require("./_lib");
const { withMonitor } = require("./_monitor");

const seen = new Map(); // ip -> [timestamps] (best effort, per instance)

/* GET (also /api/reviews): the published reviews shown on the website. */
let cachedReviews = null;
async function publishedReviews(res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  if (cachedReviews && Date.now() - cachedReviews.at < 5 * 60e3) return res.status(200).json(cachedReviews.body);
  const { listDocsAsServer } = require("./_lib");
  let list = [];
  try { list = (await listDocsAsServer("reviews")).filter((r) => r && r.status === "published"); } catch (e) { console.error("[reviews]", e.message); }
  list.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const avg = list.length ? Math.round((list.reduce((n, r) => n + Number(r.rating || 0), 0) / list.length) * 10) / 10 : 0;
  const body = { count: list.length, average: avg, reviews: list.slice(0, 24).map((r) => ({ rating: r.rating, text: r.text, name: r.name, company: r.company, city: r.city, at: String(r.at || "").slice(0, 10) })) };
  cachedReviews = { at: Date.now(), body };
  return res.status(200).json(body);
}

const handler = async (req, res) => {
  if (req.method === "GET") return publishedReviews(res);
  if (req.method !== "POST") return bad(res, 405, "POST only.");
  const b = parseBody(req);
  if (!b) return bad(res, 400, "Missing message.");
  if (b.website) return res.status(200).json({ ok: true }); // bot filled the hidden field
  const s = (v, n) => String(v || "").trim().slice(0, n);
  const name = s(b.name, 100), email = s(b.email, 160), phone = s(b.phone, 40), company = s(b.company, 120), topic = s(b.topic, 80), message = s(b.message, 3000);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || message.length < 5) return bad(res, 400, "Add your name, a valid email and a short message.");

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const now = Date.now();
  const recent = (seen.get(ip) || []).filter((t) => now - t < 10 * 60e3);
  if (recent.length >= 5) return bad(res, 429, "Too many messages. Please call or email instead.");
  recent.push(now); seen.set(ip, recent);

  const text = `From: ${name}${company ? " (" + company + ")" : ""}\nEmail: ${email}\nPhone: ${phone || "-"}\nTopic: ${topic || "-"}\n\n${message}`;
  const r = await sendEmail({ subject: "[S-I-Quotespro website] " + (topic || "Message") + " — " + name, message: text, replyTo: email });
  if (!r.sent) return bad(res, 503, "Couldn't send right now.");
  return res.status(200).json({ ok: true });
};

module.exports = withMonitor("contact", handler);
