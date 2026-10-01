/* ============================================================
   JTProQuotes — property lookup
   From a job address: map location, drive time from base, roof
   size and pitch from satellite data, a Street View and a
   satellite picture, flood zone, and (Harris County) lot facts.

   Building facts only. Owner names, sale prices and mailing
   addresses are deliberately never requested.

   Environment:
     GOOGLE_MAPS_API_KEY   Geocoding, Routes, Solar, Street View Static
                           and Maps Static APIs enabled on it
     BASE_ADDRESS          optional — where crews start from
                           (default "New Caney, TX 77357")
============================================================ */

const KEY = () => process.env.GOOGLE_MAPS_API_KEY || "";
const BASE = () => process.env.BASE_ADDRESS || "New Caney, TX 77357";
const M2_TO_FT2 = 10.7639;

async function getJson(url, opts) {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) return { _status: r.status };
    return await r.json();
  } catch (e) { return { _error: e.message }; }
}

async function imageAsDataUrl(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return "";
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return "";
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 250000) return ""; // keep the quote document small
    return "data:" + type + ";base64," + buf.toString("base64");
  } catch { return ""; }
}

async function geocode(address) {
  const d = await getJson("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(address) + "&key=" + KEY());
  const r = d && d.results && d.results[0];
  if (!r) return null;
  const comp = (type) => ((r.address_components || []).find((c) => (c.types || []).includes(type)) || {}).long_name || "";
  return {
    formatted: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng,
    precise: r.geometry.location_type === "ROOFTOP" || (r.types || []).includes("street_address") || (r.types || []).includes("premise"),
    county: comp("administrative_area_level_2"), state: comp("administrative_area_level_1"), city: comp("locality"), zip: comp("postal_code"),
  };
}

async function driveFromBase(destination) {
  const d = await getJson("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
    body: JSON.stringify({ origin: { address: BASE() }, destination: { address: destination }, travelMode: "DRIVE" }),
  });
  const r = d && d.routes && d.routes[0];
  if (!r) return null;
  return { minutes: Math.round(parseInt(String(r.duration || "0"), 10) / 60), miles: Math.round((r.distanceMeters || 0) / 1609.34), from: BASE() };
}

async function roof(lat, lng) {
  const d = await getJson(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=MEDIUM&key=${KEY()}`);
  const sp = d && d.solarPotential;
  if (!sp || !sp.wholeRoofStats) return null;
  const segs = (sp.roofSegmentStats || []).map((s) => ({
    pitchDeg: Number(s.pitchDegrees) || 0,
    sqft: Math.round(((s.stats && s.stats.areaMeters2) || 0) * M2_TO_FT2),
  })).filter((s) => s.sqft > 20);
  const total = Math.round((sp.wholeRoofStats.areaMeters2 || 0) * M2_TO_FT2);
  const weighted = segs.reduce((t, s) => t + s.pitchDeg * s.sqft, 0) / Math.max(1, segs.reduce((t, s) => t + s.sqft, 0));
  const pitch12 = Math.round(Math.tan((weighted * Math.PI) / 180) * 12);
  return {
    sqft: total, squares: Math.round(total / 10) / 10, footprintSqft: Math.round((sp.wholeRoofStats.groundAreaMeters2 || 0) * M2_TO_FT2),
    faces: segs.length, pitch: pitch12 > 0 ? pitch12 + "/12" : "flat/low", steep: pitch12 >= 8,
    quality: d.imageryQuality || "", imageryDate: d.imageryDate ? [d.imageryDate.year, d.imageryDate.month].filter(Boolean).join("-") : "",
  };
}

async function streetView(address, lat, lng) {
  const meta = await getJson(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(address)}&source=outdoor&key=${KEY()}`);
  if (!meta || meta.status !== "OK") return { image: "", date: "" };
  const image = await imageAsDataUrl(`https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${encodeURIComponent(address)}&fov=75&source=outdoor&key=${KEY()}`);
  return { image, date: meta.date || "" };
}

async function satellite(lat, lng) {
  return imageAsDataUrl(`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=640x400&maptype=satellite&key=${KEY()}`);
}

/* FEMA's public flood map — no key needed. */
async function floodZone(lat, lng) {
  const d = await getJson("https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry="
    + lng + "," + lat + "&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF&returnGeometry=false&f=json");
  const a = d && d.features && d.features[0] && d.features[0].attributes;
  if (!a) return null;
  return { zone: a.FLD_ZONE || "", detail: a.ZONE_SUBTY || "", highRisk: a.SFHA_TF === "T" };
}

/* Harris County Appraisal District parcel layer — public. Only lot and
   classification fields are requested; never owner or sale data. */
const STATE_CLASS = { A1: "Single-family home", A2: "Mobile home", B1: "Multi-family", B2: "Duplex", B3: "Triplex", B4: "Fourplex", F1: "Commercial", F2: "Industrial", C1: "Vacant lot" };
async function harrisParcel(lat, lng) {
  const d = await getJson("https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query?geometry="
    + lng + "," + lat + "&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects"
    + "&distance=12&units=esriSRUnit_Meter&outFields=HCAD_NUM,land_sqft,Acreage,state_class&returnGeometry=false&resultRecordCount=1&f=json");
  const a = d && d.features && d.features[0] && d.features[0].attributes;
  if (!a) return null;
  const cls = String(a.state_class || "").trim();
  return {
    source: "Harris County Appraisal District",
    account: String(a.HCAD_NUM || "").trim(),
    lotSqft: Math.round(Number(a.land_sqft) || 0),
    acres: parseFloat(a.Acreage) || 0,
    use: STATE_CLASS[cls.slice(0, 2)] || cls,
    link: a.HCAD_NUM ? "https://hcad.org/property-search/real-property/real-property-details/" + String(a.HCAD_NUM).trim() : "",
  };
}

async function lookupProperty(address) {
  if (!KEY()) throw Object.assign(new Error("Property lookup isn't switched on yet — GOOGLE_MAPS_API_KEY is not set in Vercel."), { code: 503 });
  const g = await geocode(address);
  if (!g) throw Object.assign(new Error("Couldn't find that address on the map. Check the street and city."), { code: 404 });
  const [drive, roofInfo, sv, sat, flood, parcel] = await Promise.all([
    driveFromBase(g.formatted),
    g.precise ? roof(g.lat, g.lng) : Promise.resolve(null),
    g.precise ? streetView(g.formatted, g.lat, g.lng) : Promise.resolve({ image: "", date: "" }),
    g.precise ? satellite(g.lat, g.lng) : Promise.resolve(""),
    floodZone(g.lat, g.lng),
    /harris/i.test(g.county) ? harrisParcel(g.lat, g.lng) : Promise.resolve(null),
  ]);
  return {
    at: new Date().toISOString(),
    address: g.formatted, lat: g.lat, lng: g.lng, precise: g.precise,
    city: g.city, county: g.county, state: g.state, zip: g.zip,
    mapUrl: "https://www.google.com/maps/search/?api=1&query=" + g.lat + "," + g.lng,
    drive, roof: roofInfo, flood, parcel,
    streetView: sv.image, streetViewDate: sv.date, satellite: sat,
  };
}

/* One paragraph the AI estimator reads alongside the photos. */
function propertyBrief(p) {
  if (!p) return "";
  const bits = ["PROPERTY FACTS (looked up from the job address — use them, don't repeat them to the customer):", "Address: " + p.address + (p.precise ? "" : " (approximate — street-level only)")];
  if (p.drive) bits.push("Drive from our base (" + p.drive.from + "): about " + p.drive.minutes + " min / " + p.drive.miles + " miles each way.");
  if (p.roof) bits.push("Roof (satellite measurement" + (p.roof.imageryDate ? ", imagery " + p.roof.imageryDate : "") + "): about " + p.roof.sqft + " sq ft = " + p.roof.squares + " squares, " + p.roof.faces + " roof faces, average pitch " + p.roof.pitch + (p.roof.steep ? " (steep — add safety equipment and time)" : "") + "; building footprint about " + p.roof.footprintSqft + " sq ft. Treat roof numbers as measured, but say 'measured from satellite' in assumptions.");
  if (p.parcel) bits.push(p.parcel.source + ": " + (p.parcel.use || "property") + ", lot about " + p.parcel.lotSqft + " sq ft.");
  if (p.flood) bits.push("FEMA flood zone " + p.flood.zone + (p.flood.highRisk ? " (high-risk special flood hazard area — flag permit/elevation rules in risks)" : ""));
  if (p.streetView) bits.push("A Street View image of the house" + (p.streetViewDate ? " (" + p.streetViewDate + ")" : "") + " is attached for exterior context — it may be out of date.");
  if (p.satellite) bits.push("A top-down satellite image is attached for roof/lot context.");
  return bits.join("\n");
}

/* The two reference pictures as model inputs (not customer photos). */
function propertyImages(p) {
  const out = [];
  const add = (dataUrl, label) => {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl || "");
    if (m) out.push({ mediaType: m[1], data: m[2], label });
  };
  if (p) { add(p.streetView, "Street View of the property (reference only — not a customer photo)"); add(p.satellite, "Satellite view of the property (reference only — not a customer photo)"); }
  return out;
}

/* A property object sent back by the app — keep only known fields, so
   nothing odd reaches the AI brief. */
function cleanProperty(p) {
  if (!p || typeof p !== "object" || typeof p.address !== "string") return null;
  const s = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const img = (v) => (typeof v === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/.test(v) && v.length < 400000 ? v : "");
  const r = p.roof, d = p.drive, f = p.flood, pa = p.parcel;
  return {
    address: s(p.address, 240), precise: !!p.precise, lat: n(p.lat), lng: n(p.lng),
    drive: d ? { minutes: n(d.minutes), miles: n(d.miles), from: s(d.from, 120) } : null,
    roof: r ? { sqft: n(r.sqft), squares: n(r.squares), footprintSqft: n(r.footprintSqft), faces: n(r.faces), pitch: s(r.pitch, 20), steep: !!r.steep, imageryDate: s(r.imageryDate, 20) } : null,
    flood: f ? { zone: s(f.zone, 20), detail: s(f.detail, 80), highRisk: !!f.highRisk } : null,
    parcel: pa ? { source: s(pa.source, 80), use: s(pa.use, 80), lotSqft: n(pa.lotSqft), acres: n(pa.acres) } : null,
    streetView: img(p.streetView), streetViewDate: s(p.streetViewDate, 20), satellite: img(p.satellite),
  };
}

module.exports = { lookupProperty, propertyBrief, propertyImages, cleanProperty };
