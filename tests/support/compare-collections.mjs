import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const [a,b] = process.argv.slice(2);
if (!a || !b || path.resolve(a) === path.resolve(b)) throw new Error('Supply two distinct collection directories');
const readManifest = async dir => JSON.parse(await readFile(path.join(dir,'pixels-1','manifest.json'),'utf8'));
const left = await readManifest(a), right = await readManifest(b);
assert.deepEqual(left,right,'Manifest mismatch');
const hash = data => createHash('sha256').update(data).digest('hex');
let failures = 0;
for (const item of left) {
  const [x,y] = await Promise.all([a,b].map(dir => readFile(path.join(dir,'pixels-1',item.name))));
  assert.equal(x.length,item.width*item.height*4); assert.equal(y.length,x.length);
  assert.equal(hash(x),item.sha256, `${item.name}: first collection hash mismatch`);
  const secondHashValid = hash(y) === item.sha256;
  if (!secondHashValid || !x.equals(y)) {
    failures++; const diff = Buffer.alloc(x.length); let count=0; const first=[];
    for (let i=0;i<x.length;i+=4) if (!x.subarray(i,i+4).equals(y.subarray(i,i+4))) {
      count++; if(first.length<10) first.push({x:(i/4)%item.width,y:Math.floor(i/4/item.width),expected:[...x.subarray(i,i+4)],actual:[...y.subarray(i,i+4)]});
      for(let c=0;c<4;c++) diff[i+c]=Math.abs(x[i+c]-y[i+c]);
    }
    await writeFile(path.join(b,`diff-${item.name}`),diff,{flag:'wx'}); console.error(item.name,count,first);
  }
}
assert.equal(failures,0); console.log(`${left.length} independently collected frames match byte-for-byte; manifests and hashes verified`);
