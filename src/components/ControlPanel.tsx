import { drawUpscaled, downloadPng } from '../lib/canvas';
import { options, resetOptions, result, setOptions, source } from '../store';
import AlgorithmPicker from './AlgorithmPicker';
import PalettePresets from './PalettePresets';
import styles from './ControlPanel.module.scss';

type NumericKey = 'pixelSize' | 'brightness' | 'contrast';

function Slider(props: { key: NumericKey; label: string; min: number; max: number }) {
  const id = `slider-${props.key}`;
  return (
    <div class={styles.field}>
      <div class={styles.row}>
        <label for={id}>{props.label}</label>
        <output for={id} class={styles.value}>{options[props.key]}</output>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={1}
        value={options[props.key]}
        onInput={(e) => setOptions(props.key, e.currentTarget.valueAsNumber)}
      />
    </div>
  );
}

export default function ControlPanel() {
  async function exportPng() {
    const r = result();
    const src = source();
    if (!r || !src) return;
    const canvas = document.createElement('canvas');
    drawUpscaled(canvas, r.image, r.pixelSize, src.image.width, src.image.height);
    await downloadPng(canvas, `${src.name}-${options.algo}.png`);
  }

  return (
    <div class={styles.panel}>
      <div class={styles.scroll}>
        <fieldset class={styles.group}>
          <legend>Algorithm</legend>
          <AlgorithmPicker />
        </fieldset>

        <fieldset class={styles.group}>
          <legend>Adjust</legend>
          <Slider key="pixelSize" label="Pixel size" min={1} max={16} />
          <Slider key="brightness" label="Brightness" min={-100} max={100} />
          <Slider key="contrast" label="Contrast" min={-100} max={100} />
        </fieldset>

        <fieldset class={styles.group}>
          <legend>Palette</legend>
          <PalettePresets />
        </fieldset>
      </div>

      <div class={styles.actions}>
        <button type="button" class={styles.secondary} onClick={resetOptions}>
          Reset
        </button>
        <button type="button" class={styles.primary} disabled={!result()} onClick={exportPng}>
          Save PNG
        </button>
      </div>
    </div>
  );
}
