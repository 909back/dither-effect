import { For } from 'solid-js';
import { PALETTE_PRESETS, options, setOptions } from '../store';
import styles from './PalettePresets.module.scss';

const MAX_COLORS = 8;

function same(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i]!.toLowerCase());
}

export default function PalettePresets() {
  const setColor = (i: number, hex: string) => setOptions('palette', (p) => p.map((c, j) => (j === i ? hex : c)));

  return (
    <div class={styles.root}>
      <div class={styles.presets}>
        <For each={PALETTE_PRESETS}>
          {(preset) => (
            <button
              type="button"
              class={styles.preset}
              aria-pressed={same(options.palette, preset.colors)}
              onClick={() => setOptions('palette', [...preset.colors])}
            >
              <span class={styles.strip}>
                <For each={preset.colors}>{(c) => <span style={{ background: c }} />}</For>
              </span>
              <span class={styles.name}>{preset.name}</span>
            </button>
          )}
        </For>
      </div>

      <div class={styles.current}>
        <For each={options.palette}>
          {(color, i) => (
            <div class={styles.swatch}>
              <input
                type="color"
                value={color}
                aria-label={`Colour ${i() + 1}`}
                onInput={(e) => setColor(i(), e.currentTarget.value)}
              />
              <button
                type="button"
                class={styles.remove}
                aria-label={`Remove colour ${i() + 1}`}
                disabled={options.palette.length <= 2}
                onClick={() => setOptions('palette', (p) => p.filter((_, j) => j !== i()))}
              >
                ×
              </button>
            </div>
          )}
        </For>
        <button
          type="button"
          class={styles.add}
          aria-label="Add colour"
          disabled={options.palette.length >= MAX_COLORS}
          onClick={() => setOptions('palette', (p) => [...p, '#808080'])}
        >
          +
        </button>
      </div>
    </div>
  );
}
