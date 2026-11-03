import { clamp } from '../core/math';
import { h1, h3, vn } from '../core/tables';
import type { SceneContext, VoxelMaterial, TreeOptions, SoilOptions } from './scene-types';
import type { CylinderMaterial, ConeOptions, RoofOptions } from './types';

export const LV = [-.70, .28, .66];
export const roundLevel = (nx: number, ny: number, nz: number) => .55 + 3.75 * Math.max(0, nx * LV[0] + ny * LV[1] + nz * LV[2]);
export interface GeometryContext extends Pick<SceneContext, 'set' | 'when' | 'ramp' | 'mat' | 'fm' | 'curAp' | 'curVa' | 'F_COVER' | 'WORLD' | 'G'> {
  grid: Uint8Array; N: number; NN: number;
}
export function createGeometry(ctx: GeometryContext) {
const { set, when, ramp, mat, fm, F_COVER, WORLD, G, N, NN } = ctx;
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: VoxelMaterial) {
  const fn = typeof m === 'function';
  for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, z, fn ? m(x, y, z) : m);
}
function cyl(cx: number, cy: number, z0: number, z1: number, r: number, m: CylinderMaterial) {
  const fn = typeof m === 'function', R = Math.ceil(r), r2 = r * r;
  for (let z = z0; z <= z1; z++) for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    if (x * x + y * y > r2) continue;
    set(cx + x, cy + y, z, fn ? m(cx + x, cy + y, z, x, y) : m);
  }
}
// baked lighting for round things: returns a level from an (x, y, z) outward direction
// a cylinder wall shaded by its normal so it reads as round, with an optional fn(z, angle) -> ramp
function roundCyl(cx: number, cy: number, z0: number, z1: number, r: number, rampOf: number | ((z: number, x: number, y: number) => number), o: { edge?: number } = {}) {
  cyl(cx, cy, z0, z1, r, (x, y, z, dx, dy) => {
    const d = Math.hypot(dx, dy) || 1, lvl = Math.round(1.2 + 2.5 * Math.max(0, (dx * LV[0] + dy * LV[1]) / d + .25));
    return fm(typeof rampOf === 'function' ? rampOf(z, x, y) : rampOf, clamp(lvl, 0, 5), { edge: o.edge == null ? 2 : o.edge });
  });
}
function dome(cx: number, cy: number, z0: number, r: number, rz: number, rp: number, o: { edge?: number } = {}) {
  const R = Math.ceil(r), Rz = Math.ceil(rz);
  for (let z = 0; z <= Rz; z++) for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const nx = x / r, ny = y / r, nz = z / rz, dd = nx * nx + ny * ny + nz * nz;
    if (dd > 1) continue;
    set(cx + x, cy + y, z0 + z, fm(rp, clamp(Math.round(roundLevel(nx, ny, nz)), 0, 5), { edge: o.edge == null ? 2 : o.edge }));
  }
}
function cone(cx: number, cy: number, z0: number, h: number, r: number, rp: number, o: ConeOptions = {}) {
  for (let z = 0; z <= h; z++) {
    const rr = r * (1 - z / h), R = Math.ceil(rr);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y);
      if (d > rr) continue;
      const nd = d || 1, lvl = clamp(Math.round(1.1 + 3 * Math.max(0, (x * LV[0] + y * LV[1]) / nd + .3)), 0, 5);
      set(cx + x, cy + y, z0 + z, o.band ? fm(z % o.band < 1 ? o.ramp2 : rp, lvl, { edge: 2 }) : fm(rp, lvl, { edge: 2 }));
    }
  }
}
// gable roof with its ridge along x; the end on +x shows the wall material as a triangle
function gableX(x0: number, x1: number, y0: number, y1: number, z: number, rp: number, wall: number, o: RoofOptions = {}) {
  const over = o.over == null ? 1 : o.over, slope = o.slope || .8, cy = (y0 + y1) / 2, hw = (y1 - y0) / 2 + over;
  for (let x = x0 - over; x <= x1 + over; x++) for (let y = Math.floor(cy - hw); y <= Math.ceil(cy + hw); y++) {
    const zt = z + Math.floor((hw - Math.abs(y - cy)) * slope);
    const front = y > cy, lvl = front ? (zt % 3 === 0 ? 2.7 : 3.4) : 2.2;
    for (let zz = zt - 1; zz <= zt; zz++) if (zz >= z) set(x, y, zz, fm(rp, lvl, { edge: 2, flags: F_COVER }));
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) for (let zz = z; zz < zt - 1; zz++) set(x, y, zz, wall);
  }
}
// gable roof with its ridge along y; the end on +y shows the wall material as a triangle
function gableY(x0: number, x1: number, y0: number, y1: number, z: number, rp: number, wall: number, o: RoofOptions = {}) {
  const over = o.over == null ? 1 : o.over, slope = o.slope || .8, cx = (x0 + x1) / 2, hw = (x1 - x0) / 2 + over;
  for (let y = y0 - over; y <= y1 + over; y++) for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
    const zt = z + Math.floor((hw - Math.abs(x - cx)) * slope);
    const front = x > cx, lvl = front ? (zt % 3 === 0 ? 1.5 : 2.1) : 3.4;
    for (let zz = zt - 1; zz <= zt; zz++) if (zz >= z) set(x, y, zz, fm(rp, lvl, { edge: 2, flags: F_COVER }));
    if (y >= y0 && y <= y1 && x >= x0 && x <= x1) for (let zz = z; zz < zt - 1; zz++) set(x, y, zz, wall);
  }
}
// round tree: overlapping blobs with baked light; sets lets autumn colour arrive unevenly
function blobTree(cx: number, cy: number, z0: number, o: TreeOptions) {
  const r = o.r || 8, th = o.trunk || 7, sets = o.sets, trunk = o.trunkM;
  const a0 = ctx.curAp, v0 = ctx.curVa;
  if (o.trunkWhen) when(o.trunkWhen[0], o.trunkWhen[1]);
  box(cx, cy, z0, cx + 1, cy + 1, z0 + th, trunk);
  const zc = z0 + th + r * .55;
  const seed = o.seed || cx * 7 + cy;
  const blobs = [[0, 0, zc + r * .25, r]];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + h1(seed + i) * 1.2;
    blobs.push([Math.cos(a) * r * .55, Math.sin(a) * r * .55, zc - r * .05 + h1(seed + i + 9) * r * .3, r * (.58 + h1(seed + i + 5) * .15)]);
  }
  blobs.forEach((b, n) => { // bare branches stay when the leaves go
    const steps = 14, ex = b[0] * .95, ey = b[1] * .95, ez = z0 + th - 1 + (b[2] - z0 - th + 1) * .95;
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      set(cx + ex * k, cy + ey * k, z0 + th - 1 + (ez - z0 - th + 1) * k, trunk);
    }
    for (let tw = 0; tw < 3; tw++) { // twigs off the end of each branch
      const a = h1(seed + n * 7 + tw) * 6.283, len = r * (.4 + h1(seed + n + tw * 5) * .35);
      for (let s = 1; s <= len; s++) set(cx + ex + Math.cos(a) * s, cy + ey + Math.sin(a) * s, ez + s * (.35 + h1(seed + tw) * .5), trunk);
    }
  });
  ctx.curAp = a0; ctx.curVa = v0;
  const R = Math.ceil(r * 1.5), zMax = Math.ceil(zc + r * 1.2);
  for (let z = z0 + th - 1; z <= zMax; z++) for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    let best = -1, bn = null;
    for (const b of blobs) {
      const dx = x - b[0], dy = y - b[1], dz = (z - b[2]) * 1.28, dd = (dx * dx + dy * dy + dz * dz) / (b[3] * b[3]);
      if (dd <= 1 && (best < 0 || dd > best)) { best = dd; bn = [dx / b[3], dy / b[3], dz / b[3]]; }
    }
    if (!bn) continue;
    const X = cx + x, Y = cy + y;
    if (X >= 0 && Y >= 0 && X <= WORLD && Y <= WORLD && ctx.grid[X + Y * N + z * NN] === trunk) continue;
    const clump = h3(X >> 1, Y >> 1, z >> 1) - .5, lvl = clamp(Math.round(roundLevel(bn[0], bn[1], bn[2]) + clump * 1.3), 0, 5);
    if (o.when) { const w = o.when(X, Y, z); when(w[0], w[1]); }
    set(X, Y, z, fm(sets[h3(X >> 1, Y >> 1, (z >> 1) + 3) * sets.length | 0], lvl, { edge: 1, flags: o.flags || 0 }));
  }
  ctx.curAp = a0; ctx.curVa = v0;
}

// the floating slab: strata of soil with a few roots hanging out of the bottom
function soilSlab(top: (x: number, y: number) => number, o: SoilOptions = {}) {
  const bottom = o.bottom == null ? 8 : o.bottom;
  const soil = ramp(o.soil || [92, 66, 48]), humus = ramp(o.humus || [62, 46, 40]), stone = ramp(o.stone || [150, 132, 112]), deep = ramp(o.deep || [70, 50, 44]);
  const mSoil = mat(soil, { noise: .9 }), mHum = mat(humus, { noise: .7 }), mStone = mat(stone, { noise: .3 }), mDeep = mat(deep, { noise: .9 });
  const root = fm(humus, 1, { edge: 0 });
  for (let z = bottom; z < G - 1; z++) for (let y = 0; y <= WORLD; y++) for (let x = 0; x <= WORLD; x++) {
    if (x < WORLD && y < WORLD) { if (x > 1 && y > 1 && x < WORLD - 1 && y < WORLD - 1 && z < G - 3) continue; }
    const r = h3(x, y, z), band = z + vn(x * .15, y * .15) * 3;
    set(x, y, z, r > .955 ? mStone : band > G - 4 ? mHum : band < bottom + 4 ? mDeep : mSoil);
  }
  for (let y = 0; y <= WORLD; y++) for (let x = 0; x <= WORLD; x++) {
    const m = top(x, y);
    if (m > 0) set(x, y, G - 1, m);
  }
  for (let i = 0; i < 26; i++) { // roots
    const onX = i % 2 === 0;
    let a = 6 + h1(i + 40) * 138 | 0, z = bottom - 1;
    const len = 2 + h1(i + 80) * 6 | 0;
    for (let k = 0; k < len && z >= 0; k++, z--) {
      if (h3(i, k, 2) > .7) a += h3(i, k, 3) > .5 ? 1 : -1;
      if (onX) set(WORLD, a, z, root); else set(a, WORLD, z, root);
    }
  }
}

return { box, cyl, roundCyl, dome, cone, gableX, gableY, blobTree, soilSlab };
}
