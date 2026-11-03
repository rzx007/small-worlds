import type { SceneContext, SceneDefinition } from '../renderer/scene-types';
// A real-time ten seconds at the pad: T-5 to T+5, arms back, ignition, and the rocket leaves through the top of the frame.
export function createScene(ctx: SceneContext): SceneDefinition {
  const { F_COVER, F_EMIT, F_NOSHADOW, F_WIND, G, H, LV, W, WORLD, Z, box, clamp, col, dbox, dome, dyn, fbm, fm, h1, h2, h3, lerp, mat, pDot, pGlow, pPlot, project, puff, ramp, roundCyl, roundLevel, set, setGrade, setRamp, setSun, soilSlab, sstep, state } = ctx;
  // Populated by build before frame updates.
  const R = {} as { beacon: number; black: number; blue: number; bunker: number; flame0: number; flame1: number; flame2: number; flame3: number; glass: number; ink: number; line: number; pad: number; padD: number; pipe: number; pit: number; red: number; road: number; sand: number; sand2: number; scorch: number; scrub: number; scrub2: number; smoke: number; smokeHot: number; smokeWarm: number; steel: number; tank: number; tower: number; towerW: number; truck: number; vent: number; water: number; white: number; whiteD: number };
  const PX = 74, PY = 74, BASEZ = G + 13, ROCKET_H = 118;
  const RK: number[] = [];
  const secs = (q: number) => -5 + q * 10;
  const lift = (T: number) => (T <= 0 ? 0 : .5 * 16.5 * T * T);
  const trench = (x: number, y: number) => (Math.abs(y - PY) < 7 && x > PX && x < 124) || (Math.abs(x - PX) < 7 && y > PY && y < 124);
  const onPad = (x: number, y: number) => { const dx = Math.abs(x - PX), dy = Math.abs(y - PY); return Math.max(dx, dy) < 44 && dx + dy < 66; };
  const BIRDS: [number, number, number][] = []; for (let i = 0; i < 11; i++) BIRDS.push([h1(i + 3), h1(i + 5), h1(i + 7)]);
  const ARMS = [{ z: G + 44, a0: 0 }, { z: G + 76, a0: .15 }, { z: G + 108, a0: .3 }];

  return {
    id: 'liftoff', title: 'LIFT-OFF', accent: [70, 110, 170], ticks: 10, majorEvery: 5,
    label: q => { const s = secs(q), a = Math.floor(Math.abs(s) + (s < 0 ? .999 : 0)); return 'T' + (s < 0 ? '-' : '+') + '00:' + String(a).padStart(2, '0'); },
    build() {
      R.sand = ramp([220, 192, 136]); R.sand2 = ramp([204, 174, 118]); R.scrub = ramp([116, 134, 72]); R.scrub2 = ramp([92, 114, 66]); R.road = ramp([120, 116, 112]); R.pad = ramp([196, 192, 182]); R.padD = ramp([164, 160, 152]); R.pit = ramp([58, 54, 56]);
      R.line = ramp([232, 186, 56]); R.ink = ramp([40, 40, 48]); R.white = ramp([244, 244, 240]); R.whiteD = ramp([214, 216, 220]); R.black = ramp([48, 48, 56]); R.red = ramp([204, 58, 46]); R.steel = ramp([130, 136, 146]); R.tower = ramp([206, 78, 52]); R.towerW = ramp([232, 228, 218]); R.bunker = ramp([176, 170, 156]); R.glass = ramp([64, 92, 124]); R.scorch = ramp([54, 50, 54]); R.pipe = ramp([206, 208, 210]); R.blue = ramp([64, 106, 170]); R.truck = ramp([232, 186, 56]); R.tank = ramp([238, 238, 234]);
      R.flame0 = ramp([255, 250, 214], true); R.flame1 = ramp([255, 206, 92], true); R.flame2 = ramp([250, 128, 44], true); R.flame3 = ramp([218, 66, 34], true);
      R.smoke = ramp([236, 234, 232]); R.smokeWarm = ramp([244, 196, 150]); R.smokeHot = ramp([250, 150, 84]); R.vent = ramp([226, 234, 244]); R.water = ramp([146, 196, 226]); R.beacon = ramp([230, 40, 40], true);

      const sandA = mat(R.sand, { noise: .8, edge: 0 }), sandB = mat(R.sand2, { noise: .9, edge: 0 }), pad = mat(R.pad, { noise: .32, edge: 2, flags: F_COVER }), padD = fm(R.padD, 2.7, { edge: 0, flags: F_COVER }), road = mat(R.road, { noise: .5, edge: 0 }), line = mat(R.line, { edge: 0 });
      const onRoad = (x: number, y: number) => (y >= 8 && y <= 16 && x >= 4) || (x >= 8 && x <= 16 && y >= 8);
      soilSlab((x, y) => {
        if (onRoad(x, y)) return ((x + y) % 10 < 4 && (Math.abs(y - 12) < 1 || Math.abs(x - 12) < 1)) ? line : road;
        return fbm(x * .06, y * .06) + (h2(x, y) - .5) * .1 > .5 ? sandA : sandB;
      }, { soil: [132, 96, 62], humus: [104, 78, 58], deep: [96, 70, 54] });
      // dunes of scrub on the sand
      for (let i = 0; i < 700; i++) {
        const x = h1(i) * 150 | 0, y = h1(i + 2000) * 150 | 0;
        if (onPad(x, y) || onRoad(x, y) || trench(x, y) || trench(x + 4, y) || trench(x, y + 4)) continue;
        if (fbm(x * .08, y * .08) < .42 && i > 240) continue;
        const rr = .8 + h1(i + 4000) * 2, s2 = h1(i + 5000) > .5 ? R.scrub : R.scrub2;
        for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) {
          if (u * u + v * v > rr * rr + .5) continue;
          const lv = clamp(Math.round(2 + (-u * .6 + v * .2) + (h3(x + u, y + v, 1) - .5) * 1.4), 0, 5);
          set(x + u, y + v, G, fm(s2, lv, { edge: 1, flags: F_WIND }));
          if (u * u + v * v < rr * rr * .4) set(x + u, y + v, G + 1, fm(s2, Math.min(5, lv + 1), { edge: 1, flags: F_WIND }));
        }
      }
      // the pad: raised concrete with two flame trenches running toward the viewer
      for (let y = 0; y <= WORLD; y++) for (let x = 0; x <= WORLD; x++) {
        if (!onPad(x, y)) continue;
        for (let z = G - 1; z <= G + 2; z++) {
          if (trench(x, y)) { if (z <= G - 1) set(x, y, z, fm(R.pit, 1.4, { edge: 0 })); continue; }
          set(x, y, z, z === G + 2 && (x % 12 === 0 || y % 12 === 0) ? padD : pad);
        }
      }
      for (let i = 0; i < 16; i++) for (let k = 0; k < 360; k++) {
        const a = k / 360 * 6.283, rr = 30 + (i < 2 ? i : 0);
        if (i >= 2) continue;
        const X = PX + Math.cos(a) * rr | 0, Y = PY + Math.sin(a) * rr | 0;
        if (!trench(X, Y) && ((k / 8 | 0) % 2 === 0)) set(X, Y, G + 2, line);
      }
      // the launch table
      const tableM = mat(R.padD, { noise: .3 }), steel = mat(R.steel, { noise: .3 });
      box(PX - 16, PY - 16, G + 3, PX + 16, PY + 16, G + 11, tableM);
      for (let x = PX - 7; x <= PX + 7; x++) for (let y = PY - 7; y <= PY + 7; y++) for (let z = G + 3; z <= G + 11; z++) set(x, y, z, 0);
      for (let x = PX - 7; x <= PX + 7; x++) for (let y = PY - 7; y <= PY + 7; y++) set(x, y, G + 2, fm(R.pit, 1.2, { edge: 0 }));
      for (let x = PX - 16; x <= PX + 16; x += 2) { set(x, PY + 16, G + 11, line); set(PX + 16, x - PX + PY, G + 11, line); }
      // hold-downs
      for (const [a, b] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) box(PX + a - 1, PY + b - 1, G + 12, PX + a + 1, PY + b + 1, G + 13, fm(R.ink, 1.8, { edge: 2 }));
      // the service tower behind the rocket
      const TX0 = 40, TX1 = 54, TY0 = 66, TY1 = 80, TZ = 150;
      const towerAt = (z: number) => (Math.floor(z / 16) % 2 ? R.tower : R.towerW);
      for (let z = G + 3; z < TZ; z++) {
        const m = fm(towerAt(z), 3, { edge: 1 }), mD = fm(towerAt(z), 1.7, { edge: 1 });
        for (const [x, y, mm] of [[TX0, TY0, m], [TX1, TY0, mD], [TX0, TY1, m], [TX1, TY1, m]]) { set(x, y, z, mm); set(x + 1, y, z, mm); set(x, y + 1, z, mm); }
        const k = (z - G) % 16;
        if (k === 0) for (let i = 0; i <= 14; i++) { set(TX0 + i, TY1, z, m); set(TX1, TY0 + i, z, mD); set(TX0 + i, TY0, z, m); set(TX0, TY0 + i, z, m); }
        // cross bracing on the two faces you can see
        const d = k < 8 ? k * 14 / 8 : (16 - k) * 14 / 8;
        set(TX0 + d, TY1, z, m); set(TX0 + 14 - d, TY1, z, m); set(TX1, TY0 + d, z, mD); set(TX1, TY0 + 14 - d, z, mD);
      }
      for (let z = G + 16; z < TZ; z += 16) box(TX0, TY0, z, TX1, TY1, z, fm(R.steel, 3, { edge: 1 }));
      box(TX0 - 1, TY0 - 1, TZ, TX1 + 1, TY1 + 1, TZ + 1, fm(R.ink, 2.4, { edge: 2 }));
      box(TX0 + 6, TY0 + 6, TZ + 2, TX0 + 8, TY0 + 8, TZ + 30, fm(R.ink, 2.4, { edge: 1 }));
      // the elevator shaft, and the base of the tower
      box(TX0 + 5, TY0 + 5, G + 3, TX0 + 9, TY0 + 9, TZ - 1, fm(R.steel, 2.4, { edge: 1 }));
      box(TX0 - 3, TY0 - 3, G + 3, TX1 + 3, TY1 + 3, G + 6, tableM);
      // tanks with long pipes to the pad
      const tank = (cx: number, cy: number, r: number) => {
        for (const [a, b] of [[-r * .7, -r * .7], [r * .7, -r * .7], [-r * .7, r * .7], [r * .7, r * .7]]) box(cx + a, cy + b, G, cx + a, cy + b, G + r * .9, fm(R.steel, 2, { edge: 1 }));
        const zc = G + r + 3;
        for (let z = -r; z <= r; z++) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          const d = Math.hypot(x, y, z);
          if (d > r) continue;
          set(cx + x, cy + y, zc + z, fm(R.tank, clamp(Math.round(roundLevel(x / r, y / r, z / r) + .5), 0, 5), { edge: 2 }));
        }
      };
      tank(22, 28, 10); tank(44, 24, 8); tank(24, 54, 7);
      const pipeM = fm(R.pipe, 3.2, { edge: 1 }), pipeR = fm(R.red, 3, { edge: 1 });
      for (let x = 22; x <= 60; x++) { set(x, 40, G + 1, pipeM); set(x, 42, G + 1, pipeR); }
      for (let y = 40; y <= 58; y++) { set(60, y, G + 1, pipeM); set(62, y + 2, G + 1, pipeR); }
      // water tower for the deluge
      for (const [a, b] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) for (let z = 0; z < 44; z++) { const k = 1 - z / 110; set(126 + a * k, 22 + b * k, G + z, fm(R.steel, 2, { edge: 1 })); }
      for (let z = 8; z < 44; z += 9) { const k = 1 - z / 110; for (let i = -5; i <= 5; i++) { set(126 + i * k, 22 + 5 * k, G + z, fm(R.steel, 2, { edge: 1 })); set(126 + 5 * k, 22 + i * k, G + z, fm(R.steel, 2, { edge: 1 })); } }
      roundCyl(126, 22, G + 44, G + 56, 8, z => (z % 4 === 0 ? R.whiteD : R.white));
      dome(126, 22, G + 57, 8, 4, R.blue);
      for (let z = G; z < G + 44; z += 1) set(126, 22, z, pipeM);
      // the blockhouse, half buried
      const bunkerM = mat(R.bunker, { noise: .5 });
      box(14, 110, G, 44, 134, G + 7, bunkerM);
      box(16, 112, G + 8, 42, 132, G + 11, bunkerM);
      for (let x = 19; x <= 41; x += 6) box(x, 134, G + 3, x + 3, 134, G + 5, fm(R.glass, 2.6, { edge: 0 }));
      for (let y = 113; y <= 131; y += 6) box(44, y, G + 3, 44, y + 3, G + 5, fm(R.glass, 1.8, { edge: 0 }));
      box(20, 116, G + 12, 26, 120, G + 16, fm(R.steel, 3, { edge: 2 }));
      // radar post and floodlight masts
      box(133, 134, G, 134, 135, G + 18, fm(R.steel, 2.4, { edge: 1 }));
      for (const [x, y] of [[96, 34], [34, 96], [118, 58], [58, 118]]) {
        for (let z = 0; z < 56; z++) { set(x, y, G + z, fm(R.steel, 2.2, { edge: 1 })); if (z % 5 === 0) set(x + 1, y, G + z, fm(R.steel, 2.2, { edge: 1 })); }
        box(x - 3, y - 1, G + 56, x + 3, y + 1, G + 59, fm(R.ink, 2, { edge: 2 }));
        box(x - 2, y + 1, G + 57, x + 2, y + 1, G + 58, fm(R.white, 4.6, { edge: 0 }));
      }
      // fence and gate along the near edges
      const fp = fm(R.steel, 2.2, { edge: 1 });
      for (let i = 2; i <= 148; i++) { if (i % 10 === 2) { box(i, 148, G, i, 148, G + 4, fp); box(148, i, G, 148, i, G + 4, fp); } set(i, 148, G + 4, fp); set(148, i, G + 4, fp); }
      // the rocket is kept as a list and re-stamped as it climbs
      const lvlAt = (dx: number, dy: number, r: number) => { const d = Math.hypot(dx, dy) || 1; return clamp(Math.round(.9 + 3.3 * Math.max(0, (dx * LV[0] + dy * LV[1]) / d + .32)), 0, 5); };
      const radius = (z: number) => {
        if (z < 74) return 7.5;
        if (z < 78) return lerp(7.5, 6, (z - 74) / 4);
        if (z < 100) return 6;
        return 6 * Math.sqrt(Math.max(0, 1 - Math.pow((z - 100) / 20, 2)));
      };
      for (let z = 0; z < ROCKET_H + 3; z++) {
        const r = radius(z), RR = Math.ceil(r);
        for (let y = -RR; y <= RR; y++) for (let x = -RR; x <= RR; x++) {
          const d = Math.hypot(x, y);
          if (d > r || (d < r - 2 && z !== 0)) continue;
          const ang = Math.atan2(y, x), q4 = Math.floor((ang + Math.PI + .4) / (Math.PI / 2)) % 2;
          let rr = R.white;
          if (z < 6) rr = R.black;
          else if (z >= 6 && z < 22) rr = q4 ? R.black : R.white;
          else if (z >= 34 && z < 37) rr = R.red;
          else if (z >= 68 && z < 74) rr = q4 ? R.black : R.white;
          else if (z >= 74 && z < 78) rr = R.black;
          else if (z >= 92 && z < 94) rr = R.red;
          RK.push(x, y, z, fm(rr, lvlAt(x, y, r), { edge: 2 }));
        }
      }
      // a dark stripe of lettering down the side you can see
      for (let z = 42; z < 62; z++) if (z % 4 !== 3) for (let a = -1; a <= 1; a++) { RK.push(a * 2 - 3, 7, z, fm(R.black, 1.5, { edge: 2 })); RK.push(a * 2 - 2, 7, z, fm(R.black, 1.5, { edge: 2 })); }
      // fins
      for (let k = 0; k < 14; k++) {
        const w = Math.floor((14 - k) * .55);
        for (let a = 0; a <= w; a++) {
          RK.push(7 + a, 0, k, fm(R.black, 1.8, { edge: 2 })); RK.push(0, 7 + a, k, fm(R.black, 2.6, { edge: 2 })); RK.push(-7 - a, 0, k, fm(R.black, 2.6, { edge: 2 })); RK.push(0, -7 - a, k, fm(R.black, 1.8, { edge: 2 }));
        }
      }
      // engine bell
      for (let k = 1; k <= 4; k++) for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) { if (x * x + y * y <= (2 + k * .5) * (2 + k * .5)) RK.push(x, y, -k, fm(R.ink, 1.6, { edge: 1 })); }
    },
    update(q, t) {
      const T = secs(q);
      const ign = sstep(-.45, .1, T), bright = sstep(-.3, .3, T) * (1 - sstep(3.4, 5, T) * .85);
      setSun(-1, .35, .72, 1);
      setGrade([lerp(1, 1.03, bright), lerp(1, .97, bright), lerp(1, .9, bright)]);
      state.coverAmt = sstep(.2, 2.2, T) * .72; state.coverRamp = R.scorch; state.coverAll = false;
      setRamp(R.beacon, Math.floor(t * 3) % 2 ? [255, 70, 60] : [120, 40, 40]);
      const shakeAmt = sstep(-.5, .2, T) * (1 - sstep(3, 5, T));
      if (shakeAmt > 0) { const k = Math.floor(t * 22); state.shakeX = Math.round((h1(k + 20) - .5) * 3.6 * shakeAmt); state.shakeY = Math.round((h1(k + 50) - .5) * 2.6 * shakeAmt); }
      // the fuel truck clears the pad
      {
        const k = sstep(-5, -2.2, T), X = lerp(96, 12, k), body = fm(R.truck, 3.2, { edge: 2 }), tankM = fm(R.white, 3.2, { edge: 2 }), dark = fm(R.ink, 1.4, { edge: 1 });
        if (k < .99) {
          dbox(X, 10, G + 1, X + 6, 15, G + 5, body); dbox(X + 7, 10, G + 1, X + 22, 15, G + 6, tankM);
          dbox(X + 2, 15, G, X + 3, 15, G, dark); dbox(X + 10, 15, G, X + 11, 15, G, dark); dbox(X + 18, 15, G, X + 19, 15, G, dark);
        }
      }
      // rocket
      const rz = BASEZ + lift(T);
      if (rz < Z + 20) {
        const shiver = T > -.4 && T < 1 ? (Math.floor(t * 20) % 2) : 0;
        for (let i = 0; i < RK.length; i += 4) dyn(PX + RK[i] + shiver, PY + RK[i + 1], rz + RK[i + 2], RK[i + 3]);
        // a blinking beacon at the tip
        dyn(PX + shiver, PY, rz + 120, fm(R.beacon, 3, { edge: 0, flags: F_EMIT }));
      }
      // arms swing clear
      const swing = sstep(-3.3, -1.6, T);
      ARMS.forEach((a, i) => {
        const k = clamp(swing * 1.4 - a.a0 * .9);
        const ang = -k * 1.5, m = fm(R.tower, 3.2, { edge: 2 }), m2 = fm(R.ink, 1.8, { edge: 1 }), L = 14;
        for (let s = 0; s <= L; s++) {
          const X = 55 + Math.cos(ang) * s, Y = 73 + Math.sin(ang) * s;
          dyn(X, Y, a.z, m); dyn(X, Y + 1, a.z, m); dyn(X, Y, a.z + 1, m2); dyn(X, Y - 1, a.z, m); dyn(X, Y, a.z - 1, m2);
        }
      });
      // liquid oxygen boils off the side of the stack
      if (T < .1) for (let i = 0; i < 14; i++) {
        const k = (t * .6 + i / 14) % 1, str = 1 - sstep(-.6, .1, T), rr = (1 + k * 3.6) * str;
        if (rr < .7) continue;
        const z = rz + (i % 2 ? 72 : 92) + k * (i % 2 ? -3 : -2);
        puff(PX + 8 + k * 16 + h1(i) * 2, PY - 4 - k * 12, z, rr, R.vent, { seed: i, lift: 1, edge: 3, zMin: G });
      }
      // water floods the table just before ignition
      if (T > -1.4 && T < 3.8) for (let i = 0; i < 26; i++) {
        const k = (t * 1.5 + i / 26) % 1, str = sstep(-1.4, -1, T) * (1 - sstep(.5, 2, T)), a = i * .85;
        if (str <= 0) continue;
        const r0 = 14 + k * 9;
        puff(PX + Math.cos(a) * r0, PY + Math.sin(a) * r0, G + 4 + k * 14 - k * k * 16, (1 + k * 1.4) * str, R.water, { seed: i, lift: .8, edge: 0 });
      }
      // the flame
      if (ign > 0 && rz < Z + 40) {
        const fo = { edge: 0, flags: F_EMIT | F_NOSHADOW }, f0 = fm(R.flame0, 3, fo), f1 = fm(R.flame1, 3, fo), f2 = fm(R.flame2, 3, fo), f3 = fm(R.flame3, 3, fo);
        const bottom = rz - 4, full = 34 + Math.min(84, lift(T) * .6 + 22 * ign), tick = Math.floor(t * 16), len = full * ign * (T > 0 ? 1 : .55);
        for (let dz = 0; dz < len; dz++) {
          const f = dz / len;
          const rad = (dz < 6 ? 3 + dz * .75 : 7.5 * (1 - f * .84) * (1 + (h3(dz, tick, 3) - .5) * .35)), RR = Math.ceil(rad);
          for (let y = -RR; y <= RR; y++) for (let x = -RR; x <= RR; x++) {
            const d = Math.hypot(x, y) / (rad || 1);
            if (d > 1) continue;
            const z = bottom - dz;
            if (z < G + 3) continue;
            const hsh = h3(x + tick, y, dz);
            const zone = d + f * .85 + (hsh - .5) * .4;
            dyn(PX + x, PY + y, z, zone < .42 ? f0 : zone < .78 ? f1 : zone < 1.12 ? f2 : f3);
          }
        }
      }
      // smoke rolls out of both trenches and climbs back up around the pad
      if (T > -.55) {
        const birth = (i: number) => -.45 + i * .042, DIRS = [[1, 0], [0, 1]];
        for (let i = 0; i < 90; i++) {
          const age = T - birth(i);
          if (age < 0 || birth(i) > 2.8) continue;
          const life = 6;
          const k = clamp(age / life);
          const d = DIRS[i % 2], s = 1 - Math.pow(1 - k, 2.6), run = 18 + s * 62;
          const side = (h1(i + 3) - .5) * (10 + s * 44), up = s * (10 + h1(i + 9) * 30) + k * k * 22;
          const X = PX + d[0] * run + d[1] * side, Y = PY + d[1] * run + d[0] * side;
          const rr = 4 + s * 14 + h1(i + 8) * 2, thin = sstep(.55, 1, k);
          const warmK = age < .55 ? 2 : age < 1.3 ? 1 : 0, r0 = warmK === 2 ? R.smokeHot : warmK === 1 ? R.smokeWarm : R.smoke;
          if (thin < .97) puff(X, Y, G + 4 + up + rr * .3, rr, r0, { thin, seed: i, lift: .8 + (warmK ? .3 : 0), edge: 3, bump: .25, zMin: G });
        }
        // a collar around the table once the rocket clears it
        for (let i = 0; i < 26; i++) {
          const b = -.2 + i * .1, age = T - b;
          if (age < 0) continue;
          const k = clamp(age / 5), s = 1 - Math.pow(1 - k, 2.4), a = i * 2.4, run = 8 + s * 36;
          const rr = 4 + s * 10, thin = sstep(.55, 1, k);
          if (thin < .97) puff(PX + Math.cos(a) * run, PY + Math.sin(a) * run, G + 8 + s * 22, rr, age < .5 ? R.smokeWarm : R.smoke, { thin, seed: i + 90, lift: .9, edge: 3, bump: .25 });
        }
        // the trail hangs where the rocket passed
        for (let i = 0; i < 46; i++) {
          const b = .1 + i * .09;
          if (T < b) continue;
          const zz = BASEZ - 6 + lift(b), age = T - b, rr = 2.4 + age * 2.3 + h1(i + 40) * 2, thin = sstep(2.6, 6, age);
          if (zz > Z - 8 || thin >= .97) continue;
          puff(PX + Math.sin(i * 1.3) * age * .9 + age * 1.6, PY - age * .7, zz, rr, age < .3 ? R.smokeWarm : R.smoke, { thin, seed: i + 200, lift: .75, edge: 3, bump: .25 });
        }
      }
    },
    post(q, t) {
      const T = secs(q);
      const ign = sstep(-.45, .1, T);
      const rz = BASEZ + lift(T);
      if (ign > 0) {
        const [sx, sy] = project(PX, PY, Math.round(rz - 16));
        if (sy > -40 && sy < H + 40) {
          pGlow(sx, sy, 30, col(255, 214, 120), .75 * ign, { flat: 1, onBg: false, mix: .4 });
          pGlow(sx, sy, 12, col(255, 248, 210), 1 * ign, { flat: 1, onBg: false, mix: .7 });
        }
        const [gx, gy] = project(PX, PY, G + 3), fade = 1 - sstep(2.6, 4.6, T);
        if (fade > 0) pGlow(gx, gy, 96, col(255, 176, 96), .5 * ign * fade, { flat: .62, mix: .34 });
      }
      // sparks flung off the flame deflector
      if (T > -.4 && T < 2.4) {
        const dirs = [[1, 0], [0, 1]];
        for (let i = 0; i < 90; i++) {
          const k = ((t * 1.7 + h1(i)) % 1), d = dirs[i % 2], run = 18 + k * (60 + h1(i + 7) * 28), side = (h1(i + 2) - .5) * (10 + k * 18);
          const z = G + 3 + Math.sin(k * Math.PI) * (6 + h1(i + 3) * 24);
          pDot(PX + d[0] * run + d[1] * side, PY + d[1] * run + d[0] * side, z, k < .5 ? col(255, 226, 150) : col(255, 150, 60));
        }
      }
      // the radar turns until the end
      const [rx, ry] = project(133, 134, G + 19), ra = t * 2.6, ink = col(70, 76, 86), wht = col(226, 228, 228);
      for (let i = -7; i <= 7; i++) { const X = rx + Math.cos(ra) * i, Y = ry - 2 + Math.sin(ra) * i * .35 - (1 - (i / 7) * (i / 7)) * 2; pPlot(X, Y, i % 2 ? wht : ink); }
      // birds lift off the scrub at the first shake
      const dark = col(54, 50, 60);
      if (T > -1 && T < 2.5) {
        const k = (T + 1) / 3.5;
        for (const [a, b, c] of BIRDS) {
          const X = a * W + (a - .5) * k * 160, Y = 110 + b * 150 - k * (60 + c * 70), fl = Math.floor(t * 10 + a * 9) % 2;
          pPlot(X, Y, dark); pPlot(X - 1, Y - fl, dark); pPlot(X + 1, Y - fl, dark);
        }
      }
    },
  };
}
