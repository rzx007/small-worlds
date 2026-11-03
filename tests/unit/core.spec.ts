import { test, expect } from '@playwright/test';
import { clamp, lerp, rgb, span, sstep } from '../../src/core/math';
import { BAYER4, BAYER8, h1, h2, h3, vn, fbm, WTEX } from '../../src/core/tables';
import { state, resetFrameOverrides } from '../../src/renderer/frame-state';

test('math and deterministic lookup tables retain their boundary behavior', () => {
  expect([clamp(-1), clamp(2), lerp(10, 20, .5), span(0, 10, 5), sstep(0, 10, 5)]).toEqual([0, 1, 15, .5, .5]);
  expect(rgb(255, 0, 0)).toBe(0xff0000ff);
  expect(BAYER4).toHaveLength(16);
  expect(new Set(BAYER8).size).toBe(64);
  expect(WTEX).toHaveLength(65536);
  expect([h1(1), h2(1, 2), h3(1, 2, 3), vn(.25, .75), fbm(.25, .75)]).toEqual(
    [h1(1), h2(1, 2), h3(1, 2, 3), vn(.25, .75), fbm(.25, .75)]
  );
});

test('frame reset leaves persistent fields intact', () => {
  const previous = { ...state };
  try {
    state.coverRamp = 42; state.bgA = 123; state.time = 7;
    state.coverAll = true; state.bgMix = 1; state.shakeX = 9;
    resetFrameOverrides();
    expect([state.coverRamp, state.bgA, state.time]).toEqual([42, 123, 7]);
    expect([state.coverAll, state.bgMix, state.shakeX, state.windAmt]).toEqual([false, 0, 0, .6]);
  } finally {
    Object.assign(state, previous);
  }
});
