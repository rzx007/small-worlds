import type { BuiltScene } from './types';

interface ActiveScene {
  cur: BuiltScene;
  grid: Uint8Array; ap: Uint8Array; va: Uint8Array;
}

// A single journal belongs to the last scene that received dynamic writes.
// Restore in reverse order: the same voxel can be written more than once.
export function createDynamicOverlay(ctx: ActiveScene, WORLD: number, N: number, Z: number) {
  const NN = N * N, JCAP = 3000000;
  const jI = new Int32Array(JCAP), jM = new Uint8Array(JCAP), jA = new Uint8Array(JCAP), jV = new Uint8Array(JCAP);
  let jN = 0, dynTop = 0, owner: BuiltScene | null = null;

  function dyn(x: number, y: number, z: number, m: number) {
    x |= 0; y |= 0; z |= 0;
    if (x < 0 || y < 0 || z < 0 || x > WORLD || y > WORLD || z >= Z - 1 || jN >= JCAP) return;
    const i = x + y * N + z * NN;
    owner = ctx.cur;
    jI[jN] = i; jM[jN] = ctx.grid[i]; jA[jN] = ctx.ap[i]; jV[jN] = ctx.va[i]; jN++;
    ctx.grid[i] = m; ctx.ap[i] = 0; ctx.va[i] = 255;
    if (m && z + 1 > dynTop) dynTop = z + 1;
  }
  function undoDyn() {
    // Use the recorded scene rather than whichever scene is currently active.
    if (owner) {
      const { grid, ap, va } = owner;
      while (jN > 0) { jN--; const i = jI[jN]; grid[i] = jM[jN]; ap[i] = jA[jN]; va[i] = jV[jN]; }
    }
    owner = null;
    dynTop = 0;
  }
  return { dyn, undoDyn, get dynTop() { return dynTop; } };
}
