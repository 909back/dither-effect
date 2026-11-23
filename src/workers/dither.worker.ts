/// <reference lib="webworker" />
import { dither, type DitherOptions } from '../lib/dither';

export type WorkerRequest =
  | { type: 'source'; image: ImageData }
  | { type: 'render'; id: number; options: DitherOptions };

export type WorkerResponse =
  | { type: 'result'; id: number; image: ImageData }
  | { type: 'error'; id: number; message: string };

declare const self: DedicatedWorkerGlobalScope;

// The source is sent once and kept here, so each slider tick only posts options.
let source: ImageData | null = null;

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'source') {
    source = msg.image;
    return;
  }
  if (!source) return;
  try {
    const image = dither(source, msg.options);
    self.postMessage({ type: 'result', id: msg.id, image } satisfies WorkerResponse, [image.data.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: String(err) } satisfies WorkerResponse);
  }
};
