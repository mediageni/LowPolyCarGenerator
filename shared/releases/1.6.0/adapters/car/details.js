import * as THREE from "three";
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
    if (
      p.cabinOn &&
      !p.deckRise &&
      p.archetype !== "truck" &&
      p.archetype !== "van"
    )
      for (const [a, b, c, d] of [
        [brl, bfl, trl, tfl],
        [brr, bfr, trr, tfr],
      ])
        tube(
          trim,
          mats.body,
          interpolate(a, b, p._doors === 2 ? 0.52 : 0.26),
          interpolate(c, d, p._doors === 2 ? 0.52 : 0.26),
          p.length * 0.006,
          4,
        );
    for (const fraction of p._doors === 2 ? [0.32, 0.76] : [0.55]) {
      const t = p.cabinStart + (p.cabinEnd - p.cabinStart) * fraction;
      const profile = stationProfile(p, t),
        y = Math.max(profile.yb + 0.028, p.beltline * 0.83);
      for (const side of [-1, 1])
        box(
          trim,
          mats.hub,
          [p.length * 0.047, p.length * 0.012, 0.022],
          [profile.x, y, side * (halfWidthAtY(profile, y) + 0.006)],
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
        [end[0] - 0.099, end[1], end[2]],
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
            [
              pr.x -
                ((p.noseSlant || 0) * (pr.yt - (y + 0.06 + i * 0.04))) /
                  Math.max(0.01, pr.yt - pr.yb) +
                0.004,
              y + 0.06 + i * 0.04,
              0,
            ],
          );
    }
    mergePart(bumpers);
  }
  addCarStructure(car, p, mats);
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

function addCarStructure(root, p, mats) {
  const structure = part(root, "Chassis and wheel arches");
  const radius = p._archRadius;
  const front = (p.frontAxle * p.length) / 2,
    rear = (-p.rearAxle * p.length) / 2;
  box(
    structure,
    mats.tire,
    [front - rear + p.wheelRadius * 0.7, 0.12, p.halfWidth * 1.1],
    [(front + rear) / 2, p.floor + 0.07, 0],
  );
  if (p.wheelsOn) {
    const z =
      (p.wheelOut
        ? p.halfWidth + p.wheelWidth * 0.38
        : p.halfWidth - p.wheelWidth * 0.12) - (p.track || 0);
    for (const x of [front, rear])
      tube(
        structure,
        mats.hub,
        [x, p.wheelRadius, -z],
        [x, p.wheelRadius, z],
        p.wheelRadius * 0.085,
        8,
      );
  }
  for (const x of [front, rear]) {
    for (const side of [-1, 1]) {
      const points = [];
      const start = Math.asin(
        Math.max(-0.9, Math.min(0.9, (p.floor - p.wheelRadius) / radius)),
      );
      for (let i = 0; i <= 14; i++) {
        const angle = start + ((Math.PI - start * 2) * i) / 14;
        const xx = x + Math.cos(angle) * radius,
          y = p.wheelRadius + Math.sin(angle) * radius;
        const profile = stationProfile(p, xx / p.length + 0.5);
        points.push([xx, y, side * (halfWidthAtY(profile, y) + 0.003)]);
      }
      for (let i = 1; i < points.length; i++)
        tube(
          structure,
          mats.body,
          points[i - 1],
          points[i],
          p.length * 0.003,
          5,
        );
    }
  }
  mergePart(structure);
  if (p.trimOn) {
    const doors = part(root, "Door seams");
    const body = root.getObjectByName("Body");
    body.updateWorldMatrix(true, false);
    for (let i = 0; i <= p._doors; i++) {
      const t =
        p.cabinStart +
        (p.cabinEnd - p.cabinStart) * (0.1 + (i / p._doors) * 0.74);
      const profile = stationProfile(p, t),
        bottom = Math.max(profile.yb + 0.025, p.floor + 0.08),
        top = Math.max(bottom + 0.015, p.beltline * 0.96);
      if (top > profile.yt) continue;
      for (const side of [-1, 1]) {
        const points = [];
        for (let j = 0; j <= 16; j++) {
          const y = bottom + ((top - bottom) * j) / 16;
          const hit = new THREE.Raycaster(
            new THREE.Vector3(profile.x, y, side * p.halfWidth * 2),
            new THREE.Vector3(0, 0, -side),
          ).intersectObject(body, false)[0];
          // Follow the actual triangulated panel, including chamfers. A single
          // straight tube used to disappear into it and leave black end slivers.
          if (hit)
            points.push([
              hit.point.x,
              hit.point.y,
              hit.point.z + side * p.length * 0.0006,
            ]);
        }
        for (let j = 1; j < points.length; j++)
          tube(
            doors,
            mats.tire,
            points[j - 1],
            points[j],
            p.length * 0.00085,
            4,
          );
      }
    }
    mergePart(doors);
  }
  if (p.archetype === "pickup") {
    const bed = part(root, "Open pickup bed");
    const back = 0.05,
      frontT = p.cabinStart - 0.035,
      middle = (back + frontT) / 2;
    const floor = p.beltline * p.bedDrop,
      height = p.beltline - floor;
    const len = (frontT - back) * p.length,
      width = p.halfWidth * 1.8;
    const y = floor + height / 2;
    box(
      bed,
      mats.tire,
      [len, 0.025, width * 0.88],
      [-p.length / 2 + middle * p.length, floor + 0.018, 0],
    );
    for (const side of [-1, 1])
      box(
        bed,
        mats.body,
        [len, height, 0.09],
        [-p.length / 2 + middle * p.length, y, (side * width) / 2],
      );
    for (const t of [back, frontT])
      box(
        bed,
        mats.body,
        [0.08, height, width],
        [-p.length / 2 + t * p.length, y, 0],
      );
    mergePart(bed);
  }
  if (p.archetype === "muscle") {
    const hood = part(root, "Hood scoop"),
      profile = stationProfile(p, 0.78);
    box(
      hood,
      mats.body,
      [p.length * 0.15, 0.095, p.halfWidth * 0.45],
      [profile.x, profile.yt + 0.035, 0],
    );
    box(
      hood,
      mats.tire,
      [0.02, 0.06, p.halfWidth * 0.37],
      [profile.x + p.length * 0.075, profile.yt + 0.035, 0],
    );
    mergePart(hood);
  }
  if (p.archetype === "truck") {
    const hitch = part(root, "Fifth wheel");
    const profile = stationProfile(p, 0.25);
    const plate = ring(hitch, mats.hub, p.halfWidth * 0.44, 0.055, [
      profile.x,
      profile.yt + 0.045,
      0,
    ]);
    plate.rotation.x = Math.PI / 2;
    for (const x of [profile.x - 0.12, profile.x + 0.12])
      box(
        hitch,
        mats.hub,
        [0.07, 0.075, p.halfWidth * 0.7],
        [x, profile.yt + 0.025, 0],
      );
    mergePart(hitch);
  }
}
