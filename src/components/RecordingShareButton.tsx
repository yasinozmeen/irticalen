import { useEffect, useState } from 'preact/hooks';
import type { Dictionary } from '../i18n';
import type { RecordingFile } from './useSelfRecording';

interface Props {
  file: RecordingFile;
  dict: Dictionary;
  /** The one filled ink button of the screen (the watch panel) instead of an underlined link. */
  primary?: boolean;
}

type ShareNavigator = Navigator & {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[] }) => Promise<void>;
};

/**
 * Whether this device should hand the video to the share sheet instead of downloading it — checked
 * synchronously so the page can decide between "kaydı paylaş" and "kaydı indir" without the buttons
 * swapping a moment later.
 */
export function canShareVideoFiles(): boolean {
  try {
    // Phones/tablets only: a desktop share sheet (macOS, Windows) has no "save to files" entry, so
    // there the plain download stays.
    if (!window.matchMedia?.('(pointer: coarse)').matches) return false;
    const nav = navigator as ShareNavigator;
    if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
    return nav.canShare({ files: [new File([''], 'irticalen.mp4', { type: 'video/mp4' })] });
  } catch {
    return false;
  }
}

/**
 * "kaydı paylaş": the phone's share sheet with the finished video — on an iPhone "Videoyu Kaydet"
 * puts it straight into Photos (a plain download lands in Files/iCloud), and it can go to any app.
 * Used instead of the download link on a phone (the sheet offers saving to Files too) — see
 * `canShareVideoFiles`. The File is prepared as soon as the recording exists:
 * `navigator.share` must run inside the tap itself, with no await before it, or iOS refuses it.
 */
export function RecordingShareButton({ file, dict, primary }: Props) {
  const [shareable, setShareable] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  // This particular file can't go to the share sheet (e.g. a webm the phone won't accept) — the
  // plain download takes the button's place instead of leaving it disabled for good.
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    setShareable(null);
    setFailed(false);
    setUnsupported(false);
    const nav = navigator as ShareNavigator;
    if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') {
      setUnsupported(true);
      return;
    }
    // Built straight from the recording's Blob — no fetch of the blob URL (CSP `connect-src 'self'`
    // blocks that on the live site).
    try {
      const prepared = new File([file.blob], file.name, { type: file.blob.type || 'video/mp4' });
      if (nav.canShare({ files: [prepared] })) setShareable(prepared);
      else setUnsupported(true);
    } catch {
      setUnsupported(true);
    }
  }, [file.blob, file.name]);

  const onShare = (): void => {
    if (!shareable) return;
    const nav = navigator as ShareNavigator;
    setFailed(false);
    try {
      nav.share?.({ files: [shareable] }).catch((error: unknown) => {
        // Closing the sheet is an AbortError — not a failure worth telling anyone about.
        if ((error as { name?: string })?.name !== 'AbortError') setFailed(true);
      });
    } catch {
      setFailed(true);
    }
  };

  if (unsupported) {
    return (
      <a class={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`} href={file.url} download={file.name}>
        {dict.record.downloadRecording}
      </a>
    );
  }

  return (
    <>
      {/* Disabled only for the moment the file is being prepared (a local blob — near instant). */}
      <button type="button" class={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`} onClick={onShare} disabled={!shareable}>
        {dict.record.shareRecording}
      </button>
      {/* The sheet failed — the note says "try the download", so the download has to be right here. */}
      {failed && (
        <>
          <a class="btn btn-secondary" href={file.url} download={file.name}>
            {dict.record.downloadRecording}
          </a>
          <span class="record-download-inline-note">{dict.record.shareFailed}</span>
        </>
      )}
    </>
  );
}
