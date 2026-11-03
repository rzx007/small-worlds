import { test, expect } from '@playwright/test';
import { compareRgba, sha256 } from '../support/rgba';

test('RGBA comparator detects channels and coordinates and validates dimensions', () => {
  const a = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const b = Buffer.from([1, 2, 3, 4, 5, 9, 7, 8]);
  expect(compareRgba(a, a, 2, 1).pixels).toBe(0);
  const result = compareRgba(a, b, 2, 1);
  expect(result.pixels).toBe(1);
  expect(result.first[0]).toContain('(1,0)');
  expect(result.diff[5]).toBe(3);
  expect(() => compareRgba(a, b, 1, 1)).toThrow();
  expect(sha256(a)).toHaveLength(64);
});
