import { buildCar } from "./carBuilder.js";
import {
  ARCHETYPES,
  SLIDERS,
  paramsFromSeed,
  getDerived,
  setDerived,
} from "./params.js";
import { STYLES } from "./styles.js";
import { schemaFromSamples } from "@engine/state.js";
const samples = Object.keys(ARCHETYPES).flatMap((key) =>
  [0, 1, 42, 12345, 4294967295].map((seed) => paramsFromSeed(seed, key)),
);
export const adapter = {
  id: "car",
  path: "low-poly-car-generator",
  label: "Low Poly Car",
  noun: "car",
  filePrefix: "lowpoly",
  defaultLook: "studio",
  defaultType: "cyber",
  colorKey: null,
  colorLabel: "Hue",
  archetypes: ARCHETYPES,
  sliders: SLIDERS,
  styles: STYLES,
  paramsFromSeed,
  getDerived,
  setDerived,
  schema: schemaFromSamples(samples, SLIDERS),
  build: buildCar,
  materials: (style, params) => style.materials(params.color),
  paletteSlots: {
    body: "body",
    trim: "trim",
    glass: "glass",
    wheel: "roof",
    rim: "accent",
  },
  camera: {
    fov: 42,
    near: 0.1,
    far: 200,
    min: 2,
    max: 30,
    direction: [0.85, 0.5, 1.05],
  },
};
