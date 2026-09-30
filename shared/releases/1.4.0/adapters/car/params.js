// Car parameters: archetype presets + seed -> params sampling + URL (de)serialization.
// Pure data, no Three.js. The builder consumes whatever this produces.

import { makeRng, rng } from "@engine/rng.js";

// Each archetype is a base shape; ranges below get jittered per-seed.
// Units are loosely "metres". x runs rear(-L/2) -> front(+L/2); cabin* are
// fractions 0..1 along that span (0 = rear bumper, 1 = front bumper).
export const ARCHETYPES = {
  sedan: {
    label: "Sedan",
    length: [4.0, 4.6],
    halfWidth: [0.86, 0.94],
    beltline: [0.9, 1.0],
    floor: [0.4, 0.46],
    cabinStart: [0.3, 0.34],
    cabinEnd: [0.62, 0.68],
    roofHeight: [1.34, 1.46],
    cabinInset: [0.16, 0.22],
    cabinTaper: [0.84, 0.9],
    windshieldRake: [0.22, 0.3],
    backlightRake: [0.18, 0.26],
    noseTaper: [0.82, 0.92],
    tailTaper: [0.84, 0.94],
    noseDrop: [0.8, 0.9],
    tailDrop: [0.86, 0.96],
    chamferTop: [0.22, 0.34],
    chamferBottom: [0.14, 0.24],
    chamferAngle: [0.45, 0.6],
    wheelRadius: [0.34, 0.4],
    wheelWidth: [0.24, 0.3],
    frontAxle: [0.62, 0.7],
    rearAxle: [0.6, 0.68],
    slant: [0.05, 0.12],
    chamferTopVar: [0.55, 1.1],
    lamps: {
      front: { h: 0.5, y: 0.6, w: 0.3, corner: true, wrap: 0.025 },
      rear: { h: 0.42, y: 0.6, w: 0.24, corner: true, wrap: 0.025 },
    }, // big corner blocks (blue sedan in the gif)
  },
  coupe: {
    label: "Coupe",
    length: [3.9, 4.4],
    halfWidth: [0.88, 0.96],
    beltline: [0.82, 0.92],
    floor: [0.34, 0.42],
    cabinStart: [0.28, 0.34],
    cabinEnd: [0.56, 0.62],
    roofHeight: [1.22, 1.34],
    cabinInset: [0.18, 0.24],
    cabinTaper: [0.8, 0.88],
    windshieldRake: [0.3, 0.4],
    backlightRake: [0.42, 0.55],
    noseTaper: [0.84, 0.92],
    tailTaper: [0.82, 0.92],
    noseDrop: [0.72, 0.84],
    tailDrop: [0.8, 0.9],
    chamferTop: [0.3, 0.44],
    chamferBottom: [0.16, 0.26],
    chamferAngle: [0.5, 0.66],
    wheelRadius: [0.36, 0.42],
    wheelWidth: [0.26, 0.32],
    frontAxle: [0.64, 0.72],
    rearAxle: [0.62, 0.7],
    slant: [0.05, 0.12],
    chamferTopVar: [0.55, 1.1],
    lamps: {
      front: { h: 0.45, y: 0.62, w: 0.26, corner: true, wrap: 0.02 },
      rear: { h: 0.36, y: 0.62, w: 0.3, corner: true, wrap: 0.02 },
    },
  },
  hatchback: {
    label: "Hatchback",
    length: [3.4, 3.9],
    halfWidth: [0.84, 0.92],
    beltline: [0.92, 1.02],
    floor: [0.4, 0.46],
    cabinStart: [0.32, 0.38],
    cabinEnd: [0.72, 0.8],
    roofHeight: [1.4, 1.52],
    cabinInset: [0.16, 0.22],
    cabinTaper: [0.86, 0.92],
    windshieldRake: [0.24, 0.32],
    backlightRake: [0.12, 0.2],
    noseTaper: [0.82, 0.9],
    tailTaper: [0.9, 0.98],
    noseDrop: [0.82, 0.92],
    tailDrop: [0.92, 1.0],
    chamferTop: [0.24, 0.36],
    chamferBottom: [0.14, 0.22],
    chamferAngle: [0.45, 0.6],
    wheelRadius: [0.33, 0.39],
    wheelWidth: [0.24, 0.3],
    frontAxle: [0.66, 0.74],
    rearAxle: [0.66, 0.74],
    slant: [0.04, 0.1],
    chamferTopVar: [0.6, 1.1],
    lamps: {
      front: { h: 0.5, y: 0.58, w: 0.18, corner: true, wrap: 0.02 },
      rear: { h: 0.55, y: 0.6, w: 0.16, corner: true, wrap: 0.025 },
    }, // upright corner rectangles
  },
  pickup: {
    label: "Pickup",
    length: [4.5, 5.2],
    halfWidth: [0.9, 0.98],
    beltline: [1.0, 1.12],
    floor: [0.46, 0.54],
    cabinStart: [0.4, 0.46],
    cabinEnd: [0.66, 0.72],
    roofHeight: [1.5, 1.62],
    cabinInset: [0.16, 0.2],
    cabinTaper: [0.88, 0.94],
    windshieldRake: [0.2, 0.28],
    backlightRake: [0.12, 0.18],
    noseTaper: [0.86, 0.94],
    tailTaper: [0.94, 1.0],
    noseDrop: [0.84, 0.92],
    tailDrop: [0.96, 1.0],
    chamferTop: [0.14, 0.24],
    chamferBottom: [0.12, 0.2],
    chamferAngle: [0.4, 0.55],
    wheelRadius: [0.4, 0.48],
    wheelWidth: [0.3, 0.36],
    frontAxle: [0.66, 0.74],
    rearAxle: [0.66, 0.74],
    bed: true,
    bedStart: [0.66, 0.72],
    bedDrop: [0.74, 0.8], // shallow open bed, high side walls (xyz's white pickup)
    slant: [0.05, 0.12],
    lamps: {
      front: { h: 0.5, y: 0.55, w: 0.14, corner: true, wrap: 0.02 },
      rear: { h: 0.5, y: 0.6, w: 0.14, corner: true, wrap: 0.02 },
    },
  },
  van: {
    label: "Van",
    length: [4.2, 4.8],
    halfWidth: [0.92, 1.0],
    beltline: [1.1, 1.25],
    floor: [0.42, 0.5],
    cabinStart: [0.26, 0.32],
    cabinEnd: [0.92, 0.98],
    roofHeight: [1.78, 1.96],
    cabinInset: [0.1, 0.16],
    cabinTaper: [0.9, 0.96],
    windshieldRake: [0.1, 0.18],
    backlightRake: [0.04, 0.1],
    noseTaper: [0.86, 0.94],
    tailTaper: [0.94, 1.0],
    noseDrop: [0.86, 0.94],
    tailDrop: [0.96, 1.0],
    chamferTop: [0.16, 0.26],
    chamferBottom: [0.12, 0.2],
    chamferAngle: [0.42, 0.56],
    wheelRadius: [0.36, 0.42],
    wheelWidth: [0.26, 0.32],
    frontAxle: [0.68, 0.76],
    rearAxle: [0.64, 0.72],
    slant: [0.02, 0.06],
    lamps: {
      front: { h: 0.24, y: 0.58, w: 0.34, z: 0.55 },
      rear: { h: 0.5, y: 0.62, w: 0.14, corner: true, wrap: 0.02 },
    }, // slim inboard strips up front
  },
  sports: {
    label: "Sports",
    length: [4.1, 4.6],
    halfWidth: [0.94, 1.04],
    beltline: [0.72, 0.82],
    floor: [0.28, 0.36],
    cabinStart: [0.34, 0.4],
    cabinEnd: [0.56, 0.62],
    roofHeight: [1.02, 1.14],
    cabinInset: [0.2, 0.26],
    cabinTaper: [0.78, 0.86],
    windshieldRake: [0.36, 0.46],
    backlightRake: [0.4, 0.52],
    noseTaper: [0.78, 0.88],
    tailTaper: [0.82, 0.92],
    noseDrop: [0.64, 0.76],
    tailDrop: [0.72, 0.84],
    chamferTop: [0.34, 0.48],
    chamferBottom: [0.2, 0.3],
    chamferAngle: [0.55, 0.7],
    wheelRadius: [0.38, 0.44],
    wheelWidth: [0.32, 0.4],
    frontAxle: [0.66, 0.74],
    rearAxle: [0.64, 0.72],
    slant: [0.06, 0.14],
    chamferTopVar: [0.55, 1.1],
    lamps: {
      front: { h: 0.34, y: 0.66, w: 0.3, z: 0.52 },
      rear: { h: 0.26, y: 0.66, w: 0.34, z: 0.5 },
    }, // rectangles set into the face, off the corners
  },
  muscle: {
    label: "Muscle",
    length: [4.7, 5.2],
    halfWidth: [0.96, 1.04],
    beltline: [0.84, 0.94],
    floor: [0.34, 0.42],
    cabinStart: [0.26, 0.32],
    cabinEnd: [0.52, 0.58],
    roofHeight: [1.12, 1.24],
    cabinInset: [0.16, 0.22],
    cabinTaper: [0.82, 0.9],
    windshieldRake: [0.3, 0.4],
    backlightRake: [0.34, 0.46],
    noseTaper: [0.86, 0.94],
    tailTaper: [0.86, 0.94],
    noseDrop: [0.74, 0.86],
    tailDrop: [0.82, 0.92],
    chamferTop: [0.24, 0.36],
    chamferBottom: [0.16, 0.26],
    chamferAngle: [0.5, 0.64],
    wheelRadius: [0.38, 0.44],
    wheelWidth: [0.3, 0.38],
    frontAxle: [0.66, 0.74],
    rearAxle: [0.62, 0.7],
    cPillar: [0.18, 0.34], // long hood, low fastback roof, thick C-pillar
    slant: [0.06, 0.14],
    chamferTopVar: [0.55, 1.1],
    lamps: {
      front: { h: 0.4, y: 0.62, w: 0.26, z: 0.55 },
      rear: { h: 0.3, y: 0.62, w: 0.38, z: 0.5 },
    },
  },
  // Cab-over semi tractor (the red truck in xyz's gif): tall boxy cab at the very
  // front with a glass band all the way around, behind it a low flat chassis deck
  // dropping straight down off the cab's back wall, rear axle far back under the deck.
  truck: {
    label: "Truck",
    length: [5.0, 5.6],
    halfWidth: [1.0, 1.08],
    beltline: [1.42, 1.5],
    floor: [0.46, 0.52],
    cabinStart: [0.54, 0.58],
    cabinEnd: [0.96, 0.985],
    roofHeight: [2.2, 2.32],
    cabinInset: [0.05, 0.08],
    cabinTaper: [0.92, 0.96],
    windshieldRake: [0.06, 0.1],
    backlightRake: [0.04, 0.07],
    noseTaper: [0.93, 0.98],
    tailTaper: [0.97, 1.0],
    noseDrop: [0.96, 1.0],
    tailDrop: [1.0, 1.0],
    chamferTop: [0.1, 0.16],
    chamferBottom: [0.08, 0.14],
    chamferAngle: [0.45, 0.55],
    wheelRadius: [0.44, 0.48],
    wheelWidth: [0.38, 0.44],
    frontAxle: [0.7, 0.76],
    rearAxle: [0.78, 0.84],
    bed: true,
    bedStart: [0.54, 0.58],
    bedDrop: [0.66, 0.7], // thick low deck riding just over the big rear wheels
    lamps: {
      front: { h: 0.45, y: 0.42, w: 0.13, corner: true, wrap: 0.015 },
      rear: { h: 0.6, y: 0.55, w: 0.16, corner: true, wrap: 0.02 },
    }, // tall cab strips; small deck-end tiles
  },
  // Monster truck (xyz's c10b morph gif): a chunky muscle body jacked way up on
  // huge wheels that sit OUTSIDE the body, glass band wrapping the whole cabin.
  monster: {
    label: "Monster",
    length: [3.7, 4.1],
    halfWidth: [0.92, 1.0],
    beltline: [1.28, 1.4],
    floor: [0.66, 0.74],
    cabinStart: [0.3, 0.36],
    cabinEnd: [0.64, 0.7],
    roofHeight: [1.78, 1.92],
    cabinInset: [0.12, 0.16],
    cabinTaper: [0.84, 0.9],
    windshieldRake: [0.3, 0.38],
    backlightRake: [0.3, 0.38],
    noseTaper: [0.88, 0.94],
    tailTaper: [0.9, 0.96],
    noseDrop: [0.88, 0.94],
    tailDrop: [0.9, 0.97],
    chamferTop: [0.2, 0.3],
    chamferBottom: [0.1, 0.18],
    chamferAngle: [0.5, 0.6],
    wheelRadius: [0.56, 0.62],
    wheelWidth: [0.42, 0.5],
    frontAxle: [0.58, 0.64],
    rearAxle: [0.58, 0.64],
    wheelOut: true,
    slant: [0.04, 0.1],
    chamferTopVar: [0.6, 1.1],
    lamps: {
      front: { h: 0.38, y: 0.6, w: 0.24, z: 0.55 },
      rear: { h: 0.3, y: 0.6, w: 0.28, z: 0.5 },
    },
  },
  // Replica of xyz's "official cybertruck DLC" (source thread posts 25-27): the
  // windshield is one unbroken plane from the nose top to the peak (no hood kink),
  // and the rear slope lands on a RAISED tail deck (deckRise = xyz's back_elev/back_lift).
  // Dimensions lifted 1:1 from Vidal's reference GLB (tesla_cybertruck_low-poly.glb,
  // x1.1): peak 1.76 at ~57%, windshield base at 91% (h 1.18), flat-ish belt with a
  // gentle deck rise to a 1.34 tailgate, hood sloping to a 1.0 nose, one straight
  // tonneau line peak->tail, side glass inset ~5cm (thin body rail), wheels r 0.44
  // on axles 0.72/0.60.
  cyber: {
    label: "Cybertruck",
    length: [5.4, 5.6],
    halfWidth: [0.99, 1.03],
    beltline: [1.19, 1.22],
    floor: [0.3, 0.33],
    cabinStart: [0.0, 0.01],
    cabinEnd: [0.9, 0.92],
    roofHeight: [1.74, 1.78],
    cabinInset: [0.04, 0.06],
    cabinTaper: [0.76, 0.82],
    windshieldRake: [0.35, 0.37],
    backlightRake: [0.58, 0.6],
    noseTaper: [1.0, 1.0],
    tailTaper: [1.0, 1.0],
    noseDrop: [0.83, 0.86],
    tailDrop: [1.0, 1.0],
    hoodSlope: true,
    chamferTop: [0.08, 0.11],
    chamferBottom: [0.1, 0.14],
    chamferAngle: [0.5, 0.6],
    wheelRadius: [0.43, 0.45],
    wheelWidth: [0.39, 0.42],
    frontAxle: [0.71, 0.73],
    rearAxle: [0.59, 0.61],
    cPillar: [0.38, 0.42],
    deckRise: [0.12, 0.15],
    paint: "steel",
    lamps: { front: { bar: true }, rear: { bar: true } }, // full-width bars like the GLB
  },
};

export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

// Slider metadata the UI builds from. Each edits one numeric param in place.
export const SLIDERS = [
  { key: "length", label: "Length", min: 3.2, max: 5.4, step: 0.02 },
  { key: "halfWidth", label: "Width", min: 0.78, max: 1.1, step: 0.01 },
  { key: "beltline", label: "Body height", min: 0.68, max: 1.3, step: 0.01 },
  { key: "roofHeight", label: "Roof height", min: 1.0, max: 2.0, step: 0.01 },
  {
    key: "cabinLen",
    lockFields: ["cabinStart", "cabinEnd"],
    label: "Cabin length",
    min: 0.16,
    max: 0.7,
    step: 0.01,
    derived: true,
  },
  {
    key: "wheelbase",
    lockFields: ["frontAxle", "rearAxle"],
    label: "Wheelbase",
    min: 0.5,
    max: 0.92,
    step: 0.01,
    derived: true,
  },
  { key: "wheelRadius", label: "Wheel size", min: 0.3, max: 0.62, step: 0.01 },
  { key: "track", label: "Wheel inset", min: 0, max: 0.35, step: 0.01 },
  { key: "chamferTop", label: "Chamfer top", min: 0.0, max: 0.55, step: 0.01 },
  {
    key: "chamferBottom",
    label: "Chamfer bottom",
    min: 0.0,
    max: 0.4,
    step: 0.01,
  },
  {
    key: "chamferAngle",
    label: "Chamfer angle",
    min: 0.2,
    max: 0.85,
    step: 0.01,
  },
  { key: "cPillar", label: "C-pillar", min: 0.0, max: 0.7, step: 0.01 },
];

const r2 = (v) => Math.round(v * 1000) / 1000;

// Sample a full param set from a seed (+ optional fixed archetype).
export function paramsFromSeed(seed, archetype) {
  const r = makeRng(seed);
  const key =
    archetype && ARCHETYPES[archetype]
      ? archetype
      : rng.pick(r, ARCHETYPE_KEYS);
  const a = ARCHETYPES[key];
  const s = (name) => r2(rng.range(r, a[name][0], a[name][1]));
  const p = {
    seed: seed >>> 0,
    archetype: key,
    length: s("length"),
    halfWidth: s("halfWidth"),
    beltline: s("beltline"),
    floor: s("floor"),
    cabinStart: s("cabinStart"),
    cabinEnd: s("cabinEnd"),
    roofHeight: s("roofHeight"),
    cabinInset: s("cabinInset"),
    cabinTaper: s("cabinTaper"),
    windshieldRake: s("windshieldRake"),
    backlightRake: s("backlightRake"),
    noseTaper: s("noseTaper"),
    tailTaper: s("tailTaper"),
    noseDrop: s("noseDrop"),
    tailDrop: s("tailDrop"),
    chamferTop: s("chamferTop"),
    chamferBottom: s("chamferBottom"),
    chamferAngle: s("chamferAngle"),
    wheelRadius: s("wheelRadius"),
    wheelWidth: s("wheelWidth"),
    frontAxle: s("frontAxle"),
    rearAxle: s("rearAxle"),
    color: {
      h: r2(r()),
      s: r2(rng.range(r, 0.45, 0.85)),
      l: r2(rng.range(r, 0.42, 0.6)),
    },
  };
  if (a.bed) {
    p.bed = true;
    p.bedStart = s("bedStart");
    p.bedDrop = s("bedDrop");
  }
  if (a.deckRise) p.deckRise = s("deckRise");
  if (a.hoodSlope) p.noseDropStart = p.cabinEnd; // hood = one plane from windshield base to nose
  if (a.wheelOut) p.wheelOut = true;
  p.track = 0; // wheel inset slider: 0 = default stance, >0 pulls the wheels inboard
  if (a.lamps) {
    p.lampF = { ...a.lamps.front };
    p.lampR = { ...a.lamps.rear };
  }
  // xyz's front/back box sloping + variable top chamfer + spoke size
  if (a.slant) {
    p.noseSlant = s("slant");
    p.tailSlant = s("slant");
  }
  if (a.chamferTopVar) {
    p.chamferTopF = s("chamferTopVar");
    p.chamferTopB = s("chamferTopVar");
  }
  p.spokeSize = r2(rng.range(r, 0.42, 0.6));
  // stainless-steel archetypes ignore the sampled paint: dark gunmetal grey
  if (a.paint === "steel") {
    p.color = {
      h: r2(rng.range(r, 0.55, 0.62)),
      s: r2(rng.range(r, 0.04, 0.08)),
      l: r2(rng.range(r, 0.24, 0.32)),
    };
  }
  p.cPillar = a.cPillar ? s("cPillar") : 0;
  return p;
}

// Friendly derived sliders: "cabinLen" resizes the cabin around its centre,
// "wheelbase" pushes both axles in/out keeping their front/rear ratio.
export function setDerived(p, key, value) {
  if (key === "cabinLen") {
    const mid = (p.cabinStart + p.cabinEnd) / 2;
    const half = Math.max(0.06, value / 2);
    p.cabinStart = Math.max(0.08, mid - half);
    p.cabinEnd = Math.min(0.96, mid + half);
  } else if (key === "wheelbase") {
    const avg = (p.frontAxle + p.rearAxle) / 2 || 0.7;
    const k = value / avg;
    p.frontAxle = r2(Math.min(0.95, Math.max(0.3, p.frontAxle * k)));
    p.rearAxle = r2(Math.min(0.95, Math.max(0.3, p.rearAxle * k)));
  } else {
    p[key] = value;
  }
}
export const getDerived = (p, key) =>
  key === "cabinLen"
    ? r2(p.cabinEnd - p.cabinStart)
    : key === "wheelbase"
      ? r2((p.frontAxle + p.rearAxle) / 2)
      : p[key];

// Compact URL config: base64 of JSON. Survives manual slider tweaks.
export { encodeConfig, decodeConfig } from "@engine/state.js";
