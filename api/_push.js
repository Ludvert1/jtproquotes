/* ============================================================
   JTProQuotes — phone notifications (Web Push)

   Sends a real push notification — sound, vibration, lock-screen
   banner, app-icon badge — to every phone or computer a person has
   switched alerts on for, even when the app is closed.

   Standard Web Push (RFC 8291 encryption + RFC 8292 VAPID), written
   with Node's built-in crypto so there is nothing extra to install.

   Environment:
     VAPID_PRIVATE_KEY   the private half of the key pair (secret)
     VAPID_PUBLIC_KEY    optional — defaults to the one in config.js
     VAPID_SUBJECT       optional — defaults to mailto:info@jtproconstruction.com
============================================================ */

const crypto = require("crypto");

// Public by design; the browser needs it to subscribe. Must match config.js.
const DEFAULT_PUBLIC = "BHJZrgFysdU8GUtlP0FM04D_brRVTjfNOdYX-VBnEBzWewiM0g7tpksbZkKF0snEyVBHPxPcxAK31Frtap6bMSY";

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

function vapidKeys() {
  const priv = process.env.VAPID_PRIVATE_KEY || "";
  const pub = process.env.VAPID_PUBLIC_KEY || DEFAULT_PUBLIC;
  if (!priv) return null;
  return { priv: unb64u(priv), pub: unb64u(pub), pubText: pub };
}
const pushEnabled = () => !!process.env.VAPID_PRIVATE_KEY;

/* VAPID: a short-lived ES256 token proving the push came from us. */
function vapidHeader(endpoint, keys) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: process.env.VAPID_SUBJECT || "mailto:info@jtproconstruction.com",
  }));
  const x = keys.pub.subarray(1, 33), y = keys.pub.subarray(33, 65);
  const key = crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: b64u(keys.priv), x: b64u(x), y: b64u(y) }, format: "jwk",
  });
  const sig = crypto.sign("sha256", Buffer.from(header + "." + claims), { key, dsaEncoding: "ieee-p1363" });
  return "vapid t=" + header + "." + claims + "." + b64u(sig) + ", k=" + keys.pubText;
}

/* RFC 8291 aes128gcm encryption of one message for one subscription. */
function encrypt(payload, sub) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);

  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/* Sends to one subscription. Returns { ok, gone } — gone means the phone
   unsubscribed or the app was removed, so the record can be dropped. */
async function sendOne(sub, message) {
  const keys = vapidKeys();
  if (!keys) return { ok: false, skipped: true };
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return { ok: false };
  try {
    const r = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        TTL: "86400", Urgency: "high",
        "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
        Authorization: vapidHeader(sub.endpoint, keys),
      },
      body: encrypt(JSON.stringify(message), sub),
    });
    if (r.status === 404 || r.status === 410) return { ok: false, gone: true };
    if (!r.ok) console.error("[push] " + r.status + " from " + new URL(sub.endpoint).host);
    return { ok: r.ok };
  } catch (e) {
    console.error("[push] network:", e.message);
    return { ok: false };
  }
}

/* Every device of every listed person. `records` are pushSubs documents:
   { uid, subs: { <id>: { endpoint, keys, ... } } }. */
async function sendToPeople(records, uids, message) {
  if (!pushEnabled()) return { sent: 0, skipped: "VAPID_PRIVATE_KEY is not set" };
  const wanted = new Set(uids);
  const targets = [];
  (records || []).forEach((rec) => {
    if (!rec || !wanted.has(rec.uid)) return;
    Object.values(rec.subs || {}).forEach((s) => targets.push(s));
  });
  const results = await Promise.all(targets.map((s) => sendOne(s, message)));
  const sent = results.filter((r) => r.ok).length;
  console.log("[push] " + sent + "/" + targets.length + " delivered — " + (message.title || ""));
  return { sent, devices: targets.length };
}

module.exports = { pushEnabled, sendOne, sendToPeople, encrypt, vapidHeader, DEFAULT_PUBLIC };
