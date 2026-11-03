import { rgb } from '../core/math';

// Persistent fields deliberately remain untouched between frames unless reset below.
export interface FrameState {
  coverAmt: number; coverRamp: number; coverAll?: boolean; coverMaxZ?: number; coverEmit?: boolean;
  windAmt: number; sparkle: number; waterAmp: number;
  bgMix: number; bgA: number; bgB: number;
  shakeX: number; shakeY: number; time: number; uiDark: number; p: number; q?: number;
}

// ---------- frame state set by scenes ----------
export const state: FrameState = {
  coverAmt: 0, coverRamp: 0, windAmt: .6, sparkle: .74, waterAmp: 1, bgMix: 0, bgA: rgb(255, 255, 255), bgB: rgb(14, 18, 44),
  shakeX: 0, shakeY: 0, time: 0, uiDark: 0, p: 0,
};

// Preserve the original reset order and leave coverRamp and background colours persistent.
export function resetFrameOverrides(): void {
  state.coverAmt = 0; state.coverAll = false; state.coverMaxZ = 9999; state.coverEmit = false;
  state.windAmt = .6; state.sparkle = .74; state.waterAmp = 1; state.bgMix = 0;
  state.shakeX = 0; state.shakeY = 0; state.uiDark = 0;
}
