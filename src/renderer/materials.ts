import { lerp, rgb } from '../core/math';
import type { Color, MaterialOptions } from './scene-types';
import type { BuiltScene } from './types';

// Accessors bind allocations and palette updates to the currently active scene.
export interface MaterialContext {
  cur: BuiltScene; rampCount: number; matCount: number;
  rampBase: Float32Array; rampEmit: Uint8Array; fmCache: Map<string, number>;
  mRamp: Uint8Array; mL: Float32Array; mN: Float32Array; mE: Uint8Array; mF: Uint8Array;
  pal: Uint32Array;
}
export function createMaterials(ctx: MaterialContext, LEVELS: number) {
const COOL = [44, 32, 92], WARM = [255, 226, 160];
// a ramp is a base colour; its six shades drift to violet in shadow and to warm yellow in light
function ramp(c: Color, emit = false) {
  const r = ctx.rampCount++;
  ctx.rampBase.set(c, r * 3); ctx.rampEmit[r] = emit ? 1 : 0;
  return r;
}
const setRamp = (r: number, c: Color) => { ctx.rampBase[r * 3] = c[0]; ctx.rampBase[r * 3 + 1] = c[1]; ctx.rampBase[r * 3 + 2] = c[2]; };
function mat(r: number, o: MaterialOptions = {}) {
  if (ctx.matCount > 254) throw new Error('out of materials in ' + (ctx.cur && ctx.cur.id));
  const m = ctx.matCount++;
  ctx.mRamp[m] = r; ctx.mL[m] = o.flat == null ? -1 : o.flat; ctx.mN[m] = o.noise || 0;
  ctx.mE[m] = o.edge == null ? 2 : o.edge; ctx.mF[m] = o.flags || 0;
  return m;
}
// a flat material: shade is baked into the voxel instead of coming from the face it shows
function fm(r: number, level: number, o: MaterialOptions = {}) {
  const key = r + ':' + level + ':' + (o.edge == null ? 1 : o.edge) + ':' + (o.flags || 0) + ':' + (o.noise || 0);
  let m = ctx.fmCache.get(key);
  if (!m) { m = mat(r, { flat: level, edge: o.edge == null ? 1 : o.edge, flags: o.flags, noise: o.noise }); ctx.fmCache.set(key, m); }
  return m;
}

let gMul = [1, 1, 1], gTint = [0, 0, 0], gTintAmt = 0;
function setGrade(mul: Color, tint?: Color, amt?: number) { gMul = mul; gTint = tint || gTint; gTintAmt = amt || 0; }
const RAMP_MUL = [.4, .58, .78, 1, 1.07, 1.15], RAMP_COOL = [.34, .22, .1, 0, 0, 0], RAMP_WARM = [0, 0, 0, 0, .12, .34];
function flushPalette() {
  for (let r = 0; r < ctx.rampCount; r++) {
    const b0 = ctx.rampBase[r * 3], b1 = ctx.rampBase[r * 3 + 1], b2 = ctx.rampBase[r * 3 + 2], o = r * LEVELS;
    if (ctx.rampEmit[r]) {
      ctx.pal[o] = rgb(b0 * .72, b1 * .68, b2 * .62); ctx.pal[o + 1] = rgb(b0 * .82, b1 * .8, b2 * .74); ctx.pal[o + 2] = rgb(b0 * .92, b1 * .9, b2 * .86);
      ctx.pal[o + 3] = rgb(b0, b1, b2); ctx.pal[o + 4] = rgb(lerp(b0, 255, .4), lerp(b1, 255, .4), lerp(b2, 240, .4)); ctx.pal[o + 5] = rgb(255, 250, 225);
      ctx.pal[o + 6] = rgb(b0 * .5, b1 * .4, b2 * .4);
      continue;
    }
    for (let l = 0; l < 6; l++) {
      const mul = RAMP_MUL[l], c = RAMP_COOL[l], w = RAMP_WARM[l];
      let cr = b0 * mul, cg = b1 * mul, cb = b2 * mul;
      cr = cr + (COOL[0] - cr) * c + (WARM[0] - cr) * w; cg = cg + (COOL[1] - cg) * c + (WARM[1] - cg) * w; cb = cb + (COOL[2] - cb) * c + (WARM[2] - cb) * w;
      cr *= gMul[0]; cg *= gMul[1]; cb *= gMul[2];
      if (gTintAmt) { cr += (gTint[0] - cr) * gTintAmt; cg += (gTint[1] - cg) * gTintAmt; cb += (gTint[2] - cb) * gTintAmt; }
      ctx.pal[o + l] = rgb(cr, cg, cb);
      if (l === 0) ctx.pal[o + 6] = rgb(cr * .6, cg * .56, cb * .62);
    }
  }
}

return { ramp, setRamp, mat, fm, setGrade, flushPalette };
}
