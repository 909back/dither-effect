import { createSignal, type JSX } from 'solid-js';
import { loadImageData } from '../lib/canvas';
import { setSource } from '../store';
import styles from './ImageDropzone.module.scss';

/**
 * Opens an image by file picker or drop.
 * - default: an empty-state panel with the picker button
 * - compact: just the button (for the top bar)
 * - with children: wraps them as a drop target, no button
 */
export default function ImageDropzone(props: { compact?: boolean; children?: JSX.Element }) {
  const [dragging, setDragging] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let input!: HTMLInputElement;

  async function load(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Only image files can be opened.');
      return;
    }
    setError(null);
    try {
      const image = await loadImageData(file);
      setSource({ image, name: file.name.replace(/\.[^.]+$/, '') });
    } catch {
      setError('Couldn’t read that image. Try another file.');
    }
  }

  const wrapping = () => props.children !== undefined;

  return (
    <div
      class={styles.zone}
      classList={{
        [styles.compact!]: props.compact,
        [styles.wrap!]: wrapping(),
        [styles.dragging!]: dragging(),
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void load(e.dataTransfer?.files[0]);
      }}
    >
      {wrapping() ? (
        props.children
      ) : (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            tabindex={-1}
            aria-hidden="true"
            class="visually-hidden"
            onChange={(e) => {
              void load(e.currentTarget.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          <button
            type="button"
            class={styles.button}
            classList={{ [styles.primary!]: !props.compact }}
            onClick={() => input.click()}
          >
            {props.compact ? 'Open another image' : 'Choose image'}
          </button>
          {!props.compact && <span class={styles.hint}>or drop an image here</span>}
        </>
      )}
      {error() && (
        <p class={styles.error} role="alert">
          {error()}
        </p>
      )}
    </div>
  );
}
