import { test, expect } from '@playwright/test';

test('sixth scene responds to keyboard and seeking, and survives scene round trips', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    let queue: FrameRequestCallback[] = [];
    window.requestAnimationFrame = cb => (queue.push(cb), queue.length);
    (window as unknown as { step: (t: number) => void }).step = t => { const pending = queue; queue = []; pending.forEach(cb => cb(t)); };
  });
  await page.goto('/');
  const step = (t: number) => page.evaluate(time => (window as unknown as { step: (t: number) => void }).step(time), t);
  const canvas = page.locator('canvas');
  const frame = () => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL());
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await step(0);
  await page.keyboard.press('Digit6');
  const bounds = (await canvas.boundingBox())!;
  const seek = async (x: number, t: number) => { await page.mouse.click(bounds.x + bounds.width * x / 360, bounds.y + bounds.height * 312 / 330); await step(t); };
  await seek(140, 16);
  const afternoon = await frame();
  await seek(205, 32);
  const night = await frame();
  expect(night).not.toBe(afternoon);
  expect(await page.evaluate(() => document.body.style.background)).toBe('rgb(14, 18, 44)');
  await page.keyboard.press('Digit3'); await step(48);
  await page.keyboard.press('Digit6'); await seek(205, 64);
  expect(await frame()).toBe(night);
  await seek(140, 80);
  expect(await frame()).toBe(afternoon);
  expect(errors).toEqual([]);
});
