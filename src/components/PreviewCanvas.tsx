import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { DitherClient } from '../lib/ditherClient';
import { drawUpscaled } from '../lib/canvas';
import { options, result, setResult, source } from '../store';
import styles from './PreviewCanvas.module.scss';

const DEBOUNCE_MS = 16;

type Zoom = 'fit' | 1 | 2 | 4;
const ZOOMS: { value: Zoom; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
];

export default function PreviewCanvas() {
  let canvas!: HTMLCanvasElement;
  let viewport!: HTMLDivElement;
  const client = new DitherClient();
  onCleanup(() => client.dispose());

  const [zoom, setZoom] = createSignal<Zoom>('fit');
  const [panning, setPanning] = createSignal(false);
  const zoomed = () => zoom() !== 'fit';
  const [room, setRoom] = createSignal({ width: 0, height: 0 });

  createEffect(
    on(source, (src) => {
      if (src) client.setSource(src.image);
    }),
  );

  createEffect(() => {
    const src = source();
    // Plain snapshot: reads every field (so all are tracked) and is cloneable for postMessage.
    const opts = { ...options, palette: [...options.palette] };
    if (!src) return;

    const timer = setTimeout(async () => {
      const image = await client.render(opts);
      if (!image) return;
      drawUpscaled(canvas, image, opts.pixelSize, src.image.width, src.image.height);
      setResult({ image, pixelSize: opts.pixelSize });
    }, DEBOUNCE_MS);
    onCleanup(() => clearTimeout(timer));
  });

  // Track the viewport's content box so Fit can pick a crisp scale.
  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setRoom({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewport);
    onCleanup(() => observer.disconnect());
  });

  // Keep the view centred when the zoom changes.
  createEffect(
    on(zoom, () => {
      queueMicrotask(() => {
        viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
        viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
      });
    }),
  );

  const canvasSize = () => {
    const z = zoom();
    const src = source();
    if (!src) return {};
    const { width, height } = src.image;
    if (z !== 'fit') return { width: `${width * z}px`, height: `${height * z}px` };

    // Fit: the largest whole number of screen pixels per output pixel, so the
    // dither pattern stays even. Below one, fall back to plain contain.
    const r = result();
    const box = room();
    if (!r || !box.width || !box.height) return {};
    const perPixel = Math.floor(Math.min(box.width / r.image.width, box.height / r.image.height));
    if (perPixel < 1) return {};
    const scale = perPixel / r.pixelSize;
    return { width: `${width * scale}px`, height: `${height * scale}px` };
  };

  let last = { x: 0, y: 0 };
  const onPointerDown = (e: PointerEvent) => {
    if (!zoomed() || e.button !== 0) return;
    setPanning(true);
    last = { x: e.clientX, y: e.clientY };
    viewport.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!panning()) return;
    viewport.scrollLeft -= e.clientX - last.x;
    viewport.scrollTop -= e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
  };
  const endPan = () => setPanning(false);

  return (
    <figure class={styles.frame}>
      <div
        ref={viewport}
        class={styles.viewport}
        classList={{ [styles.zoomed!]: zoomed(), [styles.panning!]: panning() }}
        tabindex={zoomed() ? 0 : undefined}
        aria-label={zoomed() ? 'Zoomed preview, use arrow keys to pan' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <canvas
          ref={canvas}
          class={styles.canvas}
          style={canvasSize()}
          role="img"
          aria-label="Dithered preview"
        />
      </div>
      <figcaption class={styles.footer}>
        <Show when={result()} fallback={<span />}>
          {(r) => (
            <span class={styles.meta}>
              {source()!.image.width} × {source()!.image.height} → {r().image.width} × {r().image.height} px
            </span>
          )}
        </Show>
        <div class={styles.zoom} role="group" aria-label="Zoom">
          <For each={ZOOMS}>
            {(z) => (
              <button type="button" aria-pressed={zoom() === z.value} onClick={() => setZoom(z.value)}>
                {z.label}
              </button>
            )}
          </For>
        </div>
      </figcaption>
    </figure>
  );
}
