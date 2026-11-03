import { build } from 'vite';
import assert from 'node:assert/strict';
import path from 'node:path';
const modules = new Set();
await build({ configFile: false, logLevel: 'silent', build: { write: false }, plugins: [{
  name: 'verify-production-module-graph',
  generateBundle() {
    for (const id of this.getModuleIds()) {
      const info = this.getModuleInfo(id);
      if (info && !info.isExternal) modules.add(id);
    }
  },
}] });
const forbidden = [...modules].filter(id => /(^|[\\/])tests([\\/]|$)|__test|t2-collect/.test(id));
assert.deepEqual(forbidden, [], `Test modules in production graph: ${forbidden.join(', ')}`);
console.log('Production build graph:', [...modules].map(id => path.relative(process.cwd(), id)).sort());
