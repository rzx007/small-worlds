import { chromium } from '@playwright/test';
import { createServer, preview } from 'vite';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';

// The same real events go to the unmodified production bundle and the test-only
// transformed development entry. Direct seek is intentionally not used here.
const source = await readFile('src/main.ts', 'utf8');
function replaceOnce(text, needle, replacement) {
  assert.equal(text.split(needle).length, 2, `source anchor: ${needle}`);
  return text.replace(needle, replacement);
}
let transformed = replaceOnce(source, "from './renderer';", "from '/src/renderer.ts';");
transformed = replaceOnce(transformed, '  resizeCanvas();\n  if (!playing)', `  window.__control = { seek(scene, progress) { time = (scene + progress) * SCENE_SECONDS; dirty = true; }, status() { return {time, playing, dragging, bgMix: state.bgMix}; } };
  resizeCanvas();
  if (!playing)`);
transformed = replaceOnce(transformed, '      draw();\n      dirty = false;', '      const begin = performance.now();\n      draw();\n      window.__measurements.push(performance.now() - begin);\n      dirty = false;');
transformed = replaceOnce(transformed, '  window.__control = {', '  window.__measurements = [];\n  window.__control = {');
const js = ts.transpileModule(transformed, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const dev = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0 } });
let prod, browser;
try {
  await dev.listen();
  prod = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
  let checked = 0;
  for (const view of [{width:360,height:330,dpr:1}, {width:400,height:350,dpr:2}]) {
    const contexts = await Promise.all([0,1].map(() => browser.newContext({ viewport: {width:view.width,height:view.height}, deviceScaleFactor:view.dpr, reducedMotion:'reduce', colorScheme:'light' })));
    try {
      const pages = await Promise.all(contexts.map(c => c.newPage()));
      for (const p of pages) await p.addInitScript(() => { let q = []; window.requestAnimationFrame = cb => (q.push(cb), q.length); window.__step = t => { const old=q; q=[]; old.forEach(cb=>cb(t)); }; });
      await pages[1].route('**/src/main.ts', route => route.fulfill({contentType:'text/javascript',body:js}));
      await pages[0].goto(prod.resolvedUrls.local[0]); await pages[1].goto(dev.resolvedUrls.local[0]);
      let time = 0;
      async function sample(label) {
        const frames = [];
        for (const page of pages) {
          await page.evaluate(t => window.__step(t), time);
          frames.push(await page.locator('canvas').evaluate(c => ({width:c.width,height:c.height,bytes:(() => { const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let s=''; for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192)); return btoa(s); })(), background:getComputedStyle(document.body).backgroundColor})));
        }
        assert.equal(frames[0].width, frames[1].width, label); assert.equal(frames[0].height, frames[1].height, label);
        assert.equal(frames[0].background, frames[1].background, label);
        const a=Buffer.from(frames[0].bytes,'base64'), b=Buffer.from(frames[1].bytes,'base64');
        assert.ok(a.equals(b), `${label}: production ${createHash('sha256').update(a).digest('hex')} != transformed ${createHash('sha256').update(b).digest('hex')}`);
        checked++; time += 16;
      }
      await sample('initial');
      for (const scene of [1,2,3,4,5,1]) {
        for (const page of pages) await page.keyboard.press(`Digit${scene}`);
        await sample(`scene ${scene} start`);
        for (const x of [44,100,172,240,300,172]) {
          for (const page of pages) { const b=await page.locator('canvas').boundingBox(); await page.mouse.click(b.x+b.width*x/360,b.y+b.height*312/330); }
          await sample(`scene ${scene} x ${x}`);
        }
      }
      for (const key of ['ArrowLeft','ArrowRight','Space']) { for (const page of pages) await page.keyboard.press(key); await sample(key); }
      for (const page of pages) await page.setViewportSize({width:800,height:700}); await sample('resize playing');
    } finally { await Promise.all(contexts.map(c=>c.close())); }
  }
  console.log(`Production bundle vs instrumented dev: ${checked} actual-event frames byte-identical, both viewport/DPR settings; Chromium ${browser.version()}`);
} finally { if (browser) await browser.close(); if (prod) await new Promise((resolve,reject)=>prod.httpServer.close(e=>e?reject(e):resolve())); await dev.close(); }
