// Pure body-loft geometry: params -> per-station cross-sections. No Three.js.
// Both the body mesh (carBuilder.buildBody) AND the lights consume this, so the
// lights always sit on the REAL body surface instead of a hand-tuned guess.
// x runs rear(-L/2) -> front(+L/2); t is the normalised station 0..1 along it.

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The body's cross-section at station t: full width `halfW`, floor `yb`, top `yt`,
// and the top/bottom chamfer insets (already clamped exactly like crossSection uses).
export function stationProfile(p, t) {
  const L = p.length, HW = p.halfWidth, belt = p.beltline, floor = p.floor;
  let wf = 1;
  if (t > 0.85) wf = lerp(1, p.noseTaper, (t - 0.85) / 0.15);
  if (t < 0.12) wf = lerp(1, p.tailTaper, (0.12 - t) / 0.12);
  let yt = belt;
  // Cybertruck-style raised tail (xyz's back_elev/back_lift): the deck climbs
  // linearly from the belt at the nose to a tall tailgate at the rear.
  if (p.deckRise) yt = belt * (1 + p.deckRise * (1 - t));
  // noseDropStart (default 0.9) lets the hood slope down over a LONG run — the
  // Cybertruck's hood is ONE dead-straight plane from the windshield base to a low
  // nose (linear in t, so the loft stations sample exactly on the line).
  const ns = p.noseDropStart ?? 0.9;
  if (t > ns) {
    const ytNs = p.deckRise ? belt * (1 + p.deckRise * (1 - ns)) : belt;
    yt = lerp(ytNs, belt * p.noseDrop, (t - ns) / (1 - ns));
  }
  if (t < 0.1) yt *= lerp(1, p.tailDrop, (0.1 - t) / 0.1);
  if (p.bed && t < p.cabinStart) {
    // near-vertical wall right behind the cab (xyz's pickup/semi decks drop straight down)
    const ramp = clamp((p.cabinStart - t) / 0.02, 0, 1);
    yt = lerp(belt, belt * p.bedDrop, ramp);
  }
  yt = Math.max(yt, floor + 0.06); // never let a drop/bed invert the section
  const sw = HW * wf, sh = yt - floor;
  // variable-width top chamfer (xyz's one-step variable fillet): full width mid-body,
  // scaled by chamferTopB toward the tail and chamferTopF toward the nose.
  let ctw = p.chamferTop;
  if (p.chamferTopF != null || p.chamferTopB != null) {
    ctw *= t < 0.5 ? lerp(p.chamferTopB ?? 1, 1, t * 2) : lerp(1, p.chamferTopF ?? 1, (t - 0.5) * 2);
  }
  const tcz = clamp(ctw * sw * p.chamferAngle, 0, sw * 0.85);
  const tcy = clamp(ctw * sh * (1 - p.chamferAngle) * 1.6, 0, sh * 0.7);
  const bcz = clamp(p.chamferBottom * sw * p.chamferAngle, 0, sw * 0.85);
  const bcy = clamp(p.chamferBottom * sh * (1 - p.chamferAngle) * 1.6, 0, sh * 0.7);
  return { x: -L / 2 + t * L, halfW: sw, yb: floor, yt, tcz, tcy, bcz, bcy };
}

// The chamfered-octagon outline for a profile -> 8 [z, y] points (Y-Z plane).
export function crossSection(pr) {
  const { halfW: hw, yb, yt, tcz, tcy, bcz, bcy } = pr;
  return [
    [hw - tcz, yt], [hw, yt - tcy], [hw, yb + bcy], [hw - bcz, yb],
    [-(hw - bcz), yb], [-hw, yb + bcy], [-hw, yt - tcy], [-(hw - tcz), yt],
  ];
}

// Body half-width (±z extent) at height y for this station — tracks the chamfers,
// so a part placed at this z is exactly flush with the surface.
export function halfWidthAtY(pr, y) {
  const lowTop = pr.yb + pr.bcy, hiBot = pr.yt - pr.tcy;
  if (y <= pr.yb) return pr.halfW - pr.bcz;
  if (y >= pr.yt) return pr.halfW - pr.tcz;
  if (y < lowTop) return lerp(pr.halfW - pr.bcz, pr.halfW, (y - pr.yb) / Math.max(1e-6, pr.bcy));
  if (y > hiBot) return lerp(pr.halfW, pr.halfW - pr.tcz, (y - hiBot) / Math.max(1e-6, pr.tcy));
  return pr.halfW;
}

// Where the head/tail lamps go. Boxes (depth along X, h along Y, w along Z) on the
// actual nose/tail face. xyz's design (post 34 + the morphing gif): every archetype
// has its OWN characteristic lamp spec (p.lampF / p.lampR from params.js):
//   h: lamp height as fraction of the face height, y: vertical centre fraction,
//   w: lamp width as fraction of the face half-width,
//   corner: hug the outer corner, wrap: poke that far past the side so a sliver of
//           lamp shows along the flank (the corner-wrap seen all over the gif),
//   z: (inboard lamps) centre as fraction of half-width,
//   bar: full-width split bar riding under the top edge (Cybertruck tail).
const GENERIC_LAMP = { h: 0.45, y: 0.6, w: 0.24, corner: true, wrap: 0.02 };

export function lightPlacements(p) {
  return [true, false].map((front) => {
    const spec = (front ? p.lampF : p.lampR) || GENERIC_LAMP;
    const pr = stationProfile(p, front ? 1 : 0);
    const fh = pr.yt - pr.yb;
    // Lamps live in the STRAIGHT band of the face, between the top/bottom chamfer
    // creases — tiles then fold cleanly around the corner instead of clipping
    // through the bevels (and never exceed a short face like a pickup tailgate).
    const loY = pr.yb + pr.bcy + 0.015, hiY = pr.yt - pr.tcy - 0.015;
    const bandH = Math.max(0.05, hiY - loY);
    const h = Math.min(bandH * 0.92,
      spec.bar ? clamp(fh * 0.16, 0.06, 0.1) : clamp(fh * spec.h, 0.08, 0.5));
    const y0 = lerp(pr.yb, pr.yt, spec.bar ? 0.84 : spec.y);
    const y = clamp(y0, loY + h / 2, Math.max(loY + h / 2, hiY - h / 2));
    const surf = Math.min(halfWidthAtY(pr, y - h / 2), halfWidthAtY(pr, y + h / 2));
    // bar: front = continuous full-width (real Cybertruck), rear = split pair (c12)
    const w = spec.bar ? surf * (front ? 1.04 : 0.78) : clamp(surf * spec.w, 0.07, 0.5);
    const wrap = spec.corner ? (spec.wrap || 0) : 0;
    // FLAT panels (xyz paints his lamps on the mesh): a thin tile on the face, plus —
    // for corner lamps — a thin sliver tile lying on the flank (sideLen along X).
    const depth = 0.02;
    const zc = spec.bar ? surf * (front ? 0.26 : 0.43)
      : spec.corner ? surf - w / 2          // outer edge exactly on the corner edge
      : surf * spec.z;
    // slanted end faces: the tile follows the face (centre shifted back, tilted)
    const sl = (front ? p.noseSlant : p.tailSlant) || 0;
    const faceX = pr.x - (front ? 1 : -1) * sl * (pr.yt - y) / fh;
    // The flank piece lies ON the tapered corner facet (between the cap and the next
    // loft station), sharing the corner edge with the face tile — so the two tiles
    // read as ONE rectangle folding around the corner, never a broken pair.
    const pr2 = stationProfile(p, front ? 0.92 : 0.08);
    const surf2 = Math.min(halfWidthAtY(pr2, y - h / 2), halfWidthAtY(pr2, y + h / 2));
    const run = Math.abs(pr2.x - pr.x);
    return {
      front, depth, w, h, y, zc, wrap, surf, faceX,
      prX: pr.x, yt: pr.yt, fh, sl,        // cap-plane data so the builder can shear quads onto it
      sideLen: Math.min(0.22, run * 0.9),
      yaw: clamp(Math.atan2(surf2 - surf, Math.max(1e-6, run)), 0, 0.9),
      tilt: Math.atan2(sl, fh),
      x: faceX + (front ? 1 : -1) * 0.005, // panel sits flush, a hair proud of the face
    };
  });
}
