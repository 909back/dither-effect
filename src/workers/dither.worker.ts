/// <reference lib="webworker" />
import { ditherDownsampled, downsample, type DitherOptions, type Downsampled } from '../lib/dither';

export type WorkerRequest =
  | { type: 'source'; image: ImageData }
  | { type: 'render'; options: DitherOptions };

export type WorkerResponse = { type: 'result'; image: ImageData } | { type: 'error'; message: string };

declare const self: DedicatedWorkerGlobalScope;

// The source is sent once and kept here, so each slider tick only posts options.
let source: ImageData | null = null;
// Downsampling is the only step that reads every source pixel. Keep the last
// one so changes other than pixel size skip it.
let cached: Downsampled | null = null;

function reply(msg: WorkerResponse, transfer: Transferable[] = []): void {
  self.postMessage(msg, transfer);
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'source') {
    source = msg.image;
    cached = null;
    return;
  }
  // Every render gets exactly one reply, or the client would wait forever.
  if (!source) return reply({ type: 'error', message: 'No source image' });
  try {
    if (cached?.pixelSize !== Math.max(1, Math.floor(msg.options.pixelSize))) {
      cached = downsample(source, msg.options.pixelSize);
    }
    const image = ditherDownsampled(cached, msg.options);
    reply({ type: 'result', image }, [image.data.buffer]);
  } catch (err) {
    reply({ type: 'error', message: String(err) });
  }
};
