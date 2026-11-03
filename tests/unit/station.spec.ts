import { test, expect } from '@playwright/test';
import { SCENES, W, H, renderScene, upscale, state } from '../../src/renderer';
import type { BuiltScene } from '../../src/renderer/types';

function frame(index: number, progress: number) {
  renderScene(index, progress);
  const pixels = new Uint32Array(W * H);
  upscale(pixels, 1);
  return pixels;
}

test('station builds once, animates deterministically and restores state across seeks and scenes', () => {
  expect(SCENES).toHaveLength(6);
  expect(SCENES[5].id).toBe('station');
  expect(SCENES[5].label(0)).toBe('17:00');
  expect(SCENES[5].label(1)).toBe('21:00');
  const afternoon = frame(5, .2);
  const station = SCENES[5] as BuiltScene;
  const grid = station.grid;
  const counts = [station.rampCount, station.matCount];
  const night = frame(5, .85);
  expect(state.bgMix).toBeGreaterThan(.55);
  expect(night).not.toEqual(afternoon);
  expect(frame(5, .2)).toEqual(afternoon);
  frame(2, .55);
  expect(frame(5, .85)).toEqual(night);
  expect(frame(5, .2)).toEqual(afternoon);
  expect(station.grid).toBe(grid);
  expect([station.rampCount, station.matCount]).toEqual(counts);
  frame(0, .5);
  expect(state.bgMix).toBe(0);
});
