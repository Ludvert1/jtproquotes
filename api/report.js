/* ============================================================
   S-I-Quotespro — /api/report
   The app sends crashes and failed requests here from the browser,
   so problems show up in Admin → System health (and on your phone)
   before a customer calls. No sign-in needed; input is trimmed and
   rate-limited, and obvious browser-extension noise is ignored.
============================================================ */
const { bad, parseBody } = require("./_lib");
const { report } = require("./_monitor");

const perIp = new Map();
const NOISE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection captured|Load failed$|NetworkError when attempting|The operation was aborted|AbortError/i;

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");
  const b = parseBody(req);
  if (!b) return res.status(204).end();
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const now = Date.now();
  const hits = (perIp.get(ip) || []).filter((t) => now - t < 60e3);
  if (hits.length >= 20) return res.status(204).end();
  hits.push(now); perIp.set(ip, hits);

  const message = String(b.message || "").slice(0, 500);
  if (!message || NOISE.test(message) || NOISE.test(String(b.stack || ""))) return res.status(204).end();
  await report({
    source: "browser", where: String(b.where || "app").slice(0, 120), message,
    stack: b.stack, cid: b.cid, url: b.url, ua: req.headers["user-agent"],
  });
  return res.status(204).end();
};
