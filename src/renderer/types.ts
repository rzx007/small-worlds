import type { SceneDefinition } from './scene-types';

// Storage is allocated lazily on each scene and retained across switches.
export interface SceneBuffers {
  grid: Uint8Array; ap: Uint8Array; va: Uint8Array;
  mRamp: Uint8Array; mL: Float32Array; mF: Uint8Array; mN: Float32Array; mE: Uint8Array;
  rampBase: Float32Array; rampEmit: Uint8Array; fmCache: Map<string, number>;
  matCount: number; rampCount: number; staticTop: number;
}
export type BuiltScene = SceneDefinition & SceneBuffers;
export type CylinderMaterial = number | ((x: number, y: number, z: number, dx: number, dy: number) => number);
export type ConeOptions = { band: number; ramp2: number } | { band?: undefined; ramp2?: number };
export interface RoofOptions { over?: number; slope?: number }
export interface PuffOptions {
  zMin?: number; seed?: number; lift?: number; bump?: number; flags?: number;
  edge?: number; thin?: number; squash?: number; grain?: number;
}
export interface GlowOptions { flat?: number; onBg?: boolean; mix?: number; dither?: boolean }
