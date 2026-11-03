import type { FrameState } from './frame-state';
import type { CylinderMaterial, ConeOptions, RoofOptions, PuffOptions, GlowOptions } from './types';

export type Color = number[];
export type ColorKeys = [number, Color][];
export interface MaterialOptions { flat?: number; noise?: number; edge?: number; flags?: number }
export interface TreeOptions { r?: number; trunk?: number; sets: number[]; trunkM: number; seed?: number; flags?: number; trunkWhen?: [number, number]; when?: (x: number, y: number, z: number) => [number, number] }
export interface SoilOptions { bottom?: number; soil?: Color; humus?: Color; stone?: Color; deep?: Color }
export type VoxelMaterial = number | ((x: number, y: number, z: number) => number);
export interface SceneContext {
  F_COVER: number;
  F_EMIT: number;
  F_NOSHADOW: number;
  F_WATER: number;
  F_WIND: number;
  G: number;
  H: number;
  W: number;
  WORLD: number;
  Z: number;
  BAYER4: ArrayLike<number>;
  BAYER8: ArrayLike<number>;
  LV: ArrayLike<number>;
  gD: Int16Array;
  gR: Uint8Array;
  pix: Uint32Array;
  blobTree: (x: number, y: number, z: number, options: TreeOptions) => void;
  box: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, material: VoxelMaterial) => void;
  clamp: typeof import('../core/math').clamp;
  col: (r: number, g: number, b: number) => number;
  cone: (cx: number, cy: number, z0: number, height: number, radius: number, ramp: number, options?: ConeOptions) => void;
  cyl: (cx: number, cy: number, z0: number, z1: number, radius: number, material: CylinderMaterial) => void;
  dbox: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, material: number) => void;
  dome: (cx: number, cy: number, z0: number, radius: number, height: number, ramp: number, options?: { edge?: number }) => void;
  dyn: (x: number, y: number, z: number, material: number) => void;
  fbm: typeof import('../core/tables').fbm;
  fm: (ramp: number, level: number, options?: MaterialOptions) => number;
  gableX: (x0: number, x1: number, y0: number, y1: number, z: number, ramp: number, wall: number, options?: RoofOptions) => void;
  gableY: (x0: number, x1: number, y0: number, y1: number, z: number, ramp: number, wall: number, options?: RoofOptions) => void;
  h1: typeof import('../core/tables').h1;
  h2: typeof import('../core/tables').h2;
  h3: typeof import('../core/tables').h3;
  keyNum: (keys: [number, number][], t: number) => number;
  keys: (keys: ColorKeys, t: number) => Color;
  lerp: typeof import('../core/math').lerp;
  mat: (ramp: number, options?: MaterialOptions) => number;
  pDot: (x: number, y: number, z: number, color: number, size?: number) => void;
  pGlow: (sx: number, sy: number, radius: number, color: number, strength?: number, options?: GlowOptions) => void;
  pLine: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, skip?: number) => void;
  pPlot: (sx: number, sy: number, color: number) => void;
  project: (x: number, y: number, z: number) => [number, number, number];
  puff: (cx: number, cy: number, cz: number, radius: number, ramp: number, options?: PuffOptions) => void;
  ramp: (color: Color, emit?: boolean) => number;
  rgb: typeof import('../core/math').rgb;
  roundCyl: (x: number, y: number, z0: number, z1: number, radius: number, ramp: number | ((z: number, x: number, y: number) => number), options?: { edge?: number }) => void;
  roundLevel: (x: number, y: number, z: number) => number;
  set: (x: number, y: number, z: number, material: number) => void;
  setGrade: (mul: Color, tint?: Color, amount?: number) => void;
  setRamp: (ramp: number, color: Color) => void;
  setSun: (x: number, y: number, z: number, strength?: number) => void;
  soilSlab: (top: (x: number, y: number) => number, options?: SoilOptions) => void;
  sstep: typeof import('../core/math').sstep;
  vn: typeof import('../core/tables').vn;
  when: (start?: number, end?: number) => void;
  state: FrameState;
  curAp: number;
  curVa: number;
}

export interface SceneDefinition {
  id: string; title: string; accent: [number, number, number];
  ticks?: number; majorEvery?: number; baseShift?: number;
  accentAt?: (progress: number) => [number, number, number];
  label: (progress: number) => string;
  build: () => void; update: (progress: number, time: number) => void;
  post?: (progress: number, time: number) => void;
}

