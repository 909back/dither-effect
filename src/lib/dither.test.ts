import { describe, expect, it } from 'vitest';
import {
  ALGORITHMS,
  adjust,
  bayerMatrix,
  dither,
  parseHex,
  type DitherOptions,
  type ImageDataLike,
} from './dither';

const BW = ['#000000', '#ffffff'];

function solid(width: number, height: number, v: number, a = 255): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = a;
  }
  return { width, height, data };
}

function opts(partial: Partial<DitherOptions> = {}): DitherOptions {
  return { algo: 'bayer4', pixelSize: 1, brightness: 0, contrast: 0, palette: BW, ...partial };
}

function whiteRatio(img: ImageData): number {
  let white = 0;
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i] === 255) white++;
  return white / (img.width * img.height);
}

function colorsOf(img: ImageData): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < img.data.length; i += 4) s.add(`${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`);
  return s;
}

describe('parseHex', () => {
  it('parses short and long forms', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('0f380f')).toEqual([15, 56, 15]);
  });
  it('rejects invalid input', () => {
    expect(() => parseHex('#zzz')).toThrow();
  });
});

describe('bayerMatrix', () => {
  it.each([2, 4, 8])('size %i is a permutation of 0..n²-1', (n) => {
    const flat = bayerMatrix(n).flat().sort((a, b) => a - b);
    expect(flat).toEqual(Array.from({ length: n * n }, (_, i) => i));
  });
  it('matches the classic 2x2 layout', () => {
    expect(bayerMatrix(2)).toEqual([
      [0, 2],
      [3, 1],
    ]);
  });
});

describe('adjust', () => {
  it('is identity at zero', () => {
    expect(adjust(100, 0, 0)).toBeCloseTo(100);
  });
  it('clamps to 0..255', () => {
    expect(adjust(200, 100, 0)).toBe(255);
    expect(adjust(50, -100, 0)).toBe(0);
  });
  it('contrast pushes values away from the midpoint', () => {
    expect(adjust(200, 0, 50)).toBeGreaterThan(200);
    expect(adjust(60, 0, 50)).toBeLessThan(60);
    expect(adjust(200, 0, -100)).toBeCloseTo(128, 0);
  });
});

describe('dither', () => {
  it('downsamples by pixelSize, rounding up partial blocks', () => {
    const out = dither(solid(10, 7, 128), opts({ pixelSize: 4 }));
    expect([out.width, out.height]).toEqual([3, 2]);
  });

  it('does not mutate the input', () => {
    const src = solid(8, 8, 90);
    const before = src.data.slice();
    dither(src, opts({ algo: 'floyd-steinberg' }));
    expect(src.data).toEqual(before);
  });

  it.each(ALGORITHMS)('%s: black stays black, white stays white', (algo) => {
    expect(whiteRatio(dither(solid(16, 16, 0), opts({ algo })))).toBe(0);
    expect(whiteRatio(dither(solid(16, 16, 255), opts({ algo })))).toBe(1);
  });

  it.each(ALGORITHMS)('%s: only emits palette colors', (algo) => {
    const palette = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
    const src = solid(32, 32, 0);
    for (let i = 0; i < src.data.length; i += 4) src.data[i] = src.data[i + 1] = src.data[i + 2] = (i / 4) % 256;
    const used = colorsOf(dither(src, opts({ algo, palette })));
    const allowed = new Set(palette.map((h) => parseHex(h).join(',')));
    for (const c of used) expect(allowed.has(c)).toBe(true);
  });

  it.each(['bayer2', 'bayer4', 'bayer8', 'floyd-steinberg'] as const)(
    '%s: mid-gray renders ~50%% white',
    (algo) => {
      // 128 is just above the 127.5 midpoint.
      expect(whiteRatio(dither(solid(64, 64, 128), opts({ algo })))).toBeCloseTo(0.5, 1);
    },
  );

  it('bayer4 at 25% gray lights exactly 4 of 16 cells per tile', () => {
    const out = dither(solid(4, 4, 255 * 0.25), opts({ algo: 'bayer4' }));
    expect(whiteRatio(out)).toBe(4 / 16);
  });

  it('halftone45 coverage grows with brightness', () => {
    const dark = whiteRatio(dither(solid(60, 60, 64), opts({ algo: 'halftone45' })));
    const light = whiteRatio(dither(solid(60, 60, 192), opts({ algo: 'halftone45' })));
    expect(dark).toBeLessThan(0.4);
    expect(light).toBeGreaterThan(0.6);
  });

  it('atkinson loses error, so mid-gray is less balanced than floyd-steinberg', () => {
    const src = solid(64, 64, 100);
    const fs = whiteRatio(dither(src, opts({ algo: 'floyd-steinberg' })));
    const at = whiteRatio(dither(src, opts({ algo: 'atkinson' })));
    expect(fs).toBeCloseTo(100 / 255, 1);
    expect(at).toBeLessThan(fs);
  });

  it('brightness +100 turns mid-gray white, -100 turns it black', () => {
    expect(whiteRatio(dither(solid(8, 8, 128), opts({ brightness: 100 })))).toBe(1);
    expect(whiteRatio(dither(solid(8, 8, 128), opts({ brightness: -100 })))).toBe(0);
  });

  it('palette order does not matter (sorted by luminance)', () => {
    const src = solid(16, 16, 60);
    const a = dither(src, opts({ palette: ['#000', '#fff'] }));
    const b = dither(src, opts({ palette: ['#fff', '#000'] }));
    expect(b.data).toEqual(a.data);
  });

  it('single-color palette fills everything with that color', () => {
    const out = dither(solid(4, 4, 200), opts({ palette: ['#ff0000'] }));
    expect(colorsOf(out)).toEqual(new Set(['255,0,0']));
  });

  it('preserves averaged alpha', () => {
    const out = dither(solid(4, 4, 255, 64), opts({ pixelSize: 2 }));
    expect(out.data[3]).toBe(64);
  });

  it('is deterministic', () => {
    const src = solid(20, 20, 77);
    const o = opts({ algo: 'atkinson' });
    expect(dither(src, o).data).toEqual(dither(src, o).data);
  });
});
