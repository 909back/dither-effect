/**
 * Pure dithering pipeline. No DOM access: safe to run in a Web Worker or Node.
 *
 * Pipeline:
 *   1. Downsample the source by `pixelSize` (block average).
 *   2. Convert to luminance (Rec.601) and apply contrast, then brightness.
 *   3. Quantize to N evenly spaced gray levels (N = palette length),
 *      using ordered thresholds or error diffusion.
 *   4. Map each level to the palette, sorted dark to light.
 *
 * The result is the downsampled size; the caller scales it up with
 * nearest-neighbour sampling.
 */

export const ALGORITHMS = [
  'bayer2',
  'bayer4',
  'bayer8',
  'halftone45',
  'floyd-steinberg',
  'atkinson',
] as const;

export type Algorithm = (typeof ALGORITHMS)[number];

export interface DitherOptions {
  algo: Algorithm;
  /** Size of one output pixel in source pixels. Integer >= 1. */
  pixelSize: number;
  /** -100..100, added after contrast (scaled to -255..255). */
  brightness: number;
  /** -100..100. */
  contrast: number;
  /** Hex colors (#rgb or #rrggbb). Order does not matter. */
  palette: readonly string[];
}

export interface ImageDataLike {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

type RGB = readonly [number, number, number];

export const HALFTONE_CELL = 6;

export function parseHex(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Standard contrast curve: factor = 259(C+255) / 255(259-C), C in -255..255. */
export function adjust(gray: number, brightness: number, contrast: number): number {
  const c = contrast * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  const v = factor * (gray - 128) + 128 + brightness * 2.55;
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Recursive Bayer index matrix of size n (power of two), values 0..n²-1. */
export function bayerMatrix(n: number): number[][] {
  if (n === 1) return [[0]];
  const half = bayerMatrix(n / 2);
  const h = n / 2;
  const m: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < h; x++) {
      const v = 4 * half[y]![x]!;
      m[y]![x] = v;
      m[y]![x + h] = v + 2;
      m[y + h]![x] = v + 3;
      m[y + h]![x + h] = v + 1;
    }
  }
  return m;
}

type ThresholdFn = (x: number, y: number) => number;

function bayerThreshold(n: number): ThresholdFn {
  const m = bayerMatrix(n);
  const area = n * n;
  return (x, y) => (m[y % n]![x % n]! + 0.5) / area;
}

/**
 * Dot screen rotated 45°: threshold in (0, 1), lowest at dot centres.
 * The two cosines depend only on x + y and x - y, so they are tabulated once
 * per image instead of computed twice per pixel.
 */
function halftoneThreshold(cell: number, width: number, height: number): ThresholdFn {
  const step = ((2 * Math.PI) / cell) * Math.SQRT1_2;
  const span = width + height;
  const cosSum = new Float64Array(span); // index x + y
  const cosDiff = new Float64Array(span); // index x - y + height
  for (let n = 0; n < span; n++) {
    cosSum[n] = Math.cos(step * n);
    cosDiff[n] = Math.cos(step * (n - height));
  }
  return (x, y) => {
    const t = 0.5 - 0.25 * (cosSum[x + y]! + cosDiff[x - y + height]!);
    return t < 0.001 ? 0.001 : t > 0.999 ? 0.999 : t;
  };
}

interface Downsampled {
  width: number;
  height: number;
  gray: Float32Array;
  alpha: Uint8ClampedArray;
}

function downsample(src: ImageDataLike, size: number, brightness: number, contrast: number): Downsampled {
  const width = Math.ceil(src.width / size);
  const height = Math.ceil(src.height / size);
  const gray = new Float32Array(width * height);
  const alpha = new Uint8ClampedArray(width * height);
  const d = src.data;

  for (let by = 0; by < height; by++) {
    const y0 = by * size;
    const y1 = Math.min(y0 + size, src.height);
    for (let bx = 0; bx < width; bx++) {
      const x0 = bx * size;
      const x1 = Math.min(x0 + size, src.width);
      let r = 0, g = 0, b = 0, a = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * src.width + x0) * 4;
        for (let x = x0; x < x1; x++, i += 4) {
          r += d[i]!;
          g += d[i + 1]!;
          b += d[i + 2]!;
          a += d[i + 3]!;
        }
      }
      const count = (x1 - x0) * (y1 - y0);
      const o = by * width + bx;
      gray[o] = adjust(luminance(r / count, g / count, b / count), brightness, contrast);
      alpha[o] = a / count;
    }
  }
  return { width, height, gray, alpha };
}

function orderedQuantize(img: Downsampled, levels: number, threshold: ThresholdFn): Uint8Array {
  const { width, height, gray } = img;
  const out = new Uint8Array(width * height);
  const steps = levels - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = (gray[i]! / 255) * steps;
      const base = Math.floor(v);
      const idx = v - base > threshold(x, y) ? base + 1 : base;
      out[i] = idx > steps ? steps : idx;
    }
  }
  return out;
}

/** [dx, dy, weight] taps. */
type Kernel = readonly (readonly [number, number, number])[];

const FLOYD_STEINBERG: Kernel = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16],
];

/** Atkinson diffuses 6/8 of the error; the remaining 1/4 is dropped. */
const ATKINSON: Kernel = [
  [1, 0, 1 / 8],
  [2, 0, 1 / 8],
  [-1, 1, 1 / 8],
  [0, 1, 1 / 8],
  [1, 1, 1 / 8],
  [0, 2, 1 / 8],
];

function diffuseQuantize(img: Downsampled, levels: number, kernel: Kernel): Uint8Array {
  const { width, height } = img;
  const buf = Float32Array.from(img.gray);
  const out = new Uint8Array(width * height);
  const steps = levels - 1;
  const step = 255 / steps;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = buf[i]!;
      let idx = Math.round(old / step);
      idx = idx < 0 ? 0 : idx > steps ? steps : idx;
      out[i] = idx;
      const err = old - idx * step;
      for (const [dx, dy, w] of kernel) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height) continue;
        buf[ny * width + nx]! += err * w;
      }
    }
  }
  return out;
}

function quantize(img: Downsampled, levels: number, algo: Algorithm): Uint8Array {
  switch (algo) {
    case 'bayer2':
      return orderedQuantize(img, levels, bayerThreshold(2));
    case 'bayer4':
      return orderedQuantize(img, levels, bayerThreshold(4));
    case 'bayer8':
      return orderedQuantize(img, levels, bayerThreshold(8));
    case 'halftone45':
      return orderedQuantize(img, levels, halftoneThreshold(HALFTONE_CELL, img.width, img.height));
    case 'floyd-steinberg':
      return diffuseQuantize(img, levels, FLOYD_STEINBERG);
    case 'atkinson':
      return diffuseQuantize(img, levels, ATKINSON);
  }
}

export function dither(source: ImageDataLike, options: DitherOptions): ImageData {
  if (options.palette.length === 0) throw new Error('Palette must contain at least one color');

  const size = Math.max(1, Math.floor(options.pixelSize));
  const img = downsample(source, size, options.brightness, options.contrast);
  const colors = options.palette
    .map(parseHex)
    .sort((a, b) => luminance(...a) - luminance(...b));

  const indices =
    colors.length === 1 ? new Uint8Array(img.width * img.height) : quantize(img, colors.length, options.algo);

  const result = new ImageData(img.width, img.height);
  const out = result.data;
  for (let i = 0, o = 0; i < indices.length; i++, o += 4) {
    const c = colors[indices[i]!]!;
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
    out[o + 3] = img.alpha[i]!;
  }
  return result;
}
