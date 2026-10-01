/* ============================================================
   JTProQuotes — /api/property
   Job address in; map position, drive time, roof size and pitch,
   Street View and satellite pictures, flood zone and county lot
   facts out. Building facts only — never owner or sale records.
   Signed-in, approved team members only.
============================================================ */

const { bad, parseBody, verifyCaller } = require("./_lib");
const { lookupProperty } = require("./_property");

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");
  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) return bad(res, 401, "Sign in again — no session token was sent.");
  let caller;
  try { caller = await verifyCaller(idToken); }
  catch { return bad(res, 503, "Couldn't check your sign-in just now. Try again in a moment."); }
  if (!caller) return bad(res, 403, "Your account isn't approved to use this yet.");

  const address = typeof body.address === "string" ? body.address.trim().slice(0, 240) : "";
  if (address.length < 6) return bad(res, 400, "Enter the job address first (street, city).");

  try {
    const p = await lookupProperty(address);
    console.log("[property] ok uid=" + caller.uid + " precise=" + p.precise + " roof=" + !!p.roof + " parcel=" + !!p.parcel);
    return res.status(200).json({ property: p });
  } catch (e) {
    console.error("[property] failed:", e.message);
    return bad(res, e.code || 502, e.message || "Property lookup failed.");
  }
};
