import { Show } from 'solid-js';
import ControlPanel from './components/ControlPanel';
import ImageDropzone from './components/ImageDropzone';
import PreviewCanvas from './components/PreviewCanvas';
import { source } from './store';
import styles from './App.module.scss';

export default function App() {
  return (
    <div class={styles.app}>
      <header class={styles.bar}>
        <h1 class={styles.title}>Dither</h1>
        <div class={styles.barActions}>
          <Show when={source()}>
            <ImageDropzone compact />
          </Show>
        </div>
      </header>
      <main class={styles.stage}>
        <Show when={source()} fallback={<ImageDropzone />}>
          <ImageDropzone>
            <PreviewCanvas />
          </ImageDropzone>
        </Show>
      </main>
      <aside class={styles.inspector} aria-label="Settings">
        <ControlPanel />
      </aside>
    </div>
  );
}
