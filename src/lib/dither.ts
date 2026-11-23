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

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

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

/** Bayer thresholds (m + 0.5) / n², flattened row-major so lookup is one index. */
function bayerTable(n: number): Float64Array {
  const m = bayerMatrix(n);
  const area = n * n;
  const table = new Float64Array(area);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) table[y * n + x] = (m[y]![x]! + 0.5) / area;
  return table;
}

/**
 * Dot screen rotated 45°: threshold in (0, 1), lowest at dot centres.
 * The two cosines depend only on x + y and x - y, so they are tabulated once
 * per image instead of computed twice per pixel.
 */
function halftoneQuantize(gray: Float32Array, width: number, height: number, steps: number, cell: number): Uint8Array {
  const step = ((2 * Math.PI) / cell) * Math.SQRT1_2;
  const span = width + height;
  const cosSum = new Float64Array(span); // index x + y
  const cosDiff = new Float64Array(span); // index x - y + height
  for (let n = 0; n < span; n++) {
    cosSum[n] = Math.cos(step * n);
    cosDiff[n] = Math.cos(step * (n - height));
  }
  const out = new Uint8Array(width * height);
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      let t = 0.5 - 0.25 * (cosSum[x + y]! + cosDiff[x - y + height]!);
      t = t < 0.001 ? 0.001 : t > 0.999 ? 0.999 : t;
      const v = (gray[i]! / 255) * steps;
      const base = Math.floor(v);
      const idx = v - base > t ? base + 1 : base;
      out[i] = idx > steps ? steps : idx;
    }
  }
  return out;
}

function bayerQuantize(gray: Float32Array, width: number, height: number, steps: number, n: number): Uint8Array {
  const table = bayerTable(n);
  const mask = n - 1; // n is a power of two
  const out = new Uint8Array(width * height);
  for (let y = 0, i = 0; y < height; y++) {
    const row = (y & mask) * n;
    for (let x = 0; x < width; x++, i++) {
      const v = (gray[i]! / 255) * steps;
      const base = Math.floor(v);
      const idx = v - base > table[row + (x & mask)]! ? base + 1 : base;
      out[i] = idx > steps ? steps : idx;
    }
  }
  return out;
}

/**
 * Source pixels averaged into `pixelSize` blocks, before brightness and
 * contrast. This is the only step that reads every source pixel, so callers
 * that re-render the same source at the same pixel size can keep it.
 */
export interface Downsampled {
  width: number;
  height: number;
  pixelSize: number;
  /** Rec.601 luminance per block, 0..255. */
  lum: Float64Array;
  alpha: Uint8ClampedArray;
}

export function downsample(src: ImageDataLike, pixelSize: number): Downsampled {
  const size = Math.max(1, Math.floor(pixelSize));
  const width = Math.ceil(src.width / size);
  const height = Math.ceil(src.height / size);
  const lum = new Float64Array(width * height);
  const alpha = new Uint8ClampedArray(width * height);
  const d = src.data;

  if (size === 1) {
    for (let o = 0, i = 0; o < lum.length; o++, i += 4) {
      lum[o] = luminance(d[i]!, d[i + 1]!, d[i + 2]!);
      alpha[o] = d[i + 3]!;
    }
    return { width, height, pixelSize: size, lum, alpha };
  }

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
      lum[o] = luminance(r / count, g / count, b / count);
      alpha[o] = a / count;
    }
  }
  return { width, height, pixelSize: size, lum, alpha };
}

/** `adjust` over a whole buffer, with the contrast factor computed once. */
function adjustAll(lum: Float64Array, brightness: number, contrast: number): Float32Array {
  const c = contrast * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  const offset = brightness * 2.55;
  const gray = new Float32Array(lum.length);
  for (let i = 0; i < lum.length; i++) {
    const v = factor * (lum[i]! - 128) + 128 + offset;
    gray[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return gray;
}

/*
 * Error diffusion. Each kernel is unrolled: the taps are fixed, and a loop over
 * a tap list costs more than the arithmetic it wraps. Both write into `buf`.
 */

/** Floyd–Steinberg: 7/16 right, 3/16 down-left, 5/16 down, 1/16 down-right. */
function floydSteinberg(buf: Float32Array, width: number, height: number, steps: number): Uint8Array {
  const out = new Uint8Array(width * height);
  const step = 255 / steps;
  for (let y = 0, i = 0; y < height; y++) {
    const down = y + 1 < height;
    for (let x = 0; x < width; x++, i++) {
      const old = buf[i]!;
      let idx = Math.round(old / step);
      idx = idx < 0 ? 0 : idx > steps ? steps : idx;
      out[i] = idx;
      const err = old - idx * step;
      const right = x + 1 < width;
      if (right) buf[i + 1]! += err * (7 / 16);
      if (down) {
        const b = i + width;
        if (x > 0) buf[b - 1]! += err * (3 / 16);
        buf[b]! += err * (5 / 16);
        if (right) buf[b + 1]! += err * (1 / 16);
      }
    }
  }
  return out;
}

/** Atkinson: 1/8 to six neighbours, so 6/8 of the error; the remaining 1/4 is dropped. */
function atkinson(buf: Float32Array, width: number, height: number, steps: number): Uint8Array {
  const out = new Uint8Array(width * height);
  const step = 255 / steps;
  for (let y = 0, i = 0; y < height; y++) {
    const down1 = y + 1 < height;
    const down2 = y + 2 < height;
    for (let x = 0; x < width; x++, i++) {
      const old = buf[i]!;
      let idx = Math.round(old / step);
      idx = idx < 0 ? 0 : idx > steps ? steps : idx;
      out[i] = idx;
      const e = (old - idx * step) * (1 / 8);
      const right1 = x + 1 < width;
      if (right1) buf[i + 1]! += e;
      if (x + 2 < width) buf[i + 2]! += e;
      if (down1) {
        const b = i + width;
        if (x > 0) buf[b - 1]! += e;
        buf[b]! += e;
        if (right1) buf[b + 1]! += e;
      }
      if (down2) buf[i + 2 * width]! += e;
    }
  }
  return out;
}

function quantize(gray: Float32Array, width: number, height: number, levels: number, algo: Algorithm): Uint8Array {
  const steps = levels - 1;
  switch (algo) {
    case 'bayer2':
      return bayerQuantize(gray, width, height, steps, 2);
    case 'bayer4':
      return bayerQuantize(gray, width, height, steps, 4);
    case 'bayer8':
      return bayerQuantize(gray, width, height, steps, 8);
    case 'halftone45':
      return halftoneQuantize(gray, width, height, steps, HALFTONE_CELL);
    // Error diffusion writes into `gray`; it is a fresh buffer per render.
    case 'floyd-steinberg':
      return floydSteinberg(gray, width, height, steps);
    case 'atkinson':
      return atkinson(gray, width, height, steps);
  }
}

/**
 * Dither an already downsampled source. `options.pixelSize` is ignored: the
 * block size is fixed by `downsample`.
 */
export function ditherDownsampled(img: Downsampled, options: DitherOptions): ImageData {
  if (options.palette.length === 0) throw new Error('Palette must contain at least one color');

  const gray = adjustAll(img.lum, options.brightness, options.contrast);
  const colors = options.palette
    .map(parseHex)
    .sort((a, b) => luminance(...a) - luminance(...b));

  const indices =
    colors.length === 1
      ? new Uint8Array(img.width * img.height)
      : quantize(gray, img.width, img.height, colors.length, options.algo);

  const result = new ImageData(img.width, img.height);
  const alpha = img.alpha;
  if (LITTLE_ENDIAN) {
    // One 32-bit write per pixel: RGB packed once per palette entry, alpha OR'd in.
    const packed = Uint32Array.from(colors, ([r, g, b]) => r | (g << 8) | (b << 16));
    const out = new Uint32Array(result.data.buffer, result.data.byteOffset, indices.length);
    for (let i = 0; i < indices.length; i++) out[i] = (packed[indices[i]!]! | (alpha[i]! << 24)) >>> 0;
  } else {
    const out = result.data;
    for (let i = 0, o = 0; i < indices.length; i++, o += 4) {
      const c = colors[indices[i]!]!;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = alpha[i]!;
    }
  }
  return result;
}

export function dither(source: ImageDataLike, options: DitherOptions): ImageData {
  if (options.palette.length === 0) throw new Error('Palette must contain at least one color');
  return ditherDownsampled(downsample(source, options.pixelSize), options);
}
