import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { compareRgba, sha256, writeNew } from '../support/rgba';

declare global {
  interface Window { __testStep: (time: number) => void; }
}

async function start(page: Page) {
  await page.addInitScript(() => {
    let pending: FrameRequestCallback[] = [];
    window.requestAnimationFrame = callback => { pending.push(callback); return pending.length; };
    window.__testStep = (time: number) => {
      const callbacks = pending;
      pending = [];
      callbacks.forEach(callback => callback(time));
    };
  });
  await page.goto('/');
  await page.evaluate(() => window.__testStep(0));
}
async function step(page: Page, time: number) { await page.evaluate(t => window.__testStep(t), time); }
async function snapshot(page: Page) {
  return page.locator('canvas').evaluate(canvas => {
    const view = canvas as HTMLCanvasElement;
    const ctx = view.getContext('2d');
    if (!ctx) throw new Error('No canvas context');
    const { width, height } = view;
    const bytes = ctx.getImageData(0, 0, width, height).data;
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { width, height, bytes: btoa(binary) };
  });
}

for (const view of [{ width: 360, height: 330, deviceScaleFactor: 1 }, { width: 400, height: 350, deviceScaleFactor: 2 }]) {
  test.describe(`${view.width}x${view.height} DPR ${view.deviceScaleFactor}`, () => {
    test.use({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.deviceScaleFactor });
    test('baseline: five scene final frames are reproducible', async ({ browser }) => {
      test.setTimeout(180000);
      const runs = [];
      for (let run = 0; run < 2; run++) {
        const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.deviceScaleFactor, reducedMotion: 'reduce', colorScheme: 'light' });
        const page = await context.newPage();
        await start(page);
        const frames = [];
        for (let scene = 1; scene <= 5; scene++) {
          await page.keyboard.press(`Digit${scene}`);
          const box = await page.locator('canvas').boundingBox();
          if (!box) throw new Error('No canvas box');
          await page.mouse.click(box.x + box.width * 172 / 360, box.y + box.height * 312 / 330);
          await step(page, scene * 16);
          const frame = await snapshot(page);
          frames.push({ width: frame.width, height: frame.height, data: Buffer.from(frame.bytes, 'base64') });
        }
        runs.push(frames);
        await context.close();
      }
      const directory = process.env.BASELINE_COLLECT_DIR;
      if (directory) throw new Error('Historical five-scene baseline collection is disabled after the scene count changed; do not relabel new frames as the old baseline.');
      const manifest = [];
      for (let i = 0; i < 5; i++) {
        const first = runs[0][i], second = runs[1][i];
        expect([first.width, first.height]).toEqual([second.width, second.height]);
        const result = compareRgba(first.data, second.data, first.width, first.height);
        if (result.pixels) {
          writeNew(`test-artifacts/diff-${view.width}-scene${i + 1}.rgba`, result.diff);
        }
        expect(result.pixels, result.first.join('\n')).toBe(0);
        const name = `${view.width}-dpr${view.deviceScaleFactor}-scene${i + 1}.rgba`;
        if (directory) writeNew(join(directory, name), first.data);
        const reference = join('baselines/small-worlds/windows-x64-chromium-1248', name);
        if (!directory) {
          expect(existsSync(reference), `Missing baseline ${reference}`).toBe(true);
          const expected = readFileSync(reference);
          const normalized = Buffer.from(first.data);
          // Only mask the count digit and its one-pixel halo, not the full title.
          // Historical baseline data remains unchanged and every other pixel is checked.
          const titles = ['FOUR SEASONS', 'RISE', 'HARBOUR NIGHT', 'ERUPTION', 'LIFT-OFF'];
          const scale = first.width / 360, fontScale = Math.max(1, Math.round(scale * .75));
          const title = `${i + 1}/6 ${titles[i]}`;
          const start = Math.round((first.width - (title.length * 6 * fontScale - fontScale)) / 2);
          for (let y = 7 * scale - fontScale; y < 7 * scale + 8 * fontScale; y++) {
            for (let x = start + 11 * fontScale; x < start + 18 * fontScale; x++) {
              const offset = (y * first.width + x) * 4;
              expected.copy(normalized, offset, offset, offset + 4);
            }
          }
          const comparison = compareRgba(expected, normalized, first.width, first.height);
          if (comparison.pixels) writeNew(`test-artifacts/reference-diff-${name}`, comparison.diff);
          expect(comparison.pixels, comparison.first.join('\n')).toBe(0);
        }
        manifest.push({ name, scene: i + 1, initial: 'reduced motion; 4 seconds', events: Array.from({ length: i + 1 }, (_, n) => ({ key: `Digit${n + 1}`, pointer: 'click logical (172,312)', raf: (n + 1) * 16 })), progress: (0.024 + 0.958 * 0.5) * 0.999, viewport: view, width: first.width, height: first.height, bytes: first.data.length, sha256: sha256(first.data) });
      }
      if (directory) writeNew(join(directory, `manifest-${view.width}-dpr${view.deviceScaleFactor}.json`), JSON.stringify({ command: 'npm run build && npm run test:baseline:collect', browser: await browser.version(), node: process.version, platform: process.platform, arch: process.arch, sourceManifestSha256: '705328E191DB87B34F1037F3E1977B7ED3AD3BB118EE0B1492645D13830CC05B', frames: manifest }, null, 2));
    });
    test('canvas sizing and reduced-motion pause; real keyboard and pointer events', async ({ page }) => {
      test.setTimeout(180000);
      await start(page);
      const canvas = page.locator('canvas');
      const scale = Math.max(1, Math.floor(Math.min(view.width / 360, view.height / 330) * view.deviceScaleFactor));
      await expect(canvas).toHaveJSProperty('width', 360 * scale);
      await expect(canvas).toHaveJSProperty('height', 330 * scale);
      const initial = await snapshot(page);
      await step(page, 100);
      expect((await snapshot(page)).bytes).toEqual(initial.bytes);
      await page.keyboard.press('Digit2'); await step(page, 116);
      expect((await snapshot(page)).bytes).not.toEqual(initial.bytes);
      await page.keyboard.press('ArrowLeft'); await step(page, 132);
      const sceneOneStart = await snapshot(page);
      await page.keyboard.press('ArrowLeft'); await step(page, 148);
      const sceneSix = await snapshot(page);
      await page.keyboard.press('ArrowRight'); await step(page, 164);
      expect((await snapshot(page)).bytes).toEqual(sceneOneStart.bytes);
      await page.keyboard.press('Digit6'); await step(page, 180);
      expect((await snapshot(page)).bytes).toEqual(sceneSix.bytes);
      const box = await canvas.boundingBox(); if (!box) throw new Error('No canvas box');
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 312 / 330);
      await step(page, 196);
      expect((await snapshot(page)).bytes).not.toEqual(sceneSix.bytes);
      const scrubbed = await snapshot(page);
      await page.keyboard.press('Space'); await step(page, 212); await step(page, 312);
      expect((await snapshot(page)).bytes).not.toEqual(scrubbed.bytes);
    });
  });
}

test('production build excludes test code, and production URL has no test page', async ({ page, request }) => {
  const files = readdirSync('dist', { recursive: true }).filter((name): name is string => typeof name === 'string');
  for (const file of files.filter(name => /\.(html|js|map)$/.test(name))) {
    const contents = readFileSync(join('dist', file), 'utf8');
    expect(contents).not.toContain('__testStep');
    expect(contents).not.toContain('tests/support');
  }
  await page.goto('/');
  expect(await page.evaluate(() => '__testStep' in window)).toBe(false);
  const response = await request.get('/tests/browser/baseline.spec.ts');
  // Vite preview may fall back to index.html; it must never serve executable test source.
  expect(await response.text()).not.toContain('five scene final frames are reproducible');
});


