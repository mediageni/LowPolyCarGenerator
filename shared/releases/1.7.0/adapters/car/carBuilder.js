// The pure, reusable core: params -> THREE.Group (a flat-shaded low-poly car).
// No UI, no globals. Materials are injected so any visual style can reskin it.
// Body is a lofted run of chamfered octagon cross-sections (the source project's
// top+bottom chamfer idea); greenhouse, wheels and lights sit on top.

import * as THREE from "three";
import { shapeSegments } from "@engine/finish.js";
import { addCarDetails } from "./details.js";
import {
  carShape,
  stationProfile,
  crossSection,
  halfWidthAtY,
  lightPlacements,
} from "./bodyProfile.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const vlerp = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// --- low-level mesh assembly -------------------------------------------------

function tri(pos, a, b, c) {
  pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}
function quad(pos, a, b, c, d) {
  tri(pos, a, b, c);
  tri(pos, a, c, d);
}

function meshFrom(positions, material, edges) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  if (edges) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 22), edges);
    m.add(e);
  }
  return m;
}

// --- body --------------------------------------------------------------------

function buildBody(p, mat, edges) {
  // Cross-sections from the shared loft math — the lights reuse the same profiles.
  const STATIONS = [0, 0.08, 0.22, 0.4, 0.6, 0.78, 0.92, 1];
  if (p._physicalBody) {
    for (const axle of [
      (p.frontAxle * p.length) / 2,
      (-p.rearAxle * p.length) / 2,
    ])
      for (let i = 0; i <= 14; i++) {
        const x = axle + p._archRadius * Math.cos((Math.PI * i) / 14);
        STATIONS.push(clamp(x / p.length + 0.5, 0.001, 0.999));
      }
    STATIONS.sort((a, b) => a - b);
  }
  if (p.bed) {
    // extra ring pair at the cab's rear so the deck wall drops truly vertical
    STATIONS.push(
      clamp(p.cabinStart - 0.022, 0, 1),
      clamp(p.cabinStart + 0.004, 0, 1),
    );
    STATIONS.sort((a, b) => a - b);
  }
  const stations = p._physicalBody
    ? STATIONS.filter((t, i) => !i || Math.abs(t - STATIONS[i - 1]) > 1e-9)
    : STATIONS;
  const rings = stations.map((t) => {
    const pr = stationProfile(p, t);
    return { pr, pts: crossSection(pr).map(([z, y]) => [pr.x, y, z]) };
  });
  // xyz's front/back box sloping: the end faces lean back at the bottom (the offset
  // is linear in height, so the slanted cap stays planar).
  const slantEnd = (ring, amt, dir) => {
    const { yt, yb } = ring.pr;
    for (const v of ring.pts)
      v[0] += (dir * amt * (yt - v[1])) / Math.max(1e-6, yt - yb);
  };
  if (p.noseSlant) slantEnd(rings[rings.length - 1], p.noseSlant, -1);
  if (p.tailSlant) slantEnd(rings[0], p.tailSlant, 1);

  const pos = [];
  const N = 8;
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i],
      B = rings[i + 1];
    for (let k = 0; k < N; k++) {
      const k2 = (k + 1) % N;
      // wound so the loft's face normals point outward (front-face culling friendly)
      quad(pos, A.pts[k], A.pts[k2], B.pts[k2], B.pts[k]);
    }
  }
  // end caps (triangle fans)
  const cap = (ring, flip) => {
    const c = ring.pts;
    for (let k = 1; k < N - 1; k++) {
      flip ? tri(pos, c[0], c[k + 1], c[k]) : tri(pos, c[0], c[k], c[k + 1]);
    }
  };
  cap(rings[0], true);
  cap(rings[rings.length - 1], false);
  return meshFrom(pos, mat, edges);
}

// --- greenhouse (cabin): a raked frustum; sides/front/back = glass, top = body ---

function buildCabin(p, bodyMat, glassMat, edges) {
  const L = p.length;
  const xR = -L / 2 + p.cabinStart * L; // rear of cabin
  const xF = -L / 2 + p.cabinEnd * L; // front of cabin
  const len = xF - xR;
  const belt = p.beltline * 0.98;
  const roof = p.roofHeight;

  // On a raised tail deck (Cybertruck) both base edges ride the actual body top —
  // windshield starts at the nose's top edge (one unbroken nose-to-peak plane) and
  // the backlight lands on the tailgate's top edge instead of down at the belt.
  const prF = stationProfile(p, p.cabinEnd),
    prR = stationProfile(p, p.cabinStart);
  const beltF = p.deckRise ? prF.yt : belt;
  const beltR = p.deckRise ? prR.yt : belt;

  // cabin can never be wider than the (tapered, chamfered) body under its base —
  // otherwise the windshield overhangs the nose sideways
  const Wc = Math.min(
    p.halfWidth * (1 - p.cabinInset),
    halfWidthAtY(prF, beltF) - 0.012,
    halfWidthAtY(prR, Math.min(beltR, prR.yt)) - 0.012,
  );
  const Wt = Wc * p.cabinTaper;
  const rakeF = len * p.windshieldRake; // windshield pulled back at top
  const rakeR = len * p.backlightRake; // backlight pulled forward at top

  // On the Cybertruck tent the glass base edges ARE the body's top corner lines —
  // same height (yt), same width (top-surface corner) — so the hood edge and glass
  // edge form ONE continuous line from any angle, with no step, sliver or overhang.
  const wF = p.deckRise ? prF.halfW - prF.tcz - 0.001 : Wc;
  const wR = p.deckRise ? prR.halfW - prR.tcz - 0.001 : Wc;

  // 8 corners: b=bottom(belt), t=top(roof); f/r = front/rear, l/r = left/right(+/-z)
  const bfl = [xF, beltF, wF],
    bfr = [xF, beltF, -wF];
  const brl = [xR, beltR, wR],
    brr = [xR, beltR, -wR];
  const tfl = [xF - rakeF, roof, Wt],
    tfr = [xF - rakeF, roof, -Wt];
  const trl = [xR + rakeR, roof, Wt],
    trr = [xR + rakeR, roof, -Wt];

  const glass = [],
    solid = [];
  quad(glass, bfl, bfr, tfr, tfl); // windshield
  // on a raised deck (Cybertruck) the peak-to-tail slope is the metal tonneau, not glass
  quad(p.deckRise ? solid : glass, brr, brl, trl, trr); // backlight

  // side windows. cPillar (0..1) closes the rear fraction into a solid body panel
  // — the thick C-pillar of muscle cars, semi-trucks and windowless vans.
  const c = clamp(p.cPillar || 0, 0, 0.9);
  if (c > 0.02) {
    const dbl = vlerp(brl, bfl, c),
      dtl = vlerp(trl, tfl, c); // left split (bottom/top)
    const dbr = vlerp(brr, bfr, c),
      dtr = vlerp(trr, tfr, c); // right split
    quad(glass, bfl, tfl, dtl, dbl); // left window (front part)
    quad(solid, dbl, dtl, trl, brl); // left C-pillar (rear part)
    quad(glass, bfr, dbr, dtr, tfr); // right window (front part)
    quad(solid, dbr, brr, trr, dtr); // right C-pillar (rear part)
  } else {
    quad(glass, bfl, tfl, trl, brl); // left windows
    quad(glass, bfr, brr, trr, tfr); // right windows
  }

  quad(solid, tfl, tfr, trr, trl); // roof panel — always body-coloured

  const cabin = new THREE.Group();
  cabin.name = "Cabin";
  cabin.userData.profile = { bfl, bfr, brl, brr, tfl, tfr, trl, trr };
  cabin.add(meshFrom(glass, glassMat, edges));
  cabin.add(meshFrom(solid, bodyMat, edges));
  return cabin;
}

// --- wheels ------------------------------------------------------------------

function buildWheels(p, tireMat, hubMat) {
  const r = p.wheelRadius,
    w = p.wheelWidth;
  // monster trucks carry their wheels OUTSIDE the body instead of tucked under it;
  // p.track (Wheel inset slider) pulls them further inboard
  const z =
    (p.wheelOut ? p.halfWidth + w * 0.38 : p.halfWidth - w * 0.12) -
    (p.track || 0);
  const xF = p.frontAxle * (p.length / 2);
  const xR = -p.rearAxle * (p.length / 2);
  const thickness = Math.min(w * 0.42, r * 0.32);
  const tire = p._physicalBody
    ? new THREE.TorusGeometry(
        r - thickness,
        thickness,
        shapeSegments(6),
        shapeSegments(20),
      )
    : new THREE.CylinderGeometry(r, r, w, shapeSegments(16));
  if (p._physicalBody) tire.scale(1, 1, (w * 0.5) / thickness);
  else tire.rotateX(Math.PI / 2); // axis Y -> Z
  const spoke = r * (p.spokeSize || 0.5); // xyz's spoke_size param
  const hub = new THREE.CylinderGeometry(
    spoke,
    spoke,
    w * 1.04,
    shapeSegments(10),
  );
  hub.rotateX(Math.PI / 2);

  const group = new THREE.Group();
  group.name = "wheels"; // styles can spin/shake these to fake driving
  for (const [x, sz] of [
    [xF, 1],
    [xF, -1],
    [xR, 1],
    [xR, -1],
  ]) {
    const t = new THREE.Mesh(tire, tireMat);
    t.position.set(x, r, sz * z);
    t.castShadow = true;
    const h = new THREE.Mesh(hub, hubMat);
    h.position.set(x, r, sz * z);
    group.add(t, h);
  }
  group.userData.radius = r;
  return group;
}

// --- lights ------------------------------------------------------------------

function buildLights(p, frontMat, rearMat) {
  const g = new THREE.Group();
  // Placements come from the shared body math. Lamps are FLAT, painted-on quads.
  // Corner lamps are ONE mesh: a face quad and a flank quad sharing the exact same
  // corner-edge vertices, so the lamp always reads as a single rectangle folding
  // around the corner — it can never split or show a gap.
  for (const lamp of lightPlacements(p)) {
    const mat = lamp.front ? frontMat : rearMat;
    mat.side = THREE.DoubleSide; // shear-built quads: don't depend on winding
    const dirF = lamp.front ? 1 : -1;
    if (lamp.wrap) {
      const y1 = lamp.y - lamp.h / 2,
        y2 = lamp.y + lamp.h / 2;
      // x of the (possibly slanted) cap plane at height yy, a hair proud of it
      const capX = (yy) =>
        lamp.prX - (dirF * lamp.sl * (lamp.yt - yy)) / lamp.fh + dirF * 0.006;
      const cos = Math.cos(lamp.yaw),
        sin = Math.sin(lamp.yaw);
      for (const sz of [1, -1]) {
        const pos = [];
        const zE = sz * (lamp.surf + 0.004),
          zI = sz * (lamp.surf - lamp.w);
        const e1 = [capX(y1), y1, zE],
          e2 = [capX(y2), y2, zE]; // shared corner edge
        quad(pos, [capX(y1), y1, zI], [capX(y2), y2, zI], e2, e1); // face quad
        const fz = (yy) => sz * (lamp.surf + 0.004 + sin * lamp.sideLen);
        quad(
          pos,
          e1,
          e2,
          [e2[0] - dirF * cos * lamp.sideLen, y2, fz(y2)],
          [e1[0] - dirF * cos * lamp.sideLen, y1, fz(y1)],
        ); // flank quad
        const m = meshFrom(pos, mat);
        m.castShadow = m.receiveShadow = false; // painted-on: must not shade the body
        g.add(m);
      }
    } else {
      const face = new THREE.BoxGeometry(lamp.depth, lamp.h, lamp.w);
      for (const sz of [1, -1]) {
        const m = new THREE.Mesh(face, mat);
        m.position.set(lamp.x, lamp.y, sz * lamp.zc);
        m.rotation.z = lamp.front ? lamp.tilt : -lamp.tilt; // follow a slanted end face
        g.add(m);
      }
    }
  }
  return g;
}

// --- public API --------------------------------------------------------------

// mats: { body, glass, tire, hub, lightFront, lightRear, edges? }
export function buildCar(p, mats) {
  p = carShape(p);
  const car = new THREE.Group();
  car.name = "car";
  const body = buildBody(p, mats.body, mats.edges);
  body.name = "Body";
  car.add(body);
  const cabin = buildCabin(p, mats.body, mats.glass, mats.edges);
  // Build the cabin only when enabled; detail positions reuse its actual profile.
  if (p.cabinOn !== false) car.add(cabin);
  if (p.wheelsOn !== false) car.add(buildWheels(p, mats.tire, mats.hub));
  if (p.lightsOn !== false) {
    const lights = buildLights(p, mats.lightFront, mats.lightRear);
    lights.name = "Lights";
    car.add(lights);
  }
  addCarDetails(car, p, mats, cabin);
  if (p.cabinOn === false)
    for (const child of cabin.children) {
      child.traverse((node) => node.geometry?.dispose());
    }

  const box = new THREE.Box3().setFromObject(car);
  const size = new THREE.Vector3(),
    center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  car.userData.size = size;
  car.userData.center = center;
  return car;
}
