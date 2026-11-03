import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function compareRgba(expected: Uint8Array, actual: Uint8Array, width: number, height: number) {
  const size = width * height * 4;
  if (expected.length !== size || actual.length !== size) throw new Error('RGBA dimensions/length mismatch');
  let pixels = 0;
  const first: string[] = [];
  const diff = Buffer.alloc(size);
  for (let i = 0; i < size; i += 4) {
    if (expected[i] !== actual[i] || expected[i + 1] !== actual[i + 1] || expected[i + 2] !== actual[i + 2] || expected[i + 3] !== actual[i + 3]) {
      pixels++;
      if (first.length < 10) first.push(`(${(i / 4) % width},${Math.floor(i / 4 / width)}): ${Array.from(expected.slice(i, i + 4))} -> ${Array.from(actual.slice(i, i + 4))}`);
      for (let c = 0; c < 4; c++) diff[i + c] = Math.abs(expected[i + c] - actual[i + c]);
    }
  }
  return { pixels, first, diff };
}

export function writeNew(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data, { flag: 'wx' });
}
