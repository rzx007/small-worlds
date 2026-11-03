import { test, expect } from '@playwright/test';

for (const playing of [false, true]) {
  test(`resize and pointer cancellation (${playing ? 'playing' : 'paused'})`, async ({ page }) => {
    await page.addInitScript(() => {
      let pending: FrameRequestCallback[] = [];
      window.requestAnimationFrame = cb => (pending.push(cb), pending.length);
      (window as unknown as { step: (n: number) => void }).step = n => { const q = pending; pending = []; q.forEach(cb => cb(n)); };
    });
    await page.goto('/');
    const step = (n: number) => page.evaluate(t => (window as unknown as { step: (n: number) => void }).step(t), n);
    await step(0);
    if (playing) { await page.keyboard.press('Space'); await step(16); }
    const canvas = page.locator('canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 312 / 330);
    await page.mouse.down(); await step(32);
    expect(await canvas.evaluate(c => c.hasPointerCapture(1))).toBe(true);
    // Synthetic cancel isolates the handler; Playwright mouse does not issue a native pointercancel.
    await canvas.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true });
    await step(48);
    const before = await canvas.evaluate(c => (c as HTMLCanvasElement).toDataURL());
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 312 / 330); await step(148);
    const after = await canvas.evaluate(c => (c as HTMLCanvasElement).toDataURL());
    if (playing) expect(after).not.toEqual(before); else expect(after).toEqual(before);
    await page.mouse.up();
    await page.setViewportSize({ width: 800, height: 700 }); await step(164);
    const dims = await canvas.evaluate(c => ({ w: (c as HTMLCanvasElement).width, h: (c as HTMLCanvasElement).height, dpr: devicePixelRatio, css: parseFloat((c as HTMLCanvasElement).style.width) }));
    const scale = Math.max(1, Math.floor(Math.min(800 / 360, 700 / 330) * dims.dpr));
    expect([dims.w, dims.h, dims.css]).toEqual([360 * scale, 330 * scale, 360 * scale / dims.dpr]);
  });
}

test('actual scene frames select both background colors', async ({ page }) => {
  await page.goto('/');
  const colors = new Set<string>();
  for (let scene = 1; scene <= 5; scene++) {
    await page.keyboard.press(`Digit${scene}`);
    const box = (await page.locator('canvas').boundingBox())!;
    for (const x of [50, 120, 172, 230, 295]) {
      await page.mouse.click(box.x + box.width * x / 360, box.y + box.height * 312 / 330);
      await page.waitForTimeout(30);
      const bg = await page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor]);
      expect(bg[0]).toEqual(bg[1]); colors.add(bg[0]);
    }
  }
  expect([...colors].sort()).toEqual(['rgb(14, 18, 44)', 'rgb(255, 255, 255)']);
});
