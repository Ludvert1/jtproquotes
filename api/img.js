/* ============================================================
   JTProQuotes — /api/img
   Serves a quote photo from this site's own address so the PDF
   maker can draw it (browsers won't let a page paint images from
   another site into a PDF unless that site opts in).

   Only this project's lead photos can pass through — it is not a
   general-purpose proxy. The Firebase download URL already carries
   its own access token, so this exposes nothing the link didn't.
============================================================ */

const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "jtproquotes.firebasestorage.app";
const ALLOWED = "https://firebasestorage.googleapis.com/v0/b/" + BUCKET + "/o/leads%2F";

module.exports = async (req, res) => {
  const u = typeof req.query.u === "string" ? req.query.u : "";
  if (!u.startsWith(ALLOWED) || !/[?&]token=[\w-]+/.test(u)) return res.status(400).send("Not an allowed image.");
  try {
    const r = await fetch(u);
    if (!r.ok) return res.status(r.status === 404 ? 404 : 502).send("Image unavailable.");
    const type = r.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return res.status(415).send("Not an image.");
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.status(200).send(buf);
  } catch {
    return res.status(502).send("Image unavailable.");
  }
};
