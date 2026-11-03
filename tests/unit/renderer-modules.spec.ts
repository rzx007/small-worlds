import { test, expect } from '@playwright/test';
import { createMaterials, type MaterialContext } from '../../src/renderer/materials';
import { createGeometry, type GeometryContext } from '../../src/renderer/geometry';
import { rgb } from '../../src/core/math';

function materialContext(): MaterialContext {
  return {
    cur: { id: 'test' } as MaterialContext['cur'], matCount: 1, rampCount: 0,
    rampBase: new Float32Array(128 * 3), rampEmit: new Uint8Array(128), fmCache: new Map(),
    mRamp: new Uint8Array(256), mL: new Float32Array(256), mN: new Float32Array(256),
    mE: new Uint8Array(256), mF: new Uint8Array(256), pal: new Uint32Array(128 * 7),
  };
}

test('material cache, palette and allocation use the active context', () => {
  const first = materialContext(), second = materialContext();
  let active = first;
  const ctx: MaterialContext = {
    get cur() { return active.cur; },
    get matCount() { return active.matCount; }, set matCount(v) { active.matCount = v; },
    get rampCount() { return active.rampCount; }, set rampCount(v) { active.rampCount = v; },
    get rampBase() { return active.rampBase; }, get rampEmit() { return active.rampEmit; },
    get fmCache() { return active.fmCache; }, get mRamp() { return active.mRamp; },
    get mL() { return active.mL; }, get mN() { return active.mN; }, get mE() { return active.mE; },
    get mF() { return active.mF; }, get pal() { return active.pal; },
  };
  const m = createMaterials(ctx, 7);
  const r = m.ramp([100, 80, 60], true);
  expect(m.fm(r, 2)).toBe(m.fm(r, 2));
  expect(first.matCount).toBe(2);
  m.flushPalette(); expect(first.pal[3]).toBe(rgb(100, 80, 60));
  active = second;
  m.ramp([20, 30, 40]); m.fm(0, 2);
  expect(second.matCount).toBe(2); expect(first.fmCache.size).toBe(1);
  active = first; expect(m.fm(r, 2)).toBe(1); expect(first.matCount).toBe(2);
});

test('geometry writes via supplied voxel operation and restores tree timing', () => {
  const writes: number[][] = [];
  const ctx: GeometryContext = {
    set: (x, y, z, m) => { writes.push([x, y, z, m]); },
    when: (a = 0, b = 1) => { ctx.curAp = a; ctx.curVa = b; },
    ramp: () => 0, mat: () => 1, fm: () => 2,
    curAp: 9, curVa: 10, F_COVER: 4, WORLD: 10, G: 2, N: 12, NN: 144,
    grid: new Uint8Array(12 * 12 * 30),
  };
  const g = createGeometry(ctx);
  g.box(0, 0, 0, 1, 0, 0, (x) => x + 3);
  expect(writes).toEqual([[0, 0, 0, 3], [1, 0, 0, 4]]);
  g.blobTree(4, 4, 2, { r: 2, trunk: 2, sets: [0], trunkM: 1, trunkWhen: [.1, .2], when: () => [.3, .4] });
  expect([ctx.curAp, ctx.curVa]).toEqual([9, 10]);
});
