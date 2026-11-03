import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import ts from 'typescript';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

// Test-only source transform: fail closed if the original application changes.
const source = await readFile('src/main.ts', 'utf8');
function replaceOnce(text, needle, value) {
  if (text.split(needle).length !== 2) throw new Error(`Expected exactly one ${needle}`);
  return text.replace(needle, value);
}
let instrumented = replaceOnce(source, "from './renderer';", "from '/src/renderer.ts';");
instrumented = replaceOnce(instrumented, '      draw();\n      dirty = false;', '      const begin = performance.now();\n      draw();\n      window.__measurements.push(performance.now() - begin);\n      dirty = false;');
instrumented = replaceOnce(instrumented, '  resizeCanvas();\n  if (!playing)', `  window.__measurements = [];
  window.__control = {
    seek(scene, progress) { time = (scene + progress) * SCENE_SECONDS; dirty = true; },
    status() { return { time, playing, dragging, bgMix: state.bgMix }; }
  };
  resizeCanvas();
  if (!playing)`);
const js = ts.transpileModule(instrumented, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const root = process.env.T2_OUTPUT;
if (!root) throw new Error('Set T2_OUTPUT to a new directory');
await mkdir(root, { recursive: false });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, strictPort: true } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const hash = data => createHash('sha256').update(data).digest('hex');
async function sourceSnapshot() {
  const files = (await readdir('src', {recursive:true, withFileTypes:true})).filter(d => d.isFile()).map(d => path.join(d.parentPath, d.name)).sort();
  return Object.fromEntries(await Promise.all([...files, 'index.html', 'package-lock.json'].map(async p => [p, hash(await readFile(p))])));
}
const sourceHashes = await sourceSnapshot();
async function open() {
  const context = await browser.newContext({ viewport: { width: 360, height: 330 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' });
  const page = await context.newPage();
  await page.addInitScript(() => { let queue = []; window.requestAnimationFrame = cb => (queue.push(cb), queue.length); window.__step = t => { const q = queue; queue = []; q.forEach(cb => cb(t)); }; });
  await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: js }));
  await page.goto(url);
  return { context, page };
}
async function draw(page, scene, p, now) {
  return page.evaluate(({scene, p, now}) => { window.__control.seek(scene, p); window.__step(now); return window.__measurements.at(-1); }, { scene, p, now });
}
const points = [0, .039, .04, .041, .25, .5, .75, .969, .97, .971, .999];
// Explicit branch samples are provisional, not the independently reviewed inventory.
const thresholds = [
  [.49, .63, .72, .74], [.085, .17, .735, .86],
  [.2, .22, .46, .92, .93, .96], [.215, .22, .26, .54, .72], []
];
const paths = [
  { name: 'forward', values: points },
  { name: 'backward', values: [...points].reverse() },
];
const manifests = [];
try {
  if (!process.env.PERF_ONLY) {
  for (let run = 1; run <= 2; run++) {
    const dir = path.join(root, `pixels-${run}`); await mkdir(dir);
    const manifest = [];
    for (let scene = 0; scene < 5; scene++) for (const sequence of paths) {
      const { context, page } = await open();
      await page.evaluate(() => window.__step(0));
      for (let i = 0; i < sequence.values.length; i++) {
        const p = sequence.values[i]; await draw(page, scene, p, (i + 1) * 16);
        const frame = await page.locator('canvas').evaluate(c => { const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode(...a.subarray(i, i + 8192)); return { width: c.width, height: c.height, bytes: btoa(s) }; });
        const bytes = Buffer.from(frame.bytes, 'base64'); const name = `s${scene + 1}-${sequence.name}-${i}.rgba`;
        await writeFile(path.join(dir, name), bytes, { flag: 'wx' });
        manifest.push({ name, scene, p, path: sequence.name, prior: sequence.values.slice(0, i), initial: 'reduced motion first frame p=.4 at RAF 0', raf: (i + 1) * 16, access: 'test-only seek', width: frame.width, height: frame.height, sha256: hash(bytes) });
      }
      await context.close();
    }
    // New module instance for every cold sample; cross paths retain state across A→B→A.
    for (let scene = 0; scene < 5; scene++) {
      const keyPoints = thresholds[scene].flatMap(q => [-.0001, 0, .0001].map(d => .024 + .958 * (q + d)));
      for (const [label, p] of [['cold', .5], ...keyPoints.map(p => ['key', p])]) {
        const { context, page } = await open();
        await draw(page, scene, p, 0);
        const frame = await page.locator('canvas').evaluate(c => { const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode(...a.subarray(i, i + 8192)); return { width: c.width, height: c.height, bytes: btoa(s) }; });
        const bytes = Buffer.from(frame.bytes, 'base64'); const name = `s${scene + 1}-${label}-${manifest.length}.rgba`;
        await writeFile(path.join(dir, name), bytes, { flag: 'wx' });
        manifest.push({ name, scene, p, path: label, prior: [], initial: 'new page, no prior draw; reduced motion', raf: 0, access: 'test-only seek', width: frame.width, height: frame.height, sha256: hash(bytes) });
        await context.close();
      }
      const { context, page } = await open();
      const events = [[scene, .5], [(scene + 1) % 5, .75], [scene, .5]];
      for (let i = 0; i < events.length; i++) {
        const [target, p] = events[i]; await draw(page, target, p, i * 16);
        const frame = await page.locator('canvas').evaluate(c => { const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode(...a.subarray(i, i + 8192)); return { width: c.width, height: c.height, bytes: btoa(s) }; });
        const bytes = Buffer.from(frame.bytes, 'base64'); const name = `s${scene + 1}-aba-${i}.rgba`;
        await writeFile(path.join(dir, name), bytes, { flag: 'wx' });
        manifest.push({ name, scene: target, p, path: 'A-B-A', prior: events.slice(0, i), initial: 'new page, no prior draw; reduced motion', raf: i * 16, access: 'test-only seek', width: frame.width, height: frame.height, sha256: hash(bytes) });
      }
      await context.close();
    }
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' }); manifests.push(manifest);
  }
  if (JSON.stringify(manifests[0]) !== JSON.stringify(manifests[1])) throw new Error('Pixel runs differ: see manifests');
  // Raw byte comparison in addition to hashes.
  for (const item of manifests[0]) if (!(await readFile(path.join(root, 'pixels-1', item.name))).equals(await readFile(path.join(root, 'pixels-2', item.name)))) throw new Error(`Pixel mismatch ${item.name}`);
  }
  const perf = [];
  for (let scene = 0; scene < 5; scene++) {
    const cold = [];
    for (let i = 0; i < 5; i++) { const {context, page} = await open(); cold.push(await draw(page, scene, .5, 0)); await context.close(); }
    for (const [label, p] of [['fixed', .5], ['moving', .024 + .958 * [.73, .2, .55, .24, .51][scene]]]) {
      const {context, page} = await open();
      await page.evaluate(() => window.__step(0));
      const samples = await page.evaluate(({scene, p, label}) => { const result = []; for (let i = 0; i < 130; i++) { const progress = label === 'fixed' ? p : p + i * .0001; window.__control.seek(scene, progress); window.__step((i + 1) * 16); if (i >= 30) result.push(window.__measurements.at(-1)); } return result; }, {scene, p, label});
      const sorted = [...samples].sort((a,b) => a-b);
      perf.push({scene, label, cold, warmup: 30, samples, median: (sorted[49]+sorted[50])/2, p95: sorted[94]});
      await context.close();
    }
  }
  const {context, page} = await open(); await page.evaluate(() => window.__step(0));
  for (let scene = 0; scene < 5; scene++) await draw(page, scene, .5, (scene + 1)*16);
  const memory = await page.evaluate(() => performance.memory ? { api: 'performance.memory (non-standard, approximate heap only)', usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : { api: 'performance.memory unavailable' });
  await context.close();
  if (JSON.stringify(sourceHashes) !== JSON.stringify(await sourceSnapshot())) throw new Error('Source changed during sampling; results invalid');
  await writeFile(path.join(root, 'performance.json'), JSON.stringify({ browser: browser.version(), node: process.version, platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0].model, sourceHashes, viewport: '360x330 DPR1', boundary: 'performance.now around complete draw inside RAF callback; excludes communication, pixel reads and RAF wait; includes instrumentation overhead', protocol: 'cold: new page, first frame direct seek p=.5; fixed: p=.5 repeated; moving: p=(.024+.958*q)+i*.0001, q by scene [.73,.2,.55,.24,.51]; 30 warmups then 100 samples, nearest-rank P95; one run; no threshold', perf, memory }, null, 2), { flag: 'wx' });
  console.log(`${process.env.PERF_ONLY ? 'Performance-only run' : `Collected and byte-compared ${manifests[0].length} frames twice`}; performance saved to ${root}`);
} finally { await browser.close(); await server.close(); }
