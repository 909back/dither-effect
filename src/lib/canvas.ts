const MAX_SOURCE_SIDE = 3000;

/** Decode a file into ImageData, shrinking very large images to keep memory bounded. */
export async function loadImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return ctx.getImageData(0, 0, w, h);
}

let scratch: HTMLCanvasElement | null = null;

/**
 * Draw a reduced-resolution result onto `target`, sized to the source,
 * upscaling each pixel to a `pixelSize` square with no smoothing.
 */
export function drawUpscaled(
  target: HTMLCanvasElement,
  image: ImageData,
  pixelSize: number,
  width: number,
  height: number,
): void {
  // One scratch canvas reused across calls: this runs on every slider tick.
  scratch ??= document.createElement('canvas');
  const tmp = scratch;
  if (tmp.width !== image.width) tmp.width = image.width;
  if (tmp.height !== image.height) tmp.height = image.height;
  tmp.getContext('2d')!.putImageData(image, 0, 0);

  // Resizing reallocates the backing store, so only do it when the size changes.
  if (target.width !== width) target.width = width;
  if (target.height !== height) target.height = height;
  const ctx = target.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(tmp, 0, 0, image.width * pixelSize, image.height * pixelSize);
}

export async function downloadPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG encoding failed');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
