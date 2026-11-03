import { clamp, lerp, rgb, sstep } from '../core/math';

interface SceneUI {
  title: string;
  ticks?: number;
  majorEvery?: number;
  accent: [number, number, number];
  accentAt?: (progress: number) => [number, number, number];
  label: (progress: number) => string;
}

const W = 360, H = 330, FADE_IN = .04;

// ---------- output scaling and UI ----------
// The slider and captions are drawn into the final image, so the page and the exported video match exactly.
const FONT: Record<string, number[]> = {
  ' ': [0, 0, 0, 0, 0], '0': [0x3e, 0x51, 0x49, 0x45, 0x3e], '1': [0x00, 0x42, 0x7f, 0x40, 0x00], '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4b, 0x31], '4': [0x18, 0x14, 0x12, 0x7f, 0x10], '5': [0x27, 0x45, 0x45, 0x45, 0x39], '6': [0x3c, 0x4a, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03], '8': [0x36, 0x49, 0x49, 0x49, 0x36], '9': [0x06, 0x49, 0x49, 0x29, 0x1e],
  A: [0x7e, 0x11, 0x11, 0x11, 0x7e], B: [0x7f, 0x49, 0x49, 0x49, 0x36], C: [0x3e, 0x41, 0x41, 0x41, 0x22], D: [0x7f, 0x41, 0x41, 0x22, 0x1c],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41], F: [0x7f, 0x09, 0x09, 0x09, 0x01], G: [0x3e, 0x41, 0x49, 0x49, 0x7a], H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  I: [0x00, 0x41, 0x7f, 0x41, 0x00], J: [0x20, 0x40, 0x41, 0x3f, 0x01], K: [0x7f, 0x08, 0x14, 0x22, 0x41], L: [0x7f, 0x40, 0x40, 0x40, 0x40],
  M: [0x7f, 0x02, 0x0c, 0x02, 0x7f], N: [0x7f, 0x04, 0x08, 0x10, 0x7f], O: [0x3e, 0x41, 0x41, 0x41, 0x3e], P: [0x7f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3e, 0x41, 0x51, 0x21, 0x5e], R: [0x7f, 0x09, 0x19, 0x29, 0x46], S: [0x46, 0x49, 0x49, 0x49, 0x31], T: [0x01, 0x01, 0x7f, 0x01, 0x01],
  U: [0x3f, 0x40, 0x40, 0x40, 0x3f], V: [0x1f, 0x20, 0x40, 0x20, 0x1f], W: [0x3f, 0x40, 0x38, 0x40, 0x3f], X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x07, 0x08, 0x70, 0x08, 0x07], Z: [0x61, 0x51, 0x49, 0x45, 0x43], '-': [0x08, 0x08, 0x08, 0x08, 0x08], '+': [0x08, 0x08, 0x3e, 0x08, 0x08],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00], '.': [0x00, 0x60, 0x60, 0x00, 0x00], '/': [0x20, 0x10, 0x08, 0x04, 0x02],
};
function textWidth(str: string, s: number): number { return str.length * 6 * s - s; }
function drawText(out: Uint32Array, ow: number, oh: number, str: string, x: number, y: number, s: number, c: number): void {
  x = Math.round(x); y = Math.round(y);
  for (let n = 0; n < str.length; n++) {
    const g = FONT[str[n]] || FONT[' '];
    for (let col = 0; col < 5; col++) for (let row = 0; row < 7; row++) {
      if (!(g[col] >> row & 1)) continue;
      const X0 = x + (n * 6 + col) * s, Y0 = y + row * s;
      for (let b = 0; b < s; b++) {
        const Y = Y0 + b;
        if (Y < 0 || Y >= oh) continue;
        for (let a = 0; a < s; a++) { const X = X0 + a; if (X >= 0 && X < ow) out[Y * ow + X] = c; }
      }
    }
  }
}
// an antialiased rounded rectangle, the one smooth element against the pixel art
function roundRect(out: Uint32Array, ow: number, oh: number, x: number, y: number, w: number, h: number, r: number, c: number, alpha = 1): void {
  const cr = c & 255, cg = c >>> 8 & 255, cb = c >>> 16 & 255;
  const x0 = Math.max(0, Math.floor(x - 1)), x1 = Math.min(ow - 1, Math.ceil(x + w + 1)), y0 = Math.max(0, Math.floor(y - 1)), y1 = Math.min(oh - 1, Math.ceil(y + h + 1));
  const hx = w / 2, hy = h / 2, cx = x + hx, cy = y + hy;
  for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
    const dx = Math.abs(X + .5 - cx) - hx + r, dy = Math.abs(Y + .5 - cy) - hy + r;
    const d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
    const a = clamp(.5 - d) * alpha;
    if (a <= 0) continue;
    const p = out[Y * ow + X];
    out[Y * ow + X] = rgb(lerp(p & 255, cr, a), lerp(p >>> 8 & 255, cg, a), lerp(p >>> 16 & 255, cb, a));
  }
}
const mixRGB = (a: number[], b: number[], t: number): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// where the slider sits, in low-res pixels; the page uses this for hit-testing too
const RAIL = { x: 112, w: 120, y: 306, h: 13, thumb: 15 };
function upscale(pix: Uint32Array, out: Uint32Array, k: number): void {
  const ow = W * k;
  for (let y = 0; y < H; y++) {
    const row = y * k * ow;
    let o = row;
    for (let x = 0; x < W; x++) { const c = pix[y * W + x]; for (let a = 0; a < k; a++) out[o++] = c; }
    for (let b = 1; b < k; b++) out.copyWithin(row + b * ow, row, row + ow);
  }
}
function drawUI(out: Uint32Array, k: number, scene: SceneUI, idx: number, q: number, p: number, bgMix: number, sceneCount: number): void {
  const ow = W * k, oh = H * k, m = bgMix, d = sstep(.74, 1, m), dTop = sstep(.02, .2, m);
  const textC = mixRGB([112, 112, 104], [196, 204, 226], d), titleC = mixRGB([100, 100, 94], [196, 204, 226], dTop), haloC = mixRGB([255, 255, 255], [14, 18, 44], dTop), railC = mixRGB([238, 238, 234], [46, 52, 84], d), tickC = mixRGB([196, 196, 190], [96, 104, 140], d), thumbC = mixRGB([255, 255, 255], [20, 24, 54], d);
  const fs = Math.max(1, Math.round(k * .75));
  const title = (idx + 1) + '/' + sceneCount + ' ' + scene.title;
  const tx0 = (ow - textWidth(title, fs)) / 2, ty0 = 7 * k;
  for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) drawText(out, ow, oh, title, tx0 + a * fs, ty0 + b * fs, fs, rgb(...haloC));
  drawText(out, ow, oh, title, tx0, ty0, fs, rgb(...titleC));
  const rx = RAIL.x * k, rw = RAIL.w * k, ry = RAIL.y * k, rh = RAIL.h * k, tw = RAIL.thumb * k;
  roundRect(out, ow, oh, rx, ry, rw, rh, 3.2 * k, rgb(...railC));
  const ticks = scene.ticks || 10;
  for (let i = 0; i <= ticks; i++) {
    const tx = rx + tw / 2 + (rw - tw) * i / ticks, th = (i % (scene.majorEvery || 2) === 0 ? 3.4 : 2) * k;
    roundRect(out, ow, oh, tx - k * .22, ry + (rh - th) / 2, k * .44, th, k * .2, rgb(...tickC));
  }
  // while a new scene dissolves in, the thumb glides home instead of jumping
  const homing = clamp(p / FADE_IN), shown = homing < 1 ? lerp(1, q, homing * homing * (3 - 2 * homing)) : q;
  const tx = rx + (rw - tw) * shown;
  const accent = scene.accentAt ? scene.accentAt(q) : scene.accent;
  roundRect(out, ow, oh, tx, ry, tw, rh, 3.2 * k, rgb(...accent));
  roundRect(out, ow, oh, tx + k * .7, ry + k * .7, tw - k * 1.4, rh - k * 1.4, 2.6 * k, rgb(...thumbC));
  const label = scene.label(q), ls = Math.max(1, Math.round(k * .75));
  drawText(out, ow, oh, label, rx + rw + 5.5 * k, ry + (rh - 7 * ls) / 2, ls, rgb(...textC));
}

export { RAIL, upscale, drawUI };
