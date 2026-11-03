import { lerp, rgb } from '../core/math';
import { BAYER4, BAYER8, SIN, WTEX, h2, h3, vn } from '../core/tables';
import type { FrameState } from './frame-state';
import type { GlowOptions } from './types';

export interface PipelineContext {
  W: number; H: number; WORLD: number; N: number; NN: number; STRIDE: number; LEVELS: number;
  F_WATER: number; F_WIND: number; F_COVER: number; F_EMIT: number; F_NODITHER: number; F_NOSHADOW: number;
  pix: Uint32Array; pal: Uint32Array; gD: Int16Array; gR: Uint8Array; gL: Uint8Array; gF: Uint8Array; gE: Uint8Array;
  rBase: Int32Array; rHmin: Int16Array; rHmax: Int16Array; rDx: Int16Array; rDy: Int16Array; rDz: Int16Array;
  grid: Uint8Array; ap: Uint8Array; va: Uint8Array; mF: Uint8Array; mRamp: Uint8Array; mL: Float32Array; mN: Float32Array; mE: Uint8Array;
  T: number; staticTop: number; dynTop: number; state: FrameState;
  project: (x: number, y: number, z: number) => [number, number, number];
}
export function createPipeline(ctx: PipelineContext) {
const { W, H, WORLD, N, NN, STRIDE, LEVELS, F_WATER, F_WIND, F_COVER, F_EMIT, F_NODITHER, F_NOSHADOW,
  pix, pal, gD, gR, gL, gF, gE, rBase, rHmin, rHmax, rDx, rDy, rDz, state, project } = ctx;
// ---------- sun ----------
const sOff = new Int32Array(300);
let sun = 1, ilx = 1, ily = 1, ilz = 1;
let lvTopLit = 3.4, lvTopSh = 1.75, lvYLit = 2.55, lvYSh = 1.3, lvX = 1.45, shDrop = 1.5;
function setSun(lx: number, ly: number, lz: number, strength = 1) {
  sun = strength;
  ilx = 1 / Math.abs(lx); ily = 1 / Math.abs(ly); ilz = 1 / lz;
  for (let i = 1; i < 300; i++) sOff[i] = Math.round(lx * i) + Math.round(ly * i) * N + Math.round(lz * i) * NN;
  lvTopSh = 1.85; lvTopLit = lerp(lvTopSh, 3.4, strength);
  lvYSh = 1.4; lvYLit = lerp(lvYSh, 2.55, strength);
  lvX = lerp(1.5, 1.35, strength);
  shDrop = 1.5 * strength;
}

const TH_EDGE = 3, TH_FAR = 9;
function renderVoxels() {
  const { grid, ap, va, T, staticTop, dynTop, mF, mRamp, mL, mN, mE } = ctx;
  const zT = Math.max(staticTop, dynTop) + 1;
  const tick8 = Math.floor(state.time * 8), wt1 = tick8 * 2 & 255, wt2 = tick8 * 3 & 255, tw = Math.floor(state.time * 12) * 9 & 255;
  const windAmt = state.windAmt, sparkle = state.sparkle, waterAmp = state.waterAmp, coverAmt = state.coverAmt, coverRamp = state.coverRamp, coverAll = !!state.coverAll, coverMaxZ = state.coverMaxZ, coverEmit = !!state.coverEmit;
  const bgMix = state.bgMix, bgA = state.bgA, bgB = state.bgB;
  const g = grid, a = ap, v = va, t = T;
  const hasSun = sun > .02;
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    const q = sy * W + sx;
    let h = Math.min(rHmax[q], zT - rDz[q]);
    const hmin = rHmin[q];
    let hit = -1;
    if (h >= hmin) {
      let i = h * STRIDE + rBase[q];
      for (; h >= hmin; h--, i -= STRIDE) {
        const m = g[i];
        if (m !== 0 && a[i] <= t && t < v[i]) { hit = i; break; }
      }
    }
    if (hit < 0) {
      gD[q] = -1;
      pix[q] = bgMix > 0 && BAYER8[(sy & 7) * 8 + (sx & 7)] < bgMix * 1.75 - sy / H * .75 ? bgB : bgA;
      continue;
    }
    const i = hit, m = g[i], fl = mF[m], x = h + rDx[q], y = h + rDy[q], z = h + rDz[q];
    const up = i + NN, ym = g[i + N], xm = g[i + 1];
    let f;
    const um = g[up];
    if (um === 0 || !(a[up] <= t && t < v[up])) f = 0;
    else if (ym === 0 || !(a[i + N] <= t && t < v[i + N])) f = 1;
    else f = 2;
    let lit = 1;
    if (hasSun && f !== 2 && !(fl & F_EMIT)) {
      const j0 = f === 0 ? up : i + N, y0 = f === 0 ? y : y + 1, z0 = f === 0 ? z + 1 : z;
      const n = Math.min(x * ilx, (WORLD - y0) * ily, (zT - z0) * ilz) | 0;
      for (let k = 1; k <= n; k++) {
        const j = j0 + sOff[k], c = g[j];
        if (c !== 0 && a[j] <= t && t < v[j] && !(mF[c] & F_NOSHADOW)) { lit = 0; break; }
      }
    }
    let L, r = mRamp[m];
    const ml = mL[m];
    if (ml >= 0) L = lit ? ml : ml - shDrop;
    else {
      L = f === 0 ? (lit ? lvTopLit : lvTopSh) : f === 1 ? (lit ? lvYLit : lvYSh) : lvX;
      if (f === 0) { // contact shading where something stands beside this top face
        const b1 = up - 1, b2 = up - N, b3 = up + 1, b4 = up + N;
        if (g[b1] !== 0 && a[b1] <= t && t < v[b1]) L -= .3;
        if (g[b2] !== 0 && a[b2] <= t && t < v[b2]) L -= .3;
        if (g[b3] !== 0 && a[b3] <= t && t < v[b3]) L -= .3;
        if (g[b4] !== 0 && a[b4] <= t && t < v[b4]) L -= .3;
      }
    }
    const nz = mN[m];
    if (nz !== 0) L += (h3(x, y, z) - .5) * nz;
    if (fl !== 0) {
      if (fl & F_WIND) L += windAmt * SIN[(x * 5 + y * 3 + tw) & 255];
      if (fl & F_WATER) {
        const w = (WTEX[((x + wt1) & 255) + (((y + wt2) & 255) << 8)] + WTEX[((x - wt2 + 97) & 255) + (((y + wt1 + 31) & 255) << 8)]) / 510;
        if (w > sparkle && waterAmp > .5) L = 5;
        else if (w > .56) L += .7 * waterAmp;
        else if (w < .42) L -= .75 * waterAmp;
      }
      if (coverAmt > 0 && (fl & F_COVER) && (f === 0 || coverAll) && coverMaxZ !== undefined && z < coverMaxZ && (coverEmit || !(fl & F_EMIT)) && (h2(x, y) * .55 + vn(x * .09, y * .09) * .45) < coverAmt) {
        r = coverRamp;
        if (!coverAll && ml >= 0) L = lit ? lvTopLit : lvTopSh;
      }
    }
    let li = (fl & F_NODITHER) || (fl & F_EMIT) ? (L + .5) | 0 : (L + (BAYER4[(sy & 3) * 4 + (sx & 3)] - .5) * .55 + .5) | 0;
    if (L < 0) li = 0;
    if (li > 5) li = 5;
    gD[q] = x + y + z; gR[q] = r; gL[q] = li; gF[q] = f; gE[q] = mE[m];
  }
  // silhouettes come from the depth buffer: dark where a surface sits in front, a warm rim on upper-left edges
  for (let sy = 1; sy < H - 1; sy++) for (let sx = 1; sx < W - 1; sx++) {
    const q = sy * W + sx, d = gD[q];
    if (d < 0) continue;
    const e = gE[q], l = gD[q - 1], rr = gD[q + 1], u = gD[q - W], b = gD[q + W], o = gR[q] * LEVELS, lv = gL[q];
    let out = false, rim = false;
    if (e === 2) {
      if (d - rr > TH_EDGE || d - b > TH_EDGE) out = true;
      else if (d - l > TH_EDGE || d - u > TH_EDGE) { if (l < 0 || u < 0) out = true; else rim = true; }
      else {
        const f = gF[q];
        if (f === 0 && gF[q + W] !== 0 && gE[q + W] === 2) rim = true;
        else if (f === 1 && gF[q + 1] === 2 && gE[q + 1] === 2) rim = true;
      }
    } else if (e === 1) {
      if (l < 0 || rr < 0 || u < 0 || b < 0 || d - rr > TH_FAR || d - b > TH_FAR) out = true;
    } else if (e === 3) {
      if (l < 0 || rr < 0 || u < 0 || b < 0) { pix[q] = pal[o + 2]; continue; }
    }
    pix[q] = out ? pal[o + 6] : pal[o + (rim && lv < 5 ? lv + 1 : lv)];
  }
  for (let sx = 0; sx < W; sx++) { pix[sx] = pix[sx + W]; pix[(H - 1) * W + sx] = pix[(H - 2) * W + sx]; }
}

// ---------- post-process helpers, drawn after the voxels and tested against depth ----------
function pPlot(sx: number, sy: number, c: number) { sx |= 0; sy |= 0; if (sx >= 0 && sy >= 0 && sx < W && sy < H) pix[sy * W + sx] = c; }
function pDot(x: number, y: number, z: number, c: number, size = 1) {
  const [sx, sy, d] = project(Math.round(x), Math.round(y), Math.round(z));
  for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) {
    const X = sx + a, Y = sy + b;
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const q = Y * W + X;
    if (gD[q] <= d) pix[q] = c;
  }
}
function pLine(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, skip = 0) {
  const a = project(Math.round(x0), Math.round(y0), Math.round(z0)), b = project(Math.round(x1), Math.round(y1), Math.round(z1));
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  for (let i = 0; i <= n; i++) {
    if (skip && i % skip === skip - 1) continue;
    const t = i / n, X = Math.round(lerp(a[0], b[0], t)), Y = Math.round(lerp(a[1], b[1], t)), d = lerp(a[2], b[2], t);
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const q = Y * W + X;
    if (gD[q] <= d + 1) pix[q] = c;
  }
}
// an ordered-dither glow: light is drawn as stippled pixels so it stays pixel art
function pGlow(sx: number, sy: number, r: number, c: number, strength = 1, o: GlowOptions = {}) {
  const x0 = Math.max(0, Math.floor(sx - r)), x1 = Math.min(W - 1, Math.ceil(sx + r)), ry = r * (o.flat || .62);
  const y0 = Math.max(0, Math.floor(sy - ry)), y1 = Math.min(H - 1, Math.ceil(sy + ry));
  const cr = c >>> 0 & 255, cg = c >>> 8 & 255, cb = c >>> 16 & 255, onBg = !!o.onBg, mixA = o.mix == null ? .55 : o.mix;
  for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
    const q = Y * W + X;
    if (!onBg && gD[q] < 0) continue;
    const dx = (X - sx) / r, dy = (Y - sy) / ry, dd = dx * dx + dy * dy;
    if (dd >= 1) continue;
    const amt = strength * (1 - dd) * (1 - dd), th = BAYER4[(Y & 3) * 4 + (X & 3)];
    let m = 0;
    if (o.dither) { if (th >= amt) continue; m = mixA; }
    else { const v = amt + (th - .5) * .12; m = v > .62 ? mixA : v > .34 ? mixA * .62 : v > .14 ? mixA * .32 : v > .05 ? mixA * .14 : 0; if (m === 0) continue; }
    const p = pix[q];
    pix[q] = rgb(lerp(p & 255, cr, m), lerp(p >>> 8 & 255, cg, m), lerp(p >>> 16 & 255, cb, m));
  }
}
const col = (r: number, g: number, b: number) => rgb(r, g, b);

const shifted = new Uint32Array(W * H);
function applyShiftAndFade(fade: number, lift: number) {
  const dx = state.shakeX | 0, dy = (state.shakeY | 0) + lift, bg = state.bgA, bgB = state.bgB, bgMix = state.bgMix;
  if (!dx && !dy && fade <= 0) return;
  shifted.set(pix);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = x - dx, Y = y - dy, q = y * W + x;
    const th = BAYER8[(y & 7) * 8 + (x & 7)];
    const isBg = X < 0 || Y < 0 || X >= W || Y >= H || th < fade * 1.02;
    pix[q] = isBg ? (bgMix > 0 && th < bgMix * 1.75 - y / H * .75 ? bgB : bg) : shifted[Y * W + X];
  }
}

return { setSun, renderVoxels, pPlot, pDot, pLine, pGlow, col, applyShiftAndFade };
}
