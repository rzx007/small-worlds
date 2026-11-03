import type { SceneContext, SceneDefinition } from '../renderer/scene-types';
// One city block over ten years: a shack comes down, a pit opens, a tower climbs behind its crane, the plaza fills in.
export function createScene(ctx: SceneContext): SceneDefinition {
  const { BAYER4, F_WIND, G, H, W, blobTree, box, clamp, col, cone, dbox, dyn, fm, gD, gR, h1, h2, h3, keyNum, lerp, mat, pDot, pLine, pPlot, pix, puff, ramp, roundCyl, roundLevel, set, setRamp, setSun, soilSlab, sstep, when } = ctx;
  let hook: { x: number; y: number; z: number; drop: number } | null = null;
  let mast: { x: number; y: number; z: number; dx: number; dy: number } | null = null;
  const R = {} as Record<'asphalt' | 'walk' | 'line' | 'dirt' | 'mud' | 'grass' | 'tuft' | 'bark' | 'concrete' | 'core' | 'steel' | 'glass' | 'glass2' | 'glow' | 'yellow' | 'red' | 'ink' | 'white' | 'brick' | 'brick2' | 'tan' | 'roof' | 'win' | 'winLit' | 'water' | 'shack' | 'rust' | 'sign' | 'tarp' | 'dust' | 'spark' | 'skin', number> & { leaf: number[]; car: number[]; people: number[] };
  const TX0 = 54, TX1 = 92, TY0 = 50, TY1 = 88; // tower footprint
  const FLOORS = 26, FLOOR_H = 5, TOPZ = G + FLOORS * FLOOR_H;
  const PIT = { x0: 46, x1: 100, y0: 42, y1: 96, depth: 8 };
  const CRANE = { x: TX1 + 9, y: TY1 + 9 };
  const riseAt = (f: number) => lerp(.2, .68, f / FLOORS); // when floor f's slab appears
  const skinAt = (f: number) => riseAt(f) + .055; // the glass follows a few floors behind
  const craneTop = (q: number) => { const f = clamp((q - .2) / .48) * FLOORS; return Math.max(G + 34, G + (f + 7) * FLOOR_H); };
  const roadX = (y: number) => y >= 118; // road along the front-left edge
  const roadY = (x: number) => x >= 118; // road along the front-right edge
  const CARS: { ph: number; lane: number; axis: 'x' | 'y'; c: number; sp: number }[] = [];
  for (let i = 0; i < 9; i++) CARS.push({ ph: h1(i + 20), lane: i % 2, axis: i % 3 ? 'x' : 'y', c: i % 5, sp: .55 + h1(i + 40) * .3 });
  const PEOPLE: [number, number, number, number][] = [];
  for (let i = 0; i < 26; i++) PEOPLE.push([h1(i + 100), h1(i + 130), h1(i + 160), i % 4]);
  let shackMat = 0;
  const mat2 = (r: number) => { if (!shackMat) shackMat = mat(r, { noise: .6 }); return shackMat; };
  const PLAZA_TREES = [[40, 104], [62, 108], [84, 108], [108, 104], [108, 70], [108, 46], [38, 80]];

  return {
    id: 'rise', title: 'RISE', accent: [196, 148, 42], ticks: 10, majorEvery: 2,
    label: q => String(2026 + Math.floor(q * 10.99)),
    build() {
      R.asphalt = ramp([84, 84, 92]); R.walk = ramp([186, 180, 168]); R.line = ramp([232, 226, 200]); R.dirt = ramp([158, 124, 88]); R.mud = ramp([116, 88, 64]);
      R.grass = ramp([112, 152, 72]); R.tuft = ramp([134, 168, 76]); R.leaf = [ramp([96, 150, 66]), ramp([120, 168, 72]), ramp([78, 132, 66])]; R.bark = ramp([96, 74, 60]);
      R.concrete = ramp([196, 192, 184]); R.core = ramp([160, 156, 150]); R.steel = ramp([76, 88, 106]); R.glass = ramp([92, 150, 196]); R.glass2 = ramp([70, 122, 176]); R.glow = ramp([92, 150, 196]);
      R.yellow = ramp([240, 186, 44]); R.red = ramp([204, 64, 50]); R.ink = ramp([40, 40, 50]); R.white = ramp([244, 242, 236]); R.brick = ramp([168, 92, 70]); R.brick2 = ramp([138, 110, 96]); R.tan = ramp([212, 192, 150]); R.roof = ramp([104, 100, 104]); R.win = ramp([60, 74, 96]); R.winLit = ramp([246, 212, 130]);
      R.water = ramp([96, 176, 200]); R.shack = ramp([150, 128, 104]); R.rust = ramp([160, 96, 62]); R.sign = ramp([244, 112, 66]); R.tarp = ramp([70, 130, 190]); R.car = [ramp([206, 62, 54]), ramp([236, 234, 226]), ramp([62, 90, 150]), ramp([236, 186, 56]), ramp([56, 56, 66])]; R.dust = ramp([206, 184, 150]); R.spark = ramp([255, 214, 110], true); R.skin = ramp([226, 180, 150]); R.people = [ramp([206, 72, 60]), ramp([58, 92, 150]), ramp([236, 196, 72]), ramp([70, 70, 80])];

      const asphalt = mat(R.asphalt, { noise: .5, edge: 0 }), walk = mat(R.walk, { noise: .3, edge: 0 }), walkD = fm(R.walk, 2.9, { edge: 0 }), line = mat(R.line, { edge: 0 }), dirt = mat(R.dirt, { noise: 1, edge: 0 }), grass = mat(R.grass, { noise: .7, edge: 0 });
      soilSlab((x, y) => {
        if (roadX(y) || roadY(x)) {
          const lx = roadX(y) && !roadY(x), ly = roadY(x) && !roadX(y);
          if (lx && y >= 133 && y <= 134 && x % 10 < 6) return line;
          if (ly && x >= 133 && x <= 134 && y % 10 < 6) return line;
          if ((x >= 110 && x < 118 && y >= 122) || (y >= 110 && y < 118 && x >= 122)) return line;
          if (!lx && !ly && (x + y) % 8 < 4 && x < 128 && y < 128) return line;
          return asphalt;
        }
        if (x >= 112 || y >= 112) return (x + y) % 12 < 1 ? walkD : walk;
        return x >= 28 && y >= 28 ? -1 : grass;
      }, { soil: [96, 74, 60], humus: [70, 58, 54] });
      for (let y = 28; y < 112; y++) for (let x = 28; x < 112; x++) set(x, y, G - 2, dirt);
      // kerbs along the road
      const kerb = fm(R.concrete, 3.2, { edge: 0 });
      for (let i = 0; i < 118; i++) { set(i, 118, G - 1, kerb); set(118, i, G - 1, kerb); }
      // neighbours along the back edges
      const building = (x0: number, y0: number, x1: number, y1: number, h: number, wallR: number, roofM: number, seed: number) => {
        const wall = mat(wallR, { noise: .3 });
        box(x0, y0, G, x1, y1, G + h, wall);
        box(x0, y0, G + h + 1, x1, y1, G + h + 1, roofM);
        for (let y = y0 + 2; y <= y1 - 2; y++) for (let z = G + 3; z < G + h; z++) if ((y - y0) % 5 < 3 && (z - G) % 6 < 4) set(x1, y, z, fm(h2(y, seed + ((z - G) / 6 | 0)) > .78 ? R.winLit : R.win, 3, { edge: 0 }));
        for (let x = x0 + 2; x <= x1 - 2; x++) for (let z = G + 3; z < G + h; z++) if ((x - x0) % 5 < 3 && (z - G) % 6 < 4) set(x, y1, z, fm(h2(x + 77, seed + ((z - G) / 6 | 0)) > .78 ? R.winLit : R.win, 3, { edge: 0 }));
        box(x0, y0, G + h + 2, x1, y0, G + h + 2, wall); box(x0, y0, G + h + 2, x0, y1, G + h + 2, wall);
        box(x1, y0, G + h + 2, x1, y1, G + h + 2, wall); box(x0, y1, G + h + 2, x1, y1, G + h + 2, wall);
      };
      const flatRoof = mat(R.roof, { noise: .5, edge: 0 });
      building(2, 4, 24, 30, 32, R.brick, flatRoof, 1);
      building(2, 36, 22, 64, 20, R.tan, flatRoof, 2);
      building(30, 2, 58, 22, 24, R.brick2, flatRoof, 3);
      building(64, 2, 88, 20, 38, R.tan, flatRoof, 4);
      building(94, 2, 112, 24, 18, R.brick, flatRoof, 5);
      building(2, 72, 20, 104, 14, R.brick2, flatRoof, 6);
      // water tank on a neighbour's roof
      roundCyl(80, 10, G + 41, G + 47, 4, R.rust); cone(80, 10, G + 48, 3, 4, R.roof);
      // street trees along the far pavements
      const bark = mat(R.bark);
      for (const [x, y] of [[114, 30], [114, 62], [114, 94], [30, 114], [62, 114], [94, 114]]) blobTree(x, y, G, { r: 5, trunk: 5, sets: R.leaf, trunkM: bark, seed: x + y });
      // street lamps and a crossing signal
      const lampM = fm(R.ink, 2, { edge: 0 });
      for (const [x, y] of [[116, 16], [116, 46], [116, 78], [16, 116], [46, 116], [78, 116]]) { box(x, y, G, x, y, G + 12, lampM); set(x - 1, y, G + 12, fm(R.winLit, 4, { edge: 0 })); }
      // weeds on the empty lot
      when(0, .075);
      const weed = fm(R.tuft, 3.4, { edge: 0, flags: F_WIND });
      for (let y = 30; y <= 110; y++) for (let x = 30; x <= 110; x++) if (h3(x, y, 9) < .07) set(x, y, G, weed);
      when();
      // hoarding around the site, gone by the time the plaza opens
      when(.03, .85);
      const hoarding = (x: number, y: number) => fm((((x + y) / 7 | 0) % 2) ? R.white : R.tarp, 2.6, { edge: 2 });
      for (let x = 28; x <= 108; x++) { if (x > 66 && x < 74) continue; box(x, 110, G, x, 110, G + 6, hoarding(x, 110)); }
      for (let y = 28; y <= 110; y++) box(110, y, G, 110, y, G + 6, hoarding(110, y));
      when();
      // the tower: slabs and columns first, the glass catches up behind them
      const cols = fm(R.steel, 1.6, { edge: 2 }), slabM = mat(R.concrete, { noise: .25 });
      const coreM = mat(R.core, { noise: .5 });
      for (let f = 0; f < FLOORS; f++) {
        const z0 = G + f * FLOOR_H, ta = riseAt(f), tb2 = riseAt(f) + .012;
        when(ta);
        box(TX0, TY0, z0, TX1, TY1, z0, slabM);
        when(tb2);
        box(TX0 + 12, TY0 + 12, z0, TX1 - 12, TY1 - 12, z0 + FLOOR_H - 1, coreM);
        for (let x = TX0; x <= TX1; x += 8) { box(x, TY1, z0, x, TY1, z0 + FLOOR_H - 1, cols); box(x, TY0, z0, x, TY0, z0 + FLOOR_H - 1, cols); }
        for (let y = TY0; y <= TY1; y += 8) { box(TX1, y, z0, TX1, y, z0 + FLOOR_H - 1, cols); box(TX0, y, z0, TX0, y, z0 + FLOOR_H - 1, cols); }
        // curtain wall
        const glassOf = (a: number, z: number) => {
          const bay = a >> 3, lit = h2(bay + 11, f * 7 + 3) > .74;
          return fm(lit ? R.glow : (bay + f) % 3 === 0 ? R.glass2 : R.glass, 3, { edge: 0, flags: 0 });
        };
        when(skinAt(f) + h1(f) * .012);
        for (let x = TX0; x <= TX1; x++) for (let z = z0 + 1; z < z0 + FLOOR_H; z++) { if ((x - TX0) % 8 === 0) continue; set(x, TY1, z, glassOf(x, z)); set(x, TY0, z, glassOf(x + 3, z)); }
        for (let y = TY0; y <= TY1; y++) for (let z = z0 + 1; z < z0 + FLOOR_H; z++) { if ((y - TY0) % 8 === 0) continue; const bay = y >> 3, lit = h2(bay + 31, f * 5 + 1) > .74; set(TX1, y, z, fm(lit ? R.glow : (bay + f) % 3 === 0 ? R.glass2 : R.glass, lit ? 2.6 : 1.6, { edge: 0 })); set(TX0, y, z, glassOf(y, z)); }
      }
      // roof crown, plant room and mast appear when the crane is done
      when(.70);
      box(TX0, TY0, TOPZ, TX1, TY1, TOPZ, slabM);
      box(TX0 + 8, TY0 + 8, TOPZ + 1, TX1 - 8, TY1 - 8, TOPZ + 7, mat(R.core, { noise: .3 }));
      when(.73);
      box(TX0, TY0, TOPZ + 1, TX1, TY0, TOPZ + 2, slabM); box(TX0, TY1, TOPZ + 1, TX1, TY1, TOPZ + 2, slabM); box(TX0, TY0, TOPZ + 1, TX0, TY1, TOPZ + 2, slabM); box(TX1, TY0, TOPZ + 1, TX1, TY1, TOPZ + 2, slabM);
      when(.75);
      box(73, 69, TOPZ + 8, 74, 70, TOPZ + 24, fm(R.steel, 2.4, { edge: 2 }));
      when();
      // the plaza opens last
      when(.82);
      const paving = mat(R.walk, { noise: .35, edge: 0 }), pavingD = fm(R.walk, 2.8, { edge: 0 }), lawn = mat(R.grass, { noise: .7, edge: 0 });
      for (let y = 28; y < 112; y++) for (let x = 28; x < 112; x++) {
        if (x >= TX0 && x <= TX1 && y >= TY0 && y <= TY1) continue;
        const isLawn = (x > 34 && x < 50 && y > 54 && y < 106) || (x > 56 && x < 106 && y > 96 && y < 108);
        set(x, y, G - 1, isLawn ? lawn : (x + y) % 10 < 1 || (x - y + 200) % 10 < 1 ? pavingD : paving);
      }
      when(.86);
      roundCyl(100, 94, G, G + 1, 7, R.concrete); roundCyl(100, 94, G + 1, G + 1, 6, R.water);
      when(.87);
      box(99, 93, G + 1, 101, 95, G + 5, fm(R.concrete, 3.2, { edge: 2 }));
      when();
      PLAZA_TREES.forEach(([x, y], i) => {
        const g0 = .83 + i * .012;
        blobTree(x, y, G, { r: 6.5, trunk: 5, sets: R.leaf, trunkM: bark, seed: i * 19, trunkWhen: [g0, 1], when: (X, Y, z) => [g0 + .05 * clamp((Math.hypot(X - x, Y - y) + (z - G) * .3) / 12), 1] });
      });
      when();
      // a sign on the tower's face when it opens
      when(.9);
      box(TX0 + 6, TY1 + 1, G + 3, TX0 + 24, TY1 + 1, G + 6, fm(R.sign, 3.4, { edge: 2 }));
      when();
    },
    update(q, t) {
      // the old shack sags and goes
      if (q < .085) {
        const fall = sstep(.05, .085, q), shack = mat2(R.shack), rust = fm(R.rust, 3.2, { edge: 2 }), rustD = fm(R.rust, 2.2, { edge: 2 });
        const top = Math.round(9 * (1 - fall));
        dbox(60, 60, G, 82, 76, G + top, shack);
        if (top >= 3) dbox(68, 76, G, 72, 76, G + Math.min(6, top), fm(R.ink, 2, { edge: 0 }));
        if (top >= 6) dbox(82, 64, G + 3, 82, 68, G + 6, fm(R.win, 3, { edge: 0 }));
        for (let x = 59; x <= 83; x++) for (let y = 59; y <= 77; y++) {
          const zt = G + top + 1 + Math.floor((9.5 - Math.abs(y - 68)) * .6 * (1 - fall));
          dyn(x, y, zt, y > 68 ? (zt % 2 ? rust : rustD) : rustD);
        }
      }
      // the pit opens under the excavator, then fills as the basement slabs go in
      const dig = sstep(.075, .19, q) * (1 - sstep(.2, .27, q)) * PIT.depth;
      if (dig >= 1) {
        const d = Math.floor(dig), mud = fm(R.mud, 2.6, { edge: 0, noise: .9 }), wall = fm(R.mud, 1.6, { edge: 0, noise: .9 });
        for (let y = PIT.y0; y <= PIT.y1; y++) for (let x = PIT.x0; x <= PIT.x1; x++) {
          const edge = Math.min(x - PIT.x0, PIT.x1 - x, y - PIT.y0, PIT.y1 - y);
          const local = Math.min(d, edge + 1);
          for (let z = G - 1; z > G - 1 - local; z--) dyn(x, y, z, 0);
          dyn(x, y, G - 1 - local, local >= d ? mud : wall);
          for (let z = G - 2 - local; z >= G - 2 - d; z--) dyn(x, y, z, wall);
        }
      }
      // spoil heap grows beside the pit
      if (q > .08 && q < .86) {
        const hh = sstep(.08, .2, q) * (1 - sstep(.22, .3, q) * .55) * 12, heap = fm(R.mud, 3, { edge: 1, noise: 1.2 });
        for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
          const d = Math.hypot(x - 10, y - 10) / 10, zt = hh * (1 - d * d);
          for (let z = 0; z < zt; z++) dyn(30 + x, 28 + y, G + z, fm(R.mud, clamp(Math.round(roundLevel((x - 10) / 10, (y - 10) / 10, .8) + (h2(x, y) - .5)), 0, 5), { edge: 1 }));
        }
      }
      // excavator and truck, only while there is digging to do
      if (q > .06 && q < .21) {
        const a = t * 3, X = 66 + Math.sin(t * .8) * 4, Y = 104, body = fm(R.yellow, 3.2, { edge: 2 }), dark = fm(R.ink, 1.6, { edge: 2 });
        dbox(X - 7, Y - 4, G, X + 7, Y + 4, G + 2, dark); dbox(X - 5, Y - 4, G + 3, X + 5, Y + 4, G + 8, body); dbox(X - 4, Y - 3, G + 9, X + 1, Y + 2, G + 12, fm(R.glass, 3, { edge: 2 }));
        const ax = X + 6, az = G + 9, ex = ax + 8, ez = az + 6 + Math.sin(a) * 3, bx = ex + 2, bz = ez - 9 - Math.sin(a) * 4;
        for (let i = 0; i <= 14; i++) { const k = i / 14; dbox(lerp(ax, ex, k), Y - 1, lerp(az, ez, k), lerp(ax, ex, k) + 1, Y, lerp(az, ez, k), body); dbox(lerp(ex, bx, k), Y - 1, lerp(ez, bz, k), lerp(ex, bx, k) + 1, Y, lerp(ez, bz, k), body); }
        dbox(bx - 1, Y - 2, bz - 2, bx + 2, Y + 1, bz, dark);
      }
      // the crane stands from the first slab until the crown goes on
      if (q > .17 && q < .735) {
        const up = sstep(.17, .2, q), down = sstep(.71, .735, q), topZ = lerp(G + 34, craneTop(q), 1) * (1 - down) + G * down, yellow = fm(R.yellow, 3.2, { edge: 1 }), yd = fm(R.yellow, 2, { edge: 1 });
        const zTop = lerp(G, topZ, up), X = CRANE.x, Y = CRANE.y;
        for (let z = G; z < zTop; z++) {
          const c = z % 6 < 1 ? yellow : 0;
          dyn(X, Y, z, yellow); dyn(X + 3, Y, z, yd); dyn(X, Y + 3, z, yellow); dyn(X + 3, Y + 3, z, yd);
          if (c) { dyn(X + 1, Y, z, c); dyn(X + 2, Y, z, c); dyn(X, Y + 1, z, c); dyn(X, Y + 2, z, c); dyn(X + 1, Y + 3, z, c); dyn(X + 2, Y + 3, z, c); dyn(X + 3, Y + 1, z, c); dyn(X + 3, Y + 2, z, c); }
        }
        dbox(X - 1, Y - 1, G, X + 4, Y + 4, G + 1, fm(R.concrete, 3, { edge: 2 }));
        if (up > .98 && down < .02) {
          const slew = -2.2 + Math.sin(t * 1.1) * .75, cx = X + 1.5, cy = Y + 1.5, z1 = zTop + 2;
          dbox(X - 1, Y - 1, zTop, X + 4, Y + 4, zTop + 3, fm(R.white, 3.2, { edge: 2 }));
          dbox(X, Y, zTop + 4, X + 3, Y + 3, zTop + 8, yd);
          const dx = Math.cos(slew), dy = Math.sin(slew);
          for (let i = -14; i <= 56; i++) {
            const xx = cx + dx * i, yy = cy + dy * i, m = i < 0 ? fm(R.red, 3, { edge: 1 }) : yellow;
            dyn(xx, yy, z1 + 3, m); dyn(xx, yy, z1 + 4, i % 4 === 0 ? m : 0);
            if (i < -8) dbox(xx - 1, yy - 1, z1 - 1, xx + 1, yy + 1, z1 + 2, fm(R.core, 2.6, { edge: 1 }));
          }
          const hookDistance = 18 + (Math.sin(t * 1.6) * .5 + .5) * 34;
          hook = { x: cx + dx * hookDistance, y: cy + dy * hookDistance, z: z1 + 3, drop: 14 + Math.sin(t * 2.3) * 8 };
          mast = { x: cx, y: cy, z: z1 + 12, dx, dy };
          dbox(hook.x - 3, hook.y - 3, hook.z - hook.drop - 2, hook.x + 3, hook.y + 3, hook.z - hook.drop, fm(R.steel, 2.4, { edge: 2 }));
        } else { hook = null; mast = null; }
      } else { hook = null; mast = null; }
      // lit offices flicker on by floor as the tower fills
      const glint = Math.floor(t * 8);
      const litAmt = sstep(.55, .9, q);
      setRamp(R.glow, [lerp(92, 250, litAmt), lerp(150, 214, litAmt), lerp(196, 130, litAmt)]);
      setSun(-1, .35, keyNum([[0, .9], [.5, .72], [1, .62]], q), 1);
      // traffic grows with the building; time-lapse cars are quick
      const nCars = q < .1 ? 3 : q < .8 ? 5 : 9;
      for (let i = 0; i < nCars; i++) {
        const c = CARS[i], k = ((t * c.sp * .55 + c.ph) % 1), body = fm(R.car[c.c], 3.2, { edge: 2 }), wind = fm(R.glass2, 3.2, { edge: 1 }), dark = fm(R.ink, 1, { edge: 0 });
        if (c.axis === 'x') {
          const dir = c.lane ? -1 : 1, Y = c.lane ? 124 : 139, X = dir > 0 ? k * 158 - 8 : 158 - k * 158 - 8;
          dbox(X, Y, G + 1, X + 12, Y + 6, G + 3, body); dbox(X + 3, Y + 1, G + 4, X + 9, Y + 5, G + 5, wind);
          dbox(X + 2, Y + 6, G, X + 3, Y + 6, G, dark); dbox(X + 9, Y + 6, G, X + 10, Y + 6, G, dark);
        } else {
          const dir = c.lane ? -1 : 1, X = c.lane ? 124 : 139, Y = dir > 0 ? k * 158 - 8 : 158 - k * 158 - 8;
          dbox(X, Y, G + 1, X + 6, Y + 12, G + 3, body); dbox(X + 1, Y + 3, G + 4, X + 5, Y + 9, G + 5, wind);
          dbox(X + 6, Y + 2, G, X + 6, Y + 3, G, dark); dbox(X + 6, Y + 9, G, X + 6, Y + 10, G, dark);
        }
      }
      // people on the plaza
      if (q > .88) {
        for (let i = 0; i < PEOPLE.length; i++) {
          const [a, b, ph, cc] = PEOPLE[i], k = (t * .12 + ph) % 1, leg = clamp((q - .88 - i * .002) * 40);
          if (leg <= 0) continue;
          const X = 32 + (a * 76) + Math.cos(ph * 6.28) * k * 18, Y = 96 + b * 14 + Math.sin(ph * 6.28) * k * 4;
          dbox(X, Y, G, X + 1, Y, G + 2, fm(R.people[cc], 2.8, { edge: 1 }));
          dyn(X, Y, G + 3, fm(R.skin, 3.4, { edge: 1 }));
        }
      }
      // demolition dust
      if (q > .06 && q < .11) for (let i = 0; i < 9; i++) {
        const k = ((q - .06) / .05), rr = 3 + k * 5;
        puff(62 + h1(i) * 20 + k * 6, 60 + h1(i + 3) * 16, G + 2 + h1(i + 5) * 8 + k * 10, rr * (1 - k * .3), R.dust, { seed: i, lift: 1, edge: 3 });
      }
    },
    post(q, t) {
      const ink = col(50, 50, 60);
      if (hook) {
        const h = hook;
        pLine(h.x, h.y, h.z, h.x, h.y, h.z - h.drop, ink);
        if (mast) {
          const m = mast;
          pLine(m.x, m.y, m.z, m.x + m.dx * 54, m.y + m.dy * 54, m.z - 8, col(120, 96, 50));
          pLine(m.x, m.y, m.z, m.x - m.dx * 13, m.y - m.dy * 13, m.z - 8, col(120, 96, 50));
        }
      }
      // welding sparks at the working floor
      if (q > .2 && q < .7) {
        const f = clamp((q - .2) / .48) * FLOORS, z0 = G + f * FLOOR_H, tick = Math.floor(t * 12);
        for (let i = 0; i < 26; i++) {
          if (h3(i, tick, 1) > .4) continue;
          const onY = i % 2, a = h1(i + 500) * 38, X = onY ? TX0 + a : TX1 + 1, Y = onY ? TY1 + 1 : TY0 + a;
          const age = (t * 4 + h1(i)) % 1;
          pDot(X + age * 2, Y + age, z0 - 2 - age * age * 14, h3(i, tick, 2) > .5 ? col(255, 232, 150) : col(255, 170, 60));
        }
      }
      // a sweep of light across the finished glass
      if (q > .62) {
        const k = ((q - .62) / .1) % 1.4;
        const pos = (t * .9) % 2 - .5;
        for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
          const p = sy * W + sx, r = gR[p];
          if (gD[p] < 0 || (r !== R.glass && r !== R.glass2)) continue;
          const u = (sx * .55 + sy) / 180 - pos;
          if (u > 0 && u < .07 && BAYER4[(sy & 3) * 4 + (sx & 3)] < .75) pix[p] = col(214, 236, 248);
        }
      }
      // birds settle on the crown
      if (q > .92) { const k = (q - .92) / .08; for (let i = 0; i < 5; i++) { const X = 60 + i * 30 + k * 40, Y = 50 + h1(i) * 18 + Math.sin(t * 2 + i) * 2, fl = Math.floor(t * 8 + i) % 2, c = col(60, 58, 70); pPlot(X, Y, c); pPlot(X - 1, Y - fl, c); pPlot(X + 1, Y - fl, c); } }
    },
  };
}
