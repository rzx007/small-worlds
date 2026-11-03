import { test, expect } from '@playwright/test';

for (const playing of [false, true]) {
  test(`pointer capture and ${playing ? 'playing' : 'paused'} drag`, async ({ page }) => {
    await page.addInitScript(() => {
      let queue: FrameRequestCallback[] = [];
      window.requestAnimationFrame = cb => (queue.push(cb), queue.length);
      (window as unknown as { step: (n: number) => void }).step = n => { const q = queue; queue = []; q.forEach(cb => cb(n)); };
    });
    await page.goto('/');
    const step = (n: number) => page.evaluate(t => (window as unknown as { step: (n: number) => void }).step(t), n);
    await step(0);
    if (playing) { await page.keyboard.press('Space'); await step(16); }
    const canvas = page.locator('canvas');
    const box = (await canvas.boundingBox())!;
    const x = (logical: number) => box.x + box.width * logical / 360;
    const y = box.y + box.height * 312 / 330;
    const pixels = () => canvas.evaluate(c => (c as HTMLCanvasElement).toDataURL());
    await page.mouse.move(x(120), y); await page.mouse.down(); await step(32);
    const captured = await canvas.evaluate(c => c.hasPointerCapture(1));
    expect(captured).toBe(true);
    const start = await pixels();
    await step(132); expect(await pixels()).toEqual(start);
    await page.mouse.move(x(220), y); await step(148);
    const end = await pixels(); expect(end).not.toEqual(start);
    await page.mouse.up(); await step(248);
    if (playing) expect(await pixels()).not.toEqual(end);
    else expect(await pixels()).toEqual(end);
  });
}

test('Space prevents default; CSS canvas dimensions match device scale', async ({ page }) => {
  await page.goto('/');
  const prevented = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  const dimensions = await page.locator('canvas').evaluate(c => {
    const canvas = c as HTMLCanvasElement;
    return { width: canvas.width, height: canvas.height, cssWidth: parseFloat(canvas.style.width), cssHeight: parseFloat(canvas.style.height), dpr: devicePixelRatio };
  });
  expect(dimensions.cssWidth).toBe(dimensions.width / dimensions.dpr);
  expect(dimensions.cssHeight).toBe(dimensions.height / dimensions.dpr);
});
