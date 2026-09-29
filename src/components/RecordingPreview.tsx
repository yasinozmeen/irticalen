import { useEffect, useRef } from 'preact/hooks';

interface Props {
  stream: MediaStream;
  /** Defaults to the viewport-fixed corner box (`TimerOverlay`'s own preview). The rich (open-book)
   * main screen passes `record-preview-corner` instead — anchored to `.page-right`'s own top corner,
   * not the viewport's, so it never overlaps the top bar (see `App.tsx`). */
  className?: string;
}

/**
 * The small live self-view while "kendini kaydet" is on with video. Bound via `srcObject`
 * imperatively (never a blob URL) — `<video src>` cannot play a live MediaStream.
 */
export function RecordingPreview({ stream, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      // Detach only — the stream's tracks are owned and stopped by useSelfRecording, not here.
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  return (
    <video ref={videoRef} class={className ?? 'recording-preview'} autoPlay muted playsInline aria-hidden="true" />
  );
}
