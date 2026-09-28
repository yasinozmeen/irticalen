import { useEffect, useRef } from 'preact/hooks';

interface Props {
  stream: MediaStream;
}

/**
 * The small live self-view while "kendini kaydet" is on with video. Bound via `srcObject`
 * imperatively (never a blob URL) — `<video src>` cannot play a live MediaStream.
 */
export function RecordingPreview({ stream }: Props) {
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
    <video ref={videoRef} class="recording-preview" autoPlay muted playsInline aria-hidden="true" />
  );
}
