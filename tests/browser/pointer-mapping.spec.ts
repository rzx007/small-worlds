import { test, expect } from '@playwright/test';

// Observe timing through a test-only, fail-closed transformation of the real
// entry. Native mouse events still exercise production event handlers.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync('src/main.ts', 'utf8');
function once(text: string, needle: string, value: string) {
  if (text.split(needle).length !== 2) throw new Error(`Changed source anchor: ${needle}`);
  return text.replace(needle, value);
}
let instrumented = once(source, "from './renderer';", "from '/src/renderer.ts';");
instrumented = once(instrumented, '  resizeCanvas();\n  if (!playing)', `  (window as unknown as { __status: () => unknown }).__status = () => ({time, playing, dragging});
  resizeCanvas();
  if (!playing)`);
const js = ts.transpileModule(instrumented, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;

test('pointer mapping, clamp and out-of-rail input', async ({ browser }) => {
  test.setTimeout(120000);
  // Preview serves only the bundle, so this test uses its own test-only dev server below.
  const { createServer } = await import('vite');
  const server = await createServer({ configFile:false, server:{host:'127.0.0.1',port:0} });
  await server.listen();
  const context = await browser.newContext({viewport:{width:360,height:330},reducedMotion:'reduce'});
  try {
    const page = await context.newPage();
    await page.addInitScript(() => { let q: FrameRequestCallback[]=[]; window.requestAnimationFrame=cb=>(q.push(cb),q.length); (window as unknown as {step:(t:number)=>void}).step=t=>{const old=q;q=[];old.forEach(cb=>cb(t));}; });
    await page.route('**/src/main.ts', route => route.fulfill({contentType:'text/javascript',body:js}));
    await page.goto(server.resolvedUrls!.local[0]);
    const status = () => page.evaluate(() => (window as unknown as {__status:()=>{time:number;playing:boolean;dragging:boolean}}).__status());
    expect(await status()).toEqual({time:4,playing:false,dragging:false});
    const box=(await page.locator('canvas').boundingBox())!;
    const x=(v:number)=>box.x+box.width*v/360, y=(v:number)=>box.y+box.height*v/330;
    await page.mouse.move(x(50),y(300)); await page.mouse.down();
    expect((await status()).dragging).toBe(false); expect((await status()).time).toBe(4); await page.mouse.up();
    await page.mouse.move(x(172),y(312)); await page.mouse.down();
    expect((await status()).dragging).toBe(true);
    const expected=(position:number)=>(.024+(.982-.024)*position)*.999*10;
    expect((await status()).time).toBeCloseTo(expected(.5), 9);
    await page.mouse.move(x(50),y(312)); expect((await status()).time).toBeCloseTo(expected(0),9);
    await page.mouse.move(x(300),y(312)); expect((await status()).time).toBeCloseTo(expected(1),9);
    await page.mouse.up(); expect((await status()).dragging).toBe(false);
    await page.keyboard.press('Digit5'); expect((await status()).time).toBe(40);
    await page.keyboard.press('ArrowRight'); expect((await status()).time).toBe(50);
    await page.keyboard.press('ArrowRight'); expect((await status()).time).toBe(0);
    await page.keyboard.press('ArrowLeft'); expect((await status()).time).toBe(50);
    for(let i=1;i<=6;i++) {await page.keyboard.press(`Digit${i}`); expect((await status()).time).toBe((i-1)*10);}
    await page.keyboard.press('Digit7'); expect((await status()).time).toBe(50);
  } finally { await context.close(); await server.close(); }
});
