import type { DitherOptions } from './dither';
import type { WorkerRequest, WorkerResponse } from '../workers/dither.worker';

type Resolve = (img: ImageData | null) => void;

/**
 * Wraps the dither worker. At most one render is in flight, and the worker
 * answers each one in order, so a reply always belongs to `inFlight`. Calls
 * made while it runs replace each other, so only the latest options get
 * rendered next; superseded calls resolve with null.
 */
export class DitherClient {
  private worker = new Worker(new URL('../workers/dither.worker.ts', import.meta.url), { type: 'module' });
  private inFlight: Resolve | null = null;
  private queued: { options: DitherOptions; resolve: Resolve } | null = null;

  constructor() {
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const resolve = this.inFlight;
      this.inFlight = null;
      if (msg.type === 'result') resolve?.(msg.image);
      else {
        console.error(msg.message);
        resolve?.(null);
      }
      this.flush();
    };
  }

  /** Sends a copy: the caller keeps reading the image (export, sizes). */
  setSource(image: ImageData): void {
    this.worker.postMessage({ type: 'source', image } satisfies WorkerRequest);
  }

  render(options: DitherOptions): Promise<ImageData | null> {
    this.queued?.resolve(null);
    return new Promise((resolve) => {
      this.queued = { options, resolve };
      this.flush();
    });
  }

  dispose(): void {
    this.worker.terminate();
  }

  private flush(): void {
    if (this.inFlight || !this.queued) return;
    const { options, resolve } = this.queued;
    this.queued = null;
    this.inFlight = resolve;
    this.worker.postMessage({ type: 'render', options } satisfies WorkerRequest);
  }
}
