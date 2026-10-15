/* ============================================================
   JTProQuotes — standard scope templates and exclusions

   ONE copy, used in two places:
   - the app: build.js inlines this file into index.html
   - the server: api/_lib.js requires it, so the AI checks and
     unchecks exactly these steps when it drafts a quote

   Edit here, then run `npm run build`.
============================================================ */

const SCOPE_TEMPLATES = {
  "Flooring": [
    "Protect adjacent rooms, furnishings, and walkways; set dust containment at the work area",
    "Remove and dispose of existing floor covering, shoe molding, and underlayment",
    "Inspect subfloor; refasten loose boards, eliminate squeaks, and clean surface",
    "Level subfloor with patching compound to manufacturer's flatness tolerance",
    "Install moisture barrier and underlayment per flooring manufacturer specification",
    "Install new flooring per manufacturer layout, with required expansion gaps at perimeter",
    "Install new baseboard or reinstall shoe molding, plus transitions at doorways",
    "Caulk and touch up trim, finish all transitions and thresholds",
    "Final clean of installed area and haul away all debris",
  ],
  "Painting": [
    "Protect floors, fixtures, and furnishings with drop cloths and masking",
    "Wash and degloss surfaces; scrape and remove loose or peeling paint",
    "Patch nail holes, cracks, and minor drywall damage; sand smooth",
    "Caulk gaps at trim, corners, and penetrations",
    "Spot-prime all patched, stained, and bare areas",
    "Apply two finish coats to walls in client-selected color and sheen",
    "Cut in ceilings, trim, doors, and casings as specified",
    "Remove masking; reinstall hardware, switch plates, and outlet covers",
    "Final walkthrough touch-up and site cleanup",
  ],
  "Drywall": [
    "Protect adjacent finishes and set up dust containment",
    "Remove damaged drywall back to sound framing",
    "Inspect framing; add blocking or backing where required for support",
    "Hang new drywall of matching thickness, fastened to code spacing",
    "Tape, mud, and sand to a Level 4 finish",
    "Match existing texture (orange peel, knockdown, or smooth)",
    "Prime repaired areas ready for paint",
    "Cleanup and debris haul-off",
  ],
  "Kitchen Remodel": [
    "Protect adjacent rooms, floors, and pathways; set dust containment",
    "Demolish existing cabinets, countertops, backsplash, and flooring as scoped",
    "Coordinate disconnect and reconnect of plumbing, gas, and electrical with licensed trades",
    "Rough-in modifications for new sink, appliance, and outlet locations",
    "Install new base and wall cabinets — leveled, shimmed, and secured to framing",
    "Template, fabricate, and install countertops with sink and cooktop cutouts",
    "Install backsplash tile, grout, and seal",
    "Install sink, faucet, disposal, and reconnect appliances",
    "Install toe kick, crown molding, filler trim, and cabinet hardware",
    "Paint walls and ceiling; final caulk at all seams",
    "Final clean, punch list walkthrough, and debris removal",
  ],
  "Bath Remodel": [
    "Protect adjacent areas; set containment and floor protection",
    "Demolish existing tub or shower, vanity, flooring, and finishes as scoped",
    "Inspect subfloor and wall framing; repair water damage or rot discovered",
    "Plumbing rough-in adjustments performed by licensed plumber",
    "Install cement board and waterproof membrane at all wet areas",
    "Set tub or shower pan, install valve and surround",
    "Tile, grout, and seal walls and floor",
    "Install vanity, countertop, faucet, toilet, and accessories",
    "Install exhaust fan, vanity lighting, and mirror as scoped",
    "Paint, caulk, and install final trim",
    "Final clean and client walkthrough",
  ],
  "Exterior / Siding": [
    "Set staging and protect landscaping, windows, and walkways",
    "Remove damaged siding, trim, and fasteners; dispose properly",
    "Inspect sheathing and framing for rot; replace compromised material",
    "Install weather-resistant barrier and flashing at all openings",
    "Install new siding per manufacturer specification and course alignment",
    "Install corner boards, trim, and channel",
    "Caulk and seal all joints, penetrations, and transitions",
    "Prime and paint new material as scoped",
    "Site cleanup, magnet sweep for fasteners, and debris haul-off",
  ],
  "Concrete": [
    "Layout, mark utilities, and verify grade and drainage slope",
    "Excavate and remove existing concrete or soil to required depth",
    "Install and compact base material",
    "Set forms to specified elevation and slope",
    "Install reinforcement (rebar or wire mesh) properly chaired and spaced",
    "Place, screed, and float concrete at specified mix strength",
    "Finish surface — broom, smooth, or stamped as specified",
    "Cut control joints and apply curing compound",
    "Strip forms, backfill edges, and clean the site",
  ],
  "Covered Structure / Patio": [
    "Verify layout, setbacks, and permit requirements",
    "Excavate and pour footings or piers to code depth",
    "Set posts — plumbed, aligned, and anchored with approved hardware",
    "Frame beams, rafters, and headers to span requirements",
    "Install roof decking, underlayment, and roofing material",
    "Install fascia, trim, and drip edge",
    "Install gutters and downspouts as scoped",
    "Stain, seal, or paint all exposed wood",
    "Final cleanup and debris removal",
  ],
  "Fencing": [
    "Verify property lines and locate underground utilities",
    "Remove and dispose of existing fence",
    "Dig post holes to required depth and diameter",
    "Set posts in concrete — plumbed and aligned to string line",
    "Install rails and pickets or panels at specified spacing",
    "Build and hang gates with heavy-duty hinges and latch hardware",
    "Cut top to level line or follow grade as specified",
    "Apply stain or sealer",
    "Site cleanup and haul-off",
  ],
  "Roofing Repair": [
    "Inspect roof, flashing, and attic to identify the source of the leak",
    "Set ladders and protect landscaping and gutters",
    "Remove damaged shingles, underlayment, and decking as needed",
    "Replace compromised decking with matching material",
    "Install ice-and-water shield and underlayment at the repair area",
    "Install new shingles blended to match existing",
    "Reflash penetrations, valleys, and wall transitions",
    "Seal exposed fasteners and inspect ridge and vents",
    "Magnet sweep and debris removal",
  ],
  "Plumbing Repair": [
    "Isolate water supply and protect surrounding finishes",
    "Diagnose and locate the source of the leak or failure",
    "Open access to affected piping or fixture",
    "Replace failed pipe, valve, or fixture with code-approved material",
    "Pressure test and verify no leaks under normal operation",
    "Insulate and support piping as required",
    "Patch and restore access opening",
    "Verify drainage and clean the work area",
  ],
  "Electrical (minor)": [
    "De-energize the circuit and verify with tester",
    "Diagnose the fault or confirm scope of new device installation",
    "Install or replace devices, fixtures, and covers with code-approved material",
    "Verify grounding, polarity, and secure terminations",
    "Label panel circuit where applicable",
    "Test operation under load and restore power",
    "Patch and clean any access openings",
  ],
  "Water Damage Restoration": [
    "Assess moisture with meter and document all affected areas",
    "Stop the source of water intrusion",
    "Set containment and protect unaffected areas",
    "Remove saturated drywall, insulation, flooring, and trim",
    "Treat affected framing with antimicrobial",
    "Set air movers and dehumidifiers; monitor readings daily",
    "Verify dry standard is met before rebuild",
    "Rebuild removed materials to match existing",
    "Final clean and documentation for insurance if applicable",
  ],
  "General Repair": [
    "Assess the condition and confirm scope with client on site",
    "Protect surrounding finishes and set up the work area",
    "Remove or disassemble damaged components",
    "Repair or replace with matching material and finish",
    "Fasten, seal, and caulk as appropriate",
    "Touch up paint or finish to blend with existing",
    "Test operation and confirm with client",
    "Cleanup and haul away debris",
  ],
  "Holiday Lighting": [
    "Walk the property with the client to confirm layout, colors, and power sources",
    "Furnish commercial-grade LED holiday lights, clips, extension cords, and timer as listed",
    "Install lights along the rooflines, gutters, and eaves of the whole house (front, sides, and back)",
    "Secure all strands with plastic clips — no nails, staples, or damage to shingles or gutters",
    "Route cords neatly and connect to outdoor GFCI outlets with a weatherproof timer",
    "Test every strand, replace any dead bulbs, and set the on/off schedule with the client",
    "Clean up the work area and haul away packaging",
  ],
  "Room & Home Arranging": [
    "Walk through with the client to agree on the layout and what stays, goes, or gets stored",
    "Protect floors, door frames, and walls in the work area",
    "Move and arrange furniture into the agreed layout",
    "Sort, organize, and arrange closets, shelves, and storage areas as scoped",
    "Hang pictures, mirrors, and décor at the client's chosen spots",
    "Assemble or take apart furniture as listed",
    "Final walkthrough with the client and adjust anything they want changed",
    "Remove packaging and haul away items the client marked for disposal",
  ],
  "Cleaning": [
    "Walk through with the client to confirm rooms and areas included",
    "Dust all reachable surfaces, ceiling fans, light fixtures, baseboards, and window sills",
    "Clean and disinfect kitchen counters, sink, stovetop, appliance exteriors, and cabinet fronts",
    "Clean and disinfect bathrooms — toilets, tubs, showers, sinks, mirrors, and fixtures",
    "Vacuum carpets and rugs; sweep and mop all hard floors",
    "Clean interior glass, door handles, light switches, and high-touch surfaces",
    "Empty trash and replace liners",
    "Final walkthrough with the client",
  ],
  "Moving": [
    "Confirm inventory, pickup and drop-off addresses, and move date with the client",
    "Protect floors, door frames, and stair rails at both locations",
    "Disassemble beds, tables, and other large furniture as needed",
    "Wrap and pad furniture; box and label loose items as scoped",
    "Load, secure, and transport all listed items",
    "Unload and place furniture and boxes in the rooms the client chooses",
    "Reassemble furniture taken apart for the move",
    "Final walkthrough with the client and remove moving blankets and packaging",
  ],
  "Other": [
    "Assess site conditions and confirm scope with client",
    "Protect surrounding areas and set up the work zone",
    "Furnish all labor, materials, and equipment described in this quote",
    "Perform work in accordance with manufacturer specifications and applicable code",
    "Clean the work area at the end of each working day",
    "Final walkthrough and debris removal",
  ],
};

const STANDARD_EXCLUSIONS = [
  "Permits and inspection fees, unless expressly listed in the scope above",
  "Concealed damage discovered after demolition (rot, mold, termite, or code violations)",
  "Relocation of plumbing, gas, or electrical lines not listed in the scope",
  "Structural or engineering work, including load-bearing modifications",
  "Asbestos, lead paint, or mold abatement",
  "Moving furniture, appliance disposal, and storage of personal items",
  "Defects or delays arising from client-supplied materials",
  "Landscaping restoration and irrigation repair",
  "Final detail cleaning beyond removal of construction debris",
];

/* Holiday Lighting has two choices: how tall the house is and how much of
   it gets lights. Each pair sets the scope wording and a starting crew/hours
   (lights and supplies are priced separately as materials). */
const HOLIDAY_STORIES = { "1": "1-story house", "2": "2-story house" };
const HOLIDAY_COVERAGE = { front: "Front of house only", all: "All around the house" };
const HOLIDAY_LABOR = {
  "1-front": { crew: 2, days: 1, hoursPerDay: 3 },
  "1-all":   { crew: 2, days: 1, hoursPerDay: 6 },
  "2-front": { crew: 2, days: 1, hoursPerDay: 5 },
  "2-all":   { crew: 3, days: 1, hoursPerDay: 8 },
};
function holidayScope(stories, coverage) {
  const two = stories === "2";
  const where = coverage === "front"
    ? "the front of the house only (front rooflines, gutters, and eaves)"
    : "the whole house — front, both sides, and back (all rooflines, gutters, and eaves)";
  return [
    "Walk the property with the client to confirm layout, colors, and power sources",
    "Furnish commercial-grade LED holiday lights, clips, extension cords, and timer as listed",
    "Install lights on " + where + " of the " + (two ? "2-story" : "1-story") + " house",
    two
      ? "Work safely at second-story height using extension ladders with stabilizers and fall protection"
      : "Work from ladders at first-story height with stabilizers to protect gutters",
    "Secure all strands with plastic clips — no nails, staples, or damage to shingles or gutters",
    "Route cords neatly and connect to outdoor GFCI outlets with a weatherproof timer",
    "Test every strand, replace any dead bulbs, and set the on/off schedule with the client",
    "Clean up the work area and haul away packaging",
  ];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SCOPE_TEMPLATES, STANDARD_EXCLUSIONS, HOLIDAY_STORIES, HOLIDAY_COVERAGE, HOLIDAY_LABOR, holidayScope };
}
