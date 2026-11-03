import {
  W, H, SCENES, SCENE_SECONDS, FADE_IN, FADE_OUT, RAIL,
  clamp, lerp, renderScene, upscale, drawUI, state,
} from './renderer';

function startApp(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#c');
  if (!canvas) throw new Error('Canvas #c not found');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');

  // Preserve narrowed references inside the event handlers below.
  const view: HTMLCanvasElement = canvas;
  const ctx: CanvasRenderingContext2D = context;
  const totalDuration = SCENES.length * SCENE_SECONDS;
  let pixelScale = 1;
  let output: Uint32Array;
  let image: ImageData;
  let time = 0;
  let lastFrameTime = 0;
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dragging = false;
  let dirty = true;

  function resizeCanvas(): void {
    const deviceScale = window.devicePixelRatio || 1;
    const viewportScale = Math.min(innerWidth / W, innerHeight / H);
    pixelScale = Math.max(1, Math.floor(viewportScale * deviceScale));
    view.width = W * pixelScale;
    view.height = H * pixelScale;
    view.style.width = `${view.width / deviceScale}px`;
    view.style.height = `${view.height / deviceScale}px`;
    image = ctx.createImageData(view.width, view.height);
    output = new Uint32Array(image.data.buffer);
    ctx.imageSmoothingEnabled = false;
    dirty = true;
  }

  function draw(): void {
    const sceneIndex = Math.min(SCENES.length - 1, Math.floor(time / SCENE_SECONDS));
    const progress = (time - sceneIndex * SCENE_SECONDS) / SCENE_SECONDS;
    const sceneProgress = renderScene(sceneIndex, progress);
    upscale(output, pixelScale);
    drawUI(output, pixelScale, SCENES[sceneIndex], sceneIndex, sceneProgress, progress);
    ctx.putImageData(image, 0, 0);
    const background = state.bgMix > 0.55 ? 'rgb(14,18,44)' : '#fff';
    document.documentElement.style.background = document.body.style.background = background;
  }

  function frame(now: number): void {
    const elapsed = Math.min(0.1, (now - lastFrameTime) / 1000 || 0);
    lastFrameTime = now;
    if (playing && !dragging) {
      time = (time + elapsed) % totalDuration;
      dirty = true;
    }
    if (dirty) {
      draw();
      dirty = false;
    }
    requestAnimationFrame(frame);
  }

  // Convert pointer coordinates from the displayed canvas to its logical pixel grid.
  function pointerPosition(event: PointerEvent): { x: number; y: number } {
    const bounds = view.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / bounds.width * W,
      y: (event.clientY - bounds.top) / bounds.height * H,
    };
  }

  function seekFrom(event: PointerEvent): void {
    const { x } = pointerPosition(event);
    const position = clamp((x - RAIL.x - RAIL.thumb / 2) / (RAIL.w - RAIL.thumb));
    const sceneIndex = Math.min(SCENES.length - 1, Math.floor(time / SCENE_SECONDS));
    const progress = lerp(FADE_IN * 0.6, 1 - FADE_OUT * 0.6, position) * 0.999;
    time = (sceneIndex + progress) * SCENE_SECONDS;
    dirty = true;
  }

  view.addEventListener('pointerdown', event => {
    const { x, y } = pointerPosition(event);
    if (y < RAIL.y - 6 || y > RAIL.y + RAIL.h + 6 || x < RAIL.x - 4 || x > RAIL.x + RAIL.w + 4) return;
    dragging = true;
    view.setPointerCapture(event.pointerId);
    seekFrom(event);
  });
  view.addEventListener('pointermove', event => {
    if (dragging) seekFrom(event);
  });
  const endDrag = (): void => { dragging = false; };
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);

  addEventListener('keydown', event => {
    const sceneIndex = Math.floor(time / SCENE_SECONDS);
    if (event.code === 'Space') {
      playing = !playing;
      event.preventDefault();
    } else if (event.code === 'ArrowRight') {
      time = (sceneIndex + 1) % SCENES.length * SCENE_SECONDS;
    } else if (event.code === 'ArrowLeft') {
      time = (sceneIndex + SCENES.length - 1) % SCENES.length * SCENE_SECONDS;
    } else if (/^Digit[1-9]$/.test(event.code) && Number(event.code.slice(5)) <= SCENES.length) {
      time = (Number(event.code.slice(5)) - 1) * SCENE_SECONDS;
    } else {
      return;
    }
    dirty = true;
  });

  addEventListener('resize', resizeCanvas);
  resizeCanvas();
  if (!playing) time = 4;
  requestAnimationFrame(frame);
}

startApp();
