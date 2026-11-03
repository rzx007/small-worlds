import type { SceneContext, SceneDefinition } from '../renderer/scene-types';

// A country station at dusk: the locomotive waits, then rolls out as lamps come on.
export function createScene(ctx: SceneContext): SceneDefinition {
  const { G, F_EMIT, box, soilSlab, gableX, blobTree, mat, fm, ramp, dbox, dyn, puff, sstep, lerp, setGrade, setSun, setRamp, state, project, pGlow, col } = ctx;
  const R = {} as Record<'grass' | 'ballast' | 'stone' | 'wall' | 'roof' | 'wood' | 'iron' | 'rail' | 'red' | 'green' | 'glass' | 'lamp' | 'smoke' | 'leaf' | 'cream', number>;
  const lamps: [number, number][] = [[30, 76], [70, 76], [110, 76], [137, 76]];
  const departure = (q: number) => 42 * sstep(.58, .96, q);
  const nightAt = (q: number) => sstep(.32, .78, q);
  return {
    id: 'station', title: 'STEAM STATION', accent: [164, 76, 52], ticks: 12, majorEvery: 3,
    label(q) { const minutes = Math.floor((17 * 60 + q * 240) / 10) * 10; return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; },
    accentAt(q) { const n = nightAt(q); return [lerp(164, 235, n), lerp(76, 180, n), lerp(52, 94, n)]; },
    build() {
      R.grass = ramp([124, 151, 90]); R.ballast = ramp([132, 128, 116]); R.stone = ramp([191, 179, 153]);
      R.wall = ramp([224, 201, 164]); R.roof = ramp([151, 72, 55]); R.wood = ramp([107, 73, 53]);
      R.iron = ramp([48, 54, 57]); R.rail = ramp([155, 157, 153]); R.red = ramp([170, 55, 45]);
      R.green = ramp([54, 100, 77]); R.glass = ramp([81, 118, 132], true); R.lamp = ramp([255, 221, 152], true);
      R.smoke = ramp([216, 214, 203]); R.leaf = ramp([79, 127, 76]); R.cream = ramp([237, 219, 176]);
      const grass = mat(R.grass, { noise: .7, edge: 0 }), gravel = mat(R.ballast, { noise: .8, edge: 0 });
      const stone = mat(R.stone, { noise: .25 }), wall = mat(R.wall, { noise: .25 }), wood = mat(R.wood), iron = mat(R.iron), rail = mat(R.rail), roof = R.roof;
      const glass = mat(R.glass, { flags: F_EMIT }), cream = mat(R.cream);
      soilSlab((_x, y) => y >= 87 && y <= 125 ? gravel : grass);
      // Station building, windows, tiled roof and broad platform.
      box(15, 22, G, 132, 80, G + 3, stone);
      box(32, 26, G + 4, 108, 55, G + 30, wall);
      gableX(32, 108, 26, 55, G + 31, roof, wall, { slope: .55, over: 2 });
      for (const x of [41, 57, 87, 101]) {
        box(x - 4, 55, G + 13, x + 4, 56, G + 24, wood);
        box(x - 3, 56, G + 14, x + 3, 56, G + 23, glass);
        box(x, 57, G + 14, x, 57, G + 23, wood);
      }
      box(67, 55, G + 4, 78, 56, G + 22, wood);
      box(69, 57, G + 14, 76, 57, G + 21, glass);
      // Platform canopy, bench, luggage and lamps.
      for (const x of [24, 52, 80, 108, 128]) box(x, 72, G + 4, x + 1, 73, G + 21, iron);
      box(20, 58, G + 21, 132, 77, G + 22, wood);
      box(19, 57, G + 23, 133, 78, G + 24, mat(roof));
      box(42, 66, G + 6, 58, 69, G + 7, wood); box(44, 67, G + 4, 45, 68, G + 5, iron); box(55, 67, G + 4, 56, 68, G + 5, iron);
      box(91, 67, G + 4, 97, 71, G + 9, wood); box(93, 67, G + 10, 95, 71, G + 10, cream);
      for (const [x, y] of lamps) { box(x, y, G + 4, x + 1, y + 1, G + 16, iron); box(x - 1, y - 1, G + 17, x + 2, y + 2, G + 20, glass); }
      // Sleepers and parallel steel rails run along the x axis.
      for (let x = 2; x <= 148; x += 7) box(x, 90, G, x + 2, 122, G + 1, wood);
      for (const y of [96, 116]) box(0, y, G + 2, 150, y + 1, G + 3, rail);
      for (const [x, y] of [[12, 16], [136, 17], [142, 52]] as [number, number][]) blobTree(x, y, G, { r: 6, trunk: 9, sets: [R.leaf], trunkM: wood, seed: x });
    },
    update(q, t) {
      const night = nightAt(q), shift = departure(q), x = 42 + shift;
      state.bgMix = night * .85;
      setGrade([lerp(1, .46, night), lerp(1, .48, night), lerp(.96, .68, night)]);
      setSun(-1, .35, lerp(.85, .45, night), lerp(1, .65, night));
      setRamp(R.glass, [lerp(81, 255, night), lerp(118, 205, night), lerp(132, 125, night)]);
      const dark = fm(R.iron, 2), red = fm(R.red, 3), green = fm(R.green, 3), steel = fm(R.rail, 3), cream = fm(R.cream, 3);
      // Engine points toward +x. All moving voxels use the dynamic journal.
      dbox(x, 99, G + 6, x + 44, 113, G + 9, dark);
      dbox(x + 2, 100, G + 10, x + 14, 112, G + 25, green); // cab
      dbox(x + 1, 99, G + 26, x + 16, 113, G + 27, dark);
      dbox(x + 5, 113, G + 17, x + 11, 113, G + 23, cream);
      // Rounded boiler assembled in cross-section along x.
      for (let dy = -6; dy <= 6; dy++) for (let dz = -6; dz <= 6; dz++) if (dy * dy + dz * dz <= 36) dbox(x + 15, 106 + dy, G + 17 + dz, x + 38, 106 + dy, G + 17 + dz, green);
      dbox(x + 38, 101, G + 12, x + 40, 111, G + 22, dark);
      dbox(x + 28, 104, G + 23, x + 32, 108, G + 32, dark);
      dbox(x + 27, 103, G + 32, x + 33, 109, G + 33, dark);
      dbox(x + 40, 99, G + 6, x + 43, 113, G + 8, red);
      for (const wx of [x + 8, x + 21, x + 33]) for (const y of [98, 114]) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (dx * dx + dz * dz <= 9) dyn(wx + dx, y, G + 7 + dz, dx === 0 && dz === 0 ? steel : dark);
      dbox(x - 21, 100, G + 6, x - 2, 112, G + 15, red); // tender
      dbox(x - 19, 101, G + 16, x - 4, 111, G + 18, dark);
      for (let i = 0; i < 6; i++) {
        const age = (t * .23 + i / 6) % 1;
        puff(x + 30 - age * 11, 106 + age * 5, G + 35 + age * 25, 2 + age * 4, R.smoke, { seed: i + 50, thin: age * .65, lift: .6 });
      }
    },
    post(q) {
      const night = nightAt(q);
      if (night <= 0) return;
      for (const [x, y] of lamps) { const [sx, sy] = project(x, y, G + 19); pGlow(sx, sy, 9, col(255, 211, 140), night * .7, { onBg: true, mix: .4 }); }
      const [sx, sy] = project(84 + departure(q), 106, G + 17);
      pGlow(sx, sy, 7, col(255, 226, 170), night * .8, { onBg: true, mix: .5 });
    },
  };
}
