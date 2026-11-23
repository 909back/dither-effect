// Node has no ImageData; provide the subset dither() relies on.
if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataPolyfill {
    readonly data: Uint8ClampedArray;
    readonly colorSpace = 'srgb' as const;
    constructor(readonly width: number, readonly height: number) {
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  }
  (globalThis as { ImageData: unknown }).ImageData = ImageDataPolyfill;
}
