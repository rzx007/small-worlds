import type { SceneDefinition } from './scene-types';
import type { BuiltScene } from './types';
import { state } from './frame-state';

// One renderer owns these active aliases and the shared working buffers. Scene
// arrays persist on each built scene; scalar aliases are saved after build/post.
export class RendererContext {
  cur!: BuiltScene;
  grid!: Uint8Array; ap!: Uint8Array; va!: Uint8Array;
  mRamp!: Uint8Array; mL!: Float32Array; mF!: Uint8Array; mN!: Float32Array; mE!: Uint8Array;
  rampBase!: Float32Array; rampEmit!: Uint8Array; fmCache!: Map<string, number>;
  matCount!: number; rampCount!: number; staticTop!: number;
  readonly state = state;
  T = 0; curAp = 0; curVa = 255; dynMode = false;
  readonly pal: Uint32Array;
  readonly pix: Uint32Array;
  readonly gD: Int16Array; readonly gR: Uint8Array; readonly gL: Uint8Array;
  readonly gF: Uint8Array; readonly gE: Uint8Array;
  lastScene: BuiltScene | null = null;

  constructor(readonly N: number, readonly Z: number, readonly G: number, width: number, height: number, levels: number) {
    this.pal = new Uint32Array(128 * levels);
    this.pix = new Uint32Array(width * height);
    this.gD = new Int16Array(width * height); this.gR = new Uint8Array(width * height);
    this.gL = new Uint8Array(width * height); this.gF = new Uint8Array(width * height); this.gE = new Uint8Array(width * height);
  }

  useScene(s: BuiltScene): void {
    this.cur = s;
    this.grid = s.grid; this.ap = s.ap; this.va = s.va;
    this.mRamp = s.mRamp; this.mL = s.mL; this.mF = s.mF; this.mN = s.mN; this.mE = s.mE;
    this.rampBase = s.rampBase; this.rampEmit = s.rampEmit; this.fmCache = s.fmCache;
    this.matCount = s.matCount; this.rampCount = s.rampCount; this.staticTop = s.staticTop;
  }

  allocScene(def: SceneDefinition): asserts def is BuiltScene {
    const { N, Z, G } = this;
    Object.assign(def, {
      grid: new Uint8Array(N * N * Z), ap: new Uint8Array(N * N * Z), va: new Uint8Array(N * N * Z).fill(255),
      mRamp: new Uint8Array(256), mL: new Float32Array(256).fill(-1), mF: new Uint8Array(256), mN: new Float32Array(256), mE: new Uint8Array(256),
      rampBase: new Float32Array(128 * 3), rampEmit: new Uint8Array(128),
      fmCache: new Map<string, number>(), matCount: 1, rampCount: 0, staticTop: G,
    } satisfies Omit<BuiltScene, keyof SceneDefinition>);
  }

  saveCounts(): void {
    this.cur.matCount = this.matCount;
    this.cur.rampCount = this.rampCount;
    this.cur.staticTop = this.staticTop;
  }
}
