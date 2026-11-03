import type { ColorKeys, SceneContext, SceneDefinition } from '../renderer/scene-types';
// A farm through one year: blossom, wheat, harvest, falling leaves, then snow.
export function createScene(ctx: SceneContext): SceneDefinition {
  const { F_COVER, F_WATER, F_WIND, G, H, W, WORLD, blobTree, box, clamp, col, dbox, dome, dyn, fbm, fm, gD, gableX, gableY, h1, h2, h3, keyNum, keys, lerp, mat, pDot, pPlot, pix, project, puff, ramp, roundCyl, roundLevel, set, setGrade, setRamp, setSun, soilSlab, sstep, state, vn, when } = ctx;
  const MONTHS = ['MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB'];
  const R = {} as Record<'grassA' | 'grassB' | 'tuft' | 'dirt' | 'sand' | 'snow' | 'wheat' | 'water' | 'waterDeep' | 'wood' | 'bark' | 'fence' | 'barn' | 'barnRoof' | 'trim' | 'house' | 'houseRoof' | 'brick' | 'silo' | 'siloDark' | 'dome' | 'steel' | 'glass' | 'glow' | 'apple' | 'hay' | 'cow' | 'cowB' | 'pink' | 'smoke' | 'tractor' | 'tyre' | 'carrot' | 'duck', number> & { leaf: number[] };
  const LEAF_KEYS = (phase: number): ColorKeys => [
    [0, [226, 170, 188]], [.14 + phase, [238, 186, 200]], [.24 + phase, [120, 164, 72]], [.42, [84, 134, 60]],
    [.52 + phase, [120, 136, 56]], [.58 + phase, [214, 132, 44]], [.70, [196, 82, 40]], [1, [170, 70, 40]],
  ];
  const GRASS_KEYS: ColorKeys = [[0, [132, 160, 76]], [.14, [112, 164, 72]], [.34, [94, 142, 62]], [.5, [132, 142, 66]], [.66, [158, 134, 72]], [.8, [132, 118, 88]], [1, [128, 120, 104]]];
  const WHEAT_KEYS: ColorKeys = [[0, [116, 166, 70]], [.22, [116, 164, 64]], [.36, [202, 174, 72]], [.46, [228, 186, 80]], [1, [214, 176, 92]]];
  const inPond = (x: number, y: number, m = 0) => { const a = (x - 116) / (24 + m), b = (y - 56) / (15 + m); return a * a + b * b + (vn(x * .2, y * .2) - .5) * .25 < 1; };
  const FIELD = { x0: 76, x1: 144, y0: 86, y1: 144, passes: 5 };
  const TREES: [number, number][] = [];
  for (const x of [16, 34, 52]) for (const y of [66, 84, 102, 120, 138]) TREES.push([x + (y % 5), y]);
  const COWS = [[84, 62, .3], [93, 70, 1.4], [80, 74, 2.2], [90, 54, 4]];
  const BALES = [[86, 96], [104, 92], [122, 100], [92, 116], [112, 122], [130, 118], [100, 134], [122, 138]];

  return {
    id: 'seasons', title: 'FOUR SEASONS', accent: [108, 134, 78], ticks: 12, majorEvery: 3, baseShift: -22,
    label: q => MONTHS[Math.min(11, Math.floor(q * 12))],
    build() {
      R.grassA = ramp(GRASS_KEYS[0][1]); R.grassB = ramp(GRASS_KEYS[0][1]); R.tuft = ramp(GRASS_KEYS[0][1]);
      R.dirt = ramp([170, 140, 100]); R.sand = ramp([214, 192, 146]);
      R.snow = ramp([240, 244, 252]); R.wheat = ramp(WHEAT_KEYS[0][1]);
      R.water = ramp([72, 140, 170]); R.waterDeep = ramp([54, 112, 150]);
      R.wood = ramp([116, 88, 66]); R.bark = ramp([88, 68, 56]); R.fence = ramp([206, 190, 160]);
      R.barn = ramp([172, 62, 50]); R.barnRoof = ramp([96, 92, 100]); R.trim = ramp([240, 234, 220]);
      R.house = ramp([232, 216, 182]); R.houseRoof = ramp([84, 96, 118]); R.brick = ramp([150, 86, 66]);
      R.silo = ramp([188, 192, 196]); R.siloDark = ramp([150, 156, 164]); R.dome = ramp([120, 136, 150]);
      R.steel = ramp([96, 92, 92]); R.glass = ramp([70, 96, 128]); R.glow = ramp([70, 96, 128]);
      R.leaf = [ramp(LEAF_KEYS(0)[0][1]), ramp(LEAF_KEYS(0)[0][1]), ramp(LEAF_KEYS(0)[0][1])];
      R.apple = ramp([204, 46, 46]); R.hay = ramp([214, 178, 92]); R.cow = ramp([238, 234, 224]); R.cowB = ramp([52, 46, 50]); R.pink = ramp([230, 150, 160]);
      R.smoke = ramp([226, 226, 232]); R.tractor = ramp([206, 62, 44]); R.tyre = ramp([44, 40, 46]); R.carrot = ramp([232, 128, 44]);
      R.duck = ramp([246, 244, 236]);

      const grassA = mat(R.grassA, { noise: .75, edge: 0, flags: F_COVER }), grassB = mat(R.grassB, { noise: .75, edge: 0, flags: F_COVER });
      const dirt = mat(R.dirt, { noise: .85, edge: 0, flags: F_COVER }), sand = mat(R.sand, { noise: .7, edge: 0 });
      const soilField = mat(R.dirt, { noise: 1.1, edge: 0, flags: F_COVER });
      const onRoad = (x: number, y: number) => {
        const j = (vn(x * .18, y * .18) - .5) * 5;
        return (x + j > 62 && x + j < 72 && y > 40) || (y + j > 40 && y + j < 54 && x > 8 && x < 112);
      };
      soilSlab((x, y) => {
        if (inPond(x, y, 3)) return sand;
        if (x >= FIELD.x0 && x <= FIELD.x1 && y >= FIELD.y0 && y <= FIELD.y1) return soilField;
        if (onRoad(x, y)) return dirt;
        return fbm(x * .07, y * .07) + (h2(x, y) - .5) * .12 > .5 ? grassA : grassB;
      });
      // pond
      const waterS = mat(R.water, { edge: 0, flags: F_WATER }), waterD = mat(R.waterDeep, { edge: 0, flags: F_WATER });
      for (let y = 0; y <= WORLD; y++) for (let x = 0; x <= WORLD; x++) {
        if (!inPond(x, y)) continue;
        const deep = inPond(x, y, -6);
        set(x, y, G - 1, 0);
        set(x, y, G - 2, deep ? waterD : waterS);
      }
      // grass tufts and wild flowers
      const tuft = fm(R.tuft, 4, { edge: 0, flags: F_WIND | F_COVER }), tuft2 = fm(R.tuft, 2.5, { edge: 0, flags: F_WIND | F_COVER });
      for (let y = 0; y <= WORLD; y++) for (let x = 0; x <= WORLD; x++) {
        if (inPond(x, y, 3) || onRoad(x, y) || (x >= FIELD.x0 - 1 && x <= FIELD.x1 + 1 && y >= FIELD.y0 - 1 && y <= FIELD.y1 + 1)) continue;
        const r = h3(x, y, 77);
        if (r < .1) { when(0, .74 + h2(x, y) * .1); set(x, y, G, r < .05 ? tuft : tuft2); when(); }
        if (r > .992) { when(.06, .5); set(x, y, G, fm(r > .996 ? R.pink : R.trim, 4, { edge: 0 })); when(); }
      }
      // reeds at the pond edge
      const reed = fm(R.tuft, 2, { edge: 0, flags: F_WIND }), reedTop = fm(R.wood, 2, { edge: 0 });
      for (let i = 0; i < 40; i++) {
        const a = i * 2.399, x = 116 + Math.cos(a) * 24 | 0, y = 56 + Math.sin(a) * 15 | 0;
        if (h1(i + 7) < .55) continue;
        const hh = 3 + h1(i) * 4 | 0;
        for (let z = 0; z < hh; z++) set(x, y, G - 1 + z, reed);
        set(x, y, G - 1 + hh, reedTop);
      }
      // barn, plank walls with a white-trimmed door
      const plank = (x: number, y: number, z: number) => { const on = (x + y) % 4 === 0; return on ? barnD : barnM; };
      const barnM = mat(R.barn, { noise: .35 }), barnD = fm(R.barn, 1.2, { edge: 2 }), trim = mat(R.trim);
      box(14, 10, G, 50, 36, G + 18, plank);
      gableX(14, 50, 10, 36, G + 19, R.barnRoof, barnM, { over: 2, slope: .78 });
      box(26, 36, G, 38, 36, G + 13, (x, y, z) => (x === 26 || x === 38 || z === G + 13 || x - 26 === z - G || 38 - x === z - G ? trim : barnD));
      box(30, 36, G + 15, 34, 36, G + 18, fm(R.glass, 1.5));
      box(50, 18, G + 7, 50, 28, G + 15, (x, y, z) => (y === 18 || y === 28 || z === G + 7 || z === G + 15 ? trim : barnD));
      box(13, 37, G, 51, 37, G, trim);
      // silo
      roundCyl(60, 18, G, G + 40, 7, z => (z % 6 === 0 ? R.siloDark : R.silo));
      dome(60, 18, G + 41, 7, 6, R.dome);
      // farmhouse
      const hw = mat(R.house, { noise: .25 });
      box(78, 12, G, 104, 32, G + 14, hw);
      gableY(78, 104, 12, 32, G + 15, R.houseRoof, hw, { over: 2, slope: .7 });
      const win = fm(R.glow, 3, { edge: 0 });
      for (const x of [83, 92, 99]) { box(x, 32, G + 6, x + 3, 32, G + 11, trim); box(x + 1, 32, G + 7, x + 2, 32, G + 10, win); }
      for (const y of [16, 24]) { box(104, y, G + 6, 104, y + 3, G + 11, trim); box(104, y + 1, G + 7, 104, y + 2, G + 10, win); }
      box(88, 33, G, 94, 34, G, trim); box(89, 32, G, 91, 32, G + 4, fm(R.wood, 2));
      const brick = mat(R.brick, { noise: .5 });
      box(84, 18, G + 18, 88, 22, G + 30, brick);
      // wind pump
      const steel = fm(R.steel, 2, { edge: 0 });
      for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) for (let z = 0; z < 44; z++) { const k = 1 - z / 58; set(130 + a * k, 22 + b * k, G + z, steel); }
      for (let z = 8; z < 44; z += 9) { const k = 1 - z / 58; for (let i = -3; i <= 3; i++) { set(130 + i * k, 22 + 3 * k, G + z, steel); set(130 + 3 * k, 22 + i * k, G + z, steel); } }
      // kitchen garden, wood pile, well
      const gardenSoil = mat(R.dirt, { noise: 1.2, edge: 0, flags: F_COVER }), sprout = fm(R.leaf[0], 3, { edge: 0, flags: F_COVER }), cabbage = fm(R.tuft, 3.5, { edge: 1, flags: F_COVER });
      for (let y = 8; y <= 30; y++) for (let x = 108; x <= 122; x++) {
        set(x, y, G - 1, gardenSoil);
        if (x % 4 === 1 && h2(x, y) > .25) { when(.08, .72); set(x, y, G, cabbage); if (h3(x, y, 3) > .5) set(x, y, G + 1, cabbage); when(); }
      }
      for (let y = 7; y <= 31; y++) { if (y % 6 === 1) box(107, y, G, 107, y, G + 3, fm(R.fence, 3, { edge: 2 })); set(107, y, G + 2, fm(R.fence, 3, { edge: 2 })); }
      for (let x = 107; x <= 123; x++) { if (x % 6 === 1) box(x, 31, G, x, 31, G + 3, fm(R.fence, 3, { edge: 2 })); set(x, 31, G + 2, fm(R.fence, 3, { edge: 2 })); }
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3 - a; b++) { const zz = G + a * 2; box(54, 42 + b * 3 + a, zz, 62, 43 + b * 3 + a, zz + 1, fm(R.wood, a % 2 ? 3 : 2.4, { edge: 2 })); }
      roundCyl(100, 42, G, G + 4, 3.4, R.silo); box(97, 41, G + 5, 97, 43, G + 11, fm(R.wood, 2, { edge: 2 })); box(103, 41, G + 5, 103, 43, G + 11, fm(R.wood, 2, { edge: 2 }));
      gableX(96, 104, 40, 44, G + 11, R.barnRoof, 0, { over: 1, slope: .7 });
      // fences
      const post = fm(R.fence, 3, { edge: 2 });
      for (let x = FIELD.x0 - 2; x <= FIELD.x1 + 2; x++) { if ((x - FIELD.x0) % 9 === 0) box(x, FIELD.y0 - 3, G, x, FIELD.y0 - 3, G + 4, post); set(x, FIELD.y0 - 3, G + 3, post); set(x, FIELD.y0 - 3, G + 1, post); }
      for (let y = 44; y <= 84; y++) { if (y % 9 === 0) box(74, y, G, 74, y, G + 4, post); set(74, y, G + 3, post); set(74, y, G + 1, post); }
      // wheat grows upward through spring, then falls to the combine row by row
      const fieldW = FIELD.x1 - FIELD.x0, fieldH = FIELD.y1 - FIELD.y0;
      for (let y = FIELD.y0; y <= FIELD.y1; y++) for (let x = FIELD.x0; x <= FIELD.x1; x++) {
        if (y % 4 === 3) continue;
        const pass = Math.min(FIELD.passes - 1, Math.floor((y - FIELD.y0) / (fieldH + 1) * FIELD.passes));
        const along = pass % 2 ? 1 - (x - FIELD.x0) / fieldW : (x - FIELD.x0) / fieldW;
        const cut = .50 + .12 * (pass + along) / FIELD.passes;
        const hh = 7 + h2(x, y) * 3 | 0;
        for (let k = 0; k < hh; k++) {
          const grow = lerp(.05, .34, (k + 1) / hh);
          when(grow, k === 0 ? .86 : cut);
          set(x, y, G + k, fm(R.wheat, clamp(1 + k * .42 + (h3(x, y, k) - .5) * 1.1, 0, 4.6) | 0, { edge: 0, flags: F_WIND | F_COVER }));
        }
      }
      when();
      // orchard
      const bark = mat(R.bark, { edge: 2, flags: F_COVER });
      TREES.forEach(([x, y], n) => {
        blobTree(x, y, G, {
          r: 8.5, trunk: 7, sets: R.leaf, trunkM: bark, seed: n * 13 + 3, flags: F_COVER,
          when: (X, Y, z) => [.005 + .05 * h3(X, Y, z), .60 + .13 * h3(X + 4, Y, z)],
        });
        for (let i = 0; i < 16; i++) { // apples
          const a = h1(n * 31 + i) * 6.283, zz = G + 10 + h1(n * 17 + i) * 11;
          when(.3 + h1(i) * .08, .54 + h1(i + 3) * .08);
          set(x + Math.cos(a) * 9.5, y + Math.sin(a) * 9.5, zz, fm(R.apple, 3.4, { edge: 0 }));
        }
        when();
      });
      // the snowman waits for the last of the snow
      when(.86);
      dome(86, 62, G, 5, 4.5, R.snow); dome(86, 62, G + 5, 3.8, 3.6, R.snow); dome(86, 62, G + 9, 2.6, 2.6, R.snow);
      set(88, 63, G + 11, fm(R.carrot, 3, { edge: 0 })); set(86, 65, G + 10, fm(R.cowB, 1, { edge: 0 }));
      when();
    },
    update(q, t) {
      const grass = keys(GRASS_KEYS, q);
      setRamp(R.grassA, grass); setRamp(R.grassB, grass.map((v, i) => v * [1.1, 1.1, 1.02][i]));
      setRamp(R.tuft, grass.map((v, i) => v * [1.18, 1.16, 1.0][i]));
      setRamp(R.wheat, keys(WHEAT_KEYS, q));
      R.leaf.forEach((r, i) => setRamp(r, keys(LEAF_KEYS(i * .025), q)));
      const ice = sstep(.74, .84, q);
      state.waterAmp = 1 - ice; state.sparkle = lerp(.74, 2, ice);
      setRamp(R.water, keys([[0, [86, 156, 176]], [.74, [86, 156, 176]], [.84, [206, 226, 236]], [1, [214, 232, 242]]], q));
      setRamp(R.waterDeep, keys([[0, [62, 124, 160]], [.74, [62, 124, 160]], [.84, [186, 212, 228]], [1, [196, 220, 234]]], q));
      state.coverAmt = sstep(.72, .9, q) * 1.02; state.coverRamp = R.snow;
      state.windAmt = q > .74 ? .15 : .7;
      const on = sstep(.72, .78, q);
      setRamp(R.glow, [lerp(70, 255, on), lerp(96, 206, on), lerp(128, 112, on)]);
      // a low winter sun, a high summer one
      const lz = keyNum([[0, .78], [.4, .9], [.75, .6], [1, .52]], q), s = keyNum([[0, 1], [.7, 1], [.85, .75], [1, .7]], q);
      setSun(-1, .35, lz, s);
      if (q > .7) setGrade([lerp(1, .95, on), lerp(1, .97, on), lerp(1, 1.03, on)]);
      // cows until the first frost
      if (q < .72) for (const [x, y, ph] of COWS) {
        const X = x + Math.sin(t * .28 + ph) * 3, Y = y + Math.cos(t * .22 + ph) * 2, b = fm(R.cow, 3, { edge: 2 }), n = fm(R.cowB, 2, { edge: 1 });
        dbox(X, Y, G + 2, X + 7, Y + 2, G + 5, (b));
        dbox(X + 2, Y, G + 4, X + 4, Y + 2, G + 5, n);
        dbox(X + 7, Y, G + 4, X + 9, Y + 2, G + 6, b);
        dbox(X, Y, G, X, Y, G + 1, n); dbox(X + 6, Y + 2, G, X + 6, Y + 2, G + 1, n); dbox(X, Y + 2, G, X, Y + 2, G + 1, n); dbox(X + 6, Y, G, X + 6, Y, G + 1, n);
      }
      // ducks while the pond is open
      if (q < .74) for (let i = 0; i < 3; i++) {
        const a = t * .32 + i * 1.9, X = 116 + Math.cos(a) * 10, Y = 56 + Math.sin(a) * 6, d = fm(R.duck, 4, { edge: 2 });
        dbox(X, Y, G - 1, X + 2, Y + 1, G - 1, d); dbox(X + 2, Y, G, X + 2, Y, G + 1, d);
      }
      // the combine works the rows in pale red
      if (q > .49 && q < .63) {
        const k = clamp((q - .50) / .12) * FIELD.passes, pass = Math.min(FIELD.passes - 1, Math.floor(k)), along = k - pass;
        const fw = FIELD.x1 - FIELD.x0, fh = FIELD.y1 - FIELD.y0 + 1, X = FIELD.x0 + (pass % 2 ? 1 - along : along) * fw, Y = FIELD.y0 + (pass + .5) * fh / FIELD.passes;
        const body = fm(R.tractor, 3.2, { edge: 2 }), dark = fm(R.tyre, 1, { edge: 2 }), cab = fm(R.glass, 3, { edge: 2 });
        dbox(X - 6, Y - 4, G + 2, X + 6, Y + 4, G + 8, body); dbox(X - 2, Y - 2, G + 9, X + 3, Y + 2, G + 12, cab);
        dbox(X - 5, Y + 4, G, X - 2, Y + 5, G + 3, dark); dbox(X + 3, Y + 4, G, X + 6, Y + 5, G + 3, dark);
        dbox(X - 5, Y - 5, G, X - 2, Y - 4, G + 3, dark); dbox(X + 3, Y - 5, G, X + 6, Y - 4, G + 3, dark);
        const fx = pass % 2 ? -8 : 8;
        dbox(X + fx - 1, Y - 6, G + 1, X + fx + 1, Y + 6, G + 3, fm(R.hay, 3, { edge: 2 }));
      }
      // round bales are stamped each frame so the wheat underneath stays whole
      BALES.forEach(([x, y]) => {
        if (q < .61 + h2(x, y) * .05) return;
        for (let a = -5; a <= 5; a++) for (let z = -4; z <= 4; z++) for (let b = -3; b <= 3; b++) {
          if (a * a + z * z > 19) continue;
          const lvl = clamp(Math.round(roundLevel(a / 4.4, b / 12, z / 4.4) + ((a + z) % 2 ? .5 : -.1)), 0, 5);
          dyn(x + a, y + b, G + 4 + z, fm(R.hay, lvl, { edge: 1, flags: F_COVER }));
        }
      });
      // chimney smoke once the house is heated
      if (q > .7) for (let i = 0; i < 6; i++) {
        const k = ((t * .34 + i / 6) % 1), rr = 1.6 + k * 3.4;
        puff(86 - k * 4 + Math.sin(k * 8 + i) * 1.4, 20 + k * 6, G + 31 + k * 36, rr, R.smoke, { seed: i, lift: 1.4, bump: .15, edge: 3 });
      }
    },
    post(q, t) {
      // the wind pump's wheel turns in the plane facing the viewer
      const [wx, wy] = project(133, 25, G + 45), a0 = t * (q > .74 ? 2.4 : 5), blade = col(226, 222, 212), bladeD = col(120, 116, 112);
      const depth = 133 + 25 + G + 46;
      for (let i = 0; i < 10; i++) {
        const a = a0 + i * Math.PI / 5;
        for (let r = 2; r <= 10; r++) {
          const X = Math.round(wx + Math.cos(a) * r), Y = Math.round(wy + Math.sin(a) * r);
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          if (gD[Y * W + X] <= depth) pix[Y * W + X] = r > 3 ? (i % 2 ? blade : bladeD) : bladeD;
        }
      }
      pPlot(wx, wy, col(60, 56, 60));
      for (let i = 1; i <= 5; i++) { pPlot(wx - i, wy - i * .5, col(60, 56, 60)); }
      // falling leaves
      if (q > .56 && q < .8) for (let i = 0; i < 120; i++) {
        const tr = TREES[i % TREES.length], dur = .12, start = .56 + h1(i + 300) * .14, k = (q - start) / dur;
        if (k < 0 || k > 1) continue;
        const a = h1(i) * 6.283, r = h1(i + 2) * 9;
        const z = G + 19 + h1(i + 5) * 6 - k * (22 + h1(i + 5) * 6);
        const X = tr[0] + Math.cos(a) * r + k * 8 + Math.sin(k * 14 + i) * 1.5, Y = tr[1] + Math.sin(a) * r - k * 4;
        pDot(X, Y, Math.max(G, z), [col(226, 136, 46), col(196, 80, 40), col(236, 182, 72)][i % 3]);
      }
      // apple blossom drifting in spring
      if (q < .2) for (let i = 0; i < 60; i++) {
        const tr = TREES[i % TREES.length], k = ((q * 7 + h1(i + 60)) % 1), a = h1(i + 61) * 6.283;
        pDot(tr[0] + Math.cos(a) * 8 + k * 14, tr[1] + Math.sin(a) * 8 - k * 5, G + 18 - k * 18, col(252, 226, 234));
      }
      // a flock heads south
      if (q > .58 && q < .74) {
        const k = (q - .58) / .16, cx = lerp(340, 40, k), cy = lerp(44, 70, k), flap = Math.floor(t * 8) % 2, ink = col(58, 54, 66);
        for (let i = -3; i <= 3; i++) {
          const X = cx + Math.abs(i) * 7, Y = cy + i * 5;
          pPlot(X, Y, ink); pPlot(X - 1, Y - flap, ink); pPlot(X + 1, Y - flap, ink);
        }
      }
      // snow in the air
      const snow = sstep(.7, .76, q) * (1 - sstep(.95, 1, q) * .4);
      if (snow > 0) {
        const white = col(255, 255, 255), blue = col(214, 226, 244);
        for (let i = 0; i < 420 * snow; i++) {
          const speed = 26 + h1(i + 9) * 16, X = (h1(i) * W + Math.sin(t * 1.3 + i) * 3 + t * 4) % W, Y = (h1(i + 3) * H + t * speed) % H;
          const q2 = (Y | 0) * W + (X | 0);
          if (q2 >= 0 && q2 < W * H && gD[q2] >= 0) pix[q2] = white; else if (i % 3 === 0) pPlot(X, Y, blue);
        }
      }
    },
  };
}
