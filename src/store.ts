import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { Algorithm, DitherOptions } from './lib/dither';
import { createSampleImage } from './lib/sample';

export interface PalettePreset {
  name: string;
  colors: string[];
}

export const PALETTE_PRESETS: PalettePreset[] = [
  { name: '1-bit', colors: ['#000000', '#ffffff'] },
  { name: 'Ink', colors: ['#1b1b2f', '#f4f1e8'] },
  { name: 'Green LCD', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { name: 'Sepia', colors: ['#2b1d0e', '#6b4a2b', '#b98b5e', '#f2e2c4'] },
  { name: 'Gray 4', colors: ['#000000', '#555555', '#aaaaaa', '#ffffff'] },
  { name: 'Blueprint', colors: ['#0b2a5b', '#e8f1ff'] },
];

export const ALGORITHM_LABELS: Record<Algorithm, string> = {
  bayer2: 'Bayer 2×2',
  bayer4: 'Bayer 4×4',
  bayer8: 'Bayer 8×8',
  halftone45: 'Halftone 45°',
  'floyd-steinberg': 'Floyd–Steinberg',
  atkinson: 'Atkinson',
};

export const DEFAULT_OPTIONS: DitherOptions = {
  algo: 'bayer4',
  pixelSize: 3,
  brightness: 0,
  contrast: 0,
  palette: PALETTE_PRESETS[0]!.colors,
};

/** A fresh copy, so edits to the store's palette never reach DEFAULT_OPTIONS. */
const defaultOptions = (): DitherOptions => ({ ...DEFAULT_OPTIONS, palette: [...DEFAULT_OPTIONS.palette] });

export const [options, setOptions] = createStore<DitherOptions>(defaultOptions());

export function resetOptions(): void {
  setOptions(defaultOptions());
}

/** Full-resolution source pixels, plus a name used for the export filename. */
export const [source, setSource] = createSignal<{ image: ImageData; name: string } | null>(
  typeof ImageData === 'undefined' ? null : { image: createSampleImage(), name: 'sample' },
);

/** Last dithered result at reduced resolution, with the pixel size it was made at. */
export const [result, setResult] = createSignal<{ image: ImageData; pixelSize: number } | null>(null);
