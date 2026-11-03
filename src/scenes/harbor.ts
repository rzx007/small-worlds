import type { ColorKeys, SceneContext, SceneDefinition } from '../renderer/scene-types';
// One fishing town from afternoon to dawn: boats come home, windows light up, fireworks at midnight, the page itself goes dark.
export function createScene(ctx: SceneContext): SceneDefinition {
  const { BAYER4, BAYER8, F_EMIT, F_WATER, G, H, LV, W, WORLD, blobTree, box, clamp, col, cone, cyl, dbox, dyn, fbm, fm, gD, gR, gableX, gableY, h1, h2, h3, keyNum, keys, lerp, mat, pDot, pGlow, pPlot, pix, project, ramp, rgb, roundCyl, set, setGrade, setRamp, setSun, sstep, state, vn } = ctx;
  // Populated by build before frame updates.
  const R = {} as { awn: number[]; bark: number; beacon: number; cabin: number; cloth: number; cyp: number; deep: number; grass: number; hull: number[]; iron: number; lamp: number; leaf: number[]; mid: number; pave: number; people: number[]; red: number; rock: number; shallow: number; shutter: number[]; skin: number; stone: number; stoneD: number; terra: number; terra2: number; tuft: number; walls: number[]; white: number; win: number[]; wood: number; woodD: number };
  const edgeDist = (x: number, y: number) => Math.min(x, y, WORLD - x, WORLD - y) + (fbm(x * .11, y * .11) - .5) * 9;
  const keep = (x: number, y: number) => { const d = edgeDist(x, y); return d >= 9 || (d > 0 && h2(x, y) < d / 9); };
  const isLand = (x: number, y: number) => y < 44 || x < 50;
  const onBreak = (x: number, y: number) => { const j = (vn(x * .3, y * .3) - .5) * 3; return x + j > 122 && x + j < 131 && y >= 44 && y < 82; };
  const onRock = (x: number, y: number) => Math.hypot(x - 128, y - 88) + (vn(x * .4, y * .4) - .5) * 4 < 12;
  const QZ = G + 4;
  const tier = (x: number, y: number) => { // ground height of the town, stepped up toward the back corner
    if (!isLand(x, y)) return G - 1;
    const hi = (x < 22 || y < 16);
    const top = (x < 22 && y < 16);
    return top ? G + 16 : hi ? G + 10 : QZ;
  };
  const LAMPS: [number, number][] = [];
  for (let x = 58; x <= 142; x += 14) LAMPS.push([x, 42]);
  for (let y = 52; y <= 138; y += 14) LAMPS.push([48, y]);
  const JETTY_LAMPS = [[66, 96], [84, 96], [100, 96]];
  const BOATS = [
    { mx: 66, my: 84, axis: 'x', c: 0, sx: 150, sy: 100, dep: .86, arr: .08 },
    { mx: 88, my: 84, axis: 'x', c: 1, sx: 154, sy: 72, dep: .9, arr: .13 },
    { mx: 68, my: 106, axis: 'x', c: 2, sx: 150, sy: 130, dep: .84, arr: .05 },
    { mx: 92, my: 110, axis: 'x', c: 3, sx: 148, sy: 146, dep: .93, arr: .16 },
    { mx: 96, my: 58, axis: 'x', c: 4, sx: 118, sy: 150, dep: .88, arr: .11 },
    { mx: 62, my: 130, axis: 'x', c: 1, sx: 118, sy: 152, dep: .96, arr: .2 },
  ];
  const PEOPLE: { ph: number; row: number; sp: number; c: number; off: number }[] = [];
  for (let i = 0; i < 18; i++) PEOPLE.push({ ph: h1(i + 300), row: i % 2, sp: .03 + h1(i + 330) * .05, c: i % 4, off: h1(i + 360) * 5 });
  const FW: { t: number; x: number; y: number; c: number; n: number; r: number }[] = [];
  for (let i = 0; i < 9; i++) FW.push({ t: .552 + i * .019 + h1(i + 700) * .008, x: 70 + h1(i + 710) * 180, y: 52 + h1(i + 720) * 40, c: i % 4, n: 78 + (i % 3) * 26, r: 30 + h1(i + 730) * 22 });
  const FW_COL = [[[255, 120, 110], [255, 230, 160]], [[120, 210, 255], [240, 250, 255]], [[255, 214, 90], [255, 150, 60]], [[190, 140, 255], [255, 170, 230]]];
  const GRADE: ColorKeys = [[0, [1, 1, .98]], [.1, [1.04, .95, .84]], [.2, [1, .72, .6]], [.27, [.66, .5, .66]], [.36, [.32, .34, .58]], [.45, [.25, .29, .52]], [.8, [.25, .29, .52]], [.87, [.38, .38, .62]], [.92, [.74, .58, .66]], [.97, [1, .84, .76]], [1, [1, .92, .84]]];
  const HOUSES = [];

  return {
    id: 'harbour', title: 'HARBOUR NIGHT', accent: [196, 96, 66], ticks: 14, majorEvery: 2, baseShift: -8,
    accentAt(q) { const k = sstep(.28, .36, q) * (1 - sstep(.86, .94, q)); return [lerp(196, 246, k), lerp(96, 200, k), lerp(66, 120, k)]; },
    label: q => { const h = (16 + q * 14) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10; return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); },
    build() {
      R.deep = ramp([44, 108, 146]); R.mid = ramp([58, 138, 160]); R.shallow = ramp([86, 170, 170]);
      R.stone = ramp([196, 180, 150]); R.stoneD = ramp([150, 136, 116]); R.pave = ramp([208, 196, 168]); R.grass = ramp([120, 148, 76]); R.tuft = ramp([148, 170, 84]); R.rock = ramp([158, 150, 138]); R.wood = ramp([136, 100, 72]); R.woodD = ramp([92, 70, 56]);
      R.terra = ramp([202, 96, 62]); R.terra2 = ramp([176, 78, 58]); R.walls = [ramp([240, 226, 192]), ramp([232, 196, 132]), ramp([244, 240, 228]), ramp([226, 164, 128]), ramp([180, 202, 196])];
      R.shutter = [ramp([62, 118, 110]), ramp([70, 96, 150]), ramp([160, 72, 56])];
      R.win = []; for (let i = 0; i < 14; i++) R.win.push(ramp([60, 70, 100], true));
      R.lamp = ramp([250, 212, 120], true); R.beacon = ramp([250, 240, 190], true); R.iron = ramp([50, 48, 58]); R.white = ramp([240, 238, 230]); R.red = ramp([196, 62, 52]);
      R.leaf = [ramp([84, 118, 70]), ramp([104, 136, 74]), ramp([70, 102, 66])]; R.bark = ramp([86, 68, 58]); R.cyp = ramp([56, 88, 64]);
      R.awn = [ramp([214, 72, 58]), ramp([60, 110, 160]), ramp([230, 180, 70])]; R.cloth = ramp([238, 232, 216]);
      R.hull = [ramp([190, 60, 50]), ramp([56, 104, 150]), ramp([240, 236, 224]), ramp([46, 130, 110]), ramp([232, 178, 62])]; R.cabin = ramp([238, 234, 222]); R.skin = ramp([226, 180, 150]); R.people = [ramp([206, 72, 60]), ramp([58, 92, 150]), ramp([236, 196, 72]), ramp([70, 70, 80])];

      const shadeWater = (x: number, y: number) => {
        let d = 99;
        for (let r = 2; r <= 16; r += 2) {
          if (isLand(x - r, y) || isLand(x, y - r) || onBreak(x - r, y) || onBreak(x + r, y) || onRock(x, y - r)) { d = r; break; }
        }
        const v = d + (h2(x, y) - .5) * 6 + (fbm(x * .06, y * .06) - .5) * 14;
        return v < 6 ? wS : v < 18 ? wM : wD;
      };
      const wS = mat(R.shallow, { edge: 0, flags: F_WATER }), wM = mat(R.mid, { edge: 0, flags: F_WATER }), wD = mat(R.deep, { edge: 0, flags: F_WATER });
      const stone = mat(R.stone, { noise: .5 }), stoneD = fm(R.stoneD, 1.6, { edge: 0 }), pave = mat(R.pave, { noise: .35, edge: 0 }), paveD = fm(R.pave, 2.7, { edge: 0 }), grass = mat(R.grass, { noise: .8, edge: 0 }), rock = mat(R.rock, { noise: .9 });
      const stoneAt = (x: number, y: number, z: number) => { const c = z >> 1, off = c % 2 ? 3 : 0; return z % 2 === 0 && false ? stoneD : ((x + y + off) % 7 === 0 || (z % 2 === 1 && (x + y) % 3 === 0)) ? stoneD : stone; };
      for (let y = 0; y <= WORLD; y++) for (let x = 0; x <= WORLD; x++) {
        if (!keep(x, y)) continue;
        if (isLand(x, y)) {
          const d = edgeDist(x, y), t = tier(x, y), zTop = d < 12 ? G + Math.max(-1, Math.floor((d - 2) / 3)) : t;
          for (let z = G - 3; z <= zTop; z++) set(x, y, z, stoneAt(x, y, z));
          const isPave = zTop === t && (x >= 36 || y >= 30) && t === QZ;
          set(x, y, zTop, d < 14 ? grass : isPave ? ((x + y) % 11 < 1 ? paveD : pave) : (fbm(x * .1, y * .1) > .52 ? grass : pave));
        } else if (onBreak(x, y) || onRock(x, y)) {
          const zt = G + 1 + (h2(x >> 1, y >> 1) * 3 | 0) + (onRock(x, y) ? 1 : 0);
          for (let z = G - 3; z <= zt; z++) set(x, y, z, rock);
        } else set(x, y, G - 1, shadeWater(x, y));
      }
      // a walkway along the breakwater
      const walkM = mat(R.stone, { noise: .3, edge: 0 });
      for (let y = 44; y < 78; y++) for (let x = 124; x <= 128; x++) { box(x, y, G - 1, x, y, G + 3, stone); set(x, y, G + 4, walkM); }
      // quay ladder and bollards
      for (let x = 56; x <= 148; x += 10) { box(x, 43, QZ + 1, x + 1, 43, QZ + 2, fm(R.iron, 1.6, { edge: 2 })); }
      for (let y = 56; y <= 146; y += 12) { box(49, y, QZ + 1, 49, y + 1, QZ + 2, fm(R.iron, 1.6, { edge: 2 })); }
      // the jetty on its posts
      const plank = (x: number) => fm(R.wood, x % 3 === 0 ? 2.3 : 3.1, { edge: 0 }), post = fm(R.woodD, 1.8, { edge: 2 });
      for (let x = 50; x <= 104; x++) for (let y = 92; y <= 99; y++) set(x, y, G + 2, plank(x));
      for (let x = 54; x <= 104; x += 10) for (const y of [92, 99]) box(x, y, G - 1, x, y, G + 3, post);
      // houses, each with windows that keep their own hours
      const house = (x0: number, y0: number, w: number, d: number, h: number, z0: number, wallI: number, roofR: number, ridge: 'x' | 'y', seed: number) => {
        const wallM = mat(R.walls[wallI], { noise: .25 }), x1 = x0 + w, y1 = y0 + d, z1 = z0 + h;
        box(x0, y0, z0, x1, y1, z1, wallM);
        (ridge === 'x' ? gableX : gableY)(x0, x1, y0, y1, z1 + 1, roofR, wallM, { over: 1, slope: .72 });
        const shutter = fm(R.shutter[seed % 3], 2.6, { edge: 0 });
        for (let f = 0; f * 8 + 3 < h; f++) {
          const zz = z0 + 3 + f * 8;
          for (let wx = x0 + 3; wx + 2 < x1; wx += 6) {
            const n = Math.floor(h2(wx, zz + seed) * 14), wm = fm(R.win[n], 3, { edge: 0, flags: F_EMIT });
            box(wx, y1, zz, wx + 2, y1, zz + 4, wm);
            box(wx - 1, y1, zz, wx - 1, y1, zz + 4, shutter); box(wx + 3, y1, zz, wx + 3, y1, zz + 4, shutter);
          }
          for (let wy = y0 + 3; wy + 2 < y1; wy += 6) {
            const n = Math.floor(h2(wy + 40, zz + seed) * 14), wm = fm(R.win[n], 3, { edge: 0, flags: F_EMIT });
            box(x1, wy, zz, x1, wy + 2, zz + 4, wm);
            box(x1, wy - 1, zz, x1, wy - 1, zz + 4, shutter); box(x1, wy + 3, zz, x1, wy + 3, zz + 4, shutter);
          }
        }
        // chimney
        if (seed % 2) box(x0 + 3, y0 + 3, z1 + 2, x0 + 5, y0 + 5, z1 + 7 + (ridge === 'x' ? d : w) * .3, stone);
        HOUSES.push([x0, y0, w, d, h, z0]);
      };
      // row along the top right
      let seed = 1, cx = 54;
      while (cx < 138) {
        const w = 13 + (h1(seed) * 6 | 0), h = 12 + (h1(seed + 2) * 12 | 0);
        house(cx, 18, w, 13, h, QZ + 1, seed % 5, seed % 3 ? R.terra : R.terra2, seed % 2 ? 'x' : 'y', seed);
        cx += w + 1; seed++;
      }
      // row along the top left
      let cy = 48;
      while (cy < 136) {
        const d = 13 + (h1(seed) * 6 | 0), h = 12 + (h1(seed + 2) * 12 | 0);
        house(23, cy, 13, d, h, QZ + 1, seed % 5, seed % 3 ? R.terra : R.terra2, seed % 2 ? 'y' : 'x', seed);
        cy += d + 1; seed++;
      }
      // the upper terraces
      cx = 28;
      while (cx < 120) { const w = 14 + (h1(seed) * 8 | 0), h = 13 + (h1(seed + 2) * 10 | 0); house(cx, 3, w, 11, h, G + 11, seed % 5, R.terra2, 'x', seed); cx += w + 2; seed++; }
      cy = 22;
      while (cy < 112) { const d = 14 + (h1(seed) * 8 | 0), h = 13 + (h1(seed + 2) * 10 | 0); house(3, cy, 15, d, h, G + 11, seed % 5, R.terra2, 'y', seed); cy += d + 2; seed++; }
      // church and bell tower on the top terrace
      const churchM = mat(R.walls[2], { noise: .25 });
      box(3, 2, G + 17, 20, 13, G + 26, churchM);
      gableX(3, 20, 2, 13, G + 27, R.terra, churchM, { over: 1, slope: .7 });
      box(15, 12, G + 17, 21, 19, G + 54, churchM);
      for (const z of [G + 44]) { box(21, 14, z, 21, 17, z + 7, fm(R.iron, 1.2, { edge: 0 })); box(16, 19, z, 20, 19, z + 7, fm(R.iron, 1.2, { edge: 0 })); }
      box(21, 14, G + 26, 21, 17, G + 32, fm(R.win[2], 3, { edge: 0, flags: F_EMIT })); box(16, 19, G + 26, 20, 19, G + 32, fm(R.win[9], 3, { edge: 0, flags: F_EMIT }));
      cone(18, 15, G + 55, 12, 5.2, R.terra);
      // cypress and olive among the roofs
      const bark = mat(R.bark);
      for (const [x, y, z] of [[26, 18, G + 11], [14, 30, G + 11], [122, 12, G + 11], [66, 12, G + 11]]) { for (let k = 0; k < 18; k++) { const rr = 3.4 * Math.sin((k + 1) / 19 * Math.PI * .85); cyl(x, y, z + k, z + k, rr, (X: number, Y: number, zz: number, dx: number, dy: number) => fm(R.cyp, clamp(Math.round(1.6 + 2 * Math.max(0, (dx * LV[0] + dy * LV[1]) / (Math.hypot(dx, dy) || 1) + .3) + (h3(X, Y, zz) - .5)), 0, 5), { edge: 1 })); } }
      for (const [x, y] of [[42, 144], [146, 34]]) blobTree(x, y, G + 2, { r: 5.5, trunk: 4, sets: R.leaf, trunkM: bark, seed: x });
      // market stalls on the quay
      const stall = (x: number, y: number, along: 'x' | 'y', c: number) => {
        const pm = fm(R.iron, 2, { edge: 0 }), cl = (a: number) => fm(a % 4 < 2 ? R.awn[c] : R.cloth, 3.3, { edge: 2 });
        const w = along === 'x' ? 12 : 6, d = along === 'x' ? 6 : 12;
        for (const [a, b] of [[0, 0], [w, 0], [0, d], [w, d]]) box(x + a, y + b, QZ + 1, x + a, y + b, QZ + 7, pm);
        for (let a = -1; a <= w + 1; a++) for (let b = -1; b <= d + 1; b++) set(x + a, y + b, QZ + 8 - Math.floor((along === 'x' ? Math.abs(b - d / 2) : Math.abs(a - w / 2)) * .4), cl(along === 'x' ? a : b));
        box(x + 1, y + 1, QZ + 1, x + w - 1, y + d - 1, QZ + 3, fm(R.wood, 3, { edge: 2 }));
        for (let a = 1; a < w; a += 2) for (let b = 1; b < d; b += 2) set(x + a, y + b, QZ + 4, fm(R.awn[(a + b + c) % 3], 3.6, { edge: 0 }));
      };
      stall(62, 33, 'x', 0); stall(90, 33, 'x', 1); stall(118, 33, 'x', 2); stall(38, 60, 'y', 2); stall(38, 90, 'y', 0); stall(38, 118, 'y', 1);
      // barrels and crates
      for (let i = 0; i < 12; i++) { const x = 52 + h1(i + 900) * 90 | 0; roundCyl(x, 40, QZ + 1, QZ + 3, 1.6, R.woodD); }
      for (let i = 0; i < 8; i++) { const y = 54 + h1(i + 920) * 86 | 0; box(45, y, QZ + 1, 47, y + 2, QZ + 3, fm(R.wood, 2.6, { edge: 2 })); }
      // lamps
      const pole = fm(R.iron, 1.6, { edge: 0 });
      for (const [x, y] of LAMPS) { box(x, y, QZ + 1, x, y, QZ + 8, pole); set(x, y, QZ + 9, fm(R.lamp, 3, { edge: 2, flags: F_EMIT })); }
      for (const [x, y] of JETTY_LAMPS) { box(x, y, G + 3, x, y, G + 9, pole); set(x, y, G + 10, fm(R.lamp, 3, { edge: 2, flags: F_EMIT })); }
      // lighthouse
      roundCyl(128, 88, G + 3, G + 12, 8, R.rock);
      for (let z = 0; z < 52; z++) {
        const rr = lerp(6.4, 4, z / 52), band = Math.floor(z / 11) % 2 ? R.red : R.white;
        roundCyl(128, 88, G + 12 + z, G + 12 + z, rr, band);
      }
      box(123, 83, G + 64, 133, 93, G + 64, fm(R.iron, 2, { edge: 2 }));
      roundCyl(128, 88, G + 65, G + 70, 3.2, R.beacon);
      cone(128, 88, G + 71, 6, 5, R.red);
      for (let k = 0; k < 2; k++) { set(134, 88 + k, G + 4, fm(R.lamp, 3, { edge: 0, flags: F_EMIT })); }
    },
    update(q, t) {
      let flash = 0;
      for (const f of FW) { const k = (q - f.t) / .03; if (k > 0 && k < 1) flash = Math.max(flash, 1 - k); }
      const base = keys(GRADE, q);
      setGrade([base[0] * (1 + flash * .55), base[1] * (1 + flash * .5), base[2] * (1 + flash * .32)]);
      const lz = keyNum([[0, .8], [.2, .24], [.27, .24], [.36, .72], [.84, .72], [.9, .24], [1, .42]], q), s = keyNum([[0, 1], [.2, .95], [.27, .2], [.36, .2], [.84, .2], [.92, .85], [1, 1]], q);
      setSun(-1, .35, lz, s);
      const night = sstep(.27, .36, q) * (1 - sstep(.86, .94, q));
      state.bgMix = night; state.uiDark = night; state.sparkle = lerp(.74, .78, night);
      const offC = keys(GRADE, q).map((g, i) => [62, 76, 112][i] * g);
      R.win.forEach((r, i) => {
        const on = .22 + h1(i + 40) * .15, off = .6 + h1(i + 60) * .26;
        const lit = q > on && q < off;
        setRamp(r, lit ? [255 - i * 2, 206 - (i % 5) * 7, 118 + (i % 3) * 12] : offC);
      });
      const lampOn = q > .2 && q < .93;
      setRamp(R.lamp, lampOn ? [255, 220, 130] : offC.map(v => v * 1.2));
      const beam = q > .22 && q < .92;
      setRamp(R.beacon, beam ? [255, 246, 200] : offC.map(v => v * 1.6));
      // boats home at dusk, out again before dawn
      BOATS.forEach(b => {
        const inK = sstep(b.arr, b.arr + .16, q), outK = sstep(b.dep, b.dep + .12, q), k = inK * (1 - outK);
        if (k <= 0) return;
        const X = lerp(b.sx, b.mx, k), Y = lerp(b.sy, b.my, k), bob = Math.round(Math.sin(t * 2 + b.c * 1.7) * .6);
        const hull = fm(R.hull[b.c], 2.9, { edge: 2 }), hullD = fm(R.hull[b.c], 1.6, { edge: 2 }), deck = fm(R.wood, 3.2, { edge: 0 }), cabin = fm(R.cabin, 3, { edge: 2 }), iron = fm(R.iron, 2, { edge: 0 });
        const z0 = G + bob;
        for (let i = 0; i <= 20; i++) {
          const w = i > 14 ? 3.6 * (1 - (i - 14) / 7) : 3.6;
          for (let a = -w; a <= w; a++) { dbox(X + i - 10, Y + a, z0, X + i - 10, Y + a, z0 + 2, a > 0 ? hull : hullD); dyn(X + i - 10, Y + a, z0 + 3, deck); }
          dyn(X + i - 10, Y + w, z0 + 3, hull);
        }
        dbox(X - 6, Y - 2, z0 + 4, X, Y + 2, z0 + 8, cabin); dbox(X - 7, Y - 3, z0 + 9, X + 1, Y + 3, z0 + 9, hullD);
        dbox(X + 4, Y, z0 + 4, X + 4, Y, z0 + 17, iron);
        if (lampOn) dyn(X + 4, Y, z0 + 18, fm(R.lamp, 3, { edge: 0, flags: F_EMIT }));
      });
      // an evening stroll on the quay
      if (q < .46 || q > .96) for (const p of PEOPLE) {
        const k = (t * p.sp + p.ph) % 1, body = fm(R.people[p.c], 3, { edge: 1 }), head = fm(R.skin, 3.4, { edge: 1 });
        if (p.row) { const X = 54 + k * 92, Y = 38 + p.off * .8; dbox(X, Y, QZ + 1, X + 1, Y, QZ + 3, body); dyn(X, Y, QZ + 4, head); }
        else { const X = 39 + p.off * 1.1, Y = 50 + k * 92; dbox(X, Y, QZ + 1, X, Y + 1, QZ + 3, body); dyn(X, Y, QZ + 4, head); }
      }
    },
    post(q, t) {
      const night = sstep(.27, .36, q) * (1 - sstep(.86, .94, q));
      // stars and a moon, only on the sky
      if (night > .35) {
        const a = sstep(.35, .55, night), tick = Math.floor(t * 4);
        for (let i = 0; i < 170; i++) {
          if (h1(i + 40) > a) continue;
          const X = h1(i) * W | 0, Y = h1(i + 900) * 250 | 0, p = Y * W + X;
          if (gD[p] >= 0) continue;
          pix[p] = h3(i, tick, 3) > .22 ? (i % 7 ? col(200, 208, 236) : col(255, 236, 190)) : col(90, 100, 140);
        }
        const mx = lerp(322, 244, sstep(.3, .9, q)), my = lerp(92, 26, Math.sin(sstep(.3, .9, q) * Math.PI)), mr = 11;
        for (let Y = -mr; Y <= mr; Y++) for (let X = -mr; X <= mr; X++) {
          const d = Math.hypot(X, Y);
          if (d > mr) continue;
          const px = Math.round(mx) + X, py = Math.round(my) + Y;
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          const p = py * W + px;
          if (gD[p] >= 0) continue;
          const cr = vn((X + 40) * .28, (Y + 40) * .28) > .58;
          pix[p] = (X + Y) > 7 ? (cr ? col(186, 186, 190) : col(206, 204, 200)) : cr ? col(216, 216, 214) : col(246, 242, 226);
        }
      }
      // pools of lamplight, with long reflections where they meet the water
      const lamp = q > .2 && q < .93, str = sstep(.2, .34, q) * (1 - sstep(.88, .93, q));
      if (lamp) {
        const warm = col(255, 208, 120), flick = Math.floor(t * 6);
        for (const [x, y, zz] of [...LAMPS.map(l => [l[0], l[1], QZ + 9]), ...JETTY_LAMPS.map(l => [l[0], l[1], G + 10])]) {
          const [sx, sy] = project(x, y, zz);
          pGlow(sx, sy + 9, 17, warm, .8 * str, { mix: .3 });
          pGlow(sx, sy, 3.5, col(255, 232, 170), .9 * str, { onBg: true, flat: 1, mix: .6 });
          for (let i = 0; i < 16; i++) {
            const Yy = sy + 10 + i * 1, Xx = sx + Math.round(Math.sin(i * .7 + flick + x) * 1.2), p = Yy * W + Xx;
            if (Yy >= H || Xx < 0 || Xx >= W || gD[p] < 0 || gR[p] > R.shallow || BAYER4[(Yy & 3) * 4 + (Xx & 3)] > .55 * (1 - i / 16)) continue;
            pix[p] = warm;
          }
        }
      }
      // string lights over the quay
      if (lamp) {
        const bulb = col(255, 226, 150), wire = col(40, 36, 44);
        const strings = [];
        for (let i = 0; i + 1 < 7; i++) strings.push([LAMPS[i], LAMPS[i + 1]]);
        for (let i = 7; i + 1 < LAMPS.length; i++) strings.push([LAMPS[i], LAMPS[i + 1]]);
        for (const [a, b] of strings) {
          for (let k = 0; k <= 12; k++) {
            const f = k / 12, z = QZ + 9 - Math.sin(f * Math.PI) * 3;
            pDot(lerp(a[0], b[0], f), lerp(a[1], b[1], f), z, k % 3 === 1 ? bulb : wire);
          }
        }
      }
      // the lighthouse sweeps the bay
      if (q > .22 && q < .92) {
        const [lx, ly] = project(128, 88, G + 67), a = t * 1.5, str2 = sstep(.22, .3, q) * (1 - sstep(.86, .92, q));
        for (const off of [0, Math.PI]) {
          const ang = a + off, dirx = Math.cos(ang), diry = Math.sin(ang) * .5;
          const R0 = 150, x0 = Math.max(0, Math.floor(lx - R0)), x1 = Math.min(W - 1, lx + R0), y0 = Math.max(0, Math.floor(ly - R0 * .55)), y1 = Math.min(H - 1, ly + R0 * .55);
          for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
            const dx = X - lx, dy = Y - ly, along = dx * dirx + dy * diry * 2;
            if (along < 2) continue;
            const across = Math.abs(-dx * diry * 2 + dy * dirx);
            const width = 1 + along * .08;
            if (across > width) continue;
            const f = (1 - along / R0) * (1 - across / width * .6) * str2;
            if (f <= 0 || BAYER8[(Y & 7) * 8 + (X & 7)] > f * .95) continue;
            const p = Y * W + X, c = pix[p];
            pix[p] = rgb(lerp(c & 255, 255, .22), lerp(c >>> 8 & 255, 244, .22), lerp(c >>> 16 & 255, 190, .2));
          }
        }
      }
      // fireworks at midnight
      for (const f of FW) {
        const k = (q - f.t) / .055;
        const lead = (q - f.t + .02) / .02;
        if (lead > 0 && lead < 1) {
          const X = lerp(f.x * .7 + 50, f.x, lead), Y = lerp(240, f.y, lead * (2 - lead));
          pPlot(X, Y, col(255, 240, 200)); pPlot(X, Y + 1, col(220, 180, 130)); pPlot(X, Y + 3, col(150, 120, 110));
        }
        if (k < 0 || k > 1) continue;
        const [c0, c1] = FW_COL[f.c], fall = k * k * 22;
        for (let i = 0; i < f.n; i++) {
          const ang = i / f.n * 6.283 + h1(i + f.c) * .2, sp = (.65 + h1(i + 77) * .35) * f.r, rr = (1 - (1 - k) * (1 - k)) * sp;
          if (h1(i + 11) < k * k * 1.15) continue;
          const X = f.x + Math.cos(ang) * rr, Y = f.y + Math.sin(ang) * rr * .9 + fall;
          const c = i % 3 ? c0 : c1;
          pPlot(X, Y, rgb(c[0], c[1], c[2]));
          if (k < .45) { pPlot(X + 1, Y, rgb(c[0], c[1], c[2])); pPlot(X, Y + 1, rgb(c[0], c[1], c[2])); }
          pPlot(f.x + Math.cos(ang) * rr * .86, f.y + Math.sin(ang) * rr * .78 + fall * .9, rgb(c[0] * .55, c[1] * .55, c[2] * .6));
        }
      }
      // gulls by day
      if (q < .18 || q > .95) {
        const ink = col(70, 72, 84);
        for (let i = 0; i < 6; i++) {
          const X = (h1(i + 3) * W + t * (10 + i * 2)) % W, Y = 40 + h1(i + 5) * 70 + Math.sin(t * 1.5 + i) * 3, fl = Math.floor(t * 6 + i) % 2;
          pPlot(X, Y, ink); pPlot(X - 1, Y - fl, ink); pPlot(X + 1, Y - fl, ink); pPlot(X - 2, Y - fl * 2 + 1, ink); pPlot(X + 2, Y - fl * 2 + 1, ink);
        }
      }
    },
  };
}
