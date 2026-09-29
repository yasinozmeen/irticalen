import { useEffect, useRef, useState } from 'preact/hooks';
import type { Dictionary } from '../i18n';
import type { RecordingFile } from './useSelfRecording';
import { RecordingShareButton } from './RecordingShareButton';
import { recLog } from '../lib/recDebug';

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
  const [playFailed, setPlayFailed] = useState(false);

  // The panel replaces the button that opened it, so focus would otherwise drop to <body>.
  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div class="watch-panel">
      <video
        class="watch-panel-video"
        src={file.url}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          recLog(`İZLE: video hazır ${video.videoWidth}x${video.videoHeight} süre=${video.duration.toFixed(1)}sn`);
        }}
        onError={(event) => {
          const error = event.currentTarget.error;
          recLog(`İZLE HATASI: kod=${error?.code ?? '?'} ${error?.message ?? ''}`);
          setPlayFailed(true);
        }}
      />
      {/* Some browsers can record a format they then refuse to play inline — the file itself is
          fine, so point to the way that works (Photos / the downloaded file). */}
      {playFailed && (
        <p class="watch-panel-note">{shareInsteadOfDownload ? dict.record.watchFailedShare : dict.record.watchFailedDownload}</p>
      )}
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
