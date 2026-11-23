/**
 * Procedural demo scene: a lit sphere over a perspective checker floor under a
 * sky gradient. Wide tonal range, soft and hard edges: a fair test for every
 * algorithm. No DOM access.
 */
type RGB = [number, number, number];

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createSampleImage(width = 960, height = 640): ImageData {
  const img = new ImageData(width, height);
  const d = img.data;

  const horizon = height * 0.6;
  const skyTop: RGB = [34, 44, 78];
  const skyLow: RGB = [236, 206, 172];
  const tileA: RGB = [214, 204, 188];
  const tileB: RGB = [96, 88, 82];

  const r = height * 0.27;
  const cx = width * 0.56;
  const cy = horizon - r * 0.35;
  const base: RGB = [226, 112, 58];
  const lx = -0.55, ly = -0.62, lz = 0.56;
  const ll = Math.hypot(lx, ly, lz);
  const L = [lx / ll, ly / ll, lz / ll] as const;

  const shadowX = cx + r * 0.45;
  const shadowY = cy + r * 0.98;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let c: RGB;

      if (y < horizon) {
        c = mix(skyTop, skyLow, Math.pow(y / horizon, 1.6));
      } else {
        const depth = (height * 0.9) / (y - horizon + 1);
        const u = ((x - width / 2) / width) * depth * 2.2;
        const v = depth;
        const checker = (Math.floor(u) + Math.floor(v)) & 1;
        c = checker ? tileA : tileB;
        c = mix(c, skyLow, clamp01(1 - (y - horizon) / (height * 0.35)) * 0.85);

        const sx = (x - shadowX) / (r * 1.25);
        const sy = (y - shadowY) / (r * 0.28);
        const s = clamp01(1 - Math.hypot(sx, sy));
        c = mix(c, [20, 18, 22], s * s * 0.75);
      }

      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      const n2 = nx * nx + ny * ny;
      if (n2 <= 1) {
        const nz = Math.sqrt(1 - n2);
        const diffuse = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        const rz = 2 * diffuse * nz - L[2];
        const spec = Math.pow(Math.max(0, rz), 28);
        const shade = 0.12 + 0.88 * diffuse;
        const edge = clamp01((1 - Math.sqrt(n2)) * r);
        const sphere: RGB = [
          base[0] * shade + spec * 255,
          base[1] * shade + spec * 255,
          base[2] * shade + spec * 255,
        ];
        c = mix(c, sphere, edge);
      }

      const i = (y * width + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  }
  return img;
}
