// Three selectable visual styles. Each builds a "rig" (lights + ground + bg)
// and a material set for the car. Swapping styles reskins the same geometry.

import * as THREE from "three";

import {
  col,
  std,
  groundPlane as sharedGround,
  gradientSky,
  sunRig,
} from "@engine/materials.js";
const groundPlane = (material) => sharedGround(material, 60);

// --- Open Road: xyz's dusk test-drive scene — hazy sky, asphalt with lane lines ---
const road = {
  label: "Open Road",
  background: new THREE.Color("#97a3ab"),
  fog: new THREE.Fog(0x97a3ab, 16, 48),
  exposure: 1.05,
  rig() {
    const g = new THREE.Group();
    g.add(new THREE.HemisphereLight(0xd3dbe1, 0x3c4148, 0.7));
    const sun = new THREE.DirectionalLight(0xffe2b8, 1.5);
    sun.position.set(-7, 7, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -8;
    sun.shadow.camera.right = sun.shadow.camera.top = 8;
    sun.shadow.bias = -0.0003;
    g.add(sun);
    g.add(
      groundPlane(std({ color: 0x565c64, roughness: 0.95, metalness: 0.0 })),
    ); // asphalt
    // lane markings: solid edge lines + dashed lane lines, like xyz's dummy road
    const lineMat = std({ color: 0xe3cf96, roughness: 0.85 });
    const solid = new THREE.BoxGeometry(60, 0.012, 0.14);
    for (const z of [-3.8, 3.8]) {
      const m = new THREE.Mesh(solid, lineMat);
      m.position.set(0, 0.006, z);
      m.receiveShadow = true;
      g.add(m);
    }
    const dash = new THREE.BoxGeometry(1.5, 0.012, 0.14);
    const dashes = new THREE.Group();
    for (const z of [-1.4, 1.4])
      for (let x = -32; x <= 32; x += 3.2) {
        const m = new THREE.Mesh(dash, lineMat);
        m.position.set(x, 0.006, z);
        m.receiveShadow = true;
        dashes.add(m);
      }
    g.add(dashes);
    g.userData.dashes = dashes;
    return g;
  },
  // drive! — the road scrolls under the car and the wheels spin with a tiny shake,
  // like xyz's test-drive gif
  tick(rig, dt, car, t) {
    const SPEED = 7;
    const d = rig.userData.dashes;
    if (d)
      d.position.x = ((((d.position.x - SPEED * dt) % 3.2) + 3.2) % 3.2) - 3.2;
    const wheels = car && car.getObjectByName("wheels");
    if (wheels) {
      const r = wheels.userData.radius || 0.4;
      let i = 0;
      for (const w of wheels.children) {
        w.rotation.z -= (SPEED / r) * dt;
        w.position.y = r + Math.sin(t * 31 + i++) * 0.006; // subtle wheel shake
      }
    }
  },
  materials(color) {
    const c = col(color);
    return {
      body: std({ color: c, metalness: 0.05, roughness: 0.6 }),
      // matte near-black: every glass facet shades the same, so windshield, side
      // glass and roof strip read as ONE canopy (no "loose pieces" at facet breaks)
      glass: std({
        color: 0x07090d,
        metalness: 0.0,
        roughness: 0.9,
        transparent: true,
        opacity: 0.97,
        side: THREE.DoubleSide,
      }),
      tire: std({ color: 0x0e1013, roughness: 0.9 }),
      hub: std({
        color: c.clone().offsetHSL(0, -0.18, -0.1),
        metalness: 0.35,
        roughness: 0.55,
      }),
      lightFront: new THREE.MeshBasicMaterial({ color: 0xe8e4f6 }),
      lightRear: new THREE.MeshBasicMaterial({ color: 0xff4a1c }),
    };
  },
};

// --- Arcade Neon: dark studio, glowing grid, cool rim lights (matches GameHub) ---
const neon = {
  label: "Arcade Neon",
  background: new THREE.Color("#0a1421"),
  exposure: 1.15,
  rig() {
    const g = new THREE.Group();
    g.add(new THREE.HemisphereLight(0x6fd0ff, 0x101826, 0.5));
    const key = new THREE.DirectionalLight(0x9fe9ff, 1.5);
    key.position.set(6, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    g.add(key);
    const fill = new THREE.PointLight(0xff4fa3, 0.7, 40);
    fill.position.set(-7, 4, -5);
    g.add(fill);
    const rim = new THREE.PointLight(0x4fd6ff, 0.9, 40);
    rim.position.set(5, 3, -7);
    g.add(rim);
    g.add(
      groundPlane(std({ color: 0x0c1a2c, roughness: 0.9, metalness: 0.0 })),
    );
    const grid = new THREE.GridHelper(60, 60, 0x2f9bd6, 0x16486b);
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    grid.position.y = 0.002;
    g.add(grid);
    return g;
  },
  materials(color) {
    const c = col(color);
    return {
      body: std({
        color: c,
        metalness: 0.35,
        roughness: 0.42,
        emissive: c.clone().multiplyScalar(0.06),
      }),
      glass: std({
        color: 0x0a2230,
        metalness: 0.6,
        roughness: 0.15,
        transparent: true,
        opacity: 0.92,
        emissive: 0x112233,
        side: THREE.DoubleSide,
      }),
      tire: std({ color: 0x0c0e12, roughness: 0.85, metalness: 0.0 }),
      hub: std({
        color: c.clone().offsetHSL(0, -0.12, 0.06),
        metalness: 0.9,
        roughness: 0.25,
        emissive: 0x0a2a3a,
      }),
      lightFront: new THREE.MeshBasicMaterial({ color: 0xe8e4f6 }),
      lightRear: new THREE.MeshBasicMaterial({ color: 0xff4a1c }),
    };
  },
};

// --- Clean Studio: neutral showroom, soft shadows, matte paint ---
const studio = {
  label: "Clean Studio",
  background: new THREE.Color("#e9edf2"),
  exposure: 1.0,
  rig() {
    const g = new THREE.Group();
    g.add(new THREE.HemisphereLight(0xffffff, 0xb8bec8, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(5, 11, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    key.shadow.bias = -0.0003;
    g.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-6, 5, -4);
    g.add(fill);
    g.add(
      groundPlane(
        new THREE.MeshStandardMaterial({
          color: 0xf2f4f7,
          roughness: 0.95,
          metalness: 0.0,
        }),
      ),
    );
    return g;
  },
  materials(color) {
    const c = col(color);
    return {
      body: std({ color: c, metalness: 0.1, roughness: 0.55 }),
      glass: std({
        color: 0x222a33,
        metalness: 0.3,
        roughness: 0.1,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      }),
      tire: std({ color: 0x1c1f24, roughness: 0.8 }),
      hub: std({
        color: c.clone().offsetHSL(0, -0.18, -0.08),
        metalness: 0.85,
        roughness: 0.3,
      }),
      lightFront: new THREE.MeshBasicMaterial({ color: 0xece8f5 }),
      lightRear: new THREE.MeshBasicMaterial({ color: 0xdd431a }),
    };
  },
};

// --- Elite / Frontier: stark flat facets + wireframe edges, retro vibe ---
const elite = {
  label: "Elite / Frontier",
  background: new THREE.Color("#05070d"),
  exposure: 1.0,
  rig() {
    const g = new THREE.Group();
    g.add(new THREE.AmbientLight(0x6a7b8c, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.far = 40;
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    g.add(key);
    g.add(groundPlane(std({ color: 0x070b12, roughness: 1.0 })));
    const grid = new THREE.GridHelper(60, 30, 0x2bd66f, 0x0f5a2c);
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    grid.position.y = 0.002;
    g.add(grid);
    return g;
  },
  materials(color) {
    const c = col(color);
    return {
      body: std({ color: c, metalness: 0.0, roughness: 0.95 }),
      glass: std({
        color: 0x0c1414,
        metalness: 0.0,
        roughness: 0.7,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      }),
      tire: std({ color: 0x06080a, roughness: 1.0 }),
      hub: std({
        color: c.clone().offsetHSL(0, -0.12, -0.14),
        metalness: 0.3,
        roughness: 0.7,
      }),
      lightFront: new THREE.MeshBasicMaterial({ color: 0xe6e3f2 }),
      lightRear: new THREE.MeshBasicMaterial({ color: 0xff5526 }),
      edges: new THREE.LineBasicMaterial({
        color: 0x2bd66f,
        transparent: true,
        opacity: 0.8,
      }),
    };
  },
};

export const STYLES = { road, neon, studio, elite };
export const STYLE_KEYS = Object.keys(STYLES);
