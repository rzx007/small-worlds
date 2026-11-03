export const clamp = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const sstep = (a: number, b: number, v: number): number => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const span = (a: number, b: number, v: number): number => clamp((v - a) / (b - a));
export const rgb = (r: number, g: number, b: number): number => (255 << 24 | clamp(b, 0, 255) << 16 | clamp(g, 0, 255) << 8 | clamp(r, 0, 255)) >>> 0;
