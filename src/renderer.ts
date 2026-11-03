// Voxel renderer owns the mutable buffers and exposes scene operations through SceneContext.
import { createScene as createSeasons } from './scenes/seasons';
import { createScene as createCity } from './scenes/city';
import { createScene as createHarbor } from './scenes/harbor';
import { createScene as createVolcano } from './scenes/volcano';
import { createScene as createLaunch } from './scenes/launch';
import { createScene as createStation } from './scenes/station';
import type { SceneContext, SceneDefinition, Color, ColorKeys } from './renderer/scene-types';
import type { BuiltScene, PuffOptions } from './renderer/types';
import { createMaterials } from './renderer/materials';
import { RendererContext } from './renderer/context';
import { createDynamicOverlay } from './renderer/dynamic-overlay';
import { createGeometry, LV, roundLevel, type GeometryContext } from './renderer/geometry';
import { createPipeline, type PipelineContext } from './renderer/pipeline';
import { clamp, lerp, sstep, span, rgb } from './core/math';
import { resetFrameOverrides } from './renderer/frame-state';
import { RAIL, upscale as upscalePixels, drawUI as drawSceneUI } from './ui/draw';
import { h1, h2, h3, vn, fbm, BAYER4, BAYER8 } from './core/tables';

'use strict';
// Small Worlds: a voxel renderer for 2:1 isometric pixel art.
// Style inspired by shawn.'s "Post Humans" (x.com/zzzzshawn) and AmirMushich's Pixel Plays (github.com/amirmushichge/pixel-plays).
// One voxel maps to exactly one pixel along the (1,1,1) view diagonal, so every edge is a clean 2:1 staircase.
// Each scene is a static grid whose voxels carry appear/vanish times, per-frame palettes and a dynamic overlay.
// ---------- dimensions, math and deterministic lookup tables ----------
const W = 360, H = 330, WORLD = 150, N = 152, Z = 236, NN = N * N, STRIDE = 1 + N + NN;
const OX = 180, OY = 142, G = 24, LEVELS = 7;

// material flags
const F_WATER = 1, F_WIND = 2, F_COVER = 4, F_EMIT = 8, F_NODITHER = 16, F_NOSHADOW = 32;

// Shared work buffers are owned by the single renderer context.
const context: RendererContext = new RendererContext(N, Z, G, W, H, LEVELS);
const { pix, gD, gR, gL, gF, gE, pal, state } = context;

// ray table: every pixel looks down one integer diagonal of the grid
const rBase = new Int32Array(W * H), rHmin = new Int16Array(W * H), rHmax = new Int16Array(W * H);
const rDx = new Int16Array(W * H), rDy = new Int16Array(W * H), rDz = new Int16Array(W * H);
for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
  const q = sy * W + sx, d = sx - OX, even = (d & 1) === 0;
  const dx = even ? d / 2 : (d + 1) / 2, dy = even ? -d / 2 : -(d - 1) / 2, dz = -(sy - OY);
  rDx[q] = dx; rDy[q] = dy; rDz[q] = dz;
  rBase[q] = dx + dy * N + dz * NN;
  rHmin[q] = Math.max(-dx, -dy, -dz);
  rHmax[q] = Math.min(N - 2 - dx, N - 2 - dy, Z - 2 - dz);
}
const project = (x: number, y: number, z: number): [number, number, number] => [OX + x - y, OY + ((x + y) >> 1) - z, x + y + z];

// Materials operate on the active scene aliases held by the context.
const { ramp, setRamp, mat, fm, setGrade, flushPalette } = createMaterials(context, LEVELS);
const overlay = createDynamicOverlay(context, WORLD, N, Z);
const { dyn, undoDyn } = overlay;

// ---------- build helpers ----------
const tb = (p: number) => clamp(Math.round(p * 255), 0, 255);
function when(a = 0, b = 1) { context.curAp = tb(a); context.curVa = b >= 1 ? 255 : tb(b); }
function set(x: number, y: number, z: number, m: number) {
  if (context.dynMode) { dyn(x, y, z, m); return; }
  x |= 0; y |= 0; z |= 0;
  if (x < 0 || y < 0 || z < 0 || x > WORLD || y > WORLD || z >= Z - 1) return;
  const i = x + y * N + z * NN;
  context.grid[i] = m; context.ap[i] = context.curAp; context.va[i] = context.curVa;
  if (m && z + 1 > context.staticTop) context.staticTop = z + 1;
}
const geometryContext: GeometryContext = {
  set, when, ramp, mat, fm, F_COVER, WORLD, G, N, NN,
  get grid() { return context.grid; },
  get curAp() { return context.curAp; }, set curAp(v) { context.curAp = v; },
  get curVa() { return context.curVa; }, set curVa(v) { context.curVa = v; },
};
const { box, cyl, roundCyl, dome, cone, gableX, gableY, blobTree, soilSlab } = createGeometry(geometryContext);

// ---------- dynamic geometry uses the shared overlay journal ----------
function dbox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: number) {
  x0 = Math.round(x0); y0 = Math.round(y0); z0 = Math.round(z0); x1 = Math.round(x1); y1 = Math.round(y1); z1 = Math.round(z1);
  for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) dyn(x, y, z, m);
}
// a puff of smoke: only the shell is written, level comes from the outward direction, and `thin` dissolves it
function puff(cx: number, cy: number, cz: number, r: number, rampId: number, o: PuffOptions = {}) {
  const R = Math.ceil(r * 1.2), zMin = o.zMin == null ? G : o.zMin, seed = o.seed || 0, shell = Math.max(1.6, r * .3);
  const lift = o.lift || 0, bump = o.bump == null ? .22 : o.bump, flags = o.flags || 0, edge = o.edge == null ? 1 : o.edge, thin = o.thin || 0;
  cx = Math.round(cx); cy = Math.round(cy); cz = Math.round(cz);
  const squash = o.squash || 1, grain = o.grain == null ? .45 : o.grain, opt = { edge, flags };
  const lm = [fm(rampId, 0, opt), fm(rampId, 1, opt), fm(rampId, 2, opt), fm(rampId, 3, opt), fm(rampId, 4, opt), fm(rampId, 5, opt)];
  const lim = r * r * 1.44;
  for (let z = -R; z <= R; z++) {
    if (cz + z < zMin) continue;
    const zz = z * squash, zz2 = zz * zz;
    if (zz2 > lim) continue;
    for (let y = -R; y <= R; y++) {
      const yz = y * y + zz2;
      if (yz > lim) continue;
      for (let x = -R; x <= R; x++) {
        const d2 = x * x + yz;
        if (d2 > lim) continue;
        const d = Math.sqrt(d2), rr = r * (1 + (h3((cx + x) >> 1, (cy + y) >> 1, ((cz + z) >> 1) + seed) - .5) * bump * 2);
        if (d > rr || d < rr - shell) continue;
        const X = cx + x, Y = cy + y, Zz = cz + z, hv = h3(X, Y, Zz);
        if (thin > 0 && h3(X + 5, Y + seed, Zz) < thin) continue;
        const n = d || 1, lvl = Math.round(roundLevel(x / n, y / n, zz / n) + lift + (hv - .5) * grain);
        dyn(X, Y, Zz, lm[lvl < 0 ? 0 : lvl > 5 ? 5 : lvl]);
      }
    }
  }
}

const pipelineContext: PipelineContext = {
  W, H, WORLD, N, NN, STRIDE, LEVELS, F_WATER, F_WIND, F_COVER, F_EMIT, F_NODITHER, F_NOSHADOW,
  pix, pal, gD, gR, gL, gF, gE, rBase, rHmin, rHmax, rDx, rDy, rDz, state, project,
  get grid() { return context.grid; }, get ap() { return context.ap; }, get va() { return context.va; },
  get mF() { return context.mF; }, get mRamp() { return context.mRamp; }, get mL() { return context.mL; },
  get mN() { return context.mN; }, get mE() { return context.mE; },
  get T() { return context.T; }, get staticTop() { return context.staticTop; }, get dynTop() { return overlay.dynTop; },
};
const { setSun, renderVoxels, pPlot, pDot, pLine, pGlow, col, applyShiftAndFade } = createPipeline(pipelineContext);

// piecewise colour keys: [[t, [r,g,b]], ...]
// Scene color tracks contain non-empty colors; preserve the legacy scalar fallback internally.
function keys(ks: ColorKeys, t: number): Color;
function keys(ks: ColorKeys, t: number): Color | number {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const k = (t - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0]), a = ks[i - 1][1], b = ks[i][1];
      return a.length ? a.map((v, j) => lerp(v, b[j], k)) : lerp(Number(a), Number(b), k);
    }
  }
  return ks[ks.length - 1][1];
}
function keyNum(ks: [number, number][], t: number) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], (t - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0]));
  return ks[ks.length - 1][1];
}

// ---------- scenes and timeline ----------

const SCENE_SECONDS = 10, FADE_IN = .04, FADE_OUT = .03;
function isBuiltScene(s: SceneDefinition): s is BuiltScene {
  return 'grid' in s && !!s.grid;
}
function ensureBuilt(s: SceneDefinition): asserts s is BuiltScene {
  if (isBuiltScene(s)) {
    context.useScene(s);
    return;
  }
  context.allocScene(s);
  context.useScene(s);
  context.curAp = 0; context.curVa = 255;
  s.build();
  context.curAp = 0; context.curVa = 255;
  context.saveCounts();
}
// q is the scene's own time-lapse progress; fade values dissolve the diorama through an ordered dither
function renderScene(idx: number, p: number) {
  const s = SCENES[idx];
  if (context.lastScene && context.lastScene !== s) undoDynFor(context.lastScene);
  ensureBuilt(s);
  context.lastScene = s;
  undoDyn();
  const q = clamp((p - FADE_IN * .6) / (1 - FADE_IN * .6 - FADE_OUT * .6));
  context.T = Math.min(254, Math.floor(q * 255));
  state.time = p * SCENE_SECONDS; state.p = p; state.q = q;
  // Reset frame overrides before the scene's update callback applies its own.
  resetFrameOverrides();
  setGrade([1, 1, 1], [0, 0, 0], 0);
  setSun(-1, .35, .75, 1);
  s.update(q, state.time);
  flushPalette();
  renderVoxels();
  if (s.post) s.post(q, state.time);
  context.saveCounts();
  const fadeIn = clamp(1 - p / FADE_IN), fadeOut = clamp((p - (1 - FADE_OUT)) / FADE_OUT);
  const fade = Math.max(fadeIn, fadeOut);
  applyShiftAndFade(fade, (s.baseShift || 0) + Math.round(fadeIn * fadeIn * 8 - fadeOut * fadeOut * 5));
  return q;
}
function undoDynFor(s: BuiltScene) { context.useScene(s); undoDyn(); }
// Adapt the explicit UI inputs to the existing renderer facade.
function upscale(out: Uint32Array, k: number) { upscalePixels(pix, out, k); }
function drawUI(out: Uint32Array, k: number, scene: SceneDefinition, idx: number, q: number, p: number) { drawSceneUI(out, k, scene, idx, q, p, state.bgMix, SCENES.length); }

// Scene factories receive capabilities explicitly; getters preserve the active build timing.
const sceneContext: SceneContext = {
  BAYER4, BAYER8, F_COVER, F_EMIT, F_NOSHADOW, F_WATER, F_WIND, G, H, LV, W, WORLD, Z, blobTree, box, clamp, col, cone, cyl, dbox, dome, dyn, fbm, fm, gD, gR, gableX, gableY, h1, h2, h3, keyNum, keys, lerp, mat, pDot, pGlow, pLine, pPlot, pix, project, puff, ramp, rgb, roundCyl, roundLevel, set, setGrade, setRamp, setSun, soilSlab, sstep, state, vn, when,
  get curAp() { return context.curAp; }, set curAp(value) { context.curAp = value; },
  get curVa() { return context.curVa; }, set curVa(value) { context.curVa = value; },
};
const SCENES: SceneDefinition[] = [createSeasons(sceneContext), createCity(sceneContext), createHarbor(sceneContext), createVolcano(sceneContext), createLaunch(sceneContext), createStation(sceneContext)];


export { W, H, SCENES, SCENE_SECONDS, FADE_IN, FADE_OUT, RAIL, clamp, lerp, renderScene, upscale, drawUI, state };
