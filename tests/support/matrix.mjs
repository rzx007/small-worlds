import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import ts from 'typescript';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { eventPoints } from './event-points.mjs';

const root = process.env.MATRIX_OUTPUT;
if (!root) throw new Error('Set MATRIX_OUTPUT to a new directory');
await mkdir(root, {recursive:false}); // never overwrite an earlier run or frozen baseline
const sha = b => createHash('sha256').update(b).digest('hex');
async function sourceHashes() {
  const names=(await readdir('src',{recursive:true,withFileTypes:true})).filter(d=>d.isFile()).map(d=>path.join(d.parentPath,d.name)).sort();
  return Object.fromEntries(await Promise.all(names.map(async f=>[f,sha(await readFile(f))])));
}
const initialHashes=await sourceHashes();
const source = await readFile('src/main.ts','utf8');
function replaceOnce(s,a,b) { if(s.split(a).length!==2) throw Error(`Changed source anchor ${a}`); return s.replace(a,b); }
let adapted = replaceOnce(source,"from './renderer';","from '/src/renderer.ts';");
adapted = replaceOnce(adapted,'  resizeCanvas();\n  if (!playing)',`  window.__control = { seek(scene, progress) { time = (scene + progress) * SCENE_SECONDS; dirty = true; } };
  resizeCanvas();
  if (!playing)`);
const js=ts.transpileModule(adapted,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0}});
let browser;
const records=[];
try {
  await server.listen(); browser=await chromium.launch({args:['--force-color-profile=srgb']});
  for(const view of [{width:360,height:330,dpr:1},{width:400,height:350,dpr:2}]) {
    async function open() {
      const context=await browser.newContext({viewport:{width:view.width,height:view.height},deviceScaleFactor:view.dpr,reducedMotion:'reduce',colorScheme:'light'});
      const page=await context.newPage();
      await page.addInitScript(()=>{let q=[];window.requestAnimationFrame=cb=>(q.push(cb),q.length);window.__step=t=>{const old=q;q=[];old.forEach(cb=>cb(t));};});
      await page.route('**/src/main.ts',r=>r.fulfill({contentType:'text/javascript',body:js})); await page.goto(server.resolvedUrls.local[0]);
      return {context,page};
    }
    async function sample(page, sequence, index, scene, p, now) {
      const frame=await page.evaluate(({scene,p,now})=>{window.__control.seek(scene,p);window.__step(now);const c=document.querySelector('canvas');const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return {width:c.width,height:c.height,bytes:btoa(s),bg:getComputedStyle(document.body).backgroundColor};},{scene,p,now});
      const data=Buffer.from(frame.bytes,'base64');
      records.push({view,sequence,index,scene,p,raf:now,width:frame.width,height:frame.height,sha256:sha(data),bg:frame.bg});
    }
    const common=[0,.039,.04,.041,.25,.5,.75,.969,.97,.971,.999];
    for(let scene=0;scene<5;scene++) {
      const points=[...new Set([...common,...eventPoints[scene].flatMap(q=>[-.0001,0,.0001].map(d=>.024+.958*(q+d)))])].sort((a,b)=>a-b);
      for(const [name,values] of [['forward',points],['backward',[...points].reverse()]]) {
        const {context,page}=await open(); try { for(let i=0;i<values.length;i++) await sample(page,`s${scene+1}-${name}`,i,scene,values[i],i*16); } finally {await context.close();}
      }
      // A->B->A with dark/light changes; tests cache and dynamic restoration.
      const {context,page}=await open(); try {
        const events=[[scene,.5],[(scene+1)%5,.5],[2,.4],[2,.95],[scene,.5]];
        for(let i=0;i<events.length;i++) await sample(page,`s${scene+1}-cross`,i,...events[i],i*16);
      } finally {await context.close();}
      // Fresh page per cold sample, no first reduced-motion frame is drawn.
      for (const p of common) {const {context,page}=await open();try{await sample(page,`s${scene+1}-cold`,common.indexOf(p),scene,p,0);}finally{await context.close();}}
    }
  }
  const files=['src/main.ts','src/renderer.ts','src/scenes/seasons.ts','src/scenes/city.ts','src/scenes/harbor.ts','src/scenes/volcano.ts','src/scenes/launch.ts','tests/support/event-points.mjs','package-lock.json'];
  const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await readFile(f))])));
  if(JSON.stringify(initialHashes)!==JSON.stringify(await sourceHashes())) throw Error('Source changed during collection; results invalid');
  const output={allSourceHashes:initialHashes,protocol:'test-only Vite transform; fresh page each sequence, reduced motion; direct seek before each RAF; reverse is a distinct path; hashes over full RGBA; no frozen reference',browser:browser.version(),node:process.version,platform:os.platform(),release:os.release(),arch:os.arch(),hashes,records};
  await writeFile(path.join(root,'matrix.json'),JSON.stringify(output,null,2),{flag:'wx'});
  console.log(`${records.length} full-RGBA hashes saved in ${root}/matrix.json`);
} finally {if(browser)await browser.close();await server.close();}
