import { useEffect, useRef, useState } from 'preact/hooks';
import type { Dictionary } from '../i18n';
import type { RecordingFile } from './useSelfRecording';

interface Props {
  file: RecordingFile;
  dict: Dictionary;
}

type ShareNavigator = Navigator & {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[] }) => Promise<void>;
};

/**
 * "kaydı paylaş": the phone's share sheet with the finished video — on an iPhone "Videoyu Kaydet"
 * puts it straight into Photos (a plain download lands in Files/iCloud), and it can go to any app.
 * Shown only where the browser can share files. The File is prepared as soon as the recording exists:
 * `navigator.share` must run inside the tap itself, with no await before it, or iOS refuses it.
 */
export function RecordingShareButton({ file, dict }: Props) {
  const [shareable, setShareable] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    setShareable(null);
    setFailed(false);
    const nav = navigator as ShareNavigator;
    if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return;
    void fetch(file.url)
      .then((response) => response.blob())
      .then((blob) => {
        const prepared = new File([blob], file.name, { type: blob.type || 'video/mp4' });
        if (aliveRef.current && nav.canShare?.({ files: [prepared] })) setShareable(prepared);
      })
      .catch(() => undefined);
    return () => {
      aliveRef.current = false;
    };
  }, [file.url, file.name]);

  if (!shareable) return null;

  const onShare = (): void => {
    const nav = navigator as ShareNavigator;
    setFailed(false);
    nav.share?.({ files: [shareable] }).catch((error: unknown) => {
      // Closing the sheet is an AbortError — not a failure worth telling anyone about.
      if ((error as { name?: string })?.name !== 'AbortError') setFailed(true);
    });
  };

  return (
    <>
      <button type="button" class="btn btn-secondary" onClick={onShare}>
        {dict.record.shareRecording}
      </button>
      {failed && <span class="record-download-inline-note">{dict.record.shareFailed}</span>}
    </>
  );
}
