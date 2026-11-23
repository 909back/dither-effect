import type { DitherOptions } from './dither';
import type { WorkerRequest, WorkerResponse } from '../workers/dither.worker';

type Resolve = (img: ImageData | null) => void;

/**
 * Wraps the dither worker. At most one render is in flight. Calls made while
 * it runs replace each other, so only the latest options get rendered next;
 * superseded calls resolve with null.
 */
export class DitherClient {
  private worker = new Worker(new URL('../workers/dither.worker.ts', import.meta.url), { type: 'module' });
  private nextId = 0;
  private inFlight: { id: number; resolve: Resolve } | null = null;
  private queued: { options: DitherOptions; resolve: Resolve } | null = null;

  constructor() {
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const job = this.inFlight;
      if (!job || job.id !== msg.id) return;
      this.inFlight = null;
      if (msg.type === 'result') job.resolve(msg.image);
      else {
        console.error(msg.message);
        job.resolve(null);
      }
      this.flush();
    };
  }

  setSource(image: ImageData): void {
    this.post({ type: 'source', image });
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
    const id = ++this.nextId;
    this.inFlight = { id, resolve };
    this.post({ type: 'render', id, options });
  }

  private post(msg: WorkerRequest): void {
    this.worker.postMessage(msg);
  }
}
