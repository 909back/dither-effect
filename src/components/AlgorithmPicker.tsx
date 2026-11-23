import { createEffect, For } from 'solid-js';
import { ALGORITHMS, dither, type Algorithm } from '../lib/dither';
import { ALGORITHM_LABELS, options, setOptions } from '../store';
import styles from './AlgorithmPicker.module.scss';

const RAMP_W = 64;
const RAMP_H = 14;

let ramp: ImageData | null = null;
/** A left-to-right black-to-white ramp, shared by every thumbnail. */
function getRamp(): ImageData {
  if (ramp) return ramp;
  ramp = new ImageData(RAMP_W, RAMP_H);
  for (let y = 0; y < RAMP_H; y++) {
    for (let x = 0; x < RAMP_W; x++) {
      const v = (x / (RAMP_W - 1)) * 255;
      const i = (y * RAMP_W + x) * 4;
      ramp.data[i] = ramp.data[i + 1] = ramp.data[i + 2] = v;
      ramp.data[i + 3] = 255;
    }
  }
  return ramp;
}

function Thumb(props: { algo: Algorithm }) {
  let canvas!: HTMLCanvasElement;
  createEffect(() => {
    const image = dither(getRamp(), {
      algo: props.algo,
      pixelSize: 1,
      brightness: 0,
      contrast: 0,
      palette: [...options.palette],
    });
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')!.putImageData(image, 0, 0);
  });
  return <canvas ref={canvas} class={styles.thumb} aria-hidden="true" />;
}

export default function AlgorithmPicker() {
  return (
    <div class={styles.grid}>
      <For each={ALGORITHMS}>
        {(algo) => (
          <label class={styles.option}>
            <input
              type="radio"
              name="algo"
              value={algo}
              checked={options.algo === algo}
              onChange={() => setOptions('algo', algo)}
            />
            <Thumb algo={algo} />
            <span class={styles.name}>{ALGORITHM_LABELS[algo]}</span>
          </label>
        )}
      </For>
    </div>
  );
}
