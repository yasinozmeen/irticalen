import { useEffect, useRef } from 'preact/hooks';
import type { Dictionary } from '../i18n';
import type { RecordingFile } from './useSelfRecording';
import { RecordingShareButton } from './RecordingShareButton';

interface Props {
  file: RecordingFile;
  dict: Dictionary;
  /** A phone's share sheet (it also saves to Photos/Files) instead of a plain download link. */
  shareInsteadOfDownload: boolean;
  onBack: () => void;
}

/**
 * "kaydı izle": the finished take played back right inside the timer dialog — same in-place swap as
 * the share panel — so the speaker sees it before deciding to keep or send it. The file never leaves
 * the device; the video element just points at the local blob URL.
 */
export function RecordingWatchPanel({ file, dict, shareInsteadOfDownload, onBack }: Props) {
  const backRef = useRef<HTMLButtonElement>(null);

  // The panel replaces the button that opened it, so focus would otherwise drop to <body>.
  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div class="watch-panel">
      {/* `#t=0.1`: iOS shows nothing before play with a bare blob URL; a start fragment makes it
          paint the first frame (the template's intro) as the poster. */}
      <video class="watch-panel-video" src={`${file.url}#t=0.1`} controls playsInline preload="metadata" />
      <div class="watch-panel-actions">
        {shareInsteadOfDownload ? (
          <RecordingShareButton file={file} dict={dict} primary />
        ) : (
          <a class="btn btn-primary" href={file.url} download={file.name}>
            {dict.record.downloadRecording}
          </a>
        )}
        <button ref={backRef} type="button" class="btn btn-secondary watch-panel-back" onClick={onBack}>
          {dict.record.watchBack}
        </button>
      </div>
      <p class="watch-panel-note">{dict.record.downloadNote}</p>
    </div>
  );
}
