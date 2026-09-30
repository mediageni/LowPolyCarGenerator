import { part, box, tube, ring, mergePart } from "@engine/geometry.js";
import {
  detailOption,
  detailRule,
  booleanRule,
  detailed,
  choices,
  toggle,
} from "@engine/options.js";
import { stationProfile, halfWidthAtY } from "./bodyProfile.js";

export function enrichCar(params, legacy = false) {
  return {
    ...params,
    detailVersion: legacy ? 0 : 1,
    cabinOn: true,
    wheelsOn: true,
    lightsOn: true,
    mirrorsOn: true,
    trimOn: true,
    bumperOn: true,
    wheelType: ["monster", "pickup"].includes(params.archetype)
      ? "offroad"
      : "spoke",
    accessory: params.archetype === "sports" ? "spoiler" : "none",
  };
}
export const CAR_SCHEMA = {
  detailVersion: detailRule,
  cabinOn: booleanRule,
  wheelsOn: booleanRule,
  lightsOn: booleanRule,
  mirrorsOn: booleanRule,
  trimOn: booleanRule,
  bumperOn: booleanRule,
  wheelType: { type: "enum", values: ["solid", "spoke", "offroad"] },
  accessory: { type: "enum", values: ["none", "spoiler", "rack"] },
};
export const CAR_OPTIONS = [
  detailOption,
  choices(
    "wheelType",
    "Wheel design",
    [
      ["solid", "Solid"],
      ["spoke", "Spokes"],
      ["offroad", "Off-road"],
    ],
    (p) => detailed(p) && p.wheelsOn,
  ),
  choices(
    "accessory",
    "Accessory",
    [
      ["none", "None"],
      ["spoiler", "Rear spoiler"],
      ["rack", "Roof rack"],
    ],
    (p) => detailed(p) && p.cabinOn,
  ),
  toggle("mirrorsOn", "Mirrors", (p) => detailed(p) && p.cabinOn),
  toggle("trimOn", "Pillars & door handles"),
  toggle("bumperOn", "Bumpers & grille"),
  toggle("cabinOn", "Cabin", () => true),
  toggle("wheelsOn", "Wheels", () => true),
  toggle("lightsOn", "Lights", () => true),
];
const interpolate = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export function addCarDetails(car, p, mats, cabin) {
  if (!detailed(p)) return;
  const { bfl, bfr, brl, brr, tfl, tfr, trl, trr } = cabin.userData.profile;
  if (p.trimOn) {
    const trim = part(car, "Pillars and handles");
    if (p.cabinOn)
      for (const [a, b] of [
        [bfl, tfl],
        [bfr, tfr],
        [brl, trl],
        [brr, trr],
      ])
        tube(trim, mats.body, a, b, p.length * 0.008, 4);
    if (p.cabinOn && !p.deckRise)
      for (const [a, b, c, d] of [
        [brl, bfl, trl, tfl],
        [brr, bfr, trr, tfr],
      ])
        tube(
          trim,
          mats.body,
          interpolate(a, b, 0.57),
          interpolate(c, d, 0.57),
          p.length * 0.006,
          4,
        );
    for (const t of [
      p.cabinStart + (p.cabinEnd - p.cabinStart) * 0.35,
      p.cabinStart + (p.cabinEnd - p.cabinStart) * 0.7,
    ]) {
      const profile = stationProfile(p, t),
        y = p.beltline * 0.83;
      for (const side of [-1, 1])
        box(
          trim,
          mats.hub,
          [p.length * 0.047, p.length * 0.012, 0.022],
          [profile.x, y, side * (halfWidthAtY(profile, y) + 0.018)],
        );
    }
    mergePart(trim);
  }
  if (p.mirrorsOn && p.cabinOn) {
    const mirrors = part(car, "Mirrors");
    for (const side of [-1, 1]) {
      const base = interpolate(
        side > 0 ? bfl : bfr,
        side > 0 ? tfl : tfr,
        0.24,
      );
      const end = [base[0] - 0.07, base[1], side * (Math.abs(base[2]) + 0.19)];
      tube(mirrors, mats.hub, base, end, 0.025);
      box(mirrors, mats.body, [0.2, 0.11, 0.09], end);
      box(
        mirrors,
        mats.glass,
        [0.008, 0.073, 0.07],
        [end[0] - 0.105, end[1], end[2]],
      );
    }
    mergePart(mirrors);
  }
  if (p.bumperOn) {
    const bumpers = part(car, "Bumpers and grille");
    for (const t of [0, 1]) {
      const pr = stationProfile(p, t),
        dir = t === 1 ? 1 : -1,
        y = pr.yb + (pr.yt - pr.yb) * 0.27;
      const cap =
        pr.x -
        (dir * (t === 1 ? p.noseSlant || 0 : p.tailSlant || 0) * (pr.yt - y)) /
          Math.max(0.01, pr.yt - pr.yb);
      box(
        bumpers,
        mats.hub,
        [0.08, 0.075, pr.halfW * 1.7],
        [cap + dir * 0.035, y, 0],
      );
      if (t === 1)
        for (let i = 0; i < 3; i++)
          box(
            bumpers,
            mats.tire,
            [0.012, 0.026, pr.halfW * 0.85],
            [cap + 0.085, y + 0.06 + i * 0.04, 0],
          );
    }
    mergePart(bumpers);
  }
  if (p.wheelsOn && p.wheelType !== "solid") {
    const wheels = car.getObjectByName("wheels");
    for (let i = 0; i < wheels.children.length; i += 2) {
      const tire = wheels.children[i],
        side = tire.position.z > 0 ? 1 : -1,
        r = p.wheelRadius;
      const detail = part(tire, "Wheel detail");
      for (let k = 0; k < 8; k++) {
        const angle = (k * Math.PI) / 4;
        tube(
          detail,
          mats.hub,
          [0, 0, side * p.wheelWidth * 0.535],
          [
            Math.cos(angle) * r * 0.72,
            Math.sin(angle) * r * 0.72,
            side * p.wheelWidth * 0.535,
          ],
          r * 0.055,
          4,
        );
      }
      ring(detail, mats.hub, r * 0.73, r * 0.025, [
        0,
        0,
        side * p.wheelWidth * 0.535,
      ]);
      if (p.wheelType === "offroad")
        for (let k = 0; k < 16; k++) {
          const a = (k * Math.PI) / 8;
          const tread = box(
            detail,
            mats.tire,
            [r * 0.2, r * 0.08, p.wheelWidth * 1.03],
            [Math.cos(a) * r, Math.sin(a) * r, 0],
          );
          tread.rotation.z = a - Math.PI / 2;
        }
      mergePart(detail);
    }
  }
  if (p.accessory !== "none" && p.cabinOn) {
    const group = part(
      car,
      p.accessory === "rack" ? "Roof rack" : "Rear spoiler",
    );
    if (p.accessory === "rack") {
      const a = interpolate(trl, tfl, 0.2),
        b = interpolate(trl, tfl, 0.72),
        width = Math.abs(a[2]) * 1.7;
      for (const point of [a, b])
        for (const side of [-1, 1])
          tube(
            group,
            mats.hub,
            [point[0], p.roofHeight, (side * width) / 2],
            [point[0], p.roofHeight + 0.12, (side * width) / 2],
            0.022,
          );
      for (const side of [-1, 1])
        tube(
          group,
          mats.hub,
          [a[0], p.roofHeight + 0.12, (side * width) / 2],
          [b[0], p.roofHeight + 0.12, (side * width) / 2],
          0.027,
        );
      for (const point of [a, b])
        tube(
          group,
          mats.hub,
          [point[0], p.roofHeight + 0.12, -width / 2],
          [point[0], p.roofHeight + 0.12, width / 2],
          0.027,
        );
    } else {
      const pr = stationProfile(p, 0.09),
        y = pr.yt;
      for (const side of [-1, 1])
        box(
          group,
          mats.hub,
          [0.05, 0.18, 0.04],
          [pr.x, y + 0.09, side * p.halfWidth * 0.55],
        );
      box(
        group,
        mats.body,
        [p.length * 0.08, 0.055, p.halfWidth * 1.65],
        [pr.x, y + 0.19, 0],
      );
    }
    mergePart(group);
  }
}
