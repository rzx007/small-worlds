import { lerp } from './math';

const HASH = new Float32Array(4096);
{ let s = 0x2f6e2b1; for (let i = 0; i < 4096; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; HASH[i] = ((s >>> 0) % 100000) / 100000; } }
const h1 = (a: number): number => HASH[(Math.imul(a | 0, 2654435761) >>> 18) & 4095];
const h2 = (x: number, y: number): number => HASH[((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)) >>> 9) & 4095];
const h3 = (x: number, y: number, z: number): number => HASH[((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) >>> 9) & 4095];
function vn(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(h2(ix, iy), h2(ix + 1, iy), sx), lerp(h2(ix, iy + 1), h2(ix + 1, iy + 1), sx), sy);
}
const fbm = (x: number, y: number): number => vn(x, y) * .55 + vn(x * 2.1 + 9, y * 2.1 + 4) * .3 + vn(x * 4.3 + 3, y * 4.3 + 7) * .15;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const BAYER8 = new Float32Array(64);
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
  let v = 0, a = x, b = x ^ y;
  for (let i = 0; i < 3; i++) { v = (v << 1 | (b & 1)) << 1 | (a & 1); a >>= 1; b >>= 1; }
  BAYER8[y * 8 + x] = (v + .5) / 64;
}
const SIN = new Float32Array(256);
for (let i = 0; i < 256; i++) SIN[i] = Math.sin(i / 256 * Math.PI * 2);
const WTEX = new Uint8Array(65536);
{
  const wrap = (x: number, y: number, p: number): number => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const g = (a: number, b: number): number => h2((a % p + p) % p, (b % p + p) % p + 501);
    return lerp(lerp(g(ix, iy), g(ix + 1, iy), sx), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), sx), sy);
  };
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const v = wrap(x / 16, y / 8, 16) * .6 + wrap(x / 8, y / 4, 32) * .3 + wrap(x / 4, y / 2, 64) * .1;
    WTEX[y * 256 + x] = v * 255;
  }
}

export { h1, h2, h3, vn, fbm, BAYER4, BAYER8, SIN, WTEX };
