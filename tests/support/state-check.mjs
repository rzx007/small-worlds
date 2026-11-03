// Test-only probes; production source is never written or imported by production.
import { createServer } from 'vite';
import assert from 'node:assert/strict';
const rendererProbe = `
export function testCache() {
  renderScene(0,.5); const s=SCENES[0], firstGrid=s.grid;
  const before=[s.matCount,s.rampCount,s.staticTop,s.fmCache.size];
  renderScene(1,.75); renderScene(0,.5);
  return { sameGrid:s.grid===firstGrid, before, after:[s.matCount,s.rampCount,s.staticTop,s.fmCache.size] };
}`;
const server = await createServer({configFile:false,optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},plugins:[{
  name:'test-renderer-state-probe',enforce:'pre',transform(code,id) {
    const name=id.replaceAll('\\','/');
    if(name.endsWith('/src/renderer.ts')) return code+rendererProbe;
    if(name.endsWith('/src/renderer/dynamic-overlay.ts')) {
      const anchor='return { dyn, undoDyn, get dynTop() { return dynTop; } };';
      assert.equal(code.split(anchor).length,2,'overlay probe anchor changed');
      return code.replace(anchor,'return { dyn, undoDyn, get dynTop() { return dynTop; }, get testCount() { return jN; } };');
    }
  }
}]});
try {
  const {RendererContext}=await server.ssrLoadModule('/src/renderer/context.ts');
  const {createDynamicOverlay}=await server.ssrLoadModule('/src/renderer/dynamic-overlay.ts');
  const ctx=new RendererContext(4,4,1,1,1,1), first={}, second={};
  ctx.allocScene(first); ctx.allocScene(second); ctx.useScene(first);
  const journal=createDynamicOverlay(ctx,3,4,4), i=1+4+16;
  first.grid[i]=7;first.ap[i]=8;first.va[i]=9;
  journal.dyn(1,1,1,11);journal.dyn(1,1,1,12);journal.undoDyn();
  assert.deepEqual([first.grid[i],first.ap[i],first.va[i],journal.testCount],[7,8,9,0]);
  journal.dyn(-1,1,1,33);journal.dyn(4,1,1,33);journal.dyn(1,1,3,33);
  assert.equal(journal.testCount,0);
  for(let n=0;n<3000000;n++) journal.dyn(1,1,1,13);
  assert.equal(journal.testCount,3000000);journal.dyn(1,1,1,14);
  assert.deepEqual([journal.testCount,first.grid[i]],[3000000,13]);
  // Switch aliases before undo: journal must restore its owner, not active scene.
  ctx.useScene(second);second.grid[i]=42;second.ap[i]=43;second.va[i]=44;journal.undoDyn();
  assert.deepEqual([first.grid[i],first.ap[i],first.va[i],journal.testCount],[7,8,9,0]);
  assert.deepEqual([second.grid[i],second.ap[i],second.va[i]],[42,43,44]);
  const mod=await server.ssrLoadModule('/src/renderer.ts'); const cache=mod.testCache();
  assert.equal(cache.sameGrid,true);assert.deepEqual(cache.after,cache.before);
  console.log(JSON.stringify({journal:'reverse restore, invalid bounds, 3000000 capacity, cross-scene owner passed',cache},null,2));
} finally {await server.close();}
