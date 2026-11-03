import type { ColorKeys, SceneContext, SceneDefinition } from '../renderer/scene-types';
// A volcanic island: quiet, then a column of ash and rivers of lava, then black rock, then green again.
export function createScene(ctx: SceneContext): SceneDefinition {
  const { F_COVER, F_EMIT, F_WATER, G, H, LV, W, WORLD, box, clamp, col, cyl, dbox, fbm, fm, gableX, h1, h2, h3, keys, lerp, mat, pDot, pGlow, pPlot, project, puff, ramp, set, setGrade, setRamp, setSun, sstep, state, vn, when } = ctx;
  // Populated by build before frame updates.
  const R = {} as { ash: number; ashA: number; ashB: number; ashWarm: number; bird: number; boat: number; crater: number; dark: number; deep: number; green: number; green2: number; hot: number; hut: number; lake: number; lava: number[]; mid: number; moss: number; pine: number; pine2: number; red: number; rock: number; rock2: number; roof: number; sand: number; shallow: number; steam: number; trunk: number; white: number; wood: number };
  const CX = 74, CY = 70, PEAK = 76, SHORE = 62;
  const H0 = new Int16Array(151 * 151);
  const hAt = (x: number, y: number) => (x < 0 || y < 0 || x > WORLD || y > WORLD ? -1 : H0[y * 151 + x]);
  const lavaMask = new Uint8Array(151 * 151);
  type Flow = { pts: never[]; t: number; end: [number, number, number] };
  const FLOWS: Flow[] = [];
  const edgeDist = (x: number, y: number) => Math.min(x, y, WORLD - x, WORLD - y) + (fbm(x * .1, y * .1) - .5) * 10;
  const keep = (x: number, y: number) => { const d = edgeDist(x, y); return d >= 10 || (d > 0 && h2(x, y) < d / 10); };
  const HOT_T = .22, BLAST_END = .54;
  const LAVA_BUCKETS = 10;
  const lavaArrive = (b: number) => .26 + .3 * (b / (LAVA_BUCKETS - 1));
  const GREEN: ColorKeys = [[0, [96, 148, 68]], [.26, [96, 148, 68]], [.36, [84, 90, 64]], [.5, [66, 64, 60]], [.72, [66, 64, 60]], [.84, [104, 150, 66]], [1, [112, 168, 72]]];
  const GREEN2: ColorKeys = [[0, [78, 124, 62]], [.26, [78, 124, 62]], [.36, [70, 76, 60]], [.5, [58, 56, 56]], [.72, [58, 56, 56]], [.84, [86, 130, 62]], [1, [92, 146, 66]]];
  const PINE: ColorKeys = [[0, [66, 110, 74]], [.26, [66, 110, 74]], [.34, [92, 92, 84]], [.44, [70, 66, 66]], [1, [70, 66, 66]]];
  const SAND: ColorKeys = [[0, [228, 204, 152]], [.26, [228, 204, 152]], [.4, [150, 142, 130]], [.72, [156, 148, 134]], [.86, [226, 204, 156]], [1, [228, 206, 156]]];

  return {
    id: 'eruption', title: 'ERUPTION', accent: [214, 86, 44], ticks: 10, majorEvery: 2, baseShift: 0,
    label: q => (q < .72 ? 'DAY ' + (1 + Math.floor(q / .72 * 40)) : 'YEAR ' + (1 + Math.floor((q - .72) / .28 * 49))),
    build() {
      R.deep = ramp([46, 116, 156]); R.mid = ramp([60, 150, 170]); R.shallow = ramp([110, 190, 180]);
      R.sand = ramp(SAND[0][1]); R.green = ramp(GREEN[0][1]); R.green2 = ramp(GREEN2[0][1]); R.rock = ramp([128, 114, 104]); R.rock2 = ramp([96, 86, 84]); R.dark = ramp([62, 56, 58]);
      R.ash = ramp([134, 130, 128]); R.moss = ramp([104, 148, 70]); R.pine = ramp(PINE[0][1]); R.pine2 = ramp([84, 136, 76]); R.trunk = ramp([72, 58, 54]);
      R.lava = []; for (let i = 0; i < LAVA_BUCKETS; i++) R.lava.push(ramp([255, 180, 60], true));
      R.hot = ramp([255, 150, 60], true); R.crater = ramp([255, 200, 90], true); R.lake = ramp([70, 150, 176]);
      R.ashA = ramp([108, 102, 112]); R.ashB = ramp([78, 72, 84]); R.ashWarm = ramp([168, 104, 78]); R.steam = ramp([238, 240, 244]);
      R.hut = ramp([224, 208, 170]); R.roof = ramp([170, 92, 62]); R.wood = ramp([116, 88, 66]); R.boat = ramp([60, 100, 150]); R.bird = ramp([50, 46, 56]); R.white = ramp([240, 238, 230]); R.red = ramp([196, 62, 52]);

      // height field: a wrinkled cone with a crater, cut by gullies
      for (let y = 0; y <= WORLD; y++) for (let x = 0; x <= WORLD; x++) {
        const dx = x - CX, dy = y - CY, ang = Math.atan2(dy, dx), wob = (fbm(Math.cos(ang) * 1.6 + 5, Math.sin(ang) * 1.6 + 5) - .5) * 26;
        const r = Math.hypot(dx, dy), shore = SHORE + wob, k = 1 - r / shore;
        let h = -1;
        if (k > 0) {
          h = 2 + PEAK * Math.pow(k, 1.55) + 3.5 * Math.pow(k, .35);
          h += (fbm(x * .13, y * .13) - .5) * 7 * Math.min(1, k * 4);
          const gully = Math.abs(Math.sin(ang * 7 + fbm(x * .05, y * .05) * 5));
          h -= gully * 3.4 * sstep(.15, .5, k) * (1 - sstep(.72, .92, k));
          if (r < 13) h -= (13 - r) * 2.1 * sstep(0, 1, 1 - r / 13) + (13 - r) * .3;
          h = Math.max(1, h);
        }
        H0[y * 151 + x] = Math.floor(h);
      }
      // lava rivers are traced now: each voxel knows when the front reaches it
      const water = { S: mat(R.shallow, { edge: 0, flags: F_WATER }), M: mat(R.mid, { edge: 0, flags: F_WATER }), D: mat(R.deep, { edge: 0, flags: F_WATER }) };
      const lavaM = R.lava.map(r => fm(r, 3, { edge: 0, noise: 2.2, flags: F_EMIT | F_COVER }));
      const dirs = [.08, .62, 1.1, 1.62, 2.05, 2.5, -.5];
      const lavaAt = new Map();
      dirs.forEach((a0, n) => {
        let x = CX + Math.cos(a0) * 11, y = CY + Math.sin(a0) * 11, a = a0, s = 0, lastLand: [number, number, number] | null = null, sea = 0;
        const flow: { pts: never[]; t: number; end?: [number, number, number] } = { pts: [], t: 0 };
        const maxS = 80;
        while (s < maxS) {
          const ix = Math.round(x), iy = Math.round(y);
          a += (vn(s * .09 + n * 13, 3.7) - .5) * .5;
          x += Math.cos(a); y += Math.sin(a); s += 1;
          const b = clamp(Math.floor(s / 66 * LAVA_BUCKETS), 0, LAVA_BUCKETS - 1), w = 2.6 + s * .06 + Math.sin(s * .4 + n) * .8;
          const land = hAt(ix, iy) > 0;
          if (!land) { sea++; if (sea > 9) break; } else lastLand = [ix, iy, b];
          for (let v = -Math.ceil(w); v <= w; v++) for (let u = -Math.ceil(w); u <= w; u++) {
            if (u * u + v * v > w * w) continue;
            const X = ix + u, Y = iy + v;
            if (X < 0 || Y < 0 || X > WORLD || Y > WORLD) continue;
            const key = Y * 151 + X;
            const prev = lavaAt.get(key);
            if (prev == null || b < prev) lavaAt.set(key, b);
          }
        }
        if (lastLand) { flow.end = lastLand; flow.t = lavaArrive(lastLand[2]); FLOWS.push(flow as Flow); }
      });

      const fine = (rr: number, x: number, y: number, h: number) => {
        const ax = hAt(x - 1, y), ay = hAt(x, y - 1), bx = hAt(x + 1, y), by = hAt(x, y + 1);
        const nx = (Math.max(ax, -1) - Math.max(bx, -1)) * .5, ny = (Math.max(ay, -1) - Math.max(by, -1)) * .5, len = Math.hypot(nx, ny, 1);
        const lvl = 1 + 3.2 * clamp((nx * LV[0] + ny * LV[1] + LV[2]) / len * 1.25) + (h3(x, y, h) - .5) * 1.1;
        return fm(rr, clamp(Math.round(lvl), 0, 5), { edge: 0, flags: F_COVER });
      };
      for (let y = 0; y <= WORLD; y++) for (let x = 0; x <= WORLD; x++) {
        if (!keep(x, y)) continue;
        const h = hAt(x, y);
        if (h <= 0) {
          const near = Math.max(hAt(x + 3, y), hAt(x - 3, y), hAt(x, y + 3), hAt(x, y - 3), hAt(x + 6, y), hAt(x - 6, y), hAt(x, y + 6), hAt(x, y - 6), hAt(x + 10, y), hAt(x, y + 10), hAt(x - 10, y), hAt(x, y - 10));
          const v = near > 0 ? (hAt(x + 3, y) > 0 || hAt(x - 3, y) > 0 || hAt(x, y + 3) > 0 || hAt(x, y - 3) > 0 ? 0 : 1) : 2;
          set(x, y, G - 1, v + (h2(x, y) - .5) * .4 < .5 ? water.S : v + (h2(x, y) - .5) * .5 < 1.5 ? water.M : water.D);
        } else {
          for (let z = G - 2; z <= G + h; z++) {
            let rr = h < 4 ? R.sand : h < 30 + (h2(x, y) - .5) * 6 ? ((fbm(x * .1, y * .1) > .5) ? R.green : R.green2) : h < 50 + (h2(x, y) - .5) * 5 ? R.rock : R.rock2;
            if (Math.hypot(x - CX, y - CY) < 17) rr = R.dark;
            if (z === G + h || z > G + h - 4) set(x, y, z, fine(rr, x, y, h));
            else set(x, y, z, fm(rr, 1, { edge: 0 }));
          }
          // crater glow sits at the bottom of the bowl
          if (Math.hypot(x - CX, y - CY) < 7) set(x, y, G + h + 1, fm(R.crater, 3, { edge: 0, noise: 2, flags: F_EMIT }));
        }
      }
      // lava lies one voxel over the ground; where it meets the sea it makes new land
      for (const [key, b] of lavaAt) {
        const Y = Math.floor(key / 151), X = key - Y * 151, h = Math.max(0, hAt(X, Y));
        if (!keep(X, Y)) continue;
        const arrive = lavaArrive(b) + h3(X, Y, 1) * .012;
        lavaMask[key] = 1;
        when(arrive);
        const top = G + h + 1;
        set(X, Y, top, lavaM[b]);
        if (h === 0) set(X, Y, top - 1, lavaM[b]);
        when();
      }
      // forest, burnt where it stands
      const trunk = fm(R.trunk, 1.6, { edge: 0 });
      const pine = (x: number, y: number, s: number, r: number) => {
        const z0 = G + hAt(x, y) + 1, hh = (6 + s * 5) | 0, wid = 2.4 + s * 1.6;
        const a0 = ctx.curAp, v0 = ctx.curVa;
        for (let k = 0; k <= hh; k++) {
          const rr = wid * (1 - k / (hh + 1)) * (k % 3 === 2 ? .72 : 1), RR = Math.ceil(rr);
          for (let v = -RR; v <= RR; v++) for (let u = -RR; u <= RR; u++) {
            if (u * u + v * v > rr * rr + .5) continue;
            const nd = Math.hypot(u, v) || 1, lvl = clamp(Math.round(1.4 + 2.6 * Math.max(0, (u * LV[0] + v * LV[1]) / nd + .25) + (h3(x + u, y + v, k) - .5) * .8), 0, 5);
            set(x + u, y + v, z0 + 2 + k, fm(r, lvl, { edge: 1, flags: F_COVER }));
          }
        }
        ctx.curAp = a0; ctx.curVa = v0;
        box(x, y, z0, x, y, z0 + 2, trunk);
      };
      for (let gy = 0; gy < 30; gy++) for (let gx = 0; gx < 30; gx++) {
        const x = gx * 5 + (h2(gx, gy) * 4 | 0), y = gy * 5 + (h2(gx + 9, gy) * 4 | 0), h = hAt(x, y);
        if (h < 5 || h > 30 || lavaMask[y * 151 + x] || lavaMask[y * 151 + Math.min(150, x + 2)] || lavaMask[Math.min(150, y + 2) * 151 + x]) continue;
        if (h2(gx + 3, gy + 7) < .78) {
          when(0, .34 + h2(gx, gy + 5) * .2);
          pine(x, y, h2(gx, gy + 2), R.pine);
          when();
        } else {
          // the new forest grows in the gaps
          const ap0 = .78 + h2(gx + 1, gy) * .13;
          when(ap0);
          pine(x, y, h2(gx + 5, gy + 1) * .8 + .1, R.pine2);
          when();
        }
      }
      // new trees also claim the old lava, late
      for (let i = 0; i < 90; i++) {
        const x = h1(i + 1100) * 150 | 0, y = h1(i + 1200) * 150 | 0, h = hAt(x, y);
        if (h < 2 || h > 26 || !lavaMask[y * 151 + x]) continue;
        when(.88 + h1(i) * .08);
        const z0 = G + h + 2;
        const a0 = ctx.curAp;
        for (let k = 0; k < 5; k++) { const rr = 2.2 - k * .4; cyl(x, y, z0 + k, z0 + k, rr, (X: number, Y: number, zz: number, dx: number, dy: number) => fm(R.pine2, clamp(Math.round(2 + 2 * Math.max(0, (dx * LV[0] + dy * LV[1]) / (Math.hypot(dx, dy) || 1) + .2)), 0, 5), { edge: 1 })); }
        when();
      }
      // a fishing hamlet on the far shore, lucky and spared
      const hut = (x: number, y: number, w: number, d: number, hh: number) => {
        const z0 = G + Math.max(hAt(x, y), 1) + 1, wall = mat(R.hut, { noise: .3 });
        box(x, y, z0 - 1, x + w, y + d, z0 + hh, wall);
        gableX(x, x + w, y, y + d, z0 + hh + 1, R.roof, wall, { over: 1, slope: .7 });
        box(x + w, y + 3, z0 + 2, x + w, y + 5, z0 + 5, fm(R.ash, 1, { edge: 0 }));
      };
      hut(116, 34, 11, 8, 6); hut(107, 16, 10, 8, 6); hut(124, 56, 10, 8, 6);
      for (let x = 134; x <= 149; x++) for (let y = 40; y <= 43; y++) set(x, y, G + 1, fm(R.wood, x % 3 ? 3 : 2.3, { edge: 0 }));
      for (let x = 136; x <= 149; x += 5) box(x, 43, G - 1, x, 43, G + 1, fm(R.wood, 1.6, { edge: 2 }));
      // the crater lake fills in the late years
      when(.84);
      for (let y = CY - 14; y <= CY + 14; y++) for (let x = CX - 14; x <= CX + 14; x++) {
        const r = Math.hypot(x - CX, y - CY);
        if (r > 8.6) continue;
        set(x, y, G + hAt(x, y) + 2, fm(R.lake, 3.2, { edge: 0, flags: F_WATER }));
        if (hAt(x, y) < hAt(CX, CY) + 4) for (let z = G + hAt(x, y) + 2; z <= G + hAt(CX, CY) + 4; z++) set(x, y, z, fm(R.lake, 3.2, { edge: 0, flags: F_WATER }));
      }
      when();
    },
    update(q, t) {
      setRamp(R.green, keys(GREEN, q)); setRamp(R.green2, keys(GREEN2, q)); setRamp(R.pine, keys(PINE, q)); setRamp(R.sand, keys(SAND, q));
      // lava cools from yellow through red to a dark crust
      const flick = Math.floor(t * 10);
      R.lava.forEach((r, b) => {
        const age = q - lavaArrive(b);
        const c = keys([[0, [255, 216, 96]], [.05, [255, 150, 48]], [.13, [214, 70, 36]], [.22, [108, 48, 44]], [.3, [58, 50, 54]], [1, [48, 44, 50]]], Math.max(0, age + (h1(flick + b) - .5) * .012));
        setRamp(r, c);
      });
      const cr = keys([[0, [150, 74, 50]], [.14, [236, 110, 44]], [HOT_T, [255, 220, 110]], [.5, [255, 200, 90]], [.68, [150, 60, 44]], [.8, [52, 48, 54]], [1, [52, 48, 54]]], q);
      setRamp(R.crater, cr);
      // ash settles, is washed off, and moss comes up through the rock
      if (q < .74) { state.coverAmt = sstep(.26, .44, q) * .85 * (1 - sstep(.62, .73, q)); state.coverRamp = R.ash; }
      else { state.coverAmt = sstep(.76, .98, q) * .62; state.coverRamp = R.moss; state.coverEmit = true; state.coverMaxZ = G + 36; }
      state.coverAll = true;
      const dim = sstep(.2, .3, q) * (1 - sstep(.56, .72, q));
      setGrade([lerp(1, .68, dim), lerp(1, .62, dim), lerp(1, .68, dim)]);
      setSun(-1, .35, .78, lerp(1, .38, dim));
      state.sparkle = lerp(.74, .86, dim);
      // the ground gives warning, then jumps
      const rumble = sstep(.13, .22, q) * (1 - sstep(.22, .38, q) * .85);
      if (rumble > 0) { const k = Math.floor(t * 18); state.shakeX = Math.round((h1(k) - .5) * 3.4 * rumble); state.shakeY = Math.round((h1(k + 7) - .5) * 2.4 * rumble); }
      // a thread of steam before, then the column
      const czTop = G + hAt(CX + 9, CY) + 4;
      if (q < HOT_T + .04) for (let i = 0; i < 9; i++) {
        const k = (t * .24 + i / 9) % 1, grow = sstep(.0, .2, q), rr = (1.5 + k * 4) * (.6 + grow);
        puff(CX + k * 10 * (1 + grow), CY - k * 4, czTop + k * (22 + grow * 34), rr, R.steam, { seed: i, lift: .5, edge: 3, zMin: czTop - 2 });
      }
      if (q > HOT_T - .005) {
        for (let i = 0; i < 84; i++) {
          const b = HOT_T - .01 + (i / 84) * (BLAST_END - HOT_T), life = .22 + h1(i + 3) * .05, age = (q - b) / life;
          if (age < 0 || age > 1) continue;
          const rise = Math.pow(age, .62), z = czTop - 4 + rise * 196;
          const a = i * 2.4, wid = 3 + rise * 16 + sstep(.55, .95, rise) * 30;
          const drift = age * age * 46;
          const X = CX + Math.cos(a) * wid * .7 + drift, Y = CY + Math.sin(a) * wid * .7 - drift * .3;
          const rr = 4 + rise * 15, thin = sstep(.66, 1, age), r0 = age < .09 ? R.hot : age < .2 ? R.ashWarm : i % 2 ? R.ashA : R.ashB;
          if (thin < .97) puff(X, Y, z, rr, r0, { thin, seed: i, lift: age < .09 ? 1 : 0, zMin: czTop - 8, flags: age < .09 ? F_EMIT : 0, edge: age < .09 ? 0 : 3, bump: .28 });
        }
        // ash drifting low over the sea
        if (q < .72) for (let i = 0; i < 26; i++) {
          const k = (q * 2.6 + i / 26) % 1, str = sstep(.26, .36, q) * (1 - sstep(.54, .68, q));
          const rr = 8 + k * 11, thin = Math.max(1 - str, sstep(.7, 1, k));
          if (thin < .97) puff(CX + 14 + k * 100, CY - 10 - k * 34 + h1(i) * 16, czTop + 96 + h1(i + 8) * 40 + k * 16, rr, i % 2 ? R.ashA : R.ashB, { thin, seed: i + 5, edge: 3, bump: .28 });
        }
      }
      // steam where each river meets the sea
      FLOWS.forEach((f, n) => {
        const on = q - f.t;
        if (on < 0 || on > .2) return;
        const [x, y] = f.end;
        for (let i = 0; i < 4; i++) {
          const k = (t * .55 + i / 4 + n * .13) % 1, rr = (2 + k * 5) * (1 - sstep(.13, .2, on)) * sstep(0, .02, on);
          if (rr > .8) puff(x + k * 3 + h1(i + n) * 3, y - k * 3, G + 3 + k * 26, rr, R.steam, { seed: n * 5 + i, lift: 1.6, edge: 3, thin: sstep(.6, 1, k) });
        }
      });
      // the boat comes back
      const X = q < .22 ? 128 + q * 40 : q > .9 ? 150 - (q - .9) * 200 : -99;
      if (X > 0) {
        const hull = fm(R.boat, 3, { edge: 2 }), deck = fm(R.white, 3.3, { edge: 2 }), z0 = G + Math.round(Math.sin(t * 2) * .6), Y = 36;
        for (let i = 0; i <= 14; i++) { const w = i > 9 ? 2.4 * (1 - (i - 9) / 6) : 2.4; for (let a = -w; a <= w; a++) { dbox(X + i, Y + a, z0, X + i, Y + a, z0 + 1, hull); } }
        dbox(X + 2, Y - 1, z0 + 2, X + 6, Y + 1, z0 + 5, deck);
      }
    },
    post(q, t) {
      const [cx, cy] = project(CX, CY, G + hAt(CX + 7, CY) + 2);
      const hot = sstep(.18, .24, q) * (1 - sstep(.54, .7, q));
      if (hot > 0) {
        pGlow(cx, cy + 4, 46, col(255, 150, 60), .5 * hot, { flat: .6, mix: .4 });
        pGlow(cx, cy - 6, 15, col(255, 226, 150), .95 * hot, { flat: 1, mix: .7 });
      }
      // lava bombs on long arcs
      if (q > HOT_T - .01 && q < .56) for (let i = 0; i < 90; i++) {
        const b = HOT_T - .01 + (i / 90) * (.54 - HOT_T), k = (q - b) / .06;
        if (k < 0 || k > 1) continue;
        const a = h1(i + 21) * 6.283, reach = 18 + h1(i + 22) * 40, vz = 46 + h1(i + 23) * 60;
        const X = CX + Math.cos(a) * reach * k, Y = CY + Math.sin(a) * reach * k, z = G + PEAK * .9 + vz * k - 80 * k * k;
        const c = k < .4 ? col(255, 232, 150) : k < .75 ? col(255, 150, 60) : col(190, 70, 50);
        pDot(X, Y, z, c, h1(i + 24) > .6 ? 2 : 1);
        pDot(X - Math.cos(a) * 2, Y - Math.sin(a) * 2, z - (vz - 160 * k) * .03, col(120, 90, 90));
      }
      // volcanic lightning inside the ash
      if (q > .26 && q < .5) {
        const tick = Math.floor(t * 14);
        if (h1(tick + 400) > .78) {
          const seed = tick;
          let X = cx - 26 + h1(seed) * 70, Y = 34 + h1(seed + 1) * 40;
          const c = col(255, 250, 216);
          const n = 7 + (h1(seed + 2) * 4 | 0);
          for (let s = 0; s < n; s++) {
            const dx = (h1(seed + s * 3) - .5) * 18, dy = 6 + h1(seed + s * 3 + 1) * 8;
            for (let i = 0; i <= 8; i++) pPlot(X + dx * i / 8, Y + dy * i / 8, c);
            X += dx; Y += dy;
          }
        }
      }
      // glowing flow fronts light their surroundings
      FLOWS.forEach(f => {
        const age = q - f.t;
        if (age < -.2 || age > .22) return;
        const [x, y] = f.end, [sx, sy] = project(x, y, G + 3);
        const k = clamp(1 - Math.abs(age) / .22);
        if (age > 0) pGlow(sx, sy, 16, col(255, 130, 60), .3 * k);
      });
      // ash in the air
      const fall = sstep(.28, .34, q) * (1 - sstep(.56, .66, q));
      if (fall > 0) {
        const grey = col(112, 106, 112), pale = col(170, 166, 168);
        for (let i = 0; i < 300 * fall; i++) {
          const sp = 14 + h1(i + 40) * 12, X = (h1(i) * W + t * 22 + Math.sin(t + i) * 3) % W, Y = (h1(i + 3) * H + t * sp) % H;
          pPlot(X, Y, i % 2 ? grey : pale);
        }
      }
      // birds flee, and come back
      const ink = col(50, 46, 56);
      if (q > .13 && q < .28) {
        const k = (q - .13) / .15;
        for (let i = 0; i < 16; i++) {
          const a = h1(i + 13) * 6.283, X = cx + Math.cos(a) * k * (60 + i * 8), Y = cy + 60 - k * 90 + Math.sin(a) * k * 30, fl = Math.floor(t * 9 + i) % 2;
          pPlot(X, Y, ink); pPlot(X - 1, Y - fl, ink); pPlot(X + 1, Y - fl, ink);
        }
      }
      if (q > .9) {
        const k = (q - .9) / .1;
        for (let i = 0; i < 9; i++) {
          const X = lerp(40 + i * 8, 180 + i * 7, k), Y = 66 + (i % 3) * 7 + Math.sin(t * 2 + i) * 2, fl = Math.floor(t * 8 + i) % 2;
          pPlot(X, Y, ink); pPlot(X - 1, Y - fl, ink); pPlot(X + 1, Y - fl, ink);
        }
      }
    },
  };
}
